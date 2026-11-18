"""In-process inbox pub/sub fan-out."""

from __future__ import annotations

import asyncio

from app.inbox_pubsub import InboxPubSub, TOPIC_INBOX_CHANGED


class FakeSocket:
    def __init__(self) -> None:
        self.messages: list[dict] = []
        self.fail = False

    async def send_json(self, message: dict) -> None:
        if self.fail:
            raise RuntimeError("closed")
        self.messages.append(message)


def test_publish_reaches_subscribers() -> None:
    async def run() -> None:
        hub = InboxPubSub()
        hub.bind_loop(asyncio.get_running_loop())
        first = FakeSocket()
        second = FakeSocket()
        await hub.subscribe(first)  # type: ignore[arg-type]
        await hub.subscribe(second)  # type: ignore[arg-type]

        hub.publish({"type": TOPIC_INBOX_CHANGED, "event_id": 7})
        await asyncio.sleep(0.05)

        assert first.messages == [
            {"type": TOPIC_INBOX_CHANGED, "event_id": 7}
        ]
        assert second.messages == first.messages

    asyncio.run(run())


def test_dead_subscriber_is_dropped() -> None:
    async def run() -> None:
        hub = InboxPubSub()
        hub.bind_loop(asyncio.get_running_loop())
        dead = FakeSocket()
        dead.fail = True
        live = FakeSocket()
        await hub.subscribe(dead)  # type: ignore[arg-type]
        await hub.subscribe(live)  # type: ignore[arg-type]

        hub.publish({"type": TOPIC_INBOX_CHANGED})
        await asyncio.sleep(0.05)

        assert live.messages == [{"type": TOPIC_INBOX_CHANGED}]
        assert dead not in hub._subscribers

    asyncio.run(run())
