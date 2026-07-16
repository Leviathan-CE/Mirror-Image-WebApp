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


@pytest.fixture
def other_auth_headers(client: TestClient, require_db: None) -> dict[str, str]:
    """JWT for a freshly registered non-owner account."""
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
    if register.status_code == 201:
        token = register.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    login = client.post(
        "/auth/login",
        json={"identifier": email, "password": password},
    )
    if login.status_code != 200:
        pytest.skip(f"could not create other test user: {register.text} / {login.text}")
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def sample_card_id(require_db: None) -> int:
    """Any existing card id for add/remove tests."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM cards ORDER BY id ASC LIMIT 1")
            row = cur.fetchone()
    if row is None:
        pytest.skip("no cards in database — seed cards first")
    return int(row[0])
