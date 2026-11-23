"""Rejected requests for session, login, and upload attacks."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedTable

from app.db import get_connection
from app.email_tokens import PURPOSE_VERIFY, create_email_token
from app.main import api_doc_urls, app
from app.security import (
    ALGORITHM,
    DEV_SIGNING_SECRET,
    assert_production_secret,
    hash_password,
    session_cookie_secure,
    signing_secret,
)
from app.sessions import hash_session, insert_session

PNG = b"\x89PNG\r\n\x1a\n" + b"rest"
JPEG = b"\xff\xd8\xff" + b"rest"
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"rest"


def _user(role: str = "user", *, verified: bool = True) -> dict:
    suffix = uuid.uuid4().hex[:10]
    email = f"atk_{suffix}@example.com"
    name = f"atk_{suffix}"
    password = "testpass123"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (
                    user_name, email, password, role, is_active,
                    email_verification_sent, email_verification_received,
                    email_verified_at
                )
                VALUES (
                    %(name)s, %(email)s, %(password)s, %(role)s, TRUE,
                    TRUE, %(verified)s,
                    CASE WHEN %(verified)s THEN NOW() ELSE NULL END
                )
                RETURNING id
                """,
                {
                    "name": name,
                    "email": email,
                    "password": hash_password(password),
                    "role": role,
                    "verified": verified,
                },
            )
            user_id = int(cur.fetchone()[0])
        conn.commit()
    return {
        "id": user_id,
        "email": email,
        "name": name,
        "password": password,
    }


