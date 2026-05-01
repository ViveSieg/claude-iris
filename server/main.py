"""claude-lens server.

Receives assistant replies from Stop hook (POST /push), stores them per
session, and pushes to connected browser clients via WebSocket.

Optionally accepts user input from browser (POST /input) and writes to a
named pipe so the terminal can read it back.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA_DIR = Path(os.environ.get("CLAUDE_LENS_DATA", Path.home() / ".claude-lens"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DIR = DATA_DIR / "sessions"
SESSION_DIR.mkdir(parents=True, exist_ok=True)
PIPE_PATH = DATA_DIR / "input.pipe"

app = FastAPI(title="claude-lens")


class PushPayload(BaseModel):
    session_id: str = "default"
    session_label: str | None = None
    role: str = "assistant"
    content: str
    ts: float | None = None


class InputPayload(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# WebSocket fan-out
# ---------------------------------------------------------------------------


class Hub:
    def __init__(self) -> None:
        self.clients: dict[str, set[WebSocket]] = defaultdict(set)
        self.lock = asyncio.Lock()

    async def join(self, session_id: str, ws: WebSocket) -> None:
        async with self.lock:
            self.clients[session_id].add(ws)

    async def leave(self, session_id: str, ws: WebSocket) -> None:
        async with self.lock:
            self.clients[session_id].discard(ws)

    async def broadcast(self, session_id: str, message: dict[str, Any]) -> None:
        async with self.lock:
            targets = list(self.clients[session_id])
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.leave(session_id, ws)


hub = Hub()


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def session_file(session_id: str) -> Path:
    safe = "".join(c for c in session_id if c.isalnum() or c in "-_") or "default"
    return SESSION_DIR / f"{safe}.jsonl"


def append_session(session_id: str, message: dict[str, Any]) -> None:
    with session_file(session_id).open("a", encoding="utf-8") as f:
        f.write(json.dumps(message, ensure_ascii=False) + "\n")


def load_session(session_id: str) -> list[dict[str, Any]]:
    p = session_file(session_id)
    if not p.exists():
        return []
    out: list[dict[str, Any]] = []
    with p.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def list_sessions() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for f in sorted(SESSION_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
        last_label = ""
        try:
            with f.open(encoding="utf-8") as fh:
                for line in fh:
                    try:
                        msg = json.loads(line)
                        if msg.get("session_label"):
                            last_label = msg["session_label"]
                    except json.JSONDecodeError:
                        continue
        except OSError:
            continue
        out.append(
            {
                "id": f.stem,
                "label": last_label or f.stem,
                "mtime": f.stat().st_mtime,
            }
        )
    return out


# ---------------------------------------------------------------------------
# HTTP routes
# ---------------------------------------------------------------------------


@app.post("/push")
async def push(payload: PushPayload) -> dict[str, Any]:
    msg = {
        "session_id": payload.session_id,
        "session_label": payload.session_label,
        "role": payload.role,
        "content": payload.content,
        "ts": payload.ts or time.time(),
    }
    append_session(payload.session_id, msg)
    await hub.broadcast(payload.session_id, {"type": "message", "message": msg})
    await hub.broadcast("__index__", {"type": "session_touch", "session": payload.session_id})
    return {"ok": True}


@app.post("/input")
async def push_input(payload: InputPayload) -> dict[str, Any]:
    if not PIPE_PATH.exists():
        try:
            os.mkfifo(PIPE_PATH)
        except FileExistsError:
            pass
        except OSError as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
    try:
        fd = os.open(PIPE_PATH, os.O_WRONLY | os.O_NONBLOCK)
        os.write(fd, (payload.text + "\n").encode("utf-8"))
        os.close(fd)
        return {"ok": True}
    except OSError as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=503)


@app.get("/sessions")
async def get_sessions() -> dict[str, Any]:
    return {"sessions": list_sessions()}


@app.get("/session/{session_id}")
async def get_session(session_id: str) -> dict[str, Any]:
    return {"session_id": session_id, "messages": load_session(session_id)}


@app.delete("/session/{session_id}")
async def delete_session(session_id: str) -> dict[str, Any]:
    p = session_file(session_id)
    if p.exists():
        p.unlink()
    return {"ok": True}


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


@app.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    await hub.join(session_id, websocket)
    try:
        await websocket.send_json({"type": "ready", "session_id": session_id})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(session_id, websocket)


# ---------------------------------------------------------------------------
# Static
# ---------------------------------------------------------------------------


app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "data_dir": str(DATA_DIR)}


def main() -> None:
    import uvicorn

    host = os.environ.get("CLAUDE_LENS_HOST", "127.0.0.1")
    port = int(os.environ.get("CLAUDE_LENS_PORT", "7456"))
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
