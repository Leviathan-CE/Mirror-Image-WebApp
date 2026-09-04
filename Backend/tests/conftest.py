"""Shared fixtures for Backend tests."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from psycopg2 import OperationalError

from app.db import get_connection
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def require_db() -> None:
    """Skip DB-backed tests when Postgres is unreachable."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
    except OperationalError as exc:
        pytest.skip(f"database unavailable: {exc}")


@pytest.fixture
def user_token(client: TestClient, require_db: None) -> str:
    """JWT for the seeded user@localhost account."""
    response = client.post(
        "/auth/login",
        json={"identifier": "user@localhost", "password": "user123"},
    )
    if response.status_code != 200:
        pytest.skip(f"seed login failed: {response.status_code} {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(user_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture(scope="session", autouse=True)
def _purge_orphan_deck_testers() -> None:
    """
    Remove leftover `deck_tester_*` accounts from prior test runs that did
    not tear down (and again when the session ends).
    """
    def _delete_testers() -> None:
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        DELETE FROM users
                         WHERE user_name LIKE 'deck_tester\\_%' ESCAPE '\\'
                            OR email LIKE 'deck_tester\\_%@example.com' ESCAPE '\\'
                        """
                    )
                conn.commit()
        except OperationalError:
            # DB down — unit-only sessions still run.
            pass

    _delete_testers()
    yield
    _delete_testers()


@pytest.fixture
def other_auth_headers(client: TestClient, require_db: None):
    """
    JWT for a freshly registered non-owner account (email verified via SQL).

    Yields headers for the test, then deletes that user (cascades their decks).
    """
    suffix = uuid.uuid4().hex[:8]
    user_name = f"deck_tester_{suffix}"
    email = f"deck_tester_{suffix}@example.com"
    password = "testpass123"

    register = client.post(
        "/auth/register",
        json={
            "user_name": user_name,
            "email": email,
            "password": password,
        },
    )
    # Register may fail without SMTP — create the user row directly for tests.
    if register.status_code != 201:
        from app.security import hash_password

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (
                        user_name, email, password, role, is_active,
                        email_verification_sent, email_verification_received,
                        email_verified_at
                    )
                    SELECT
                        %(user_name)s, %(email)s, %(password)s, 'user', TRUE,
                        TRUE, TRUE, NOW()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM users WHERE lower(email) = lower(%(email)s)
                    )
                    """,
                    {
                        "user_name": user_name,
                        "email": email,
                        "password": hash_password(password),
                    },
                )
            conn.commit()
    else:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE users
                       SET email_verification_received = TRUE,
                           email_verified_at = NOW(),
                           email_verification_sent = TRUE
                     WHERE lower(email) = lower(%(email)s)
                    """,
                    {"email": email},
                )
            conn.commit()

    login = client.post(
        "/auth/login",
        json={"identifier": email, "password": password},
    )
    if login.status_code != 200:
        pytest.skip(f"could not create other test user: {register.text} / {login.text}")

    try:
        yield {"Authorization": f"Bearer {login.json()['access_token']}"}
    finally:
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        DELETE FROM users
                         WHERE lower(email) = lower(%(email)s)
                            OR lower(user_name) = lower(%(user_name)s)
                        """,
                        {"email": email, "user_name": user_name},
                    )
                conn.commit()
        except OperationalError:
            pass


@pytest.fixture
def admin_token(client: TestClient, require_db: None) -> str:
    """JWT for the seeded admin@localhost account."""
    response = client.post(
        "/auth/login",
        json={"identifier": "admin@localhost", "password": "admin123"},
    )
    if response.status_code != 200:
        pytest.skip(f"admin login failed: {response.status_code} {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def sample_card_id(require_db: None) -> int:
    """A published catalogue card id (add-to-deck rejects unpublished/preview)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id
                  FROM cards c
                  JOIN publish_cards pc ON pc.card_id = c.id
                 WHERE pc.published = 'published'
                 ORDER BY c.id ASC
                 LIMIT 1
                """
            )
            row = cur.fetchone()
    if row is None:
        pytest.skip("no published cards in database — seed/publish cards first")
    return int(row[0])