def _unity(client: TestClient, account: dict) -> str:
    response = client.post(
        "/auth/login",
        json={
            "identifier": account["email"],
            "password": account["password"],
            "client": "unity",
        },
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    return response.json()["access_token"]


def _bearer(raw: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {raw}"}


def _card() -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM cards")
            card_id = int(cur.fetchone()[0])
            cur.execute(
                """
                INSERT INTO cards (id, card_name, card_set_name)
                VALUES (%(id)s, %(name)s, 'Attack Set')
                """,
                {
                    "id": card_id,
                    "name": f"Attack {uuid.uuid4().hex[:8]}",
                },
            )
        conn.commit()
    return card_id


def _delete_attack_rows() -> None:
    """Remove accounts, cards, and counters this file inserts."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    DELETE FROM users
                     WHERE lower(email) LIKE 'atk\\_%@example.com'
                           ESCAPE '\\'
                        OR lower(user_name) LIKE 'atk\\_%' ESCAPE '\\'
                    """
                )
                cur.execute(
                    """
                    DELETE FROM decks AS deck
                     WHERE deck.name = 'Private deck'
                       AND NOT EXISTS (
                           SELECT 1
                             FROM user_has_decks AS link
                            WHERE link.deck_id = deck.id
                       )
                    """
                )
                cur.execute(
                    """
                    DELETE FROM cards
                     WHERE card_set_name = 'Attack Set'
                       AND card_name LIKE 'Attack %'
                    """
                )
                cur.execute(
                    """
                    DELETE FROM auth_rate_limits
                     WHERE key LIKE 'atk\\_%' ESCAPE '\\'
                        OR key LIKE 'mail\\_%@example.com' ESCAPE '\\'
                        OR key LIKE 'reset\\_%@example.com' ESCAPE '\\'
                        OR key LIKE 'missing\\_%' ESCAPE '\\'
                    """
                )
            conn.commit()
    except OperationalError:
        return
    except UndefinedTable:
        return


@pytest.fixture(scope="module", autouse=True)
def _purge_attack_rows():
    """Drop leftovers from a crashed run, then again after this file."""
    _delete_attack_rows()
    yield
    _delete_attack_rows()


def test_random_cookie_is_rejected(client: TestClient, require_db: None):
    client.cookies.set("mi_session", "not-a-real-session")
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_missing_and_empty_cookie_are_rejected(client: TestClient):
    missing = client.get("/auth/me")
    assert missing.status_code == 401
    client.cookies.set("mi_session", "   ")
    empty = client.get("/auth/me")
    assert empty.status_code == 401


def test_website_login_hides_session_id(
    client: TestClient, require_db: None
):
    account = _user()
    response = client.post(
        "/auth/login",
        json={
            "identifier": account["email"],
            "password": account["password"],
        },
    )
    assert response.status_code == 200
    assert "access_token" not in response.json()
    me = client.get("/auth/me")
    assert me.status_code == 200


def test_logout_kills_that_session_only(
    client: TestClient, require_db: None
):
    account = _user()
    first = client.post(
        "/auth/login",
        json={
            "identifier": account["email"],
            "password": account["password"],
        },
    )
    assert first.status_code == 200
    copied = client.cookies.get("mi_session")
    other = TestClient(app)
    other.post(
        "/auth/login",
        json={
            "identifier": account["email"],
            "password": account["password"],
        },
    )
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401
    replay = TestClient(app)
    replay.cookies.set("mi_session", copied)
    assert replay.get("/auth/me").status_code == 401
    assert other.get("/auth/me").status_code == 200


def test_jwt_and_purpose_token_are_not_sessions(
    client: TestClient, require_db: None
):
    forged = jwt.encode(
        {"sub": "1", "role": "admin"},
        signing_secret(),
        algorithm=ALGORITHM,
    )
    purpose = jwt.encode(
        {"purpose": "blog_email_unsub", "sub": "1"},
        signing_secret(),
        algorithm=ALGORITHM,
    )
    for raw in (forged, purpose):
        as_cookie = TestClient(app)
        as_cookie.cookies.set("mi_session", raw)
        assert as_cookie.get("/auth/me").status_code == 401
        as_bearer = client.get("/auth/me", headers=_bearer(raw))
        assert as_bearer.status_code == 401


def test_disabled_and_deleted_sessions_fail(
    client: TestClient, require_db: None
):
    account = _user()
    raw = _unity(client, account)
    actor = _unity(client, _user(role="admin"))
    patched = client.patch(
        f"/admin/users/{account['id']}",
        headers=_bearer(actor),
        json={"is_active": False},
    )
    assert patched.status_code == 200
    assert client.get("/auth/me", headers=_bearer(raw)).status_code == 401
    admin_call = client.get(
        "/admin/users",
        headers=_bearer(raw),
    )
    assert admin_call.status_code == 401

    other = _user()
    other_raw = _unity(client, other)
    me = client.get("/auth/me", headers=_bearer(other_raw))
    deleted = client.request(
        "DELETE",
        "/auth/me",
        headers=_bearer(other_raw),
        json={"user_name": me.json()["user_name"]},
    )
    assert deleted.status_code == 204
    assert client.get(
        "/auth/me", headers=_bearer(other_raw)
    ).status_code == 401


def test_demotion_kills_old_session_and_blocks_admin(
    client: TestClient, require_db: None
):
    account = _user(role="admin")
    raw = _unity(client, account)
    actor = _unity(client, _user(role="admin"))
    patched = client.patch(
        f"/admin/users/{account['id']}",
        headers=_bearer(actor),
        json={"role": "user"},
    )
    assert patched.status_code == 200
    assert client.get("/auth/me", headers=_bearer(raw)).status_code == 401
    fresh = _unity(client, account)
    denied = client.get("/admin/users", headers=_bearer(fresh))
    assert denied.status_code == 403


def test_password_change_kills_every_session(
    client: TestClient, require_db: None
):
    account = _user()
    first = _unity(client, account)
    second = _unity(TestClient(app), account)
    with get_connection() as conn:
        with conn.cursor() as cur:
            reset = create_email_token(
                cur, user_id=account["id"], purpose="password_reset"
            )
        conn.commit()
    changed = client.post(
        "/auth/email/reset-password",
        json={"token": reset, "password": "newpass123"},
    )
    assert changed.status_code == 200
    assert client.get("/auth/me", headers=_bearer(first)).status_code == 401
    assert client.get("/auth/me", headers=_bearer(second)).status_code == 401


def test_expired_session_row_is_rejected(
    client: TestClient, require_db: None
):
    account = _user()
    with get_connection() as conn:
        with conn.cursor() as cur:
            raw = insert_session(cur, account["id"])
            cur.execute(
                """
                UPDATE user_sessions
                   SET expires_at = %(expires)s
                 WHERE token_hash = %(token_hash)s
                """,
                {
                    "expires": datetime.now(UTC) - timedelta(minutes=1),
                    "token_hash": hash_session(raw),
                },
            )
        conn.commit()
    response = client.get("/auth/me", headers=_bearer(raw))
    assert response.status_code == 401


def test_cross_account_reads_and_writes(
    client: TestClient, require_db: None
):
    owner = _user()
    stranger = _user()
    owner_raw = _unity(client, owner)
    stranger_raw = _unity(client, stranger)
    created = client.post(
        "/decks",
        headers=_bearer(owner_raw),
        json={"name": "Private deck", "is_public": False},
    )
    assert created.status_code == 201
    deck_id = created.json()["id"]
    hidden = client.get(
        f"/decks/{deck_id}",
        headers=_bearer(stranger_raw),
    )
    assert hidden.status_code == 404
    patched = client.patch(
        f"/decks/{deck_id}",
        headers=_bearer(stranger_raw),
        json={"name": "Stolen"},
    )
    assert patched.status_code == 404
    export = client.get(
        "/auth/me/export",
        headers=_bearer(stranger_raw),
    )
    assert export.status_code == 200
    assert export.json()["profile"]["email"] == stranger["email"]
    prefs = client.patch(
        "/auth/me/preferences",
        headers=_bearer(owner_raw),
        json={"deck_sort": "name"},
    )
    assert prefs.status_code == 200
    owner_export = client.get(
        "/auth/me/export",
        headers=_bearer(owner_raw),
    )
    assert owner_export.json()["profile"]["email"] == owner["email"]


def test_print_confirm_rejects_other_users_payment(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, require_db: None
):
    payer = _user()
    victim = _user()
    raw = _unity(client, payer)

    intent = {
        "status": "succeeded",
        "metadata": {
            "user_id": str(victim["id"]),
            "deck_id": "1",
            "card_count": "1",
            "amount_cents": "199",
        },
        "amount": 199,
    }
    monkeypatch.setattr(
        "app.routers.billing.require_stripe_config",
        lambda: ("sk_test_fake", "price_fake"),
    )
    monkeypatch.setattr(
        "app.routers.billing.stripe.PaymentIntent.retrieve",
        lambda _pi: intent,
    )
    monkeypatch.setattr(
        "app.routers.billing.stripe.api_key",
        "sk_test_fake",
        raising=False,
    )
    response = client.post(
        "/billing/print/confirm",
        headers=_bearer(raw),
        json={"payment_intent_id": "pi_test_other_user"},
    )
    assert response.status_code == 403


def test_user_cannot_call_admin_or_staff_writes(
    client: TestClient, require_db: None
):
    account = _user()
    raw = _unity(client, account)
    headers = _bearer(raw)
    card_id = _card()
    assert client.get("/admin/users", headers=headers).status_code == 403
    upload = client.post(
        f"/cards/{card_id}/thumbnail",
        headers=headers,
        files={"file": ("x.png", b"not-an-image", "image/png")},
    )
    assert upload.status_code == 403
    flag = client.patch(
        "/admin/site/coming-soon",
        headers=headers,
        json={"coming_soon": False},
    )
    assert flag.status_code == 403


def test_developer_is_staff_but_not_admin(
    client: TestClient, require_db: None
):
    account = _user(role="developer")
    raw = _unity(client, account)
    headers = _bearer(raw)
    assert client.get("/admin/users", headers=headers).status_code == 403
    flag = client.patch(
        "/admin/site/coming-soon",
        headers=headers,
        json={"coming_soon": False},
    )
    assert flag.status_code == 200


def test_login_failure_limit_and_case_fold(
    client: TestClient, require_db: None
):
    account = _user()
    unknown = f"missing_{uuid.uuid4().hex[:8]}"
    wrong = {
        "identifier": account["email"],
        "password": "not-the-password",
    }
    missing = {"identifier": unknown, "password": "not-the-password"}
    first_real = client.post("/auth/login", json=wrong)
    first_missing = client.post("/auth/login", json=missing)
    assert first_real.status_code == first_missing.status_code
    assert first_real.json()["detail"] == first_missing.json()["detail"]
    assert first_real.json()["detail"] == "invalid_credentials"
    for _ in range(4):
        client.post("/auth/login", json=wrong)
        client.post("/auth/login", json=missing)
    blocked_real = client.post("/auth/login", json=wrong)
    blocked_missing = client.post("/auth/login", json=missing)
    assert blocked_real.status_code == 429
    assert blocked_missing.status_code == 429
    assert blocked_real.json()["detail"] == "rate_limited"
    assert blocked_missing.json()["detail"] == "rate_limited"

    fresh = _user()
    upper = fresh["email"].upper()
    for _ in range(5):
        client.post(
            "/auth/login",
            json={"identifier": upper, "password": "not-the-password"},
        )
    folded = client.post(
        "/auth/login",
        json={
            "identifier": fresh["email"],
            "password": fresh["password"],
        },
    )
    assert folded.status_code == 429
    cleared = _user()
    for _ in range(4):
        client.post(
            "/auth/login",
            json={
                "identifier": cleared["email"],
                "password": "not-the-password",
            },
        )
    ok = client.post(
        "/auth/login",
        json={
            "identifier": cleared["email"],
            "password": cleared["password"],
        },
    )
    assert ok.status_code == 200
    again = client.post(
        "/auth/login",
        json={
            "identifier": cleared["email"],
            "password": "not-the-password",
        },
    )
    assert again.status_code == 401


def test_mail_limits_are_per_address(
    client: TestClient, require_db: None
):
    first = f"mail_{uuid.uuid4().hex[:8]}@example.com"
    second = f"mail_{uuid.uuid4().hex[:8]}@example.com"
    for _ in range(5):
        client.post(
            "/auth/email/resend-verification",
            json={"email": first},
        )
    blocked = client.post(
        "/auth/email/resend-verification",
        json={"email": first},
    )
    assert blocked.status_code == 429
    other = client.post(
        "/auth/email/resend-verification",
        json={"email": second},
    )
    assert other.status_code == 200
    reset_address = f"reset_{uuid.uuid4().hex[:8]}@example.com"
    for _ in range(5):
        client.post(
            "/auth/email/forgot-password",
            json={"email": reset_address},
        )
    reset_blocked = client.post(
        "/auth/email/forgot-password",
        json={"email": reset_address},
    )
    assert reset_blocked.status_code == 429


def test_username_resend_does_not_replace_token(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    require_db: None,
):
    account = _user(verified=False)
    sent: dict[str, str] = {}

    def _capture(**kwargs: str) -> None:
        sent["to"] = kwargs["to"]

    monkeypatch.setattr(
        "app.email_tokens.send_verify_email",
        _capture,
    )
    with get_connection() as conn:
        with conn.cursor() as cur:
            create_email_token(
                cur,
                user_id=account["id"],
                purpose=PURPOSE_VERIFY,
            )
        conn.commit()
    by_name = client.post(
        "/auth/email/resend-verification",
        json={"email": account["name"]},
    )
    assert by_name.status_code == 200
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*)
                  FROM email_tokens
                 WHERE user_id = %(id)s
                   AND purpose = %(purpose)s
                   AND used_at IS NULL
                """,
                {"id": account["id"], "purpose": PURPOSE_VERIFY},
            )
            unused = int(cur.fetchone()[0])
    assert unused == 1
    by_email = client.post(
        "/auth/email/resend-verification",
        json={"email": account["email"]},
    )
    assert by_email.status_code == 200
    assert sent["to"] == account["email"]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*)
                  FROM email_tokens
                 WHERE user_id = %(id)s
                   AND purpose = %(purpose)s
                   AND used_at IS NULL
                """,
                {"id": account["id"], "purpose": PURPOSE_VERIFY},
            )
            still_unused = int(cur.fetchone()[0])
    assert still_unused == 1


