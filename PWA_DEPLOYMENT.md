# ELMS PWA deployment

The PWA is the recommended browser client. The Electron `desktop/` client remains available for legacy compatibility only; this guide does not remove or change its build scripts.

## HTTPS requirement

Service workers are limited to secure contexts. Use HTTPS for employee access over a LAN hostname or IP address. Browsers treat loopback origins such as `http://localhost` as secure for same-machine development, but a LAN address such as `http://192.168.1.10:3000` is not a secure context. [1] [2]

The app registers `/sw.js` only in production. Vite development does not register it. The production worker caches the app shell and static assets, but deliberately sends `/api/*`, `/oauth/*`, and `/manus-storage/*` to the network. Offline mode therefore provides the cached application shell; it does not cache approvals, attachments, or other authenticated data.

## Recommended internal setup: Caddy

Caddy is available as an official Windows binary. Install it as a persistent Windows service using the service manager approved for the server. [3] Make sure the employee network resolves `elms-server.sll-consult.local` to this server and can reach the Caddy HTTPS listener.

Use this Caddyfile for the internal hostname:

```text
elms-server.sll-consult.local {
    tls internal
    reverse_proxy 127.0.0.1:3000
}
```

`tls internal` makes Caddy issue a certificate from its local CA. Caddy may install its root certificate in the server's own trust store, but that does not automatically trust the certificate on employee PCs. Each client must trust the same root CA. [4] [5]

On the server, locate Caddy's `root.crt` under its data directory at `pki/authorities/local/root.crt`. The base directory depends on the Windows account that runs Caddy; keep Caddy's data directory persistent. Distribute **only** `root.crt` through an approved internal channel. Never copy or distribute the CA private key. Verify the certificate fingerprint through a separate trusted channel before installing it.

On each employee PC, import the root certificate into **Trusted Root Certification Authorities**. For a managed fleet, deploy it through the organization's certificate-management or Group Policy process. For a manual install, open `mmc`, add the **Certificates** snap-in for the **Computer account** and **Local computer**, then import the certificate under **Trusted Root Certification Authorities → Certificates**. This store is security-sensitive and normally requires administrator rights. [6] Caddy also documents the Windows command-line form:

```powershell
certutil -addstore -f ROOT C:\path\to\root.crt
```

Some browsers or managed profiles may use a separate certificate store. Restart the browser after import; if it still reports an untrusted certificate, check the browser's configured trust store and the deployed root fingerprint.

If the organization has a managed internal CA, use a certificate for the same hostname from that CA instead. IIS with an internal-CA binding or nginx with the internal certificate can be used as alternatives. In each case, terminate HTTPS at the proxy and forward to the existing Node service on `127.0.0.1:3000`.

## Session cookie setting and restart

After HTTPS is active at the proxy, keep `COOKIE_SECURE=true` in the server's `.env` and restart the ELMS Windows service. The repository's `.env.internal.example` already includes `COOKIE_SECURE=true` and `SMTP_FROM=ELMS <noreply@sll-consult.com>`. This PWA change does not modify OAuth handling, session-cookie code, email delivery code, API contracts, workflows, or the database.

The existing Windows installer still copies the repository, runs `pnpm install --frozen-lockfile` and `pnpm build`, and starts `dist/index.js`. Vite continues to emit the frontend to `dist/public`; the Express static directory and the install-server deployment path are unchanged.

## Verification checklist

Run these checks against the HTTPS origin from a client PC whose trust store contains the approved root certificate:

```powershell
$base = 'https://elms-server.sll-consult.local'

# Manifest must be returned as JSON with the manifest MIME type.
(Invoke-WebRequest "$base/manifest.webmanifest").Headers['Content-Type']
$manifest = Invoke-RestMethod "$base/manifest.webmanifest"
$manifest | ConvertTo-Json -Depth 8

# The worker must be JavaScript and must not be cached by an intermediary.
$worker = Invoke-WebRequest "$base/sw.js"
$worker.Headers['Content-Type']
$worker.Headers['Cache-Control']

# Confirm the PNG icon paths are reachable.
Invoke-WebRequest -Method Head "$base/icons/icon-192.png"
Invoke-WebRequest -Method Head "$base/icons/icon-512.png"
Invoke-WebRequest -Method Head "$base/icons/icon-maskable-512.png"
```

Expected headers include `application/manifest+json` for the manifest, `application/javascript` for `/sw.js`, and `Cache-Control: no-cache` for the worker. Static icons should return HTTP 200.

In Edge or Chrome, open DevTools → **Application** → **Manifest** and confirm the SLL-Consult name, `standalone` display mode, teal theme, language/direction, shortcuts, and all three icon sizes/purposes. Under **Application** → **Service Workers**, confirm `/sw.js` is registered with scope `/` and reaches **activated**. In Edge, the install banner appears when the browser fires `beforeinstallprompt`; the browser's Apps menu should also offer **Install SLL-Consult ELMS** when installability checks pass. If the banner was dismissed during testing, clear `localStorage` key `sll-elms-install-prompt-dismissed`. To test offline shell behavior, let the worker activate and cache the shell first, then use DevTools' offline network mode and reload a route. Authenticated API data is intentionally unavailable offline.

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts "MDN: Secure contexts"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers "MDN: Using service workers"
[3]: https://caddyserver.com/docs/install "Caddy installation"
[4]: https://caddyserver.com/docs/automatic-https "Caddy automatic HTTPS"
[5]: https://caddyserver.com/docs/running "Caddy running and local CA storage"
[6]: https://learn.microsoft.com/en-us/windows-hardware/drivers/install/trusted-root-certification-authorities-certificate-store "Microsoft: Trusted Root Certification Authorities store"
