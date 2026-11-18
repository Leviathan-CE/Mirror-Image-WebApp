"""
In-process pub/sub for inbox invalidation.

Publishers (card upload, publish, blog first-publish) call ``publish`` after
the DB commit. Subscribers are live WebSocket clients; each gets one
``inbox.changed`` message and then fetches the inbox once.

Process-local only — fine for a single uvicorn worker. Multi-worker needs a
shared bus (Postgres NOTIFY or Redis) later.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

TOPIC_INBOX_CHANGED = "inbox.changed"


class InboxPubSub:
    def __init__(self) -> None:
        self._subscribers: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def subscribe(self, ws: WebSocket) -> None:
        async with self._lock:
            self._subscribers.add(ws)

    async def unsubscribe(self, ws: WebSocket) -> None:
        async with self._lock:
            self._subscribers.discard(ws)

    def publish(self, message: dict[str, Any]) -> None:
        """Fan-out from sync request handlers after commit."""
        loop = self._loop
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                logger.debug("inbox publish skipped — no event loop")
                return
        try:
            asyncio.run_coroutine_threadsafe(
                self._broadcast(message),
                loop,
            )
        except RuntimeError:
            logger.debug("inbox publish skipped — loop closed")

    async def _broadcast(self, message: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._subscribers)
        if not targets:
            return
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        if not dead:
            return
        async with self._lock:
            for ws in dead:
                self._subscribers.discard(ws)


inbox_hub = InboxPubSub()


def publish_inbox_changed(
    *,
    event_id: int | None = None,
    kind: str | None = None,
    audience: str | None = None,
) -> None:
    """Notify every subscriber that the inbox feed may have a new row."""
    message: dict[str, Any] = {"type": TOPIC_INBOX_CHANGED}
    if event_id is not None:
        message["event_id"] = int(event_id)
    if kind:
        message["kind"] = kind
    if audience:
        message["audience"] = audience
    inbox_hub.publish(message)