def test_upload_uses_file_bytes_not_content_type(
    client: TestClient, require_db: None
):
    staff = _unity(client, _user(role="admin"))
    user = _unity(client, _user())
    card_id = _card()
    denied = client.post(
        f"/cards/{card_id}/thumbnail",
        headers=_bearer(user),
        files={"file": ("x.png", b"not-an-image", "image/png")},
    )
    assert denied.status_code == 403
    spoofed = client.post(
        f"/cards/{card_id}/thumbnail",
        headers=_bearer(staff),
        files={"file": ("x.png", b"not-an-image", "image/png")},
    )
    assert spoofed.status_code == 400
    for payload, name in (
        (PNG, "card.png"),
        (JPEG, "card.jpg"),
        (WEBP, "card.webp"),
    ):
        accepted = client.post(
            f"/cards/{card_id}/thumbnail",
            headers=_bearer(staff),
            files={"file": (name, payload, "text/plain")},
        )
        assert accepted.status_code == 200


def test_production_secret_and_docs(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", DEV_SIGNING_SECRET)
    with pytest.raises(RuntimeError):
        assert_production_secret()
    monkeypatch.setenv("JWT_SECRET", "")
    with pytest.raises(RuntimeError):
        assert_production_secret()
    urls = api_doc_urls()
    assert urls["docs_url"] is None
    assert urls["redoc_url"] is None
    assert urls["openapi_url"] is None
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("JWT_SECRET", DEV_SIGNING_SECRET)
    assert_production_secret()
    assert api_doc_urls()["docs_url"] == "/docs"


def test_cookie_flags_follow_environment(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    require_db: None,
):
    account = _user()
    monkeypatch.setenv("APP_ENV", "development")
    assert session_cookie_secure() is False
    dev_login = client.post(
        "/auth/login",
        json={
            "identifier": account["email"],
            "password": account["password"],
        },
    )
    dev_cookie = (dev_login.headers.get("set-cookie") or "").lower()
    assert "httponly" in dev_cookie
    assert "samesite=lax" in dev_cookie
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "unique-production-secret")
    assert session_cookie_secure() is True
    prod_login = client.post(
        "/auth/login",
        json={
            "identifier": account["email"],
            "password": account["password"],
        },
    )
    prod_cookie = (prod_login.headers.get("set-cookie") or "").lower()
    assert "secure" in prod_cookie
    assert "httponly" in prod_cookie
    assert "samesite=lax" in prod_cookie
