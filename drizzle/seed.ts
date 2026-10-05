import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { departments, leaveTypes, publicHolidays, users, leaveBalances, leaveRequests, approvalActions, auditLogs } from "./schema";

async function first(query: Promise<any[]>) { const rows = await query; return rows[0] as any | undefined; }

async function ensureDepartment(db: any, name: string, code: string) {
  const existing = await first(db.select().from(departments).where(eq(departments.code, code)).limit(1));
  if (existing) return existing;
  await db.insert(departments).values({ name, code });
  return first(db.select().from(departments).where(eq(departments.code, code)).limit(1));
}

async function ensureLeaveType(db: any, values: { name: string; code: string; color: string; annualAllowance: string; requiresAttachment: boolean }) {
  const existing = await first(db.select().from(leaveTypes).where(eq(leaveTypes.code, values.code)).limit(1));
  if (existing) return existing;
  await db.insert(leaveTypes).values(values);
  return first(db.select().from(leaveTypes).where(eq(leaveTypes.code, values.code)).limit(1));
}

async function ensureUser(db: any, values: any) {
  const existing = await first(db.select().from(users).where(eq(users.openId, values.openId)).limit(1));
  if (existing) return existing;
  await db.insert(users).values(values);
  return first(db.select().from(users).where(eq(users.openId, values.openId)).limit(1));
}

async function ensureBalance(db: any, userId: number, leaveTypeId: number, allowance: string) {
  const year = new Date().getFullYear();
  const existing = await first(db.select().from(leaveBalances).where(and(eq(leaveBalances.userId, userId), eq(leaveBalances.leaveTypeId, leaveTypeId), eq(leaveBalances.year, year))).limit(1));
  if (!existing) await db.insert(leaveBalances).values({ userId, leaveTypeId, year, allowance, used: "0.00", carried: "0.00" });
}

