"""
Copy a readable deck into another user's collection.

One use-case: duplicate categories, cards, cover metadata, and tags.
Likes/views reset; the copy is always private.
"""

from __future__ import annotations

from app.decks.access import require_readable_deck
from app.decks.queries import card_count, seed_default_categories, summary_with_community
from app.decks.schemas import DeckSummary


def copy_deck_for_user(cur, *, deck_id: int, user_id: int) -> DeckSummary:
    """
    Duplicate `deck_id` for `user_id`. Caller owns the DB transaction/commit.
    """
    source = require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
    source_name = (source[1] or f"Deck #{deck_id}").strip()
    copy_name = f"Copy of {source_name}"
    if len(copy_name) > 120:
        copy_name = copy_name[:120].rstrip()

    cur.execute(
        """
        SELECT cover_image_path, cover_image_mime_type, description
          FROM decks
         WHERE id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    meta = cur.fetchone()
    cover_path = meta[0] if meta else None
    cover_mime = meta[1] if meta else None
    description = meta[2] if meta else source[2]

    cur.execute(
        """
        INSERT INTO decks (
            name, description,
            cover_image_path, cover_image_mime_type,
            like_count, view_count
        )
        VALUES (
            %(name)s, %(description)s,
            %(cover_path)s, %(cover_mime)s,
            0, 0
        )
        RETURNING id, name, description, cover_image_path
        """,
        {
            "name": copy_name,
            "description": description,
            "cover_path": cover_path,
            "cover_mime": cover_mime,
        },
    )
    created = cur.fetchone()
    new_id = int(created[0])

    cur.execute(
        """
        INSERT INTO user_has_decks (user_id, deck_id, is_public)
        VALUES (%(user_id)s, %(deck_id)s, FALSE)
        """,
        {"user_id": user_id, "deck_id": new_id},
    )

    # Categories: map old id → new id
    cur.execute(
        """
        SELECT id, name, sort_order
          FROM deck_categories
         WHERE deck_id = %(deck_id)s
         ORDER BY sort_order ASC, id ASC
        """,
        {"deck_id": deck_id},
    )
    category_map: dict[int, int] = {}
    for old_cat_id, cat_name, sort_order in cur.fetchall():
        cur.execute(
            """
            INSERT INTO deck_categories (deck_id, name, sort_order)
            VALUES (%(deck_id)s, %(name)s, %(sort_order)s)
            RETURNING id
            """,
            {
                "deck_id": new_id,
                "name": cat_name,
                "sort_order": int(sort_order),
            },
        )
        category_map[int(old_cat_id)] = int(cur.fetchone()[0])

    if not category_map:
        seed_default_categories(cur, new_id)

    cur.execute(
        """
        SELECT card_id, category_id, quantity, sort_order
          FROM deck_has_cards
         WHERE deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    for card_id, old_cat_id, quantity, sort_order in cur.fetchall():
        new_cat_id = category_map.get(int(old_cat_id))
        if new_cat_id is None:
            continue
        cur.execute(
            """
            INSERT INTO deck_has_cards
                (deck_id, card_id, category_id, quantity, sort_order)
            VALUES
                (%(deck_id)s, %(card_id)s, %(category_id)s,
                 %(quantity)s, %(sort_order)s)
            """,
            {
                "deck_id": new_id,
                "card_id": int(card_id),
                "category_id": new_cat_id,
                "quantity": int(quantity),
                "sort_order": int(sort_order),
            },
        )

    cur.execute(
        """
        INSERT INTO deck_tags (deck_id, tag, created_by)
        SELECT %(new_id)s, tag, %(user_id)s
          FROM deck_tags
         WHERE deck_id = %(old_id)s
        """,
        {
            "new_id": new_id,
            "old_id": deck_id,
            "user_id": user_id,
        },
    )

    cur.execute(
        "SELECT user_name FROM users WHERE id = %(user_id)s",
        {"user_id": user_id},
    )
    author = cur.fetchone()[0]
    count = card_count(cur, new_id)
    # Build a row shaped like owned-deck summary source
    row = (
        new_id,
        created[1],
        created[2],
        created[3],
        None,
        False,
        author,
        user_id,
    )
    return summary_with_community(cur, row, count, viewer_id=user_id)
