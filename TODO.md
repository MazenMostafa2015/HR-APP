# ELMS Outcome Checklist

## Relational data model, migrations, and seed data
- Extend the starter database with users, departments, leave types, public holidays, leave balances, leave requests, approval actions, immutable audit logs, notifications, and notification outbox records; preserve OAuth identity fields and add reporting-line and active-status fields.
- Provide deterministic additive migration files and an idempotent seed operation with sample Employee, Direct Manager, General Manager, HR, and Admin users, departments, leave types, holidays, balances, and sample requests across pending, approved, and rejected outcomes.

## Sequential approval workflow and authorization
- An employee submission creates a request with status `Pending Manager Approval` and the assigned direct manager.
- The assigned Direct Manager can approve or reject; approval moves the request to `Pending General Manager Approval` and forwards it automatically to the assigned General Manager, while rejection moves it to `Rejected by Manager` and ends the workflow.
- The assigned General Manager can act only after Manager approval; approval moves the request to `Pending HR Approval` and forwards it automatically to HR, while rejection moves it to `Rejected by General Manager` and ends the workflow.
- HR can act only after General Manager approval; approval marks the request `Approved`, updates leave balance, and notifies the employee, manager, and GM, while rejection moves it to `Rejected by HR` and ends the workflow.
- No stage can be skipped; only the assigned approver for the current stage can act; stale, duplicate, unauthorized, and out-of-order actions are rejected server-side; employees can cancel only still-pending requests.
- Every submission, approval, rejection, cancellation, and reminder is recorded with timestamp, actor, role, stage, status transition, and optional comment in append-only audit data.

## Authentication and role-specific access
- Use secure Manus OAuth application sessions with the starter `webdev_app_session` contract, and keep logged-out, loading, and role-not-configured states visible without simulating a user.
- Enforce Employee, Direct Manager, General Manager, HR, and Admin permissions in server procedures, including row-level request visibility, final approval, policy management, reporting, and user/reporting-line administration.

## Leave request, attachment, and calculation experience
- Provide configurable leave type selection, start/end date, half-day options, server/client total-day calculation excluding weekends and configured public holidays, reason/notes, and attachment metadata/upload flow.
- Auto-fill employee, department, submission date, and current status; validate file type and size before requesting managed storage; keep attachment ownership in the database.

## Role-specific dashboards and UI
- Employee dashboard shows leave balance, pending/approved/history requests, quick submit, status notifications, and a request detail stepper.
- Manager dashboard shows pending direct-report approvals, comments, team calendar, and team balances; GM dashboard shows manager-approved queue and department analytics; HR dashboard shows final approvals, org analytics, policy management, reports, and export controls; Admin panel manages users, departments, reporting lines, leave types, accrual rules, and public holidays.
- Provide one-click approve/reject controls with confirmation and optional comments, distinct status badges, visible `Submitted → Manager → GM → HR → Done` workflow tracker, empty/loading/error/unauthorized states, responsive mobile layout, and accessible interaction labels.

## Notifications, reminders, reporting, and audit
- Create durable in-app notifications and email outbox events on submission, every approval/rejection, cancellation, and final decision; support SMTP configuration without exposing credentials to the browser and preserve in-app delivery if SMTP is not configured.
- Provide a reminder-ready query/job path for requests pending longer than 48 hours with repeat-safe deduplication.
- Provide HR reporting by employee, department, leave type, and period; pending/approved/rejected ratios; leave-balance tracking; CSV export; and a print/PDF-ready report view.
- Provide filterable audit history by employee, date range, status, and approver with no application mutation for audit records.

## Documentation, runtime, and delivery
- Include full organized source code, README setup/deployment instructions, database schema/migrations, seed data, API documentation, secure server routes, health endpoint, managed route manifest, Docker-compatible production build, and project logo metadata.
- Verify diagnostics, typecheck, tests for the workflow invariants and business-day rules, production build, health endpoint, route manifest, and managed canonical checkpoint; do not publish publicly without a separate request.
