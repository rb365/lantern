#!/usr/bin/env node
// Bumps the patch version in package.json, stamps a build-time ISO
// timestamp, and writes both to public/build.json. Stamping a fresh
// build.json every commit means the deployed bundle always reflects
// the exact build that the CI produced, and the running app can read
// it to show "v0.1.4 • built 2026-08-06" in the header.
//
// We do this as a separate script (not a Vite plugin) so:
//   - we run before `vite build` to avoid the in-process loop
//   - we can be triggered manually with `node build-info.cjs --skip-bump`
//   - it works identically in CI and locally
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PKG_PATH = path.join(ROOT, "package.json");
const OUT_PATH = path.join(ROOT, "public", "build.json");

function readPkg() {
  return JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
}
function writePkg(pkg) {
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
}

function bumpPatch(version) {
  const parts = version.split(".").map((n) => parseInt(n, 10));
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}

function commitSha() {
  try {
    return require("child_process")
      .execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const skipBump = process.argv.includes("--skip-bump");
const pkg = readPkg();
let version = pkg.version;

if (!skipBump) {
  version = bumpPatch(pkg.version);
  pkg.version = version;
  writePkg(pkg);
}

const info = {
  version,
  builtAt: new Date().toISOString(),
  commit: commitSha(),
};
fs.writeFileSync(OUT_PATH, JSON.stringify(info, null, 2) + "\n");
console.log(`Lantern ${version} • ${info.builtAt} • ${info.commit}`);
