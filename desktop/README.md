# ELMS Desktop Client

This is a thin Electron shell. It does not contain the database or application server. On first launch, the employee enters the internal ELMS URL; the shell then loads that URL and stores it in the user's application data folder.

Build from the repository root:

```bash
pnpm install
pnpm desktop:dist
```

The NSIS installer is written to `release/ELMS-Desktop-Setup.exe`. Build it on Windows for the most predictable signing and antivirus results.

For a self-contained installer from Linux, use the direct NSIS path:

```bash
pnpm desktop:dist:direct
```

This packages the Windows Electron payload into one `ELMS-Desktop-Setup.exe` using `desktop/direct-installer.nsi`. The generated installer is unsigned; IT should sign it with the company Windows code-signing certificate before broad rollout.
