---
description: Toggle the claude-lens browser preview (live-render assistant replies in Chrome with KaTeX/Mermaid).
argument-hint: on | off | open | status | restart
---

You are managing the **claude-lens** plugin — a local FastAPI service that mirrors each
assistant reply into a browser tab where it renders as proper markdown with LaTeX (KaTeX)
and Mermaid diagrams. The user invokes this slash command from Claude Code.

# What to do based on the argument

The argument is `$ARGUMENTS` (one of: `on`, `off`, `open`, `status`, `restart`; default `on`).

## `on` (default)

Run these steps **in order** with the Bash tool:

1. **Start the server** (idempotent — won't double-start):
   ```bash
   ~/.claude/plugins/claude-lens/bin/claude-lens start
   ```

2. **Register the Stop hook in user settings.json** so future replies auto-mirror.
   Read `~/.claude/settings.json`. If a Stop hook entry pointing to
   `~/.claude/plugins/claude-lens/hooks/stop_lens.py` already exists, skip.
   Otherwise, merge a Stop hook that runs:
   ```
   ~/.claude/plugins/claude-lens/hooks/stop_lens.py
   ```
   The Claude Code Stop hook spec:
   ```json
   {
     "hooks": {
       "Stop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "~/.claude/plugins/claude-lens/hooks/stop_lens.py"
             }
           ]
         }
       ]
     }
   }
   ```
   When merging, preserve any existing `hooks.Stop` entries — append, don't replace.
   If the file doesn't exist, create it with just the snippet above.

3. **Open the browser**:
   ```bash
   ~/.claude/plugins/claude-lens/bin/claude-lens open
   ```

4. Tell the user: server URL (`http://127.0.0.1:7456`), that the Stop hook is active,
   and that all subsequent assistant replies will mirror to the browser.

## `off`

1. **Remove the Stop hook** from `~/.claude/settings.json` — only entries whose `command`
   contains `stop_lens.py`. Preserve all other hooks.
2. **Stop the server**:
   ```bash
   ~/.claude/plugins/claude-lens/bin/claude-lens stop
   ```
3. Tell the user the mirror is fully off.

## `open`

```bash
~/.claude/plugins/claude-lens/bin/claude-lens open
```

## `status`

```bash
~/.claude/plugins/claude-lens/bin/claude-lens status
```
Also report whether the Stop hook is currently registered in `~/.claude/settings.json`.

## `restart`

```bash
~/.claude/plugins/claude-lens/bin/claude-lens restart
```

# Important

- All edits to `~/.claude/settings.json` must preserve the rest of the file untouched.
  Use `python3 -c "import json,sys,pathlib; ..."` for safe JSON merging if `jq` isn't
  available — never `sed`/`awk` JSON.
- After enabling, **do not echo this slash command's output** as if it were a normal reply;
  keep the confirmation short (1–3 lines) so the first mirrored reply is the real demo.
