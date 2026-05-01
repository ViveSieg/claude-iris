---
description: NotebookLM tutor wizard — install notebooklm-client, pick a notebook as the read-only knowledge base, pick a role for Claude, scaffold CLAUDE.md, and start the lens.
argument-hint: init | notebook | role | doctor | ask
---

You are running the **claude-lens tutor wizard**. In this workflow:

- **NotebookLM** is a **read-only knowledge base** (not a teacher) — fixed, never written back to.
- **Claude (you)** is the intelligent agent that does **二次加工 (secondary processing)** of NotebookLM content — explaining, structuring, drilling, quizzing — but **never invents domain facts** outside what the knowledge base provides.

The user wants their project's `CLAUDE.md` configured so this contract is locked in
with a chosen role (research advisor / exam reviewer / Socratic questioner / librarian
/ general).

Argument: `$ARGUMENTS` (one of: `init`, `notebook`, `role`, `doctor`, `ask`).

# `init` (full interactive setup)

Run these steps **in order**, asking the user before any non-trivial action.

## Step 1 — Doctor

Use the Bash tool to check tools. Report each line:

```bash
command -v node && node --version
command -v npm && npm --version
npm ls -g notebooklm-client --depth=0 2>/dev/null | grep notebooklm-client || echo "MISSING notebooklm-client"
test -f ~/.notebooklm/session.json && echo "session: present" || echo "session: MISSING"
```

If `notebooklm-client` is missing, ask the user once: "Install notebooklm-client globally
(`npm i -g notebooklm-client`)?" — if yes, run it. If install fails with EACCES, suggest
`sudo npm i -g notebooklm-client` and stop.

If session is missing, tell the user: "I'll launch the Google login now. A browser will
open — sign in to your Google account, then return here." Then run:
```bash
npx notebooklm export-session
```
This is interactive; it blocks until login completes. After it finishes, re-check the
session file exists.

## Step 2 — List notebooks

Run:
```bash
npx notebooklm list --transport auto
```

Parse the output (each line is `<id>  <title> (N sources)`) and present it to the user
as a numbered menu. Ask: "Pick a notebook (number) to be the **read-only knowledge base**
for this project."

Wait for the user's number, then capture the chosen notebook's `id` and `title`.

## Step 3 — Pick a role

Show this menu **verbatim**:

```
Pick a role for Claude (the knowledge base stays read-only — Claude does secondary processing):

  1. research-advisor   — Paper-pile notebooks. Outputs: 资料显示 / 我做了什么 / 结论 / 资料没覆盖的
  2. exam-reviewer      — Textbook / lecture notebooks. Outputs: 资料显示 / 我怎么讲 / 考点整理 / 解题方法 / 易错点 / 结论 / 资料没覆盖的
  3. socratic           — Asks instead of answers. Outputs: 我反问你 (3 题) / 校对(资料显示) / 资料没覆盖的
  4. librarian          — Neutral retrieval, no commentary. Outputs: 资料显示 / 来源对照表 / 资料未覆盖
  5. general            — Generic assistant for any topic. Outputs: 资料显示 / 我的处理 / 结论 / 资料没覆盖的
  6. custom             — Write your own role from scratch
```

Wait for a number. If `6`, ask three short questions (role name, primary use case, output
section names) and use the answers — but **always include the 二次加工 principle** in the
custom role's 铁律 section: all domain content must come from `/notecraft chat`, Claude
only repackages.

## Step 4 — Render CLAUDE.md and AGENTS.md

Read the chosen template file at:

```
~/.claude/plugins/claude-lens/roles/<role-id>.md
```

Substitute these placeholders:
- `{{NOTEBOOK_ID}}` → the id from step 2
- `{{NOTEBOOK_TITLE}}` → the title from step 2
- `{{TODAY}}` → today's date (YYYY-MM-DD)

Write the result to `./CLAUDE.md` in the current working directory. If a `CLAUDE.md`
already exists, **show a diff and ask** before overwriting. Then `cp CLAUDE.md AGENTS.md`
so both surfaces stay in sync (Claude Code reads CLAUDE.md, OpenAI's Codex reads
AGENTS.md — same content).

Also write `.claude-lens.json` in the cwd with the chosen settings:
```json
{
  "notebook_id": "...",
  "notebook_title": "...",
  "role": "...",
  "created_at": "<ISO ts>"
}
```

## Step 5 — Start the lens

Run:
```bash
~/.claude/plugins/claude-lens/bin/claude-lens start
~/.claude/plugins/claude-lens/bin/claude-lens open
```

Also ensure the Stop hook is registered in `~/.claude/settings.json` (same merge logic
as `/lens on`). Check first; only modify if missing.

## Step 6 — Smoke test

Send one short test query so the user sees the full pipeline live:

```bash
npx notebooklm chat <NOTEBOOK_ID> --transport auto --question "用一句话介绍这个 notebook 里的核心主题"
```

Report the answer in the terminal. The Stop hook will mirror this whole reply to the
browser, so the user sees both terminal text + rendered page.

Tell the user: "Setup complete. Ask anything; the role and notebook are wired in."

---

# `notebook` (switch notebook in current project)

Re-run **Step 2** only. Read existing `.claude-lens.json`, list notebooks, let the user
pick a new one, update both `.claude-lens.json` and the `notebook id:` line in
`./CLAUDE.md` and `./AGENTS.md`. Don't touch the role.

# `role` (switch role in current project)

Re-run **Step 3 + Step 4**. Keep the existing notebook id/title from `.claude-lens.json`.

# `doctor` (health check, no changes)

Run the doctor checks from Step 1, plus:
- Is the lens server running? `~/.claude/plugins/claude-lens/bin/claude-lens status`
- Is the Stop hook registered in `~/.claude/settings.json`?
- Does `./CLAUDE.md` exist and contain a notebook id?
- Does `./.claude-lens.json` exist?

Report a summary table. Don't fix anything; just diagnose.

# `ask <question>`

Read the notebook id from `./.claude-lens.json` (or `./CLAUDE.md`). Run:
```bash
npx notebooklm chat <id> --transport auto --question "<the user's question>"
```
Then format the response per the current role's output skeleton (read role from
`.claude-lens.json`).

---

# Important rules

- **Never write back to the notebook**. NotebookLM is the read-only knowledge base for
  this workflow. If the user asks you to "save my notes to the notebook," refuse and
  remind them why.
- **二次加工 principle is non-negotiable**: every role template enforces that domain
  facts must come from `/notecraft chat`. Don't dilute that rule when answering as
  the chosen role. You can rephrase, structure, drill, quiz, analogize — but every
  factual claim traces back to a `[citation]`.
- **Preserve `[1][2]` citations** from notebooklm chat answers verbatim.
- **JSON edits to `~/.claude/settings.json`** must use `python3` (json module) for safe
  merging, never `sed`/`awk`.
- **Don't auto-confirm destructive actions.** Overwriting an existing `CLAUDE.md` or
  re-running `export-session` (which invalidates an existing session) requires explicit
  user yes.
- **Keep terminal output short.** The browser mirror renders the long-form reply; the
  terminal just needs to confirm what happened.
