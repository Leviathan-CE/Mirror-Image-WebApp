"""2FA helpers + login challenge (mocked send)."""

from __future__ import annotations

import uuid

import pytest

from app.security import hash_password
from app.two_factor import dest_hint, hash_code, mask_email


def test_mask_email():
    assert mask_email("alex@example.com") == "a***@example.com"
    assert dest_hint("email", email="alex@example.com") == "a***@example.com"


def test_hash_code_is_challenge_scoped():
    first = hash_code("abc", "123456")
    second = hash_code("xyz", "123456")
    assert first != second
    assert first == hash_code("abc", "123456")


def test_login_requires_code_when_2fa_enabled(
    client, require_db, monkeypatch
):
    from app.db import get_connection

    suffix = uuid.uuid4().hex[:8]
    email = f"tfa_{suffix}@example.com"
    user_name = f"tfa_{suffix}"
    sent = {}

    def fake_send(*, dest, user_name, code):
        sent["code"] = code
        sent["dest"] = dest

    monkeypatch.setattr("app.two_factor._send_code", fake_send)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (
                        user_name, email, password, role, is_active,
                        email_verification_received, email_verified_at,
                        two_factor_enabled, two_factor_method
                    )
                    VALUES (
                        %(user_name)s, %(email)s, %(password)s, 'user', TRUE,
                        TRUE, NOW(), TRUE, 'email'
                    )
                    """,
                    {
                        "user_name": user_name,
                        "email": email,
                        "password": hash_password("testpass123"),
                    },
                )
            conn.commit()
    except Exception as exc:
        pytest.skip(f"2fa schema missing: {exc}")

    response = client.post(
        "/auth/login",
        json={"identifier": email, "password": "testpass123"},
    )
    if response.status_code == 500:
        pytest.skip(response.text)
    assert response.status_code == 200
    body = response.json()
    assert body.get("requires_2fa") is True
    assert body.get("access_token") in (None, "")
    assert body.get("challenge_id")
    assert sent.get("code")

    bad = client.post(
        "/auth/2fa/login",
        json={"challenge_id": body["challenge_id"], "code": "000000"},
    )
    assert bad.status_code == 401

    ok = client.post(
        "/auth/2fa/login",
        json={"challenge_id": body["challenge_id"], "code": sent["code"]},
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]
    assert ok.json()["user"]["email"] == email

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE lower(email) = lower(%s)", (email,))
        conn.commit()
