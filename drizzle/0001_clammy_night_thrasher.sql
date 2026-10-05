CREATE TABLE `approvalActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`actorId` int NOT NULL,
	`actorRole` enum('employee','manager','general_manager','hr','admin') NOT NULL,
	`stage` enum('employee','manager','general_manager','hr') NOT NULL,
	`action` enum('submit','approve','reject','cancel','reminder') NOT NULL,
	`fromStatus` varchar(80),
	`toStatus` varchar(80),
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvalActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int,
	`actorId` int NOT NULL,
	`actorRole` varchar(32) NOT NULL,
	`event` varchar(80) NOT NULL,
	`fromStatus` varchar(80),
	`toStatus` varchar(80),
	`comment` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `leaveBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`year` int NOT NULL,
	`allowance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`used` decimal(10,2) NOT NULL DEFAULT '0.00',
	`carried` decimal(10,2) NOT NULL DEFAULT '0.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaveBalances_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_balances_user_type_year_unique` UNIQUE(`userId`,`leaveTypeId`,`year`)
);
--> statement-breakpoint
CREATE TABLE `leaveRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(32) NOT NULL,
	`employeeId` int NOT NULL,
	`departmentId` int,
	`leaveTypeId` int NOT NULL,
	`directManagerId` int NOT NULL,
	`generalManagerId` int,
	`hrApproverId` int,
	`status` enum('Pending Manager Approval','Pending General Manager Approval','Pending HR Approval','Approved','Rejected by Manager','Rejected by General Manager','Rejected by HR','Cancelled') NOT NULL DEFAULT 'Pending Manager Approval',
	`currentStage` enum('manager','general_manager','hr','complete') NOT NULL DEFAULT 'manager',
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`startHalfDay` boolean NOT NULL DEFAULT false,
	`endHalfDay` boolean NOT NULL DEFAULT false,
	`totalDays` decimal(10,2) NOT NULL,
	`reason` text NOT NULL,
	`attachmentKey` varchar(512),
	`attachmentName` varchar(255),
	`attachmentType` varchar(120),
	`attachmentSize` int,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaveRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_requests_number_unique` UNIQUE(`requestNumber`)
);
--> statement-breakpoint
CREATE TABLE `leaveTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(24) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT 'teal',
	`annualAllowance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`requiresAttachment` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaveTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_types_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `notificationOutbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int,
	`recipientId` int NOT NULL,
	`eventType` varchar(40) NOT NULL,
	`dedupeKey` varchar(190) NOT NULL,
	`recipientEmail` varchar(320),
	`subject` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificationOutbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_outbox_dedupe_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientId` int NOT NULL,
	`requestId` int,
	`type` varchar(40) NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publicHolidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`date` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publicHolidays_id` PRIMARY KEY(`id`),
	CONSTRAINT `public_holidays_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','employee','manager','general_manager','hr','admin') NOT NULL DEFAULT 'employee';--> statement-breakpoint
UPDATE `users` SET `role` = 'employee' WHERE `role` = 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('employee','manager','general_manager','hr','admin') NOT NULL DEFAULT 'employee';--> statement-breakpoint
ALTER TABLE `users` ADD `departmentId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `managerId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `approvalActions` ADD CONSTRAINT `approvalActions_requestId_leaveRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `leaveRequests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalActions` ADD CONSTRAINT `approvalActions_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_requestId_leaveRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `leaveRequests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveBalances` ADD CONSTRAINT `leaveBalances_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveBalances` ADD CONSTRAINT `leaveBalances_leaveTypeId_leaveTypes_id_fk` FOREIGN KEY (`leaveTypeId`) REFERENCES `leaveTypes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveRequests` ADD CONSTRAINT `leaveRequests_employeeId_users_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveRequests` ADD CONSTRAINT `leaveRequests_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveRequests` ADD CONSTRAINT `leaveRequests_leaveTypeId_leaveTypes_id_fk` FOREIGN KEY (`leaveTypeId`) REFERENCES `leaveTypes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveRequests` ADD CONSTRAINT `leaveRequests_directManagerId_users_id_fk` FOREIGN KEY (`directManagerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveRequests` ADD CONSTRAINT `leaveRequests_generalManagerId_users_id_fk` FOREIGN KEY (`generalManagerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leaveRequests` ADD CONSTRAINT `leaveRequests_hrApproverId_users_id_fk` FOREIGN KEY (`hrApproverId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notificationOutbox` ADD CONSTRAINT `notificationOutbox_requestId_leaveRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `leaveRequests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notificationOutbox` ADD CONSTRAINT `notificationOutbox_recipientId_users_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipientId_users_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_requestId_leaveRequests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `leaveRequests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_actions_request_idx` ON `approvalActions` (`requestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_request_idx` ON `auditLogs` (`requestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `auditLogs` (`actorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `leave_requests_employee_idx` ON `leaveRequests` (`employeeId`);--> statement-breakpoint
CREATE INDEX `leave_requests_stage_idx` ON `leaveRequests` (`currentStage`,`status`);--> statement-breakpoint
CREATE INDEX `leave_requests_dates_idx` ON `leaveRequests` (`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX `notification_outbox_status_idx` ON `notificationOutbox` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_idx` ON `notifications` (`recipientId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_department_idx` ON `users` (`departmentId`);--> statement-breakpoint
CREATE INDEX `users_manager_idx` ON `users` (`managerId`);
