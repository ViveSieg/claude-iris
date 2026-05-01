# claude-lens

Render Claude Code's terminal replies in a browser tab. Markdown, KaTeX, Mermaid,
syntax highlighting — all the things the terminal flattens.

You keep typing in the terminal. The browser is read-only by default and just shows
the same reply, properly rendered.

```
┌─ terminal ─────────────────┐    ┌─ http://127.0.0.1:7456 ──────┐
│ > /lens on                 │    │  Claude Lens                 │
│ > help me with bessel ...  │ ──>│  ─────────────────────────── │
│                            │    │  ## Bessel functions         │
│                            │    │                              │
│ <reply streams here>       │    │  J_n(x) = ...   (KaTeX)      │
│                            │    │                              │
│                            │    │  | tables | render |         │
│                            │    │  | code   | nicely |         │
└────────────────────────────┘    └──────────────────────────────┘
```

`/tutor` (optional) wires Claude Code into a fixed NotebookLM notebook as a
**read-only knowledge base**, with a chosen role for Claude (research advisor,
exam reviewer, Socratic questioner, librarian, or generic). Claude does the
twice-over teaching — but every domain fact comes from the notebook.

## How it works

**Mirror.** A Claude Code `Stop` hook fires after each assistant turn, reads the
last reply from the session transcript, and POSTs it to a local FastAPI server.
The server appends to a per-session JSONL file and broadcasts to any browser
tab connected over WebSocket. The tab renders with marked + KaTeX + Mermaid +
highlight.js. If the server isn't running, the hook no-ops. It never blocks the
shell.

**Tutor (optional).** Layered on top of mirror. Walks you through installing
[notebooklm-client](https://github.com/icebear0828/notebooklm-client),
authenticating with Google, picking a notebook, and choosing a role template.
Generates a project `CLAUDE.md` that locks Claude into the
"二次加工" contract: facts must come from the notebook, Claude only repackages.

## Install

Requires Python 3.10+, Node.js 18+ (for tutor), and Claude Code.

```bash
git clone https://github.com/<you>/claude-lens.git
cd claude-lens
./install.sh                 # add --no-notebook to skip NotebookLM tooling
```

The installer:

- creates `server/.venv` and installs FastAPI + uvicorn
- symlinks the repo into `~/.claude/plugins/claude-lens`
- copies `commands/lens.md` and `commands/tutor.md` to `~/.claude/commands/`
- (unless `--no-notebook`) ensures `notebooklm-client` is installed globally and
  flags any missing `~/.notebooklm/session.json`

## Use

In any Claude Code session:

```
/lens on            start mirror server, register Stop hook, open browser
/lens off           stop server, remove hook
/lens open          re-open the browser tab
/lens status        is the server running?
/lens restart       bounce server

/tutor init         interactive wizard: doctor → notebook picker → role picker → CLAUDE.md
/tutor notebook     swap the notebook in the current project
/tutor role         swap the role in the current project
/tutor doctor       health-check current project setup
/tutor ask "..."    one-shot query through the configured notebook+role
```

The browser auto-opens in Chrome (falls back to Chromium / Brave / Edge / system
default). Leave it open. Every reply you get in the terminal shows up there.

## Roles bundled in v1

| Role | When to pick |
|---|---|
| **research-advisor** | Notebook is a paper pile. Outputs: 资料显示 / 我做了什么 / 结论 / 资料没覆盖的 |
| **exam-reviewer** | Notebook is course materials. Outputs: 资料显示 / 我怎么讲 / 考点整理 / 解题方法 / 易错点 / 结论 / 资料没覆盖的 |
| **socratic** | Asks instead of answers; uses the notebook as fact-check. Outputs: 我反问你 / 校对(资料显示) / 资料没覆盖的 |
| **librarian** | Pure retrieval, no commentary. Outputs: 资料显示 / 来源对照表 / 资料未覆盖 |
| **general** | Generic catch-all. Outputs: 资料显示 / 我的处理 / 结论 / 资料没覆盖的 |

All roles enforce the **二次加工 principle**: every domain fact comes from
`/notecraft chat`, Claude only does explanation / structuring / drilling / quizzing.
Custom roles via `/tutor init` → option 6.

## Configuration

| Var | Default | Meaning |
|---|---|---|
| `CLAUDE_LENS_HOST` | `127.0.0.1` | bind host |
| `CLAUDE_LENS_PORT` | `7456` | port |
| `CLAUDE_LENS_DATA` | `~/.claude-lens` | session JSONL + pid file |
| `CLAUDE_LENS_ENDPOINT` | `http://127.0.0.1:7456/push` | where the Stop hook POSTs |
| `CLAUDE_LENS_TIMEOUT` | `1.5` | Stop-hook HTTP timeout (seconds) |

## Stop hook payload

The hook POSTs:

```json
{
  "session_id": "<claude code session id>",
  "session_label": "<cwd basename>",
  "role": "assistant",
  "content": "<the markdown reply>"
}
```

## Bidirectional input (optional)

The browser has an input bar at the bottom. Submitting writes the text to a
named pipe at `~/.claude-lens/input.pipe`. To consume it from a terminal:

```bash
cat ~/.claude-lens/input.pipe   # blocks until something is sent
```

This is opt-in. claude-lens does not automatically inject into your Claude
Code prompt — wire it up however you want.

## Layout

```
claude-lens/
├── bin/claude-lens          # start/stop/status cli
├── commands/
│   ├── lens.md              # /lens slash command
│   └── tutor.md             # /tutor slash command (NotebookLM wizard)
├── roles/                   # CLAUDE.md role templates for /tutor
│   ├── research-advisor.md
│   ├── exam-reviewer.md
│   ├── socratic.md
│   ├── librarian.md
│   └── general.md
├── hooks/stop_lens.py       # Claude Code Stop hook
├── server/
│   ├── main.py              # FastAPI + WebSocket
│   ├── requirements.txt
│   └── static/              # index.html / styles.css / app.js
├── install.sh
├── DESIGN.md                # design tokens (getdesign add claude)
├── README.md
└── LICENSE
```

## License

MIT.
