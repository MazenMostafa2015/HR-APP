# ELMS Internal Deployment Guide

This deployment has two parts:

1. **Central internal server:** Node.js application, MySQL database, authentication integration, attachment storage, SMTP, and the approval workflow.
2. **Employee Windows client:** `ELMS-Desktop-Setup.exe`, a thin desktop shell that connects to the central server. It contains no database and no local server.

## 1. Server prerequisites

Use a Windows Server 2022+ or a Linux server managed by IT. The server needs:

- Node.js 22 LTS
- pnpm 10.18.0 (`corepack enable` and `corepack prepare pnpm@10.18.0 --activate`)
- MySQL 8.x
- A DNS name or fixed LAN address, such as `elms-server.company.local`
- An approved TLS certificate if the server will be accessed over HTTPS
- Optional SMTP relay credentials

Copy the repository to the server, or use the packaged source release. For Windows Server, run PowerShell as Administrator from the repository:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\deploy\install-server.ps1
```

The script installs dependencies, builds the production bundle, runs migrations and seed data, creates the local storage directory, and opens the configured TCP port. It creates `.env` on the first run and stops so IT can edit secrets.

## 2. MySQL setup

Create a dedicated database and application user. Do not use the MySQL root account from the application:

```sql
CREATE DATABASE elms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'elms_app'@'localhost' IDENTIFIED BY 'use-a-long-random-password';
GRANT ALL PRIVILEGES ON elms.* TO 'elms_app'@'localhost';
FLUSH PRIVILEGES;
```

Set `DATABASE_URL` in the server `.env`, then run:

```powershell
pnpm db:migrate
pnpm db:seed
```

The seed is idempotent and is intended for initial reference data. Review or remove fixture data before production use if required by company policy.

## 3. Environment configuration

Copy `.env.internal.example` to `.env` and set every `REPLACE_` value. At minimum configure:

- `DATABASE_URL`: the private MySQL connection string
- `MANUS_JWT_SECRET`: a long random server-only secret
- `MANUS_PROJECT_ID`, `MANUS_OAUTH_API_URL`, and `MANUS_OAUTH_PORTAL_URL`: the approved OAuth broker values
- `OWNER_OPEN_ID`: the initial IT administrator identity
- `STORAGE_MODE=local` and `STORAGE_PATH`: a directory on a protected disk with scheduled backups
- `COOKIE_SECURE=true` and `COOKIE_SAMESITE=lax` when using HTTPS
- `SMTP_*` values if email notifications are required

### Authentication note

The current application uses the existing Manus OAuth contract on the server. Employees do not install OAuth credentials: their browser session is redirected to the configured OAuth portal and the callback is handled by the server. If the company requires direct Google Workspace or Azure AD/OIDC instead of the Manus OAuth broker, IT must supply or implement an OAuth adapter that returns the fields used by the app (`openId`, `name`, `email`, and access token). Register this callback URL with the identity provider:

```text
https://elms-server.company.local/api/oauth/callback
```

Do not put client secrets in the desktop installer or in the browser bundle.

## 4. Local attachment storage

With `STORAGE_MODE=local`, uploaded PDFs/JPGs/PNGs are written below `STORAGE_PATH`; they are not sent to cloud storage. Restrict the directory to the service account and back it up with the database. The application exposes files only through the authenticated application route.

Recommended Windows ACL approach:

```powershell
icacls C:\ProgramData\ELMS\storage /inheritance:r
icacls C:\ProgramData\ELMS\storage /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F'
```

## 5. Run as a service

Use NSSM, WinSW, or the company's standard service manager. Configure:

- Executable: `C:\Program Files\nodejs\node.exe`
- Arguments: `C:\ProgramData\ELMS\dist\index.js`
- Startup directory: `C:\ProgramData\ELMS`
- Environment: `NODE_ENV=production`, `PORT=3000`
- Restart on failure
- Run as a dedicated low-privilege service account with access to the storage directory

Verify:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health
```

## 6. LAN and reverse proxy

Create an internal DNS record pointing `elms-server.company.local` to the server's fixed LAN address. Allow TCP 3000 only from the employee VLAN, or expose HTTPS on 443 through IIS/nginx and keep Node bound behind the proxy. Do not expose the service directly to the public Internet.

If using a reverse proxy, preserve the `/api/*` and `/manus-storage/*` paths and forward the original HTTPS protocol. Test from an employee workstation:

```powershell
Invoke-WebRequest https://elms-server.company.local/api/health
```

## 7. Build and distribute the employee client

On a build machine:

```powershell
pnpm install
pnpm desktop:dist
```

Distribute `release\ELMS-Desktop-Setup.exe` through the company's software distribution tool. Code-sign the installer and executable with the company certificate before broad rollout.

If the build is performed on Linux, run `pnpm desktop:dist:direct` instead. It produces the same self-contained `release/ELMS-Desktop-Setup.exe` using the checked-in direct NSIS script. The result is unsigned and must be code-signed by IT before deployment.

Each employee:

1. Runs the installer (administrator rights may be required by company policy).
2. Launches **ELMS Desktop**.
3. Enters `https://elms-server.company.local` when prompted.
4. Signs in through the company OAuth portal.

The server URL is stored per Windows user under the Electron application data folder. To change it, delete that user's config file or use the application's server-change menu when exposed by the desktop shell.

## 8. Upgrade and backup runbook

For an upgrade, back up MySQL and `STORAGE_PATH`, stop the service, replace the application files, run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm db:migrate`, and restart the service. Keep the previous release available for rollback. Never run destructive schema resets against production.

Back up together:

- MySQL `elms` database
- `STORAGE_PATH`
- `.env` in a secrets manager (never commit it)
- OAuth provider configuration and TLS certificate material

## 9. Troubleshooting

- **Desktop says it cannot connect:** verify the URL, DNS, firewall, and `/api/health` from the workstation.
- **Login loops:** verify the registered callback URL, OAuth portal values, system time, HTTPS, and cookie settings.
- **Uploads fail:** verify `STORAGE_MODE`, `STORAGE_PATH`, service-account permissions, and free disk space.
- **Emails are not sent:** verify SMTP values and inspect the durable notification outbox in the database.
- **Database errors:** verify MySQL is running, `DATABASE_URL` is correct, and migrations have been applied.
