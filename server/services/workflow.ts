import { and, eq } from "drizzle-orm";
import {
  approvalActions,
  auditLogs,
  leaveBalances,
  leaveRequests,
  users,
  type LeaveRequest,
  type Role,
  type User,
} from "../../drizzle/schema";
import { queueNotifications } from "./notifications";

export const TERMINAL_STATUSES = [
  "Approved",
  "Rejected by Manager",
  "Rejected by General Manager",
  "Rejected by HR",
  "Cancelled",
] as const;

export type Decision = "approve" | "reject";

export class WorkflowError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST", message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

function isTerminal(status: string) {
  return TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number]);
}

function ensureDecisionComment(comment?: string) {
  const normalized = comment?.trim() ?? "";
  if (normalized.length > 500) throw new WorkflowError("BAD_REQUEST", "Comment must be 500 characters or fewer.");
  return normalized || null;
}

async function getUser(tx: any, id: number | null | undefined): Promise<User | null> {
  if (!id) return null;
  const rows = await tx.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

function nextTransition(request: LeaveRequest, decision: Decision) {
  if (request.currentStage === "manager") {
    return decision === "approve"
      ? { status: "Pending General Manager Approval" as const, currentStage: "general_manager" as const, terminal: false }
      : { status: "Rejected by Manager" as const, currentStage: "complete" as const, terminal: true };
  }
  if (request.currentStage === "general_manager") {
    return decision === "approve"
      ? { status: "Pending HR Approval" as const, currentStage: "hr" as const, terminal: false }
      : { status: "Rejected by General Manager" as const, currentStage: "complete" as const, terminal: true };
  }
  if (request.currentStage === "hr") {
    return decision === "approve"
      ? { status: "Approved" as const, currentStage: "complete" as const, terminal: true }
      : { status: "Rejected by HR" as const, currentStage: "complete" as const, terminal: true };
  }
  throw new WorkflowError("CONFLICT", "This request is already complete and cannot receive another decision.");
}

function checkActor(request: LeaveRequest, actor: User) {
  if (request.currentStage === "manager" && (actor.role !== "manager" || actor.id !== request.directManagerId)) {
    throw new WorkflowError("FORBIDDEN", "Only the assigned Direct Manager can act at this stage.");
  }
  if (request.currentStage === "general_manager" && (actor.role !== "general_manager" || actor.id !== request.generalManagerId)) {
    throw new WorkflowError("FORBIDDEN", "Only the assigned General Manager can act at this stage.");
  }
  if (request.currentStage === "hr" && (actor.role !== "hr" || actor.id !== request.hrApproverId)) {
    throw new WorkflowError("FORBIDDEN", "Only the assigned HR approver can act at this stage.");
  }
  if (request.currentStage === "complete" || isTerminal(request.status)) {
    throw new WorkflowError("CONFLICT", "A completed request cannot be changed.");
  }
}

export async function transitionRequest(args: {
  db: any;
  requestId: number;
  actor: User;
  decision: Decision;
  comment?: string;
}) {
  const comment = ensureDecisionComment(args.comment);

  return args.db.transaction(async (tx: any) => {
    const rows = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, args.requestId)).limit(1);
    const request = rows[0] as LeaveRequest | undefined;
    if (!request) throw new WorkflowError("NOT_FOUND", "Leave request not found.");

    checkActor(request, args.actor);
    const transition = nextTransition(request, args.decision);
    const now = new Date();

    if (args.decision === "approve" && request.currentStage === "manager" && !request.generalManagerId) {
      throw new WorkflowError("CONFLICT", "No General Manager is assigned to this request.");
    }
    if (args.decision === "approve" && request.currentStage === "general_manager" && !request.hrApproverId) {
      throw new WorkflowError("CONFLICT", "No HR approver is assigned to this request.");
    }

    if (args.decision === "approve" && request.currentStage === "hr") {
      const [balance] = await tx.select().from(leaveBalances).where(and(
        eq(leaveBalances.userId, request.employeeId),
        eq(leaveBalances.leaveTypeId, request.leaveTypeId),
        eq(leaveBalances.year, new Date(request.startDate).getUTCFullYear()),
      )).limit(1);
      if (!balance) throw new WorkflowError("CONFLICT", "The employee has no leave balance for this leave type and year.");
      const available = Number(balance.allowance) + Number(balance.carried) - Number(balance.used);
      if (available < Number(request.totalDays)) {
        throw new WorkflowError("CONFLICT", "This approval would exceed the employee's available leave balance.");
      }
      await tx.update(leaveBalances).set({ used: (Number(balance.used) + Number(request.totalDays)).toFixed(2) }).where(eq(leaveBalances.id, balance.id));
    }

    await tx.update(leaveRequests).set({
      status: transition.status,
      currentStage: transition.currentStage,
      decidedAt: transition.terminal ? now : null,
      updatedAt: now,
    }).where(and(eq(leaveRequests.id, request.id), eq(leaveRequests.status, request.status), eq(leaveRequests.currentStage, request.currentStage)));

    await tx.insert(approvalActions).values({
      requestId: request.id,
      actorId: args.actor.id,
      actorRole: args.actor.role,
      stage: request.currentStage === "manager" ? "manager" : request.currentStage === "general_manager" ? "general_manager" : "hr",
      action: args.decision,
      fromStatus: request.status,
      toStatus: transition.status,
      comment,
    });

    await tx.insert(auditLogs).values({
      requestId: request.id,
      actorId: args.actor.id,
      actorRole: args.actor.role,
      event: `${args.decision}_${request.currentStage}`,
      fromStatus: request.status,
      toStatus: transition.status,
      comment,
      metadata: JSON.stringify({ requestNumber: request.requestNumber, assignedStage: request.currentStage }),
    });

    const employee = await getUser(tx, request.employeeId);
    const manager = await getUser(tx, request.directManagerId);
    const gm = await getUser(tx, request.generalManagerId);
    const hr = await getUser(tx, request.hrApproverId);
    const body = `${request.requestNumber} is now ${transition.status}.`;
    const recipients = new Map<number, User>();
    const addRecipient = (user: User | null) => { if (user) recipients.set(user.id, user); };

    addRecipient(employee);
    if (!transition.terminal) {
      if (transition.currentStage === "general_manager") addRecipient(gm);
      if (transition.currentStage === "hr") addRecipient(hr);
    } else if (transition.status === "Approved") {
      addRecipient(manager);
      addRecipient(gm);
    }

    await queueNotifications(tx, Array.from(recipients.values()).map(recipient => ({
      recipient,
      requestId: request.id,
      eventType: `request_${args.decision}`,
      dedupeKey: `${request.id}:${transition.status}:${recipient.id}`,
      title: `Leave request ${transition.status}`,
      body,
    })));

    return { requestId: request.id, requestNumber: request.requestNumber, status: transition.status, currentStage: transition.currentStage };
  });
}

export function roleLabel(role: Role) {
  return ({ employee: "Employee", manager: "Direct Manager", general_manager: "General Manager", hr: "HR", admin: "Admin" } as Record<Role, string>)[role];
}
