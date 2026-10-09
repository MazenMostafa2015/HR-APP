# ELMS on a Standard Windows PC

## MySQL and Backend API Installation Guide

This guide installs the **central ELMS server** on a Windows 10/11 PC or Windows workstation that is kept on and connected to the company LAN.

The recommended production target is still **Windows Server 2022+**. A standard PC can host ELMS for a small internal deployment if it is treated as a server: fixed network address, automatic startup, restricted access, reliable power, backups, and scheduled maintenance.

> **Architecture:** Employees run `ELMS-Desktop-Setup.exe`. The Windows host runs the backend API, web application, MySQL database, OAuth integration, and local attachment storage. Employee PCs do not need MySQL or a local backend.

---

## 1. Before you start

Prepare these values with your IT or network administrator:

- A fixed LAN IP address, or a DHCP reservation for the host PC
- An internal DNS name, for example `elms-server.company.local`
- The employee network/VLAN that is allowed to reach ELMS
- The approved OAuth broker and callback registration
- Optional SMTP relay details for email notifications
- A backup destination on a different disk or network share
- A Windows account that can install software and create firewall rules

Choose an installation directory. The repository scripts use:

```text
C:\ProgramData\ELMS
```

Use a dedicated data directory for attachments:

```text
C:\ProgramData\ELMS\storage
```

Do not place `.env`, database files, or uploaded documents inside a user profile or a shared Desktop folder.

---

## 2. Prepare the Windows host

### 2.1 Set the PC up as a server

For a reliable host:

1. Connect it to wired Ethernet where possible.
2. Create a DHCP reservation or configure a static IPv4 address through company policy.
3. Rename the PC to an IT-approved host name.
4. Install current Windows updates, then define a maintenance window for future updates.
5. Configure the power plan so the PC does not sleep or hibernate while plugged in.
6. Disable automatic consumer restarts or shutdowns during business hours where company policy permits.
7. Put the PC behind a UPS if it is business-critical.
8. Restrict interactive logon to administrators; do not use a shared admin password.
9. Enable Windows Defender and keep the host on the company endpoint-management policy.

Use a dedicated local or domain service identity for the API service. It should not be a full domain administrator.

### 2.2 Install Git and Node.js

For the fastest supported setup, IT can run `release\ELMS-Server-Prerequisites-Setup.exe` as Administrator. It downloads and installs Node.js 22.23.3 LTS with npm, Git for Windows 2.56.0.2, and pnpm 10.18.0 through Corepack. The installer verifies SHA-256 checksums and prints the installed versions. It does not install MySQL or the ELMS application backend.

If the prerequisite installer is not available, install the tools manually as described below.

Install:

- **Node.js 22 LTS**
- **Git for Windows**

Open a new **PowerShell as Administrator** after installation and verify:

```powershell
node --version
npm --version
git --version
```

The Node version must be compatible with the project requirement: **Node.js 22 LTS**.

Enable and activate the required pnpm version:

```powershell
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm --version
```

Expected pnpm version: `10.18.0`.

If `corepack` is unavailable, install the approved pnpm version through the company software process rather than using an arbitrary global version.

---

## 3. Install MySQL 8 on Windows

### 3.1 Install MySQL Server

Use the approved **MySQL Installer for Windows** from your software repository or the official MySQL distribution.

During setup:

1. Choose **Server only** if database administration will be done with command line tools, or choose **Developer Default** if IT also wants MySQL Workbench.
2. Install **MySQL Server 8.x**.
3. Configure it as a **Windows Service**.
4. Set the service to start automatically with Windows.
5. Keep the default MySQL port `3306` unless company policy requires another port.
6. Set a strong root password and store it in the approved secrets manager.
7. Prefer binding MySQL to `127.0.0.1` because only the local ELMS backend needs database access.
8. Do not open TCP `3306` to the employee LAN.

The service is commonly named `MySQL80`. Verify it from an elevated PowerShell:

```powershell
Get-Service MySQL80
Start-Service MySQL80
Set-Service MySQL80 -StartupType Automatic
```

If the service has a different name, find it with:

```powershell
Get-Service | Where-Object { $_.Name -match 'mysql' -or $_.DisplayName -match 'mysql' }
```

Verify the client is available:

```powershell
mysql --version
mysql -u root -p -e "SELECT VERSION();"
```

