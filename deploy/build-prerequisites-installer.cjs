const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const script = path.join(__dirname, "server-prerequisites.nsi");
const output = path.join(root, "release", "ELMS-Server-Prerequisites-Setup.exe");
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
fs.mkdirSync(path.dirname(output), { recursive: true });
const makensis = findMakensis();
execFileSync(makensis, ["-V2", `-DOUT_FILE=${output}`, script], { cwd: __dirname, stdio: "inherit" });
console.log(`Created ${output}`);
