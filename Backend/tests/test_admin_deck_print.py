"""Staff can price a deck, and a free deck skips payment."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.db import get_connection
from app.security import hash_password


def _account(role: str) -> dict:
    suffix = uuid.uuid4().hex[:8]
    email = f"deckprice_{suffix}@example.com"
    name = f"deckprice_{suffix}"
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
                    %(name)s, %(email)s, %(password)s, %(role)s,
                    TRUE, TRUE, TRUE, NOW()
                )
                RETURNING id
                """,
                {
                    "name": name,
                    "email": email,
                    "password": hash_password("testpass123"),
                    "role": role,
                },
            )
            user_id = int(cur.fetchone()[0])
        conn.commit()
    return {
        "id": user_id,
        "email": email,
        "password": "testpass123",
    }


def _unity(client: TestClient, account: dict) -> dict[str, str]:
    response = client.post(
        "/auth/login",
        json={
            "identifier": account["email"],
            "password": account["password"],
            "client": "unity",
        },
    )
    assert response.status_code == 200
    raw = response.json()["access_token"]
    return {"Authorization": f"Bearer {raw}"}


def _delete_accounts() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM users
                 WHERE lower(email) LIKE 'deckprice\\_%@example.com'
                       ESCAPE '\\'
                """
            )
        conn.commit()


def test_free_and_custom_print_price(
    client: TestClient, require_db: None
):
    _delete_accounts()
    owner = _account("user")
    staff = _account("admin")
    try:
        owner_headers = _unity(client, owner)
        created = client.post(
            "/decks",
            headers=owner_headers,
            json={"name": "Priced deck", "is_public": False},
        )
        assert created.status_code == 201
        deck_id = created.json()["id"]
        staff_headers = _unity(client, staff)

        hidden = client.get(f"/decks/{deck_id}", headers=owner_headers)
        assert hidden.status_code == 200
        stranger = client.get(f"/decks/{deck_id}")
        assert stranger.status_code == 401 or stranger.status_code == 404
        staff_view = client.get(f"/decks/{deck_id}", headers=staff_headers)
        assert staff_view.status_code == 200

        freed = client.patch(
            f"/admin/decks/{deck_id}/print-price",
            headers=staff_headers,
            json={"print_price_cents": 0},
        )
        assert freed.status_code == 200
        assert freed.json()["print_price_cents"] == 0
        quote = client.get(
            f"/billing/print/quote/{deck_id}",
            headers=owner_headers,
        )
        assert quote.status_code == 200
        assert quote.json()["amount_cents"] == 0
        redeemed = client.post(
            f"/billing/print/redeem/{deck_id}",
            headers=owner_headers,
        )
        assert redeemed.status_code == 200
        assert redeemed.json()["allowed"] is True

        custom = client.patch(
            f"/admin/decks/{deck_id}/print-price",
            headers=staff_headers,
            json={"print_price_cents": 250},
        )
        assert custom.status_code == 200
        priced = client.get(
            f"/billing/print/quote/{deck_id}",
            headers=owner_headers,
        )
        assert priced.status_code == 200
        assert priced.json()["amount_cents"] == 250
    finally:
        _delete_accounts()
