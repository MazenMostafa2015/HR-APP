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

The repository also includes a separate central-server bootstrap installer. Build it with:

```bash
pnpm server:prerequisites:dist
```

This produces `release/ELMS-Server-Prerequisites-Setup.exe`, which installs Node.js 22 LTS (including npm), Git for Windows, and pnpm 10.18.0 on the designated Windows server. It is not for employee PCs and does not install MySQL or the ELMS application itself.
