"""
Deck authorization / visibility checks.

These answer one question: may this viewer see or mutate this deck?
They raise HTTP 404 for both missing and forbidden (no existence leak).
"""

from __future__ import annotations

from fastapi import HTTPException, status


def require_owned_deck(cur, *, user_id: int, deck_id: int) -> tuple:
    """Return ownership row or raise 404. Row: deck fields + is_public + author."""
    cur.execute(
        """
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            d.cover_image_mime_type,
            uhd.is_public,
            u.user_name
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE uhd.user_id = %(user_id)s
          AND uhd.deck_id = %(deck_id)s
        """,
        {"user_id": user_id, "deck_id": deck_id},
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="deck_not_found"
        )
    return row


def require_readable_deck(cur, *, deck_id: int, user_id: int | None) -> tuple:
    """
    Return a deck row if the viewer may read it.

    Readable when:
    - `is_public` is true (anyone, including anonymous), or
    - `user_id` owns the deck (private decks).

    Row: id, name, description, cover_path, cover_mime, is_public, author, owner_id
    """
    cur.execute(
        """
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            d.cover_image_mime_type,
            uhd.is_public,
            u.user_name,
            uhd.user_id
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE uhd.deck_id = %(deck_id)s
        LIMIT 1
        """,
        {"deck_id": deck_id},
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="deck_not_found"
        )

    is_public = bool(row[5])
    owner_id = int(row[7])
    if is_public or (user_id is not None and user_id == owner_id):
        return row

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="deck_not_found"
    )
