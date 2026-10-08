# ELMS Deployment Presentation Script

## Server Prerequisites Installer, Firewall, and Desktop Setup

**Audience:** IT administrators, network administrators, service desk staff, and rollout coordinators  
**Suggested duration:** 12–15 minutes  
**Format:** 10-slide presenter-led deployment walkthrough

---

## Slide 1 — Deployment architecture

**On-screen title:** One central server, many employee desktop clients

**Presenter script:**

“ELMS uses a central-server architecture. The central Windows host runs the Node.js backend, MySQL, authentication integration, approval workflow, and attachment storage. Employees receive only the thin desktop client. The desktop application connects to the internal ELMS URL; it does not contain a local database or backend.”

**Diagram:**

```text
Employee PC 1 ─┐
Employee PC 2 ─┼── internal DNS / LAN / HTTPS ──> ELMS Server
Employee PC 3 ─┘                                  ├─ Node API
                                                   ├─ MySQL
                                                   └─ Local storage
```

**Key message:** Install the server prerequisites installer only on the designated server. Install the desktop Setup.exe on employee PCs.

---

## Slide 2 — Identify the two installers

**On-screen title:** Two Setup.exe files with different jobs

**Presenter script:**

“We have two installers. `ELMS-Server-Prerequisites-Setup.exe` prepares the central Windows server. It installs Node.js 22 LTS, npm, Git for Windows, and pnpm 10.18.0. `ELMS-Desktop-Setup.exe` installs the employee client. These files must not be swapped.”

| Installer | Where it runs | What it installs |
|---|---|---|
| `ELMS-Server-Prerequisites-Setup.exe` | Central server PC | Node.js 22 LTS, npm, Git, pnpm |
| `ELMS-Desktop-Setup.exe` | Employee Windows PCs | ELMS Electron desktop client |

**Presenter note:**

“The server prerequisites installer does not install MySQL or the ELMS backend. Those are configured in the following server deployment steps.”

---

## Slide 3 — Run the server prerequisites installer

**On-screen title:** Prepare the Windows server

**Presenter script:**

“On the designated server PC, sign in with an approved administrator account. Run `ELMS-Server-Prerequisites-Setup.exe` as Administrator. The installer downloads the official Node.js and Git installers over HTTPS, verifies their SHA-256 checksums, and installs the pinned tool versions.”

**Demonstration steps:**

1. Copy the installer to the designated server.
2. Right-click and select **Run as administrator**.
3. Accept the installer prompts.
4. Wait for the completion message.
5. Open a new elevated PowerShell window.
6. Verify the versions:

```powershell
node --version
npm --version
pnpm --version
git --version
```

**Expected results:**

- Node.js: version 22 LTS
- npm: included with Node.js
- pnpm: `10.18.0`
- Git: 64-bit Git for Windows

---

## Slide 4 — Continue the server installation

**On-screen title:** Prerequisites are not the complete server deployment

**Presenter script:**

“After the prerequisite installer completes, continue the server deployment. Install MySQL 8, create the `elms` database and the restricted `elms_app` account, copy the application files, configure `.env`, run migrations and seed data, build the production bundle, and register the backend as a Windows service.”

**Important separation:**

- The prerequisites installer installs developer/runtime tools.
- MySQL is installed separately.
- OAuth, SMTP, storage paths, and secrets are configured separately.
- The backend is started as a service after configuration.

**Verification command:**

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health
```

---

## Slide 5 — Choose the employee connection design

**On-screen title:** Direct Node port or HTTPS reverse proxy

**Presenter script:**

“There are two supported connection designs. For a small trusted LAN or initial testing, employee clients can connect directly to Node on TCP 3000. For production, the preferred design is HTTPS on TCP 443 through IIS, nginx, or the company reverse proxy, forwarding internally to Node on port 3000.”

| Design | Employee URL | Allowed inbound port |
|---|---|---:|
| Direct Node | `http://elms-server.company.local:3000` | TCP 3000 |
| Production proxy | `https://elms-server.company.local` | TCP 443 |

**Key message:** Do not expose MySQL 3306 or the raw Node service to the public Internet.

---

## Slide 6 — Configure DNS and Windows Firewall

**On-screen title:** Scope access to the employee VLAN

**Presenter script:**

“Create an internal DNS record that maps the stable name `elms-server.company.local` to the server’s fixed IP address or DHCP reservation. Then create a Windows Firewall rule limited to the employee subnet. Replace the example subnet with the actual company VLAN.”