If `mysql.exe` is not found, add the MySQL `bin` directory to the system `PATH`, commonly similar to:

```text
C:\Program Files\MySQL\MySQL Server 8.0\bin
```

Open a new PowerShell after changing `PATH`.

### 3.2 Create the ELMS database and application user

Log in as the MySQL root administrator:

```powershell
mysql -u root -p
```

Run the following SQL. Replace the password with a long, unique value stored in the company secrets manager:

```sql
CREATE DATABASE elms
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'elms_app'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';

GRANT ALL PRIVILEGES ON elms.* TO 'elms_app'@'localhost';
FLUSH PRIVILEGES;
```

Test the application account:

```powershell
mysql -u elms_app -p -h 127.0.0.1 -D elms -e "SELECT DATABASE();"
```

Use the application account in ELMS. Do not put the root password in `.env` and do not run the backend as root.

### 3.3 MySQL reliability settings

Confirm that:

- The MySQL service starts automatically.
- The database directory is on a healthy local disk.
- The disk has enough free space for growth and temporary backup files.
- Windows Defender or endpoint security is not blocking the MySQL service.
- The MySQL error log is included in the host monitoring plan.
- TCP `3306` is not exposed to the employee VLAN unless there is a documented exception.

---

## 4. Copy and install the ELMS backend

### 4.1 Copy the source

From an approved release location, copy or clone the repository to a staging folder. For example:

```powershell
New-Item -ItemType Directory -Force C:\Source | Out-Null
Set-Location C:\Source
git clone https://github.com/MazenMostafa2015/HR-APP.git HR-APP
Set-Location C:\Source\HR-APP
```

If the server cannot access GitHub, use an approved source-release archive instead. Do not copy `node_modules`, `dist`, `.env`, or production secrets from another machine.

### 4.2 Create the production folder

The repository includes an installation script that copies the application to:

```text
C:\ProgramData\ELMS
```

Run PowerShell as Administrator from the repository root:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\deploy\install-server.ps1
```

On the first run, the script creates `C:\ProgramData\ELMS\.env`, creates the local storage folder, and stops so the environment can be configured. An exit code of `2` at this stage is expected.

If you need a different port or want to skip seed fixtures:

```powershell
.\deploy\install-server.ps1 -Port 3000 -SkipSeed
```

### 4.3 Configure `.env`

Open the file only with an administrator-approved editor:

```powershell
notepad C:\ProgramData\ELMS\.env
```

Set at least these values:

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://elms_app:REPLACE_WITH_PASSWORD@127.0.0.1:3306/elms
MANUS_PROJECT_ID=internal-elms
MANUS_JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
MANUS_OAUTH_API_URL=https://YOUR-OAUTH-BROKER.example.com
MANUS_OAUTH_PORTAL_URL=https://YOUR-OAUTH-BROKER.example.com
OWNER_OPEN_ID=REPLACE_WITH_IT_ADMIN_OPEN_ID
STORAGE_MODE=local
STORAGE_PATH=C:\ProgramData\ELMS\storage
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=ELMS <noreply@company.example>
```

Important rules:

- Use a long random `MANUS_JWT_SECRET` and never reuse it elsewhere.
- Keep `.env` out of Git, email, screenshots, and the desktop installer.
- Keep `STORAGE_MODE=local` for an internal file-system deployment.
- Use `COOKIE_SECURE=true` only when employees access ELMS through HTTPS. For temporary HTTP-only lab testing, use `COOKIE_SECURE=false`, but do not use that setting for a production deployment.
- The current application expects the existing Manus OAuth contract. If the company requires direct Google Workspace or Azure AD/OIDC, an approved OAuth adapter must be supplied and tested; do not place provider secrets in the desktop app.

### 4.4 Apply migrations, seed data, and build

From the production directory:

```powershell
Set-Location C:\ProgramData\ELMS
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm build
```

The seed is intended for initial reference data and is idempotent. Review the seeded records before opening the system to employees.

The production server entrypoint is:

```text
C:\ProgramData\ELMS\dist\index.js
```

---

## 5. Set storage permissions

The application stores uploaded PDFs, JPGs, and PNGs below `STORAGE_PATH`.

Restrict the directory so only the service identity, SYSTEM, and approved administrators can access it. Example ACL commands:

