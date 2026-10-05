const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const payload = path.join(root, "release", "win-unpacked");
const output = path.join(root, "release", "ELMS-Desktop-Setup.exe");
const script = path.join(root, "desktop", "direct-installer.nsi");

function findMakensis() {
  if (process.env.MAKENSIS) return process.env.MAKENSIS;
  const candidates = [
    "makensis",
    "/usr/bin/makensis",
    ...fs.globSync("/home/*/.cache/electron-builder/nsis-*/**/linux/makensis"),
  ];
  for (const candidate of candidates) {
    try { execFileSync(candidate, ["/VERSION"], { stdio: "ignore" }); return candidate; } catch {}
  }
  throw new Error("makensis was not found. Install NSIS or set MAKENSIS to its executable path.");
}

if (!fs.existsSync(path.join(payload, "ELMS Desktop.exe"))) {
  throw new Error(`Windows payload not found at ${payload}. Run electron-builder --win --dir first.`);
}
fs.mkdirSync(path.dirname(output), { recursive: true });
const makensis = findMakensis();
execFileSync(makensis, ["-V2", `-DPAYLOAD_DIR=${payload}`, `-DOUT_FILE=${output}`, script], { cwd: root, stdio: "inherit" });
console.log(`Created ${output}`);
