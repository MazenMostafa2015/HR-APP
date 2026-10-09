ALTER TABLE `users` ADD `employeeId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_employee_id_unique` UNIQUE(`employeeId`);