```powershell
icacls C:\ProgramData\ELMS\storage /inheritance:r
icacls C:\ProgramData\ELMS\storage /grant:r `
  'SYSTEM:(OI)(CI)F' `
  'Administrators:(OI)(CI)F'
```

If the API runs under a dedicated domain or local service account, grant that account Modify access instead of granting broad access to Users:

```powershell
icacls C:\ProgramData\ELMS\storage /grant 'ELMS-SVC:(OI)(CI)M'
```

Confirm the service account can create and read a test file, then remove the test file. Back up the storage directory together with the MySQL database.

---

## 6. Run the backend as a Windows service

Do not rely on a logged-in user’s PowerShell window for production hosting. Use **NSSM**, **WinSW**, or the company’s approved service manager.

### 6.1 Service configuration

Use these values:

| Setting | Value |
|---|---|
| Executable | `C:\Program Files\nodejs\node.exe` |
| Arguments | `C:\ProgramData\ELMS\dist\index.js` |
| Startup directory | `C:\ProgramData\ELMS` |
| Environment | `NODE_ENV=production` and `PORT=3000` |
| Account | Dedicated low-privilege service account |
| Startup | Automatic / delayed automatic |
| Failure action | Restart the service after 1 minute; repeat on failure |
| Output logs | Dedicated log directory, rotated by policy |

The application also reads `.env` from its working directory. Keep the service startup directory set to `C:\ProgramData\ELMS`.

### 6.2 Test manually before registering the service

Run this once from PowerShell to confirm the application starts:

```powershell
Set-Location C:\ProgramData\ELMS
$env:NODE_ENV = 'production'
$env:PORT = '3000'
node .\dist\index.js
```

In a second PowerShell window:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health
```

Expected response:

```json
{"status":"ok"}
```

Stop the manual process with `Ctrl+C` after the test, then start it through the service manager.

### 6.3 Service recovery check

After registering the service:

```powershell
Get-Service ELMS
Restart-Service ELMS
Get-Service ELMS
```

Verify the health endpoint again. Reboot the PC during a maintenance window and confirm that MySQL and ELMS start automatically without an interactive login.

---

## 7. Configure the local network safely

### 7.1 DNS and address

Create an internal DNS record such as:

```text
elms-server.company.local  →  192.168.10.25
```

Prefer a DHCP reservation over manually assigning an address unless your network team requires a static address. Test name resolution from an employee PC:

```powershell
Resolve-DnsName elms-server.company.local
Test-NetConnection elms-server.company.local -Port 3000
```

### 7.2 Windows Firewall

The repository installer creates a Domain/Private inbound rule for the configured API port. If you need to create it manually, restrict the rule to the employee network rather than allowing all sources:

```powershell
New-NetFirewallRule `
  -DisplayName 'ELMS API TCP 3000' `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3000 `
  -Action Allow `
  -Profile Domain,Private `
  -RemoteAddress 192.168.10.0/24
```

Do not create a Public-profile rule for the API. Do not open MySQL port `3306` to employee PCs.

If the reverse proxy is serving HTTPS, allow only TCP 443 from the employee subnet and keep direct Node access restricted:

```powershell
New-NetFirewallRule `
  -DisplayName 'ELMS HTTPS from employee VLAN' `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 443 `
  -Action Allow `
  -Profile Domain,Private `
  -RemoteAddress 192.168.10.0/24
```

After creating or changing a rule, test from an employee workstation, not only from the server:

```powershell
Test-NetConnection elms-server.company.local -Port 443
Invoke-WebRequest https://elms-server.company.local/api/health
```

For direct Node mode, test port 3000 and use the matching `http://` URL. The desktop application needs only the selected application port. It does not need access to MySQL 3306, RDP, SSH, or any development port.

### 7.3 HTTPS recommendation

For production, place IIS, nginx, or the company reverse proxy in front of Node:

```text
Employee PC → HTTPS 443 → reverse proxy → Node 3000 → MySQL localhost:3306
```

Configure:

- An approved certificate for `elms-server.company.local`
- HTTP-to-HTTPS redirect
- Forwarding of `/api/*`
- Forwarding of `/manus-storage/*`
- Original HTTPS protocol forwarding
- Request size sufficient for approved attachments
- Access logs and rotation

The OAuth callback should be registered as:

```text
https://elms-server.company.local/api/oauth/callback
```

Use the HTTPS URL in the employee desktop client. Do not publish the raw Node port publicly.

---

