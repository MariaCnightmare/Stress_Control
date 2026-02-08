const fs = require("node:fs");
const path = require("node:path");

const outDir = path.resolve(__dirname, "..", "dist", "electron");
const pkgPath = path.join(outDir, "package.json");
const payload = JSON.stringify({ type: "module" }, null, 2);

try {
  fs.mkdirSync(outDir, { recursive: true });
  const existing = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, "utf-8") : "";
  if (existing.trim() !== payload) {
    fs.writeFileSync(pkgPath, payload);
  }
} catch (err) {
  // Non-fatal in dev; Electron will report a clearer error if this fails.
  console.warn("[ensure-electron-module] Unable to write package.json:", err?.message ?? err);
}
