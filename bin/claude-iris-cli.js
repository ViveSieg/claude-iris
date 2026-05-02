#!/usr/bin/env node
/* claude-iris npm entry — delegates to install.sh (setup) or bin/claude-iris (runtime). */

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PKG_ROOT = path.resolve(__dirname, "..");
const BASH_BIN = path.join(PKG_ROOT, "bin", "claude-iris");
const INSTALL_SH = path.join(PKG_ROOT, "install.sh");

const { print: banner, RESET, DIM, CORAL, TEAL } = require("./_banner");
const BOLD = "\x1b[1m";

function box(title, lines) {
  if (process.env.NO_COLOR || !process.stdout.isTTY) {
    console.log("\n[" + title + "]");
    lines.forEach((l) => console.log("  " + l));
    return;
  }
  const w = Math.max(title.length, ...lines.map((l) => stripAnsi(l).length)) + 4;
  console.log(
    "\n" + CORAL + "┌─ " + BOLD + title + RESET + CORAL + " " +
      "─".repeat(w - title.length - 4) + "┐" + RESET
  );
  for (const l of lines) {
    const visibleLen = stripAnsi(l).length;
    console.log(
      CORAL + "│ " + RESET + l + " ".repeat(w - visibleLen - 3) + CORAL + "│" + RESET
    );
  }
  console.log(CORAL + "└" + "─".repeat(w - 1) + "┘" + RESET + "\n");
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function step(label) {
  console.log(CORAL + "  ▸ " + RESET + label);
}

function ok(label) {
  console.log(TEAL + "  ✓ " + RESET + label);
}

function die(msg, code = 1) {
  console.error("\x1b[38;2;198;69;69m  ✗ " + msg + RESET);
  process.exit(code);
}

function ensureBash() {
  if (process.platform === "win32") {
    die("claude-iris currently requires macOS or Linux (or WSL on Windows).");
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  process.exit(r.status == null ? 1 : r.status);
}

function usage() {
  console.log(
    `claude-iris — render Claude Code replies in a browser

Usage:
  claude-iris setup [--no-notebook]   First-time install: venv, plugin symlink,
                                       slash commands, NotebookLM doctor.
  claude-iris start                   Start the mirror server.
  claude-iris stop                    Stop the mirror server.
  claude-iris restart                 Bounce the mirror server.
  claude-iris status                  Is the mirror server running?
  claude-iris open                    Open the mirror tab in Chrome.
  claude-iris listen [--dry-run]      Watch the input pipe and type browser
                                       messages into the front terminal.
                                       --dry-run disables injection (log only).

Inside Claude Code (after setup):
  /iris on       /iris off       /iris open       /iris status       /iris restart
  /tutor init    /tutor doctor   /tutor notebook  /tutor role       /tutor ask "..."
`
  );
}

const args = process.argv.slice(2);
const sub = args[0];

if (!sub || sub === "-h" || sub === "--help") {
  banner();
  usage();
  process.exit(0);
}

ensureBash();

if (sub === "setup" || sub === "install") {
  if (!fs.existsSync(INSTALL_SH)) {
    die(`install.sh not found at ${INSTALL_SH}`);
  }
  banner();
  step("Running install.sh ...");
  const r = spawnSync("bash", [INSTALL_SH, ...args.slice(1)], {
    stdio: "inherit",
  });
  if (r.status === 0) {
    box("setup complete", [
      "Next steps in any Claude Code session:",
      "",
      "  " + CORAL + "/iris on" + RESET + "        start mirror, register Stop hook, open Chrome",
      "  " + CORAL + "/tutor init" + RESET + "     bind a NotebookLM notebook + scaffold CLAUDE.md",
      "",
      DIM + "Docs: https://github.com/ViveSieg/claude-iris" + RESET,
    ]);
    process.exit(0);
  }
  die("install.sh failed (exit code " + r.status + ")");
}

if (["start", "stop", "restart", "status", "open", "listen"].includes(sub)) {
  if (!fs.existsSync(BASH_BIN)) {
    die(
      `${BASH_BIN} not found.\nDid you run \`claude-iris setup\` first?`
    );
  }
  run("bash", [BASH_BIN, sub, ...args.slice(1)]);
}

console.error(`Unknown subcommand: ${sub}\n`);
usage();
process.exit(2);
