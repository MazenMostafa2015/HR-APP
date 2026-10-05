import { describe, expect, it } from "vitest";
import { transitionRequest, WorkflowError } from "./workflow";

const baseRequest = { id: 44, requestNumber: "LR-TEST", employeeId: 1, directManagerId: 2, generalManagerId: 3, hrApproverId: 4, currentStage: "manager", status: "Pending Manager Approval", leaveTypeId: 1, startDate: "2026-10-12", totalDays: "1.00" } as any;
const actor = { id: 2, role: "manager", email: "manager@example.com" } as any;

function fakeDb(request = baseRequest) {
  return { transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [request] }) }) }),
  }) };
}

describe("workflow guards", () => {
  it("rejects a wrong approver", async () => {
    await expect(transitionRequest({ db: fakeDb(), requestId: 44, actor: { ...actor, id: 9 }, decision: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects a complete request", async () => {
    const complete = { ...baseRequest, currentStage: "complete", status: "Approved" };
    await expect(transitionRequest({ db: fakeDb(complete), requestId: 44, actor, decision: "approve" })).rejects.toBeInstanceOf(WorkflowError);
  });
});
