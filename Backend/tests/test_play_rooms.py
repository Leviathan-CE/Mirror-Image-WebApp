"""In-memory playtester rooms — no Postgres required."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.play_room_limits import WS_MAX_BYTES, reset_play_room_limits
from app.play_rooms_state import reset_play_rooms
from app.security import create_access_token
from app import play_room_limits


@pytest.fixture
def client() -> TestClient:
    reset_play_rooms()
    reset_play_room_limits()
    return TestClient(app)


def _token(user_id: int) -> str:
    return create_access_token(
        user_id=user_id,
        user_name=f"player{user_id}",
        email=f"player{user_id}@example.com",
        role="user",
    )


def _auth(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id)}"}


def _auth_ws(ws, user_id: int) -> dict:
    """First frame must be `{type: auth, token}` — query-string JWT is ignored."""
    ws.send_json({"type": "auth", "token": _token(user_id)})
    msg = ws.receive_json()
    assert msg["type"] == "welcome", msg
    return msg


def test_create_room_requires_jwt(client: TestClient) -> None:
    response = client.post("/play/rooms", json={"deck_id": 1})
    assert response.status_code == 401


def test_create_and_get_room(client: TestClient) -> None:
    created = client.post("/play/rooms", json={"deck_id": 42}, headers=_auth(11))
    assert created.status_code == 200
    body = created.json()
    assert body["seat"] == "p1"
    assert len(body["code"]) == 6
    code = body["code"]

    listed = client.get(f"/play/rooms/{code}", headers=_auth(11))
    assert listed.status_code == 200
    assert listed.json()["seats"]["p1"]["deck_id"] == 42
    assert listed.json()["seats"]["p2"] is None


def test_get_room_rate_limited(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(play_room_limits, "GET_MAX", 2)
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(12)).json()[
        "code"
    ]
    assert client.get(f"/play/rooms/{code}", headers=_auth(12)).status_code == 200
    assert client.get(f"/play/rooms/{code}", headers=_auth(12)).status_code == 200
    limited = client.get(f"/play/rooms/{code}", headers=_auth(12))
    assert limited.status_code == 429
    assert limited.json()["detail"] == "rate_limited"


def test_second_create_while_connected_returns_same_room(client: TestClient) -> None:
    first = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(3)).json()
    code = first["code"]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as ws:
        _auth_ws(ws, 3)
        second = client.post("/play/rooms", json={"deck_id": 9}, headers=_auth(3)).json()
        assert second["code"] == code
        listed = client.get(f"/play/rooms/{code}", headers=_auth(3))
        assert listed.json()["seats"]["p1"]["deck_id"] == 9


def test_create_after_leave_mints_new_room(client: TestClient) -> None:
    """Leave closes the socket; Create must not hand back the dead room code."""
    first = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(4)).json()
    code = first["code"]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as ws:
        _auth_ws(ws, 4)
    second = client.post("/play/rooms", json={"deck_id": 2}, headers=_auth(4)).json()
    assert second["code"] != code
    assert second["seat"] == "p1"


def test_create_after_guesting_seats_you_as_host(client: TestClient) -> None:
    """Creating must always return p1 — a stale p2 seat would mirror your table."""
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(20)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as host:
        _auth_ws(host, 20)
        with client.websocket_connect(f"/play/ws/rooms/{code}") as guest:
            _auth_ws(guest, 21)

    created = client.post("/play/rooms", json={"deck_id": 5}, headers=_auth(21)).json()
    assert created["seat"] == "p1"
    assert created["code"] != code


def test_host_reconnect_stays_p1(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(30)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as host:
        assert _auth_ws(host, 30)["seat"] == "p1"
    with client.websocket_connect(f"/play/ws/rooms/{code}") as host:
        welcome = _auth_ws(host, 30)
        assert welcome["seat"] == "p1"
        assert welcome["host"] is True


def test_websocket_welcome_and_signal_relay(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 7}, headers=_auth(1)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as host:
        welcome = _auth_ws(host, 1)
        assert welcome["seat"] == "p1"
        assert welcome["host"] is True

        with client.websocket_connect(f"/play/ws/rooms/{code}") as guest:
            guest_hello = _auth_ws(guest, 2)
            assert guest_hello["seat"] == "p2"
            assert guest_hello["host"] is False
            joined = host.receive_json()
            assert joined["type"] == "peer-joined"
            assert joined["seat"] == "p2"

            guest.send_json({"type": "join", "deckId": 99})
            seat_deck = host.receive_json()
            assert seat_deck["type"] == "seat-deck"
            assert seat_deck["deckId"] == 99

            host.send_json(
                {
                    "type": "signal",
                    "payload": {"kind": "offer", "sdp": "fake"},
                }
            )
            signal = guest.receive_json()
            assert signal["type"] == "signal"
            assert signal["payload"]["kind"] == "offer"
            assert signal["fromSeat"] == "p1"

            guest.send_json({"type": "intent", "action": {"t": "sh", "seat": "p2"}})
            intent = host.receive_json()
            assert intent["type"] == "intent"
            assert intent["action"]["t"] == "sh"


def test_websocket_rejects_non_auth_first_frame(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(4)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as ws:
        ws.send_json({"type": "join", "deckId": 1})
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_websocket_ignores_query_string_token(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(5)).json()[
        "code"
    ]
    token = _token(5)
    with client.websocket_connect(f"/play/ws/rooms/{code}?token={token}") as ws:
        ws.send_json({"type": "join", "deckId": 1})
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_oversized_websocket_frame_is_dropped(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(6)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as ws:
        _auth_ws(ws, 6)
        ws.send_text("x" * (WS_MAX_BYTES + 1))
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_repeated_snapshot_is_not_relayed(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(7)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as host:
        _auth_ws(host, 7)
        with client.websocket_connect(f"/play/ws/rooms/{code}") as guest:
            _auth_ws(guest, 8)
            assert host.receive_json()["type"] == "peer-joined"

            guest.send_json({"type": "snapshot"})
            first = host.receive_json()
            assert first["type"] == "snapshot"

            guest.send_json({"type": "snapshot"})
            guest.send_json(
                {
                    "type": "signal",
                    "payload": {"kind": "offer", "sdp": "after-drop"},
                }
            )
            nxt = host.receive_json()
            assert nxt["type"] == "signal"
            assert nxt["payload"]["sdp"] == "after-drop"


def test_ws_connect_rate_limited(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(play_room_limits, "WS_USER_MAX", 1)
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(40)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as first:
        _auth_ws(first, 40)
        with client.websocket_connect(f"/play/ws/rooms/{code}") as second:
            second.send_json({"type": "auth", "token": _token(40)})
            with pytest.raises(WebSocketDisconnect):
                second.receive_json()


def test_third_player_cannot_join(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(8)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as host:
        _auth_ws(host, 8)
        with client.websocket_connect(f"/play/ws/rooms/{code}") as guest:
            _auth_ws(guest, 9)
            with client.websocket_connect(f"/play/ws/rooms/{code}") as extra:
                extra.send_json({"type": "auth", "token": _token(10)})
                with pytest.raises(WebSocketDisconnect):
                    extra.receive_json()
