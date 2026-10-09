# ELMS Technical Presentation Script

## Arabic RTL Localization and Employee ID Schema Changes

**Audience:** Developers, IT administrators, database administrators, and technical leads  
**Suggested duration:** 12–15 minutes  
**Format:** 9-slide technical walkthrough

---

## Slide 1 — Implementation overview

**On-screen title:** Two additive features, one shared application

**Presenter script:**

“This release adds two capabilities without creating a second application or a second database. Employee ID is implemented as a new nullable, unique field on the existing `users` table. Arabic localization is implemented in the client language provider, which controls the document language, layout direction, translation catalog, and live translation of detailed page content.”

**Technical outcomes:**

- Existing users and leave requests remain compatible.
- Existing English mode remains available.
- Arabic switches the interface to right-to-left layout.
- The server remains the source of truth for employee IDs.

---

## Slide 2 — Employee ID data model

**On-screen title:** `users.employeeId`

**Presenter script:**

“The Employee ID is a business identifier, not the internal numeric user primary key and not the OAuth `openId`. It is stored on the existing `users` table as a nullable `varchar(64)`. Nullable is important for rollout: existing users do not need to be completed before the application can start. HR can populate IDs progressively.”

**Schema change:**

```ts
employeeId: varchar("employeeId", { length: 64 }),
```

**Constraint:**

```ts
uniqueIndex("users_employee_id_unique").on(table.employeeId)
```

**Presenter note:**

“MySQL allows multiple `NULL` values in a unique index, while rejecting duplicate non-empty Employee IDs. This gives us safe staged adoption with uniqueness once a value is assigned.”

---

## Slide 3 — Drizzle migration

**On-screen title:** Additive migration `0002_conscious_sunset_bain.sql`

**Presenter script:**

“The database change is delivered through a normal Drizzle migration. The migration adds the column and the unique constraint; it does not modify leave requests, balances, approval actions, or existing user records.”

```sql
ALTER TABLE `users` ADD `employeeId` varchar(64);
ALTER TABLE `users`
  ADD CONSTRAINT `users_employee_id_unique` UNIQUE(`employeeId`);
```

**Deployment behavior:**

- `pnpm db:migrate` applies the migration once.
- The migration journal records completion.
- Re-running migrations does not repeat an applied migration.
- A pre-migration MySQL backup is still required.

---

## Slide 4 — Employee ID API and administration UI

**On-screen title:** Controlled write path

**Presenter script:**

“The admin API exposes the Employee ID through the existing People Directory query and update mutation. The update mutation accepts a trimmed value up to 64 characters, converts an empty value to `NULL`, and writes it together with the existing role, department, manager, and active-state fields.”

**API behavior:**

```ts
employeeId: z.string().trim().max(64).nullable()
```

**Authorization:**

- HR can view the directory.
- Only the administrator role can update user profiles through the existing protected mutation.
- The database unique constraint remains the final protection against duplicates.

**Demonstration:**

“An administrator enters `EMP-001`, saves the row, and receives the normal profile-updated confirmation. If the ID already exists, the database rejects the duplicate and the administrator must correct the value.”

---

## Slide 5 — Language state and persistence

**On-screen title:** Language context and local preference

**Presenter script:**

“Language state is owned by `LanguageProvider` in `client/src/contexts/LanguageContext.tsx`. The supported values are `en` and `ar`. The selected value is stored in browser `localStorage` under `elms-language`, so switching language does not require a server request or a user profile migration.”

**State flow:**

```text
Language toggle
      ↓
LanguageProvider.setLanguage("ar")
      ↓
localStorage: elms-language = ar
      ↓
<html lang="ar" dir="rtl">
      ↓
Arabic labels and RTL layout
```

**Desktop integration:**

“The Electron shell separately persists the same choice in its local `config.json`. The preload bridge applies `lang`, `dir`, and the web-app language preference when the hosted ELMS page loads.”

---

## Slide 6 — RTL layout implementation

**On-screen title:** Direction changes at the document root

**Presenter script:**

