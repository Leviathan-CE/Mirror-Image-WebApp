"""GET /cards/all_cards — guest publish gate, player unlocks, staff dump."""

from __future__ import annotations

import uuid

import pytest

from app.db import get_connection


def _payload_items(body: dict) -> list[dict]:
    # Route model currently uses `itmes`; accept `items` once renamed.
    return body.get("items") or body.get("itmes") or []


def _ids(body: dict) -> set[int]:
    return {int(row["ID"]) for row in _payload_items(body)}


@pytest.fixture
def all_cards_fixture(require_db, client, other_auth_headers):
    """
    Four cards in two fake sets, plus one unlock row for the throwaway user.

    published_free     — published, unlocked set
    unpublished_free   — not published, same unlocked set
    published_locked   — published, set the player has no unlock for
    deprecated_free    — published + deprecated (must stay hidden)
    """
    suffix = uuid.uuid4().hex[:8]
    free_set = f"allcards_free_{suffix}"
    locked_set = f"allcards_locked_{suffix}"
    base_id = 8_900_000_000 + (int(suffix, 16) % 1_000_000)
    ids = {
        "published_free": base_id + 1,
        "unpublished_free": base_id + 2,
        "published_locked": base_id + 3,
        "deprecated_free": base_id + 4,
    }

    me = client.get("/auth/me", headers=other_auth_headers)
    if me.status_code != 200:
        pytest.skip(f"could not read throwaway user: {me.text}")
    player_id = int(me.json()["id"])

    upgrade_id: int | None = None
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS upgrades (
                        id BIGSERIAL PRIMARY KEY,
                        upgrade_name TEXT NOT NULL,
                        description TEXT NOT NULL DEFAULT '',
                        upgrade_content TEXT NOT NULL DEFAULT '',
                        number_active_upgrades INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_has_upgrades (
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        upgrade_id BIGINT NOT NULL REFERENCES upgrades(id)
                            ON DELETE CASCADE,
                        has_paid BOOLEAN DEFAULT FALSE,
                        unlock BOOLEAN DEFAULT FALSE,
                        PRIMARY KEY (user_id, upgrade_id)
                    )
                    """
                )
                for key, card_id in ids.items():
                    set_name = locked_set if key == "published_locked" else free_set
                    deprecated = key == "deprecated_free"
                    cur.execute(
                        """
                        INSERT INTO cards (id, card_name, card_set_name, is_deprecated)
                        VALUES (%(id)s, %(name)s, %(set_name)s, %(deprecated)s)
                        """,
                        {
                            "id": card_id,
                            "name": f"AllCards {key} {suffix}",
                            "set_name": set_name,
                            "deprecated": deprecated,
                        },
                    )
                    published = (
                        "published"
                        if key in {"published_free", "published_locked", "deprecated_free"}
                        else "not published"
                    )
                    cur.execute(
                        """
                        INSERT INTO publish_cards (card_id, published)
                        VALUES (%(id)s, %(published)s)
                        ON CONFLICT (card_id) DO UPDATE
                            SET published = EXCLUDED.published
                        """,
                        {"id": card_id, "published": published},
                    )
                cur.execute(
                    """
                    INSERT INTO upgrades (upgrade_name, upgrade_content)
                    VALUES (%(name)s, %(content)s)
                    RETURNING id
                    """,
                    {"name": f"allcards_{suffix}", "content": free_set},
                )
                upgrade_id = int(cur.fetchone()[0])
                cur.execute(
                    """
                    INSERT INTO user_has_upgrades (user_id, upgrade_id, unlock)
                    VALUES (%(user_id)s, %(upgrade_id)s, TRUE)
                    """,
                    {"user_id": player_id, "upgrade_id": upgrade_id},
                )
            conn.commit()

        yield {
            "ids": ids,
            "headers": other_auth_headers,
            "player_id": player_id,
            "upgrade_id": upgrade_id,
        }
    finally:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM cards WHERE id = ANY(%(ids)s)",
                    {"ids": list(ids.values())},
                )
                if upgrade_id is not None:
                    cur.execute(
                        "DELETE FROM upgrades WHERE id = %(upgrade_id)s",
                        {"upgrade_id": upgrade_id},
                    )
            conn.commit()


def test_guest_sees_only_published_cards(client, all_cards_fixture):
    ids = all_cards_fixture["ids"]
    response = client.get("/cards/all_cards")
    assert response.status_code == 200
    got = _ids(response.json())
    assert ids["published_free"] in got
    assert ids["published_locked"] in got
    assert ids["unpublished_free"] not in got
    assert ids["deprecated_free"] not in got


def test_player_sees_unlocked_published_set_only(client, all_cards_fixture):
    ids = all_cards_fixture["ids"]
    response = client.get(
        "/cards/all_cards", headers=all_cards_fixture["headers"]
    )
    assert response.status_code == 200
    got = _ids(response.json())
    assert ids["published_free"] in got
    assert ids["unpublished_free"] not in got
    assert ids["published_locked"] not in got
    assert ids["deprecated_free"] not in got


def test_player_locked_row_hides_the_set(client, all_cards_fixture):
    ids = all_cards_fixture["ids"]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_has_upgrades
                   SET unlock = FALSE
                 WHERE user_id = %(user_id)s
                   AND upgrade_id = %(upgrade_id)s
                """,
                {
                    "user_id": all_cards_fixture["player_id"],
                    "upgrade_id": all_cards_fixture["upgrade_id"],
                },
            )
        conn.commit()

    response = client.get(
        "/cards/all_cards", headers=all_cards_fixture["headers"]
    )
    assert response.status_code == 200
    got = _ids(response.json())
    assert ids["published_free"] not in got
    assert ids["unpublished_free"] not in got
    assert ids["published_locked"] not in got


def test_admin_sees_unpublished_and_locked_sets(
    client, admin_headers, all_cards_fixture
):
    ids = all_cards_fixture["ids"]
    response = client.get("/cards/all_cards", headers=admin_headers)
    assert response.status_code == 200
    got = _ids(response.json())
    assert ids["published_free"] in got
    assert ids["unpublished_free"] in got
    assert ids["published_locked"] in got
    assert ids["deprecated_free"] not in got


def test_developer_sees_unpublished_and_locked_sets(
    client, developer_headers, all_cards_fixture
):
    ids = all_cards_fixture["ids"]
    response = client.get("/cards/all_cards", headers=developer_headers)
    assert response.status_code == 200
    got = _ids(response.json())
    assert ids["published_free"] in got
    assert ids["unpublished_free"] in got
    assert ids["published_locked"] in got
    assert ids["deprecated_free"] not in got