## 8. First end-to-end test

Perform these tests from a normal employee workstation:

```powershell
Invoke-WebRequest https://elms-server.company.local/api/health
```

Then launch ELMS Desktop and confirm:

1. The server URL is accepted.
2. The company login portal opens.
3. A user can authenticate and return to ELMS.
4. The dashboard loads.
5. A test leave request can be created.
6. Approval routing shows the expected status.
7. A permitted attachment uploads and can be retrieved.
8. An email notification arrives if SMTP is enabled.

Use a test account and test attachment. Remove test records according to company policy before production use.

---

## 9. Backups and reliability operations

Back up **both** the database and attachment directory. A database backup without attachments is incomplete.

### 9.1 MySQL backup

Example command using `mysqldump`:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
mysqldump -u elms_app -p `
  --single-transaction --routines --triggers `
  elms | Out-File "D:\ELMS-Backups\elms-$stamp.sql" -Encoding utf8
```

For unattended backups, use a protected credentials mechanism approved by IT; do not put the database password directly in a scheduled task command line.

### 9.2 Storage backup

Copy the storage directory to a separate disk or protected network backup target:

```powershell
robocopy C:\ProgramData\ELMS\storage D:\ELMS-Backups\storage /E /Z /R:3 /W:10
```

Use the company backup platform for retention, encryption, off-host copies, and restore testing.

### 9.3 Minimum operational controls

- Daily database backup
- Daily attachment backup
- At least one off-host or offline copy
- Monthly restore test
- Disk-space alert for the OS, database, and storage volumes
- Monitoring for MySQL and ELMS service state
- Monitoring for HTTP health response
- Documented owner for the OAuth certificate and TLS certificate
- Documented rollback copy of the previous application release

Before an upgrade:

```text
1. Back up MySQL and STORAGE_PATH.
2. Stop the ELMS service.
3. Replace application files.
4. Run pnpm install --frozen-lockfile.
5. Run pnpm build.
6. Run pnpm db:migrate.
7. Start ELMS.
8. Verify /api/health and a test login.
```

Never run destructive schema resets against production.

---

## 10. Troubleshooting checklist

### Desktop cannot connect

- Confirm the desktop is using the correct HTTPS URL.
- Run `Resolve-DnsName` from the workstation.
- Run `Test-NetConnection <hostname> -Port 443` or `-Port 3000` as appropriate.
- Check the ELMS service state.
- Check the Windows Firewall profile and remote-address scope.
- Test `/api/health` from the workstation.

### Login loops or callback errors

- Verify the registered callback URL exactly.
- Verify system time on the host and workstation.
- Confirm HTTPS is active and `COOKIE_SECURE=true`.
- Confirm the OAuth portal and API URLs in `.env`.
- Check reverse-proxy forwarding of the original HTTPS protocol.

### Uploads fail

- Check `STORAGE_MODE=local`.
- Check `STORAGE_PATH` exists.
- Check the service account has Modify permission.
- Check free disk space and endpoint-security logs.

### Database errors

- Confirm `MySQL80` is running.
- Test `mysql -u elms_app -p -h 127.0.0.1 -D elms`.
- Verify `DATABASE_URL` has the correct password and database name.
- Confirm `pnpm db:migrate` has completed.

### Service stops after reboot

- Confirm the service is Automatic or Delayed Automatic.
- Confirm the service account password has not expired.
- Confirm the service startup directory is `C:\ProgramData\ELMS`.
- Inspect the service manager log and `dist\index.js` startup output.
- Test Node and MySQL paths from the service account context.

---

## Final production checklist

- [ ] Fixed IP or DHCP reservation is documented.
- [ ] Internal DNS name resolves from an employee workstation.
- [ ] MySQL 8 is installed as an automatic Windows service.
- [ ] `elms` database and `elms_app` user exist.
- [ ] `.env` is configured and excluded from backups accessible to general users.
- [ ] Migrations and seed data completed.
- [ ] Local storage ACL is restricted.
- [ ] API runs through a service manager and restarts after reboot.
- [ ] HTTPS reverse proxy and OAuth callback are tested.
- [ ] Firewall allows only the required employee network.
- [ ] Port 3306 is not exposed to employee PCs.
- [ ] Database and attachment backups are scheduled and restore-tested.
- [ ] A normal employee can log in, submit a test request, and upload an approved test attachment.