async function ensureRequest(db: any, values: any, actorId: number) {
  const existing = await first(db.select().from(leaveRequests).where(eq(leaveRequests.requestNumber, values.requestNumber)).limit(1));
  if (existing) return existing;
  await db.insert(leaveRequests).values(values);
  const created = await first(db.select().from(leaveRequests).where(eq(leaveRequests.requestNumber, values.requestNumber)).limit(1));
  if (!created) return created;
  await db.insert(approvalActions).values({ requestId: created.id, actorId, actorRole: "employee", stage: "employee", action: "submit", fromStatus: null, toStatus: values.status, comment: "Seeded sample request" });
  await db.insert(auditLogs).values({ requestId: created.id, actorId, actorRole: "employee", event: "request_submitted", fromStatus: null, toStatus: values.status, comment: "Seeded sample request", metadata: JSON.stringify({ seeded: true }) });
  return created;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required to seed ELMS.");
  const engineering = await ensureDepartment(db, "Engineering", "ENG");
  const operations = await ensureDepartment(db, "Operations", "OPS");
  const annual = await ensureLeaveType(db, { name: "Annual leave", code: "ANNUAL", color: "teal", annualAllowance: "20.00", requiresAttachment: false });
  const sick = await ensureLeaveType(db, { name: "Sick leave", code: "SICK", color: "red", annualAllowance: "12.00", requiresAttachment: true });
  const emergency = await ensureLeaveType(db, { name: "Emergency leave", code: "EMERGENCY", color: "amber", annualAllowance: "5.00", requiresAttachment: false });
  for (const holiday of [{ name: "Founders Day", date: "2026-10-23" }, { name: "Year End Holiday", date: "2026-12-25" }]) {
    const existing = await first(db.select().from(publicHolidays).where(eq(publicHolidays.date, holiday.date)).limit(1));
    if (!existing) await db.insert(publicHolidays).values(holiday);
  }

  const manager = await ensureUser(db, { openId: "seed_manager_oliver", name: "Oliver Grant", email: "oliver.grant@example.com", role: "manager", departmentId: engineering?.id, active: true });
  const gm = await ensureUser(db, { openId: "seed_general_manager_maya", name: "Maya Chen", email: "maya.chen@example.com", role: "general_manager", departmentId: engineering?.id, active: true });
  const hr = await ensureUser(db, { openId: "seed_hr_amina", name: "Amina Rahman", email: "amina.rahman@example.com", role: "hr", departmentId: operations?.id, active: true });
  const admin = await ensureUser(db, { openId: "seed_admin_mostafa", name: "Mostafa Zeada", email: "mostafa.zeada@example.com", role: "admin", departmentId: operations?.id, active: true });
  const employee = await ensureUser(db, { openId: "seed_employee_lina", name: "Lina Haddad", email: "lina.haddad@example.com", role: "employee", departmentId: engineering?.id, managerId: manager?.id, active: true });
  const employeeTwo = await ensureUser(db, { openId: "seed_employee_samir", name: "Samir Nassar", email: "samir.nassar@example.com", role: "employee", departmentId: engineering?.id, managerId: manager?.id, active: true });
  if (!manager || !gm || !hr || !admin || !employee || !employeeTwo || !annual || !sick || !emergency || !engineering) throw new Error("Seed references could not be created.");

  await ensureBalance(db, employee.id, annual.id, "20.00");
  await ensureBalance(db, employee.id, sick.id, "12.00");
  await ensureBalance(db, employee.id, emergency.id, "5.00");
  await ensureBalance(db, employeeTwo.id, annual.id, "20.00");

  const samples = [
    { requestNumber: "LR-2026-DEMO01", employeeId: employee.id, departmentId: engineering.id, leaveTypeId: annual.id, directManagerId: manager.id, generalManagerId: gm.id, hrApproverId: hr.id, status: "Pending Manager Approval", currentStage: "manager", startDate: "2026-10-12", endDate: "2026-10-14", startHalfDay: false, endHalfDay: false, totalDays: "3.00", reason: "Family time and recovery." },
    { requestNumber: "LR-2026-DEMO02", employeeId: employeeTwo.id, departmentId: engineering.id, leaveTypeId: annual.id, directManagerId: manager.id, generalManagerId: gm.id, hrApproverId: hr.id, status: "Pending General Manager Approval", currentStage: "general_manager", startDate: "2026-10-19", endDate: "2026-10-20", startHalfDay: false, endHalfDay: false, totalDays: "2.00", reason: "Personal appointment and travel." },
    { requestNumber: "LR-2026-DEMO03", employeeId: employee.id, departmentId: engineering.id, leaveTypeId: sick.id, directManagerId: manager.id, generalManagerId: gm.id, hrApproverId: hr.id, status: "Pending HR Approval", currentStage: "hr", startDate: "2026-09-28", endDate: "2026-09-29", startHalfDay: false, endHalfDay: false, totalDays: "2.00", reason: "Medical recovery." },
    { requestNumber: "LR-2026-DEMO04", employeeId: employeeTwo.id, departmentId: engineering.id, leaveTypeId: annual.id, directManagerId: manager.id, generalManagerId: gm.id, hrApproverId: hr.id, status: "Approved", currentStage: "complete", startDate: "2026-08-10", endDate: "2026-08-12", startHalfDay: false, endHalfDay: false, totalDays: "3.00", reason: "Planned break." },
    { requestNumber: "LR-2026-DEMO05", employeeId: employee.id, departmentId: engineering.id, leaveTypeId: emergency.id, directManagerId: manager.id, generalManagerId: gm.id, hrApproverId: hr.id, status: "Rejected by General Manager", currentStage: "complete", startDate: "2026-07-06", endDate: "2026-07-06", startHalfDay: false, endHalfDay: false, totalDays: "1.00", reason: "Urgent personal matter." },
  ];
  for (const sample of samples) await ensureRequest(db, sample, sample.employeeId);
  console.log(`ELMS seed complete. Admin fixture: ${admin.email}`);
}

main().catch(error => { console.error(error); process.exit(1); });
