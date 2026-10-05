import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  approvalActions,
  auditLogs,
  departments,
  leaveBalances,
  leaveRequests,
  leaveTypes,
  notifications,
  publicHolidays,
  users,
  requestStatuses,
  type User,
} from "../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { isValidDateRange, calculateBusinessDays } from "./services/leave-days";
import { queueNotifications, markNotificationRead } from "./services/notifications";
import { transitionRequest, WorkflowError } from "./services/workflow";
import { storagePut } from "./storage";

const roleValues = ["employee", "manager", "general_manager", "hr", "admin"] as const;
const roleSchema = z.enum(roleValues);
const statusSchema = z.enum(requestStatuses);

function requireDb() {
  return getDb().then(db => {
    if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not available." });
    return db;
  });
}

function requireRoles(user: User, roles: User["role"][]) {
  if (!roles.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission for this action." });
}

function mapWorkflowError(error: unknown): never {
  if (error instanceof WorkflowError) {
    const code = error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "FORBIDDEN" ? "FORBIDDEN" : error.code === "CONFLICT" ? "CONFLICT" : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

async function getUserById(db: any, id: number | null | undefined) {
  if (!id) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

function canViewRequest(user: User, request: any) {
  if (user.role === "admin" || user.role === "hr") return true;
  if (user.role === "employee") return request.employeeId === user.id;
  if (user.role === "manager") return request.directManagerId === user.id;
  if (user.role === "general_manager") return request.generalManagerId === user.id;
  return false;
}

async function enrichRequest(db: any, request: any) {
  const [employee, type, department, manager, gm, hr] = await Promise.all([
    getUserById(db, request.employeeId),
    db.select().from(leaveTypes).where(eq(leaveTypes.id, request.leaveTypeId)).limit(1).then((rows: any[]) => rows[0] ?? null),
    request.departmentId ? db.select().from(departments).where(eq(departments.id, request.departmentId)).limit(1).then((rows: any[]) => rows[0] ?? null) : null,
    getUserById(db, request.directManagerId),
    getUserById(db, request.generalManagerId),
    getUserById(db, request.hrApproverId),
  ]);
  return {
    ...request,
    totalDays: Number(request.totalDays),
    employeeName: employee?.name ?? employee?.email ?? "Unknown employee",
    employeeEmail: employee?.email ?? null,
    leaveTypeName: type?.name ?? "Leave",
    leaveTypeColor: type?.color ?? "teal",
    departmentName: department?.name ?? "Unassigned",
    directManagerName: manager?.name ?? manager?.email ?? "Unassigned",
    generalManagerName: gm?.name ?? gm?.email ?? "Unassigned",
    hrApproverName: hr?.name ?? hr?.email ?? "Unassigned",
  };
}

async function listVisibleRequests(db: any, user: User, input: { status?: (typeof requestStatuses)[number]; from?: string; to?: string } = {}) {
  const conditions: any[] = [];
  if (user.role === "employee") conditions.push(eq(leaveRequests.employeeId, user.id));
  if (user.role === "manager") conditions.push(eq(leaveRequests.directManagerId, user.id));
  if (user.role === "general_manager") conditions.push(eq(leaveRequests.generalManagerId, user.id));
  if (input.status) conditions.push(eq(leaveRequests.status, input.status));
  if (input.from) conditions.push(gte(leaveRequests.startDate, input.from));
  if (input.to) conditions.push(lte(leaveRequests.endDate, input.to));
  const predicate = conditions.length ? and(...conditions) : undefined;
  const rows = predicate
    ? await db.select().from(leaveRequests).where(predicate).orderBy(desc(leaveRequests.createdAt)).limit(200)
    : await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt)).limit(200);
  return Promise.all(rows.map((row: any) => enrichRequest(db, row)));
}

function toCsvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  leaveTypes: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(leaveTypes).where(eq(leaveTypes.active, true));
    }),
  }),

  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const requests = await listVisibleRequests(db, ctx.user);
      const balances = await db.select().from(leaveBalances).where(and(eq(leaveBalances.userId, ctx.user.id), eq(leaveBalances.year, new Date().getFullYear())));
      const unread = await db.select().from(notifications).where(and(eq(notifications.recipientId, ctx.user.id), isNull(notifications.readAt))).orderBy(desc(notifications.createdAt)).limit(8);
      const pending = requests.filter(request => request.status.startsWith("Pending"));
      const approved = requests.filter(request => request.status === "Approved");
      const rejected = requests.filter(request => request.status.startsWith("Rejected"));
      const queue = requests.filter(request => {
        if (ctx.user.role === "manager") return request.currentStage === "manager" && request.directManagerId === ctx.user.id;
        if (ctx.user.role === "general_manager") return request.currentStage === "general_manager" && request.generalManagerId === ctx.user.id;
        if (ctx.user.role === "hr") return request.currentStage === "hr";
        return false;
      });
      return {
        user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: ctx.user.role, departmentId: ctx.user.departmentId },
        metrics: { total: requests.length, pending: pending.length, approved: approved.length, rejected: rejected.length, queue: queue.length },
        balances: balances.map(balance => ({ ...balance, allowance: Number(balance.allowance), used: Number(balance.used), carried: Number(balance.carried), available: Number(balance.allowance) + Number(balance.carried) - Number(balance.used) })),
        queue: queue.slice(0, 6),
        upcoming: requests.filter(request => request.status === "Approved" && request.endDate >= new Date().toISOString().slice(0, 10)).slice(0, 5),
        recentRequests: requests.slice(0, 6),
        notifications: unread.map(notification => ({ ...notification, createdAt: notification.createdAt.toISOString() })),
      };
    }),
  }),

  leaveRequests: router({
    list: protectedProcedure.input(z.object({ status: statusSchema.optional(), from: z.string().optional(), to: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      return listVisibleRequests(db, ctx.user, input ?? {});
    }),

    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.id, input.id)).limit(1);
      const request = rows[0];
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Leave request not found." });
      if (!canViewRequest(ctx.user, request)) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot view this request." });
      const [detail, audit] = await Promise.all([
        enrichRequest(db, request),
        db.select().from(auditLogs).where(eq(auditLogs.requestId, request.id)).orderBy(desc(auditLogs.createdAt)),
      ]);
      const timeline = await Promise.all(audit.map(async (event: any) => {
        const actor = await getUserById(db, event.actorId);
        return { ...event, actorName: actor?.name ?? actor?.email ?? "System", createdAt: event.createdAt.toISOString() };
      }));
      return { ...detail, audit: timeline };
    }),

    create: protectedProcedure.input(z.object({
      leaveTypeId: z.number().int().positive(),
      startDate: z.string().min(10),
      endDate: z.string().min(10),
      startHalfDay: z.boolean().default(false),
      endHalfDay: z.boolean().default(false),
      reason: z.string().min(5).max(2000),
      attachment: z.object({ key: z.string(), name: z.string(), type: z.string(), size: z.number().int().positive() }).optional(),
    })).mutation(async ({ ctx, input }) => {
      requireRoles(ctx.user, ["employee"]);
      if (!isValidDateRange(input.startDate, input.endDate)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid start and end date." });
      const db = await requireDb();
      const holidays = await db.select().from(publicHolidays).where(and(gte(publicHolidays.date, input.startDate), lte(publicHolidays.date, input.endDate)));
      const totalDays = calculateBusinessDays({ ...input, holidays: holidays.map((holiday: any) => String(holiday.date)) });
      if (totalDays <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected dates contain no working days." });
      const [leaveType] = await db.select().from(leaveTypes).where(and(eq(leaveTypes.id, input.leaveTypeId), eq(leaveTypes.active, true))).limit(1);
      if (!leaveType) throw new TRPCError({ code: "BAD_REQUEST", message: "Leave type is not available." });
      if (leaveType.requiresAttachment && !input.attachment) throw new TRPCError({ code: "BAD_REQUEST", message: "An attachment is required for this leave type." });
      if (input.attachment && input.attachment.size > 5_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Attachments must be 5 MB or smaller." });

      const manager = await getUserById(db, ctx.user.managerId);
      if (!manager || manager.role !== "manager" || !manager.active) throw new TRPCError({ code: "CONFLICT", message: "No active Direct Manager is assigned to your profile." });
      const [gm] = await db.select().from(users).where(and(eq(users.role, "general_manager"), eq(users.active, true), ctx.user.departmentId ? eq(users.departmentId, ctx.user.departmentId) : eq(users.active, true))).limit(1);
      const [hr] = await db.select().from(users).where(and(eq(users.role, "hr"), eq(users.active, true))).limit(1);
      if (!gm || !hr) throw new TRPCError({ code: "CONFLICT", message: "The approval chain is not fully configured." });

      const requestNumber = `LR-${new Date().getFullYear()}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      return db.transaction(async (tx: any) => {
        await tx.insert(leaveRequests).values({
          requestNumber,
          employeeId: ctx.user.id,
          departmentId: ctx.user.departmentId ?? null,
          leaveTypeId: input.leaveTypeId,
          directManagerId: manager.id,
          generalManagerId: gm.id,
          hrApproverId: hr.id,
          status: "Pending Manager Approval",
          currentStage: "manager",
          startDate: input.startDate,
          endDate: input.endDate,
          startHalfDay: input.startHalfDay,
          endHalfDay: input.endHalfDay,
          totalDays: totalDays.toFixed(2),
          reason: input.reason.trim(),
          attachmentKey: input.attachment?.key ?? null,
          attachmentName: input.attachment?.name ?? null,
          attachmentType: input.attachment?.type ?? null,
          attachmentSize: input.attachment?.size ?? null,
        });
        const [created] = await tx.select().from(leaveRequests).where(eq(leaveRequests.requestNumber, requestNumber)).limit(1);
        await tx.insert(approvalActions).values({ requestId: created.id, actorId: ctx.user.id, actorRole: ctx.user.role, stage: "employee", action: "submit", fromStatus: null, toStatus: "Pending Manager Approval", comment: null });
        await tx.insert(auditLogs).values({ requestId: created.id, actorId: ctx.user.id, actorRole: ctx.user.role, event: "request_submitted", fromStatus: null, toStatus: "Pending Manager Approval", comment: null, metadata: JSON.stringify({ requestNumber }) });
        await queueNotifications(tx, [
          { recipient: ctx.user, requestId: created.id, eventType: "request_submitted", dedupeKey: `${created.id}:submitted:${ctx.user.id}`, title: "Leave request submitted", body: `${requestNumber} is waiting for Direct Manager approval.` },
          { recipient: manager, requestId: created.id, eventType: "request_submitted", dedupeKey: `${created.id}:submitted:${manager.id}`, title: "New leave request to review", body: `${ctx.user.name ?? ctx.user.email ?? "An employee"} submitted ${requestNumber} for ${totalDays} day(s).` },
        ]);
        return { id: created.id, requestNumber, status: created.status, totalDays };
      });
    }),

    decide: protectedProcedure.input(z.object({ id: z.number().int().positive(), decision: z.enum(["approve", "reject"]), comment: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => {
      requireRoles(ctx.user, ["manager", "general_manager", "hr"]);
      try {
        const db = await requireDb();
        return await transitionRequest({ db, requestId: input.id, actor: ctx.user, decision: input.decision, comment: input.comment });
      } catch (error) {
        return mapWorkflowError(error);
      }
    }),

    cancel: protectedProcedure.input(z.object({ id: z.number().int().positive(), comment: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => {
      requireRoles(ctx.user, ["employee"]);
      const db = await requireDb();
      return db.transaction(async (tx: any) => {
        const [request] = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, input.id)).limit(1);
        if (!request || request.employeeId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot cancel this request." });
        if (request.currentStage === "complete" || request.status !== "Pending Manager Approval") throw new TRPCError({ code: "CONFLICT", message: "Only requests still waiting for Manager approval can be cancelled." });
        await tx.update(leaveRequests).set({ status: "Cancelled", currentStage: "complete", decidedAt: new Date() }).where(eq(leaveRequests.id, input.id));
        await tx.insert(approvalActions).values({ requestId: input.id, actorId: ctx.user.id, actorRole: ctx.user.role, stage: "employee", action: "cancel", fromStatus: request.status, toStatus: "Cancelled", comment: input.comment?.trim() || null });
        await tx.insert(auditLogs).values({ requestId: input.id, actorId: ctx.user.id, actorRole: ctx.user.role, event: "request_cancelled", fromStatus: request.status, toStatus: "Cancelled", comment: input.comment?.trim() || null });
        const manager = await getUserById(tx, request.directManagerId);
        await queueNotifications(tx, manager ? [{ recipient: manager, requestId: input.id, eventType: "request_cancelled", dedupeKey: `${input.id}:cancelled:${manager.id}`, title: "Leave request cancelled", body: `${request.requestNumber} was cancelled by the employee.` }] : []);
        return { success: true as const };
      });
    }),
  }),

  attachments: router({
    upload: protectedProcedure.input(z.object({ fileName: z.string().min(1).max(255), contentType: z.string().min(1).max(120), dataBase64: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const allowed = ["application/pdf", "image/jpeg", "image/png"].includes(input.contentType);
      if (!allowed) throw new TRPCError({ code: "BAD_REQUEST", message: "Only PDF, JPG, and PNG attachments are supported." });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (bytes.length > 5_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Attachments must be 5 MB or smaller." });
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      try {
        const stored = await storagePut(`elms/attachments/${ctx.user.id}/${safeName}`, bytes, input.contentType);
        return { key: stored.key, url: stored.url, name: input.fileName, type: input.contentType, size: bytes.length };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Attachment upload failed." });
      }
    }),
  }),

  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(notifications).where(eq(notifications.recipientId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(50);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await markNotificationRead(db, input.id, ctx.user.id);
      return { success: true as const };
    }),
  }),

  audit: router({
    list: protectedProcedure.input(z.object({ requestId: z.number().int().positive().optional(), actorId: z.number().int().positive().optional(), from: z.string().optional(), to: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const requests = await listVisibleRequests(db, ctx.user, {});
      const requestIds = input?.requestId ? requests.filter(request => request.id === input.requestId).map(request => request.id) : requests.map(request => request.id);
      if (!requestIds.length) return [];
      const conditions: any[] = [inArray(auditLogs.requestId, requestIds)];
      if (input?.actorId) conditions.push(eq(auditLogs.actorId, input.actorId));
      if (input?.from) conditions.push(gte(auditLogs.createdAt, new Date(input.from)));
      if (input?.to) conditions.push(lte(auditLogs.createdAt, new Date(`${input.to}T23:59:59.999Z`)));
      if (input?.status) conditions.push(or(eq(auditLogs.fromStatus, input.status), eq(auditLogs.toStatus, input.status)));
      return db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(300);
    }),
  }),

  reports: router({
    summary: protectedProcedure.input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      requireRoles(ctx.user, ["hr", "admin"]);
      const db = await requireDb();
      const requests = await listVisibleRequests(db, ctx.user, input ?? {});
      const byStatus = requests.reduce<Record<string, number>>((acc, request) => { acc[request.status] = (acc[request.status] ?? 0) + 1; return acc; }, {});
      const byDepartment = requests.reduce<Record<string, number>>((acc, request) => { acc[request.departmentName] = (acc[request.departmentName] ?? 0) + request.totalDays; return acc; }, {});
      const byLeaveType = requests.reduce<Record<string, number>>((acc, request) => { acc[request.leaveTypeName] = (acc[request.leaveTypeName] ?? 0) + request.totalDays; return acc; }, {});
      return { totalDays: requests.reduce((sum, request) => sum + request.totalDays, 0), totalRequests: requests.length, byStatus, byDepartment, byLeaveType, requests };
    }),
    exportCsv: protectedProcedure.input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      requireRoles(ctx.user, ["hr", "admin"]);
      const db = await requireDb();
      const requests = await listVisibleRequests(db, ctx.user, input ?? {});
      const header = ["Request", "Employee", "Department", "Leave type", "Start", "End", "Days", "Status", "Submitted"].map(toCsvCell).join(",");
      const rows = requests.map(request => [request.requestNumber, request.employeeName, request.departmentName, request.leaveTypeName, request.startDate, request.endDate, request.totalDays, request.status, request.submittedAt.toISOString()].map(toCsvCell).join(","));
      return [header, ...rows].join("\n");
    }),
  }),

  admin: router({
    users: protectedProcedure.query(async ({ ctx }) => {
      requireRoles(ctx.user, ["admin", "hr"]);
      const db = await requireDb();
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      return Promise.all(rows.map(async (user: any) => ({ ...user, departmentName: user.departmentId ? (await db.select().from(departments).where(eq(departments.id, user.departmentId)).limit(1))[0]?.name ?? "Unassigned" : "Unassigned", managerName: user.managerId ? (await getUserById(db, user.managerId))?.name ?? "Unassigned" : "Unassigned" })));
    }),
    departments: protectedProcedure.query(async ({ ctx }) => { requireRoles(ctx.user, ["admin", "hr"]); const db = await requireDb(); return db.select().from(departments); }),
    leaveTypes: protectedProcedure.query(async ({ ctx }) => { requireRoles(ctx.user, ["admin", "hr"]); const db = await requireDb(); return db.select().from(leaveTypes).orderBy(desc(leaveTypes.createdAt)); }),
    holidays: protectedProcedure.query(async ({ ctx }) => { requireRoles(ctx.user, ["admin", "hr"]); const db = await requireDb(); return db.select().from(publicHolidays).orderBy(desc(publicHolidays.date)); }),
    updateUser: protectedProcedure.input(z.object({ id: z.number().int().positive(), role: roleSchema, departmentId: z.number().int().positive().nullable(), managerId: z.number().int().positive().nullable(), active: z.boolean() })).mutation(async ({ ctx, input }) => { requireRoles(ctx.user, ["admin"]); const db = await requireDb(); await db.update(users).set({ role: input.role, departmentId: input.departmentId, managerId: input.managerId, active: input.active }).where(eq(users.id, input.id)); return { success: true as const }; }),
    createLeaveType: protectedProcedure.input(z.object({ name: z.string().min(2).max(100), code: z.string().min(2).max(24), annualAllowance: z.number().min(0).max(365), requiresAttachment: z.boolean(), color: z.string().min(2).max(16) })).mutation(async ({ ctx, input }) => { requireRoles(ctx.user, ["admin", "hr"]); const db = await requireDb(); await db.insert(leaveTypes).values({ ...input, annualAllowance: input.annualAllowance.toFixed(2) }); return { success: true as const }; }),
    createHoliday: protectedProcedure.input(z.object({ name: z.string().min(2).max(120), date: z.string().min(10) })).mutation(async ({ ctx, input }) => { requireRoles(ctx.user, ["admin", "hr"]); const db = await requireDb(); await db.insert(publicHolidays).values(input); return { success: true as const }; }),
  }),
});

export type AppRouter = typeof appRouter;
