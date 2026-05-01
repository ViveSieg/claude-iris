#!/usr/bin/env node
/* claude-lens npm entry — delegates to install.sh (setup) or bin/claude-lens (runtime). */

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PKG_ROOT = path.resolve(__dirname, "..");
const BASH_BIN = path.join(PKG_ROOT, "bin", "claude-lens");
const INSTALL_SH = path.join(PKG_ROOT, "install.sh");

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function ensureBash() {
  if (process.platform === "win32") {
    die("claude-lens currently requires macOS or Linux (or WSL on Windows).");
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  process.exit(r.status == null ? 1 : r.status);
}

function usage() {
  console.log(
    `claude-lens — render Claude Code replies in a browser

Usage:
  claude-lens setup [--no-notebook]   First-time install: venv, plugin symlink,
                                       slash commands, NotebookLM doctor.
  claude-lens start                   Start the mirror server.
  claude-lens stop                    Stop the mirror server.
  claude-lens restart                 Bounce the mirror server.
  claude-lens status                  Is the mirror server running?
  claude-lens open                    Open the mirror tab in Chrome.

Inside Claude Code (after setup):
  /lens on       /lens off       /lens open       /lens status       /lens restart
  /tutor init    /tutor doctor   /tutor notebook  /tutor role       /tutor ask "..."
`
  );
}

const args = process.argv.slice(2);
const sub = args[0];

if (!sub || sub === "-h" || sub === "--help") {
  usage();
  process.exit(0);
}

ensureBash();

if (sub === "setup" || sub === "install") {
  if (!fs.existsSync(INSTALL_SH)) {
    die(`install.sh not found at ${INSTALL_SH}`);
  }
  run("bash", [INSTALL_SH, ...args.slice(1)]);
}

if (["start", "stop", "restart", "status", "open"].includes(sub)) {
  if (!fs.existsSync(BASH_BIN)) {
    die(
      `${BASH_BIN} not found.\nDid you run \`claude-lens setup\` first?`
    );
  }
  run("bash", [BASH_BIN, sub]);
}

console.error(`Unknown subcommand: ${sub}\n`);
usage();
process.exit(2);
