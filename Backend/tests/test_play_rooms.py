"""In-memory playtester rooms — no Postgres required."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.play_rooms_state import reset_play_rooms
from app.security import create_access_token


@pytest.fixture
def client() -> TestClient:
    reset_play_rooms()
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


def test_second_create_while_connected_returns_same_room(client: TestClient) -> None:
    first = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(3)).json()
    code = first["code"]
    with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(3)}"):
        second = client.post("/play/rooms", json={"deck_id": 9}, headers=_auth(3)).json()
        assert second["code"] == code
        listed = client.get(f"/play/rooms/{code}", headers=_auth(3))
        assert listed.json()["seats"]["p1"]["deck_id"] == 9


def test_create_after_leave_mints_new_room(client: TestClient) -> None:
    """Leave closes the socket; Create must not hand back the dead room code."""
    first = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(4)).json()
    code = first["code"]
    with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(4)}"):
        pass  # disconnect = leave
    second = client.post("/play/rooms", json={"deck_id": 2}, headers=_auth(4)).json()
    assert second["code"] != code
    assert second["seat"] == "p1"


def test_create_after_guesting_seats_you_as_host(client: TestClient) -> None:
    """Creating must always return p1 — a stale p2 seat would mirror your table."""
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(20)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(20)}"):
        with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(21)}"):
            pass

    created = client.post("/play/rooms", json={"deck_id": 5}, headers=_auth(21)).json()
    assert created["seat"] == "p1"
    assert created["code"] != code


def test_host_reconnect_stays_p1(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(30)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(30)}") as host:
        assert host.receive_json()["seat"] == "p1"
    with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(30)}") as host:
        welcome = host.receive_json()
        assert welcome["seat"] == "p1"
        assert welcome["host"] is True


def test_websocket_welcome_and_signal_relay(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 7}, headers=_auth(1)).json()[
        "code"
    ]
    with client.websocket_connect(
        f"/play/ws/rooms/{code}?token={_token(1)}"
    ) as host:
        welcome = host.receive_json()
        assert welcome["type"] == "welcome"
        assert welcome["seat"] == "p1"
        assert welcome["host"] is True

        with client.websocket_connect(
            f"/play/ws/rooms/{code}?token={_token(2)}"
        ) as guest:
            guest_hello = guest.receive_json()
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


def test_websocket_rejects_missing_token(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(4)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}") as ws:
        with pytest.raises(Exception):
            ws.receive_json()


def test_third_player_cannot_join(client: TestClient) -> None:
    code = client.post("/play/rooms", json={"deck_id": 1}, headers=_auth(8)).json()[
        "code"
    ]
    with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(8)}"):
        with client.websocket_connect(f"/play/ws/rooms/{code}?token={_token(9)}"):
            with client.websocket_connect(
                f"/play/ws/rooms/{code}?token={_token(10)}"
            ) as extra:
                with pytest.raises(Exception):
                    extra.receive_json()