“When Arabic is selected, the provider sets `document.documentElement.lang` to `ar` and `document.documentElement.dir` to `rtl`. The stylesheet then mirrors the fixed navigation rail, main canvas, navigation arrow, profile area, form accent, and responsive layout.”

**Representative CSS:**

```css
html[dir="rtl"] .side-rail {
  left: auto;
  right: 0;
}

html[dir="rtl"] .main-canvas {
  margin-left: 0;
  margin-right: 248px;
}
```

**Presenter note:**

“Using the root direction attribute keeps the layout decision centralized. The application does not maintain a separate Arabic page tree, so routing, permissions, and workflow behavior remain identical.”

---

## Slide 7 — Detailed content translation

**On-screen title:** Shared translation catalog plus live DOM coverage

**Presenter script:**

“The translation catalog contains the detailed page vocabulary: dashboard metrics, request lists, form labels, placeholders, report headings, approval dialogs, statuses, loading states, error messages, and administration labels. Existing shell components use the `t()` helper directly. For detailed legacy page content that still contains literal strings, the provider also walks rendered text nodes and translatable attributes.”

**Translation behavior:**

- Exact English labels map to Arabic catalog entries.
- Dynamic patterns cover visible record counts, day counts, leave type labels, and status wording.
- Placeholders, titles, and ARIA labels are translated where catalog entries exist.
- A `MutationObserver` applies translations to newly rendered content.
- Original text is retained per node so switching back to English is reversible.

**Accessibility note:**

“The provider updates the document language and direction, which helps screen readers identify Arabic content and ensures browser-level RTL behavior.”

---

## Slide 8 — Migration and rollout sequence

**On-screen title:** Safe production rollout

**Presenter script:**

“The recommended rollout is additive and reversible at the application level. First back up the database and attachment storage. Then deploy the source release, install the locked dependencies, run the migration, build the server, and restart the service.”

**Windows server sequence:**

```powershell
Set-Location C:\ProgramData\ELMS
mysqldump -u elms_app -p --single-transaction `
  --routines --triggers elms > D:\ELMS-Backups\before-employee-id.sql
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
Restart-Service ELMS
Invoke-WebRequest http://127.0.0.1:3000/api/health
```

**Post-migration verification:**

```powershell
mysql -u elms_app -p -h 127.0.0.1 -D elms -e `
  "SHOW COLUMNS FROM users LIKE 'employeeId';"
```

“After the health check, verify the People Directory, assign a test Employee ID, switch to Arabic, open the new request form, and submit a controlled test request.”

---

## Slide 9 — Rollback, compatibility, and support

**On-screen title:** What happens if rollout must be reversed?

**Presenter script:**

“The migration is additive. If the new application must be rolled back, the previous application release can safely ignore the additional nullable column. The preferred rollback is therefore application rollback while leaving the column in place. Do not drop `employeeId` as part of a routine rollback because HR may already have populated values.”

**Operational rules:**

- Keep the pre-migration database backup.
- Keep the previous application release available.
- Never run a destructive schema reset in production.
- Correct duplicate Employee IDs through the administration workflow.
- Restore the database only after a database administrator confirms the restore point.
- Confirm `/api/health`, login, People Directory, Arabic toggle, and a test request after recovery.

**Closing script:**

“These changes are intentionally isolated. Employee ID adds a controlled business field to the existing identity model. Arabic localization changes the presentation layer and document direction. Neither change alters the approval workflow, attachment storage, database relationships, or employee access model.”

---

## Technical reference table

| Area | Implementation | Operational owner |
|---|---|---|
| Employee ID storage | `users.employeeId` `varchar(64)` nullable | Database administrator |
| Employee ID uniqueness | `users_employee_id_unique` | MySQL / Drizzle |
| Employee ID editing | Protected admin update mutation | System administrator |
| Language preference | Electron `config.json` and browser `localStorage` | Employee / IT |
| Arabic direction | `<html lang="ar" dir="rtl">` | Client application |
| Detailed translation | Shared catalog, DOM text/attribute translation, mutation observer | Frontend maintainers |
| Migration command | `pnpm db:migrate` | IT administrator |
| Rollback approach | Restore previous app release; retain additive column | IT + DBA |
