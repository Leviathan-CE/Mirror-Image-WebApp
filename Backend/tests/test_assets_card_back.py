"""Card-back asset mint — staff-only premium signed /media/system/..."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.media_urls import verify_media_signature
from app.routers.assets import CARD_BACK_FILE, CARD_BACK_KEY, SYSTEM_MEDIA_DIR
@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _session_for_role(role: str) -> str:
    from psycopg2 import OperationalError

    from app.db import get_connection
    from app.security import hash_password
    from app.sessions import issue_session

    email = f"cardback_{role}@example.com"
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (
                        user_name, email, password, role, is_active,
                        email_verification_received
                    )
                    VALUES (
                        %(name)s, %(email)s, %(password)s, %(role)s,
                        TRUE, TRUE
                    )
                    ON CONFLICT DO NOTHING
                    """,
                    {
                        "name": f"cardback_{role}",
                        "email": email,
                        "password": hash_password("testpass123"),
                        "role": role,
                    },
                )
                cur.execute(
                    """
                    SELECT id FROM users WHERE lower(email) = lower(%(email)s)
                    """,
                    {"email": email},
                )
                row = cur.fetchone()
            conn.commit()
        if row is None:
            pytest.skip("card-back user was not created")
        return issue_session(int(row[0]))
    except OperationalError as exc:
        pytest.skip(f"database unavailable: {exc}")


def _user_token() -> str:
    return _session_for_role("user")


def _staff_token() -> str:
    return _session_for_role("admin")


def test_card_back_requires_auth(client: TestClient) -> None:
    response = client.get("/assets/card-back")
    assert response.status_code == 401


def test_card_back_rejects_non_staff(client: TestClient) -> None:
    response = client.get(
        "/assets/card-back",
        headers={"Authorization": f"Bearer {_user_token()}"},
    )
    assert response.status_code == 403


def test_card_back_mints_signed_system_path(client: TestClient) -> None:
    if not (SYSTEM_MEDIA_DIR / CARD_BACK_FILE).is_file():
        pytest.skip("system card_back.png not present in checkout")

    response = client.get(
        "/assets/card-back",
        headers={"Authorization": f"Bearer {_staff_token()}"},
    )
    assert response.status_code == 200
    path = response.json()["card_back_path"]
    assert path.startswith(f"media/{CARD_BACK_KEY}?")

    parsed = urlparse(path)
    qs = parse_qs(parsed.query)
    key = parsed.path.removeprefix("media/")
    assert key == CARD_BACK_KEY
    assert verify_media_signature(
        key,
        int(qs["exp"][0]),
        qs["sig"][0],
    )
