# ELMS API reference

The browser calls the tRPC router at `/api/trpc`. All procedures except `auth.me`, `auth.logout`, and the starter `system` procedures require the Manus OAuth application session.

## Permission matrix

| Procedure family | Employee | Manager | General Manager | HR | Admin |
| --- | ---: | ---: | ---: | ---: | ---: |
| `dashboard.summary` | own | direct reports | GM queue | org-wide | org-wide |
| `leaveTypes.list` | yes | yes | yes | yes | yes |
| `leaveRequests.list/get` | own | direct reports | assigned GM | all | all |
| `leaveRequests.create/cancel` | own | no | no | no | no |
| `leaveRequests.decide` | no | assigned manager stage | assigned GM stage | HR stage | no |
| `notifications.*` | own | own | own | own | own |
| `audit.list` | visible requests | visible requests | visible requests | all | all |
| `reports.*` | no | no | no | yes | yes |
| `attachments.upload` | authenticated | authenticated | authenticated | authenticated | authenticated |
| `admin.*` | no | no | no | policy/read-only user views | yes; HR has policy/read access |

## Auth

- `auth.me` → current application user or `null`.
- `auth.logout` → `{ success: true }` and clears `webdev_app_session`.

## Dashboard and reference data

- `dashboard.summary` → `{ user, metrics, balances, queue, upcoming, recentRequests, notifications }`.
- `leaveTypes.list` → active leave types with annual allowance and attachment policy.

## Leave requests

- `leaveRequests.list({ status?, from?, to? })` → visible enriched request rows.
- `leaveRequests.get({ id })` → enriched request details and immutable audit timeline.
- `leaveRequests.create({ leaveTypeId, startDate, endDate, startHalfDay, endHalfDay, reason, attachment? })` → creates `Pending Manager Approval`, assigns the employee's manager plus the first active General Manager and HR approver, writes submit audit data, and queues notifications.
- `leaveRequests.decide({ id, decision: "approve" | "reject", comment? })` → runs the authoritative transactional transition service. The server ignores any client-supplied next stage or approver.
- `leaveRequests.cancel({ id, comment? })` → employee-only cancellation while the request is still `Pending Manager Approval`.

## Attachments

- `attachments.upload({ fileName, contentType, dataBase64 })` → validates PDF/JPG/PNG and a 5 MB limit, uploads to managed storage, and returns `{ key, url, name, type, size }` for inclusion in a request submission.

## Notifications and audit

- `notifications.list` → latest 50 in-app notifications for the current user.
- `notifications.markRead({ id })` → marks one notification read only if owned by the current user.
- `audit.list({ requestId?, actorId?, from?, to?, status? })` → filterable lifecycle history limited to the caller's visible requests.

## Reports and administration

- `reports.summary({ from?, to? })` → HR/Admin totals, status counts, department usage, leave-type usage, and enriched rows.
- `reports.exportCsv({ from?, to? })` → CSV text for the same report scope.
- `admin.users` → HR/Admin directory with department and manager labels.
- `admin.departments` / `admin.leaveTypes` / `admin.holidays` → reference data.
- `admin.updateUser({ id, role, departmentId, managerId, active })` → Admin-only role and reporting-line update.
- `admin.createLeaveType({ name, code, annualAllowance, requiresAttachment, color })` → HR/Admin policy creation.
- `admin.createHoliday({ name, date })` → HR/Admin holiday creation.

## Status values

`Pending Manager Approval`, `Pending General Manager Approval`, `Pending HR Approval`, `Approved`, `Rejected by Manager`, `Rejected by General Manager`, `Rejected by HR`, and `Cancelled`.

## Immutable lifecycle events

Every lifecycle mutation writes the actor ID, actor role, stage, action, previous status, next status, timestamp, and optional comment to `approvalActions` and `auditLogs`. The application has no update/delete procedure for audit rows.
