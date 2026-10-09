import {
  boolean,
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const departments = mysqlTable(
  "departments",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 16 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ codeIdx: uniqueIndex("departments_code_unique").on(table.code) })
);

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    employeeId: varchar("employeeId", { length: 64 }),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["employee", "manager", "general_manager", "hr", "admin"]).default("employee").notNull(),
    departmentId: int("departmentId").references(() => departments.id),
    managerId: int("managerId"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({ employeeIdIdx: uniqueIndex("users_employee_id_unique").on(table.employeeId), departmentIdx: index("users_department_idx").on(table.departmentId), managerIdx: index("users_manager_idx").on(table.managerId) })
);

export const leaveTypes = mysqlTable(
  "leaveTypes",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 24 }).notNull(),
    color: varchar("color", { length: 16 }).default("teal").notNull(),
    annualAllowance: decimal("annualAllowance", { precision: 10, scale: 2 }).default("0.00").notNull(),
    requiresAttachment: boolean("requiresAttachment").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ codeIdx: uniqueIndex("leave_types_code_unique").on(table.code) })
);

export const publicHolidays = mysqlTable(
  "publicHolidays",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ dateIdx: uniqueIndex("public_holidays_date_unique").on(table.date) })
);

export const leaveBalances = mysqlTable(
  "leaveBalances",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    leaveTypeId: int("leaveTypeId").notNull().references(() => leaveTypes.id),
    year: int("year").notNull(),
    allowance: decimal("allowance", { precision: 10, scale: 2 }).default("0.00").notNull(),
    used: decimal("used", { precision: 10, scale: 2 }).default("0.00").notNull(),
    carried: decimal("carried", { precision: 10, scale: 2 }).default("0.00").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ balanceIdx: uniqueIndex("leave_balances_user_type_year_unique").on(table.userId, table.leaveTypeId, table.year) })
);

export const requestStatuses = [
  "Pending Manager Approval",
  "Pending General Manager Approval",
  "Pending HR Approval",
  "Approved",
  "Rejected by Manager",
  "Rejected by General Manager",
  "Rejected by HR",
  "Cancelled",
] as const;

export const workflowStages = ["manager", "general_manager", "hr", "complete"] as const;

export const leaveRequests = mysqlTable(
  "leaveRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    requestNumber: varchar("requestNumber", { length: 32 }).notNull(),
    employeeId: int("employeeId").notNull().references(() => users.id),
    departmentId: int("departmentId").references(() => departments.id),
    leaveTypeId: int("leaveTypeId").notNull().references(() => leaveTypes.id),
    directManagerId: int("directManagerId").notNull().references(() => users.id),
    generalManagerId: int("generalManagerId").references(() => users.id),
    hrApproverId: int("hrApproverId").references(() => users.id),
    status: mysqlEnum("status", requestStatuses).default("Pending Manager Approval").notNull(),
    currentStage: mysqlEnum("currentStage", workflowStages).default("manager").notNull(),
    startDate: date("startDate", { mode: "string" }).notNull(),
    endDate: date("endDate", { mode: "string" }).notNull(),
    startHalfDay: boolean("startHalfDay").default(false).notNull(),
    endHalfDay: boolean("endHalfDay").default(false).notNull(),
    totalDays: decimal("totalDays", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    attachmentKey: varchar("attachmentKey", { length: 512 }),
    attachmentName: varchar("attachmentName", { length: 255 }),
    attachmentType: varchar("attachmentType", { length: 120 }),
    attachmentSize: int("attachmentSize"),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
    decidedAt: timestamp("decidedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    requestNumberIdx: uniqueIndex("leave_requests_number_unique").on(table.requestNumber),
    employeeIdx: index("leave_requests_employee_idx").on(table.employeeId),
    stageIdx: index("leave_requests_stage_idx").on(table.currentStage, table.status),
    datesIdx: index("leave_requests_dates_idx").on(table.startDate, table.endDate),
  })
);

export const approvalActions = mysqlTable(
  "approvalActions",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").notNull().references(() => leaveRequests.id),
    actorId: int("actorId").notNull().references(() => users.id),
    actorRole: mysqlEnum("actorRole", ["employee", "manager", "general_manager", "hr", "admin"]).notNull(),
    stage: mysqlEnum("stage", ["employee", "manager", "general_manager", "hr"]).notNull(),
    action: mysqlEnum("action", ["submit", "approve", "reject", "cancel", "reminder"]).notNull(),
    fromStatus: varchar("fromStatus", { length: 80 }),
    toStatus: varchar("toStatus", { length: 80 }),
    comment: text("comment"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ requestIdx: index("approval_actions_request_idx").on(table.requestId, table.createdAt) })
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").references(() => leaveRequests.id),
    actorId: int("actorId").notNull().references(() => users.id),
    actorRole: varchar("actorRole", { length: 32 }).notNull(),
    event: varchar("event", { length: 80 }).notNull(),
    fromStatus: varchar("fromStatus", { length: 80 }),
    toStatus: varchar("toStatus", { length: 80 }),
    comment: text("comment"),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ requestIdx: index("audit_logs_request_idx").on(table.requestId, table.createdAt), actorIdx: index("audit_logs_actor_idx").on(table.actorId, table.createdAt) })
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    recipientId: int("recipientId").notNull().references(() => users.id),
    requestId: int("requestId").references(() => leaveRequests.id),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ recipientIdx: index("notifications_recipient_idx").on(table.recipientId, table.createdAt) })
);

export const notificationOutbox = mysqlTable(
  "notificationOutbox",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId").references(() => leaveRequests.id),
    recipientId: int("recipientId").notNull().references(() => users.id),
    eventType: varchar("eventType", { length: 40 }).notNull(),
    dedupeKey: varchar("dedupeKey", { length: 190 }).notNull(),
    recipientEmail: varchar("recipientEmail", { length: 320 }),
    subject: varchar("subject", { length: 180 }).notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ dedupeIdx: uniqueIndex("notification_outbox_dedupe_unique").on(table.dedupeKey), statusIdx: index("notification_outbox_status_idx").on(table.status, table.createdAt) })
);

export type Role = typeof users.$inferSelect["role"];
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type RequestStatus = (typeof requestStatuses)[number];
export type WorkflowStage = (typeof workflowStages)[number];
