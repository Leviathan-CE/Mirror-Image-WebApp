"""Sliding-window play-room limits — no sockets required."""

from __future__ import annotations

from app.play_room_limits import (
    GET_MAX,
    WS_IP_MAX,
    WS_USER_MAX,
    allow_room_get,
    allow_snapshot,
    allow_ws_connect,
    allow_ws_handshake,
)


def test_room_get_allows_up_to_max_then_blocks() -> None:
    for _ in range(GET_MAX):
        assert allow_room_get(1) is True
    assert allow_room_get(1) is False
    assert allow_room_get(2) is True


def test_ws_handshake_is_per_ip() -> None:
    for _ in range(WS_IP_MAX):
        assert allow_ws_handshake("1.1.1.1") is True
    assert allow_ws_handshake("1.1.1.1") is False
    assert allow_ws_handshake("8.8.8.8") is True


def test_ws_connect_is_per_user() -> None:
    for _ in range(WS_USER_MAX):
        assert allow_ws_connect(9) is True
    assert allow_ws_connect(9) is False
    assert allow_ws_connect(10) is True


def test_snapshot_spacing_is_per_seat(monkeypatch) -> None:
    clock = [100.0]
    monkeypatch.setattr("app.play_room_limits.time.monotonic", lambda: clock[0])

    assert allow_snapshot("ABCD12", "p1") is True
    assert allow_snapshot("ABCD12", "p1") is False
    assert allow_snapshot("ABCD12", "p2") is True

    clock[0] += 1.9
    assert allow_snapshot("ABCD12", "p1") is False
    clock[0] += 0.2
    assert allow_snapshot("ABCD12", "p1") is True
