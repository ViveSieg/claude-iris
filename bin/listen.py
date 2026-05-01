#!/usr/bin/env python3
"""claude-lens listen — inject browser input into the front terminal.

Watches the named pipe at ``~/.claude-lens/input.pipe`` (created by the
mirror server's ``POST /input`` endpoint). For each line it reads, sends
keystrokes + Return to whatever window has OS focus:

* macOS: ``osascript`` / System Events
* Linux: ``xdotool``

Run this in a *separate* terminal window after focusing your Claude Code
terminal. Browser-side typing then reaches Claude with no manual paste.

macOS note: System Events keystroke requires Accessibility permission for
your terminal app (System Settings → Privacy & Security → Accessibility).
Without it, keystrokes are silently dropped.
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

DATA_DIR = Path(os.environ.get("CLAUDE_LENS_DATA", Path.home() / ".claude-lens"))
PIPE = DATA_DIR / "input.pipe"
SYSTEM = platform.system()


def ensure_pipe() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not PIPE.exists():
        os.mkfifo(PIPE)


def _osascript_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"')


def inject_macos(text: str, *, focus_app: str | None) -> None:
    esc = _osascript_escape(text)
    activate = f'tell application "{focus_app}" to activate\n' if focus_app else ""
    script = (
        activate
        + 'tell application "System Events"\n'
        '    delay 0.05\n'
        f'    keystroke "{esc}"\n'
        '    delay 0.02\n'
        '    key code 36\n'
        'end tell\n'
    )
    subprocess.run(["osascript", "-e", script], check=False)


def inject_linux(text: str) -> None:
    if not shutil.which("xdotool"):
        print(
            "[listen] xdotool not found — install via apt/yum/pacman.",
            file=sys.stderr,
        )
        return
    subprocess.run(["xdotool", "type", "--delay", "20", text], check=False)
    subprocess.run(["xdotool", "key", "Return"], check=False)


def inject(text: str, *, focus_app: str | None) -> None:
    if SYSTEM == "Darwin":
        inject_macos(text, focus_app=focus_app)
    elif SYSTEM == "Linux":
        inject_linux(text)
    else:
        print(f"[listen] platform {SYSTEM} not supported", file=sys.stderr)


def banner(args: argparse.Namespace) -> None:
    print()
    print("claude-lens listen")
    print(f"  pipe:        {PIPE}")
    print(f"  platform:    {SYSTEM}")
    print(f"  inject:      {'on' if args.inject else 'off (dry-run, log only)'}")
    if args.inject and args.focus:
        print(f"  focus app:   {args.focus}")
    if SYSTEM == "Darwin" and args.inject:
        print()
        print("  macOS Accessibility permission required for keystroke injection.")
        print("  System Settings → Privacy & Security → Accessibility → enable")
        print("  your terminal (Terminal.app or iTerm.app). First run usually")
        print("  fails silently until permission is granted.")
    print()
    if args.inject:
        print("  Focus your Claude Code terminal window. Browser messages will")
        print("  be typed into it automatically.")
    else:
        print("  Dry run — every line received from the browser is printed below")
        print("  but NOT injected. Add --inject to enable typing.")
    print("  Ctrl-C to stop.")
    print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="claude-lens listen")
    parser.add_argument(
        "--inject",
        action="store_true",
        help="actually type the messages into the front window (default: dry-run)",
    )
    parser.add_argument(
        "--focus",
        default=None,
        help="macOS only: name of the app to activate before each keystroke "
        "(e.g. 'Terminal', 'iTerm2'). Default: don't activate, type into current focus.",
    )
    args = parser.parse_args(argv)

    ensure_pipe()
    banner(args)

    while True:
        try:
            # Re-open per-line: a write closes the pipe; we re-open to wait for next.
            with open(PIPE, "r") as f:
                for raw in f:
                    line = raw.rstrip("\n")
                    if not line:
                        continue
                    print(f"  ▸ {line}")
                    if args.inject:
                        inject(line, focus_app=args.focus)
        except KeyboardInterrupt:
            print("\n[listen] stopped.")
            return 0
        except OSError as e:
            print(f"[listen] pipe error: {e}", file=sys.stderr)
            time.sleep(0.5)


if __name__ == "__main__":
    sys.exit(main())
