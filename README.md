# Employee Leave Management System (ELMS)

ELMS is a managed React/Express/tRPC/Drizzle application for employee leave requests with a strict **Direct Manager → General Manager → HR** approval chain. It runs on the Manus-managed server and MySQL capabilities selected for this project.

## Product behavior

Employees submit Annual, Sick, Unpaid, Maternity/Paternity, Emergency, and other configured leave types with dates, half-day options, reason, and optional or required attachments. Working days are calculated server-side, excluding weekends and configured public holidays. A request begins as `Pending Manager Approval` and can only move through the following transitions:

| Current state | Actor | Decision | Next state |
| --- | --- | --- | --- |
| Pending Manager Approval | assigned Direct Manager | Approve | Pending General Manager Approval |
| Pending Manager Approval | assigned Direct Manager | Reject | Rejected by Manager |
| Pending General Manager Approval | assigned General Manager | Approve | Pending HR Approval |
| Pending General Manager Approval | assigned General Manager | Reject | Rejected by General Manager |
| Pending HR Approval | assigned HR | Approve | Approved; balance deducted |
| Pending HR Approval | assigned HR | Reject | Rejected by HR |

The server rejects skipped stages, wrong approvers, stale requests, duplicate decisions, and attempts to change terminal requests. Every submit, approve, reject, cancel, and reminder action is written to `approvalActions` and the append-only `auditLogs` table. Notifications are created for the employee and the next or affected approvers.

## Roles

- **Employee:** submit, view, and cancel still-pending requests; view own history and balances.
- **Direct Manager:** review assigned direct-report requests and approve/reject with an optional comment.
- **General Manager:** review requests forwarded after Direct Manager approval.
- **HR:** final approval/rejection, reports, leave types, holidays, and all records.
- **Admin:** users, roles, departments, reporting lines, leave types, holidays, and policy configuration.

Authorization is enforced in server procedures. The UI only hides actions; it is not a security boundary.

## Development

The project uses pnpm 10.18.0.

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

The managed Preview listens on port `3000`. The server exposes `/api/health`, `/api/platform/config.js`, OAuth routes, and the tRPC API under `/api/trpc`. The client is served by Vite in development and the generated `dist` bundle in production.

### Database

The managed MySQL connection is provided through `DATABASE_URL`. Schema changes are additive and committed under `drizzle/`.

```bash
pnpm db:migrate
pnpm db:seed
```

`db:seed` is idempotent: it inserts reference data only when the corresponding code/open ID/request number does not already exist. It does not reset or delete live records. The seed includes sample users for every role, Engineering and Operations departments, leave policies, holidays, balances, and requests across pending, approved, and rejected stages. Seed identities are fixtures; real access still resolves through Manus OAuth.

## Authentication

ELMS preserves the starter's Manus OAuth implementation and the `webdev_app_session` cookie contract. There is no simulated user or development bypass. On first sign-in, the OAuth identity is synchronized into `users`; an Admin or HR operator can assign the application role, department, and reporting line from Administration. The project owner is mapped to Admin by the starter's owner identity rule.

## Attachments and email

Attachments are validated on the server (PDF/JPG/PNG, maximum 5 MB), uploaded through the managed storage helper, and retained as stable `/manus-storage/...` addresses plus database metadata. Browser code never receives storage credentials.

Each status event creates an in-app notification and a durable `notificationOutbox` record. Optional SMTP delivery uses protected environment values:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

If SMTP values are not configured, the in-app event and outbox record remain available; the product does not claim an email was delivered. A reminder-ready service query can be connected to a scheduled callback for requests pending longer than 48 hours, with dedupe keys to make repeated runs safe.

## Reports and exports

HR and Admin can filter reports by date, review pending/approved/rejected ratios, inspect leave usage by department and type, print the report to PDF through the browser print dialog, and export the same data as CSV. Audit records can be filtered by request, actor, status, and date range through the `audit.list` procedure.

## Deployment

The generated Dockerfile builds the Vite client and bundled Express server, honors `PORT`, and serves `/api/health` without authentication. Managed publication uses the committed build configuration. Public publication is intentionally not enabled by default; a checkpoint is safe to preview and review before a separate publication decision.

## Project files

- `drizzle/schema.ts` — relational schema and status enums.
- `drizzle/0001_clammy_night_thrasher.sql` — additive migration from the starter users table.
- `drizzle/seed.ts` — idempotent sample data.
- `server/services/workflow.ts` — authoritative approval transition and balance update logic.
- `server/services/notifications.ts` — in-app notification and SMTP outbox adapter.
- `server/routers.ts` — protected tRPC API and role guards.
- `client/src/pages/` — responsive dashboards, request form/detail, reports, and administration.
- `API.md` — procedure and permission reference.
