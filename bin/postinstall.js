#!/usr/bin/env node
/* claude-iris npm postinstall — runs install.sh quietly so the slash
   commands work right after `npm i -g claude-iris`. Failure here MUST
   never break the install — we just print a friendly hint.
*/

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

if (process.env.CLAUDE_IRIS_SKIP_POSTINSTALL === "1") {
  process.exit(0);
}

if (process.platform === "win32") {
  console.log("");
  console.log("[claude-iris] Native Windows isn't supported — please use WSL2.");
  console.log("");
  console.log("  One-time WSL setup (PowerShell as admin):");
  console.log("    wsl --install -d Ubuntu");
  console.log("");
  console.log("  Then in the Ubuntu shell:");
  console.log("    sudo apt update && sudo apt install -y nodejs npm python3-venv");
  console.log("    npm i -g claude-iris && claude-iris setup");
  console.log("");
  console.log("  Inside WSL the mirror runs in read-only mode (browser shows");
  console.log("  Claude replies; you type prompts directly in the terminal).");
  console.log("  Docs: https://github.com/ViveSieg/claude-iris#windows-via-wsl2");
  console.log("");
  process.exit(0);
}

const PKG_ROOT = path.resolve(__dirname, "..");
const INSTALL_SH = path.join(PKG_ROOT, "install.sh");

if (!fs.existsSync(INSTALL_SH)) {
  console.log(
    "[claude-iris] install.sh missing — skipping post-install setup.\n" +
      "             Run `claude-iris setup` manually if needed."
  );
  process.exit(0);
}

const { print: banner, RESET, CORAL, TEAL, DIM } = require("./_banner");
const tty = process.stdout.isTTY;
const c = (col, s) => (tty ? col + s + RESET : s);

banner();
console.log(c(DIM, "  Setting up venv + plugin symlink + slash commands..."));
console.log("");

// `--no-notebook` skips the interactive NotebookLM toolchain check so we
// never block the install. Users who want the notebook layer run
// `claude-iris setup` later or invoke `/tutor init` from Claude Code.
const r = spawnSync("bash", [INSTALL_SH, "--no-notebook"], {
  cwd: PKG_ROOT,
  stdio: tty ? "inherit" : "pipe",
});

if (r.status === 0) {
  console.log("");
  console.log(c(TEAL, "  ✓ ready"));
  console.log("");
  console.log(c(DIM, "  next:"));
  console.log("    " + c(CORAL, "claude-iris open") + "    " + c(DIM, "# start mirror + open Chrome + spawn listener"));
  console.log("    " + c(CORAL, "/iris on") + "          " + c(DIM, "# (in any Claude Code session) same thing"));
  console.log("    " + c(CORAL, "/tutor init") + "       " + c(DIM, "# (optional) wire a NotebookLM notebook in"));
  console.log("");
} else {
  console.log("");
  console.log(
    c(CORAL, "  ! post-install setup didn't complete cleanly.")
  );
  console.log(
    c(DIM, "  Most likely Python 3.10+ is missing or pip can't reach PyPI.")
  );
  console.log(c(DIM, "  Try manually:"));
  console.log("    bash " + INSTALL_SH);
  console.log("");
  // Important: do NOT exit non-zero — npm would mark the package as broken.
}

process.exit(0);