**Direct Node example:**

```powershell
New-NetFirewallRule `
  -DisplayName 'ELMS API from employee VLAN' `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 `
  -RemoteAddress 192.168.10.0/24 -Profile Domain,Private
```

**HTTPS proxy example:**

```powershell
New-NetFirewallRule `
  -DisplayName 'ELMS HTTPS from employee VLAN' `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 `
  -RemoteAddress 192.168.10.0/24 -Profile Domain,Private
```

**Security message:**

“Do not use `RemoteAddress Any` when a company subnet is available. Do not create the rule on the Public profile. Keep TCP 3306 closed to employee PCs.”

---

## Slide 7 — Test connectivity from an employee PC

**On-screen title:** Test from the real employee network

**Presenter script:**

“A successful local test on the server is not enough. Run the tests from a normal employee workstation on the permitted VLAN. First verify DNS, then TCP reachability, then the application health endpoint.”

**HTTPS test:**

```powershell
Resolve-DnsName elms-server.company.local
Test-NetConnection elms-server.company.local -Port 443
Invoke-WebRequest https://elms-server.company.local/api/health
```

**Direct Node test:**

```powershell
Test-NetConnection elms-server.company.local -Port 3000
Invoke-WebRequest http://elms-server.company.local:3000/api/health
```

**Interpretation:**

- DNS failure: fix the internal DNS record or client DNS configuration.
- TCP failure: check VLAN routing, Windows Firewall, and upstream network ACLs.
- Health failure after TCP succeeds: check the reverse proxy, Node service, URL path, or TLS certificate.

---

## Slide 8 — Deploy the employee desktop Setup.exe

**On-screen title:** Install the thin client on employee PCs

**Presenter script:**

“Once the server URL works from an employee workstation, distribute `ELMS-Desktop-Setup.exe` through the approved software distribution tool or a controlled IT share. The employee runs the installer, launches ELMS Desktop, enters the approved internal URL, and completes company sign-in.”

**Employee steps:**

1. Run `ELMS-Desktop-Setup.exe`.
2. Accept the installation location.
3. Launch **ELMS Desktop**.
4. Select English or **العربية**.
5. Enter the approved internal server URL.
6. Select the open/connect button.
7. Sign in through the company OAuth portal.
8. Confirm the dashboard loads.

**Important:**

“Do not enter the server’s MySQL address, a localhost address, or a public URL. The client should use the company DNS name and the selected application protocol.”

---

## Slide 9 — First-user validation and rollout waves

**On-screen title:** Validate before broad distribution

**Presenter script:**

“Start with one IT test account and one representative employee account. Confirm login, Arabic and English switching, the dashboard, a leave request, an approval action, an attachment upload if applicable, and the notification path. Then distribute the client in rollout waves.”

**Pilot checklist:**

- [ ] Desktop installer completes successfully.
- [ ] Server URL is saved and survives restart.
- [ ] Employee can sign in.
- [ ] Arabic RTL layout displays correctly.
- [ ] Employee ID is visible where expected.
- [ ] Test leave request follows Manager → GM → HR.
- [ ] Attachments open through the authenticated route.
- [ ] `/api/health` remains available.

**Rollout approach:**

1. IT pilot.
2. HR and managers.
3. One department.
4. Remaining employee groups.

---

## Slide 10 — Troubleshooting and security handover

**On-screen title:** Keep the network secure and supportable

**Presenter script:**

“If a desktop cannot connect, check the URL, DNS, TCP port, Windows Firewall, upstream VLAN ACL, and the health endpoint in that order. If login loops, check HTTPS, the OAuth callback URL, cookies, and system time. If the service stops after reboot, check the Windows service recovery settings.”

**Handover records:**

- Server host name and fixed IP or DHCP reservation
- Internal DNS record
- Employee subnet/CIDR
- Firewall rule name and permitted port
- Reverse proxy and TLS certificate owner
- MySQL backup location
- ELMS storage backup location
- Service account and restart policy
- Installer checksums and signing status

**Closing script:**

“The safe deployment pattern is simple: prepare the server once, expose only the approved application port to the employee VLAN, test from a real workstation, and distribute the thin desktop client. The prerequisites installer accelerates the server preparation; it does not replace the database, application, firewall, or service configuration steps.”
