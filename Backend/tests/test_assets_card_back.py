"""Card-back asset mint — login required, then signed /media/system/..."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.media_urls import verify_media_signature
from app.routers.assets import CARD_BACK_FILE, CARD_BACK_KEY, SYSTEM_MEDIA_DIR
from app.security import create_access_token


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _token() -> str:
    return create_access_token(
        user_id=1,
        user_name="cardback_tester",
        email="cardback@example.com",
        role="user",
    )


def test_card_back_requires_auth(client: TestClient) -> None:
    response = client.get("/assets/card-back")
    assert response.status_code == 401


def test_card_back_mints_signed_system_path(client: TestClient) -> None:
    if not (SYSTEM_MEDIA_DIR / CARD_BACK_FILE).is_file():
        pytest.skip("system card_back.png not present in checkout")

    response = client.get(
        "/assets/card-back",
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert response.status_code == 200
    path = response.json()["card_back_path"]
    assert path.startswith(f"media/{CARD_BACK_KEY}?")

    parsed = urlparse(path)
    qs = parse_qs(parsed.query)
    key = parsed.path.removeprefix("media/")
    assert key == CARD_BACK_KEY
    assert verify_media_signature(key, int(qs["exp"][0]), qs["sig"][0])
