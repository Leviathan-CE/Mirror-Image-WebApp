"""
Deck builder API.

Read (public decks — anyone; private — owner only):
  GET    /decks/default-categories
  GET    /decks/tags
  GET    /decks/public
  GET    /decks/{deck_id}
  GET    /decks/{deck_id}/categories
  GET    /decks/{deck_id}/cards

Write (owner only, Bearer JWT required):
  GET    /decks/me
  POST   /decks
  POST   /decks/{deck_id}/copy
  PATCH  /decks/{deck_id}
  DELETE /decks/{deck_id}
  POST   /decks/{deck_id}/cover
  POST   /decks/{deck_id}/categories
  PATCH  /decks/{deck_id}/categories/{category_id}
  DELETE /decks/{deck_id}/categories/{category_id}
  POST   /decks/{deck_id}/cards
  PATCH  /decks/{deck_id}/cards/{card_id}
  DELETE /decks/{deck_id}/cards/{card_id}
  PUT    /decks/{deck_id}/cards/order

Domain logic lives under app.decks (schemas, access, queries).
This module is the HTTP edge: Depends, status codes, and wiring.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from psycopg2 import OperationalError
from psycopg2.errors import ForeignKeyViolation, UniqueViolation

from app.card_publish import (
    catalogue_visibility_sql,
    get_optional_include_preview,
)
from app.db import get_connection
from app.deck_community import (
    add_deck_like,
    ensure_deck_tag,
    fetch_deck_tags,
    increment_deck_view,
    remove_deck_like,
    remove_deck_tag,
    suggest_deck_tags,
)
from app.deck_defaults import DEFAULT_DECK_CATEGORY_NAMES, category_in_deck_default
from app.decks.access import require_owned_deck, require_readable_deck
from app.decks.copy import copy_deck_for_user
from app.decks.queries import (
    card_count,
    category_out,
    default_category_id,
    fetch_deck_cards,
    fetch_deck_categories,
    fetch_one_deck_card,
    next_card_sort_order,
    next_category_sort_order,
    normalize_category_name,
    require_category_on_deck,
    seed_default_categories,
    slugify,
    summary_with_community,
)
from app.decks.schemas import (
    AddCardRequest,
    DeckCardEntry,
    DeckCategoryCreate,
    DeckCategoryOut,
    DeckCategoryUpdate,
    DeckCoverUploaded,
    DeckCreateRequest,
    DeckDetail,
    DeckListPage,
    DeckSummary,
    DeckTagBody,
    DeckTagSuggestion,
    DeckTagSuggestResponse,
    DeckUpdateRequest,
    DefaultCategoriesResponse,
    ReorderCardsRequest,
    UpdateCardRequest,
)
from app.media_urls import signed_media_path
from app.play_visibility import resolve_room_visibility
from app.profanity import reject_if_profane
from app.security import (
    get_current_user_id,
    get_optional_is_admin,
    get_optional_user_id,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/decks", tags=["decks"])

_COVER_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}
_COVER_MAX_BYTES = 2 * 1024 * 1024


def _db_unavailable(exc: OperationalError) -> HTTPException:
    logger.warning("db error on decks route: %s", exc)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="database_unavailable",
    )



@router.get("/default-categories", response_model=DefaultCategoriesResponse)
def list_default_categories():
    """Default section names seeded on new decks (no auth required)."""
    return DefaultCategoriesResponse(categories=list(DEFAULT_DECK_CATEGORY_NAMES))


@router.get("/tags", response_model=DeckTagSuggestResponse)
def list_deck_tag_suggestions(
    q: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=12, ge=1, le=40),
    exclude: str | None = Query(
        default=None,
        max_length=400,
        description="Comma-separated tags already on the deck (hidden from suggestions).",
    ),
):
    """Typeahead for existing deck tags (public; used when adding tags)."""
    excluded = [part.strip() for part in (exclude or "").split(",") if part.strip()]
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                rows = suggest_deck_tags(
                    cur, q=q or "", limit=limit, exclude=excluded
                )
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return DeckTagSuggestResponse(
        tags=[DeckTagSuggestion(tag=r["tag"], uses=r["uses"]) for r in rows]
    )


@router.get("/public", response_model=DeckListPage)
def list_public_decks(
    q: str | None = Query(default=None, max_length=120),
    author: str | None = Query(default=None, max_length=64),
    tag: str | None = Query(default=None, max_length=32),
    card: str | None = Query(
        default=None,
        max_length=120,
        description="Deck must contain a card whose name matches (ILIKE).",
    ),
    card_id: int | None = Query(default=None, gt=0),
    sort: str = Query(
        default="newest",
        pattern="^(newest|likes|views|name)$",
    ),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: int | None = Depends(get_optional_user_id),
):
    """
    Browse public decks with optional search filters.

    Filters (AND):
    - q: deck name / description
    - author: username contains
    - tag: exact tag (case-insensitive)
    - card / card_id: deck contains that card
    """
    where = ["uhd.is_public = TRUE"]
    params: dict[str, Any] = {
        "limit": limit,
        "offset": offset,
        "viewer_id": user_id,
    }

    q_trim = (q or "").strip()
    if q_trim:
        where.append(
            "(d.name ILIKE %(q)s OR COALESCE(d.description, '') ILIKE %(q)s)"
        )
        params["q"] = f"%{q_trim}%"

    author_trim = (author or "").strip()
    if author_trim:
        where.append("u.user_name ILIKE %(author)s")
        params["author"] = f"%{author_trim}%"

    tag_trim = (tag or "").strip()
    if tag_trim:
        where.append(
            """
            EXISTS (
                SELECT 1 FROM deck_tags dt
                 WHERE dt.deck_id = d.id
                   AND lower(trim(dt.tag)) = lower(%(tag)s)
            )
            """
        )
        params["tag"] = tag_trim

    if card_id is not None:
        where.append(
            """
            EXISTS (
                SELECT 1 FROM deck_has_cards dhc
                 WHERE dhc.deck_id = d.id
                   AND dhc.card_id = %(card_id)s
            )
            """
        )
        params["card_id"] = card_id
    else:
        card_trim = (card or "").strip()
        if card_trim:
            where.append(
                """
                EXISTS (
                    SELECT 1
                      FROM deck_has_cards dhc
                      JOIN cards c ON c.id = dhc.card_id
                     WHERE dhc.deck_id = d.id
                       AND c.card_name ILIKE %(card)s
                )
                """
            )
            params["card"] = f"%{card_trim}%"

    where_sql = " AND ".join(where)
    order_sql = {
        "newest": "d.id DESC",
        "likes": "like_count DESC, d.id DESC",
        "views": "view_count DESC, d.id DESC",
        "name": "lower(COALESCE(d.name, '')) ASC, d.id DESC",
    }[sort]

    sql = f"""
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            uhd.is_public,
            u.user_name,
            COALESCE(
                (
                    SELECT SUM(dhc.quantity)::int
                    FROM deck_has_cards dhc
                    WHERE dhc.deck_id = d.id
                ),
                0
            ) AS card_count,
            COALESCE(d.like_count, 0)::int AS like_count,
            COALESCE(d.view_count, 0)::int AS view_count,
            COALESCE(
                (
                    SELECT array_agg(dt.tag ORDER BY lower(dt.tag), dt.tag)
                      FROM deck_tags dt
                     WHERE dt.deck_id = d.id
                ),
                '{{}}'::text[]
            ) AS tags,
            (
                %(viewer_id)s IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM deck_likes dl2
                     WHERE dl2.deck_id = d.id
                       AND dl2.user_id = %(viewer_id)s
                )
            ) AS liked_by_me,
            COUNT(*) OVER() AS total_count
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT %(limit)s OFFSET %(offset)s
    """

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    total = int(rows[0][11]) if rows else 0
    items = [
        DeckSummary(
            id=row[0],
            name=row[1],
            description=row[2],
            cover_image_path=signed_media_path(row[3]),
            is_public=bool(row[4]),
            author_name=row[5],
            card_count=int(row[6] or 0),
            like_count=int(row[7] or 0),
            view_count=int(row[8] or 0),
            tags=list(row[9] or []),
            liked_by_me=bool(row[10]) if user_id is not None else False,
        )
        for row in rows
    ]
    return DeckListPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/me", response_model=list[DeckSummary])
def list_my_decks(user_id: int = Depends(get_current_user_id)):
    """Return decks owned by the current user."""
    sql = """
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            uhd.is_public,
            u.user_name,
            COALESCE(
                (
                    SELECT SUM(dhc.quantity)::int
                    FROM deck_has_cards dhc
                    WHERE dhc.deck_id = d.id
                ),
                0
            ) AS card_count
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE uhd.user_id = %(user_id)s
        ORDER BY d.id DESC
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, {"user_id": user_id})
                rows = cur.fetchall()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return [
        DeckSummary(
            id=row[0],
            name=row[1],
            description=row[2],
            cover_image_path=signed_media_path(row[3]),
            is_public=bool(row[4]),
            author_name=row[5],
            card_count=int(row[6] or 0),
        )
        for row in rows
    ]


@router.post("", response_model=DeckSummary, status_code=status.HTTP_201_CREATED)
def create_deck(
    body: DeckCreateRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Create a deck owned by the current user (optional cover via /cover later)."""
    reject_if_profane(body.name, field="name")
    reject_if_profane(body.description, field="description")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO decks (name, description)
                    VALUES (%(name)s, %(description)s)
                    RETURNING id, name, description, cover_image_path, cover_image_mime_type
                    """,
                    {"name": body.name, "description": body.description},
                )
                deck = cur.fetchone()
                deck_id = deck[0]
                cur.execute(
                    """
                    INSERT INTO user_has_decks (user_id, deck_id, is_public)
                    VALUES (%(user_id)s, %(deck_id)s, %(is_public)s)
                    """,
                    {
                        "user_id": user_id,
                        "deck_id": deck_id,
                        "is_public": body.is_public,
                    },
                )
                seed_default_categories(cur, deck_id)
                cur.execute(
                    "SELECT user_name FROM users WHERE id = %(user_id)s",
                    {"user_id": user_id},
                )
                author = cur.fetchone()[0]
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return DeckSummary(
        id=deck_id,
        name=deck[1],
        description=deck[2],
        cover_image_path=signed_media_path(deck[3]),
        is_public=body.is_public,
        author_name=author,
        card_count=0,
    )


@router.post(
    "/{deck_id}/copy",
    response_model=DeckSummary,
    status_code=status.HTTP_201_CREATED,
)
def copy_deck(
    deck_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """
    Duplicate a readable deck into the current user's collection.

    Copies categories, cards (with quantities), cover path, and tags.
    Likes/views start at 0. New deck is private so the owner can edit safely.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                summary = copy_deck_for_user(
                    cur, deck_id=deck_id, user_id=user_id
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return summary


@router.get("/{deck_id}", response_model=DeckDetail)
def get_deck(
    deck_id: int,
    room: str | None = Query(
        default=None,
        max_length=16,
        description=(
            "Playtest room code. Pools card visibility across the two seated "
            "players and opens the deck your opponent seated. Ignored unless "
            "you are seated in that live room with this deck."
        ),
    ),
    user_id: int | None = Depends(get_optional_user_id),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """
    Deck metadata, categories, and cards.

    Public decks: anyone. Private decks: owner only.
    Preview / unpublished cards are classified stubs unless the viewer
    is entitled (subscriber preview or admin bypass).
    Mutations still require ownership on write routes.

    Increments `view_count` when a non-owner opens the deck — playtest room
    reads are excluded, since both clients refetch on every join.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                pooled = resolve_room_visibility(
                    cur, code=room, deck_id=deck_id, user_id=user_id
                )
                row = require_readable_deck(
                    cur,
                    deck_id=deck_id,
                    user_id=user_id,
                    allow_private=bool(pooled and pooled.allow_private),
                )
                owner_id = int(row[7])
                if pooled is None and (user_id is None or user_id != owner_id):
                    increment_deck_view(cur, deck_id)

                categories = fetch_deck_categories(cur, deck_id)
                cards = fetch_deck_cards(
                    cur,
                    deck_id,
                    bypass=is_admin or bool(pooled and pooled.bypass),
                    include_preview=(
                        include_preview or bool(pooled and pooled.include_preview)
                    ),
                )
                count = card_count(cur, deck_id)
                summary = summary_with_community(
                    cur, row, count, viewer_id=user_id
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return DeckDetail(**summary.model_dump(), categories=categories, cards=cards)


@router.post("/{deck_id}/like", response_model=DeckSummary)
def like_deck(
    deck_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Like a readable deck (idempotent)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
                add_deck_like(cur, deck_id=deck_id, user_id=user_id)
                summary = summary_with_community(
                    cur, row, card_count(cur, deck_id), viewer_id=user_id
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e
    return summary


@router.delete("/{deck_id}/like", response_model=DeckSummary)
def unlike_deck(
    deck_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Remove your like from a readable deck (idempotent)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
                remove_deck_like(cur, deck_id=deck_id, user_id=user_id)
                summary = summary_with_community(
                    cur, row, card_count(cur, deck_id), viewer_id=user_id
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e
    return summary


@router.post("/{deck_id}/tags", response_model=DeckSummary)
def add_tag_to_deck(
    deck_id: int,
    body: DeckTagBody,
    user_id: int = Depends(get_current_user_id),
):
    """Owner adds a user-generated tag to their deck."""
    reject_if_profane(body.tag, field="tag")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                try:
                    ensure_deck_tag(
                        cur, deck_id=deck_id, tag=body.tag, created_by=user_id
                    )
                except UniqueViolation as e:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT, detail="tag_exists"
                    ) from e
                summary = summary_with_community(
                    cur, row, card_count(cur, deck_id), viewer_id=user_id
                )
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e
    return summary


@router.delete("/{deck_id}/tags/{tag}", response_model=DeckSummary)
def delete_tag_from_deck(
    deck_id: int,
    tag: str,
    user_id: int = Depends(get_current_user_id),
):
    """Owner removes a tag from their deck."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                if not remove_deck_tag(cur, deck_id=deck_id, tag=tag):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND, detail="tag_not_found"
                    )
                summary = summary_with_community(
                    cur, row, card_count(cur, deck_id), viewer_id=user_id
                )
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e
    return summary


@router.patch("/{deck_id}", response_model=DeckSummary)
def update_deck(
    deck_id: int,
    body: DeckUpdateRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Update name, description, and/or public flag."""
    if body.name is None and body.description is None and body.is_public is None:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    reject_if_profane(body.name, field="name")
    reject_if_profane(body.description, field="description")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                owned = require_owned_deck(cur, user_id=user_id, deck_id=deck_id)

                # Publishing re-checks stored text so private drafts can't sneak
                # blocked language onto the community list.
                if body.is_public is True:
                    effective_name = (
                        body.name if body.name is not None else owned[1]
                    )
                    effective_desc = (
                        body.description
                        if body.description is not None
                        else owned[2]
                    )
                    reject_if_profane(effective_name, field="name")
                    reject_if_profane(effective_desc, field="description")
                    for tag in fetch_deck_tags(cur, deck_id):
                        reject_if_profane(tag, field="tag")

                if body.name is not None or body.description is not None:
                    cur.execute(
                        """
                        UPDATE decks
                           SET name = COALESCE(%(name)s, name),
                               description = COALESCE(%(description)s, description)
                         WHERE id = %(deck_id)s
                        """,
                        {
                            "name": body.name,
                            "description": body.description,
                            "deck_id": deck_id,
                        },
                    )

                if body.is_public is not None:
                    cur.execute(
                        """
                        UPDATE user_has_decks
                           SET is_public = %(is_public)s
                         WHERE user_id = %(user_id)s
                           AND deck_id = %(deck_id)s
                        """,
                        {
                            "is_public": body.is_public,
                            "user_id": user_id,
                            "deck_id": deck_id,
                        },
                    )

                row = require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                count = card_count(cur, deck_id)
                summary = summary_with_community(
                    cur, row, count, viewer_id=user_id
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return summary


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a deck the user owns (cascades card entries and categories)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                cur.execute("DELETE FROM decks WHERE id = %(deck_id)s", {"deck_id": deck_id})
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.post("/{deck_id}/cover", response_model=DeckCoverUploaded)
async def upload_deck_cover(
    deck_id: int,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """Attach a cover image to a deck (png/jpeg/webp, max 2MB)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="cover_must_be_image")

    extension = _COVER_EXT.get(file.content_type)
    if extension is None:
        raise HTTPException(status_code=400, detail="unsupported_cover_type")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty_cover_file")
    if len(data) > _COVER_MAX_BYTES:
        raise HTTPException(status_code=413, detail="cover_too_large")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                deck_name = row[1] or f"deck-{deck_id}"

                base_dir = Path(__file__).resolve().parent.parent / "thumbnails" / "decks"
                deck_dir = base_dir / str(deck_id)
                deck_dir.mkdir(parents=True, exist_ok=True)

                file_name = f"{slugify(deck_name)}_cover{extension}"
                file_path = deck_dir / file_name
                file_path.write_bytes(data)

                relative_path = f"decks/{deck_id}/{file_name}"
                cur.execute(
                    """
                    UPDATE decks
                       SET cover_image_path = %(path)s,
                           cover_image_mime_type = %(mime)s
                     WHERE id = %(deck_id)s
                    """,
                    {
                        "path": relative_path,
                        "mime": file.content_type,
                        "deck_id": deck_id,
                    },
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e
    except OSError as e:
        logger.warning("deck cover write error: %s", e)
        raise HTTPException(status_code=500, detail="cover_write_failed") from e

    return DeckCoverUploaded(
        deck_id=deck_id,
        cover_image_path=signed_media_path(relative_path) or relative_path,
        cover_size_bytes=len(data),
    )


@router.get("/{deck_id}/categories", response_model=list[DeckCategoryOut])
def list_deck_categories(
    deck_id: int,
    user_id: int | None = Depends(get_optional_user_id),
):
    """List custom categories for a readable deck."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
                return fetch_deck_categories(cur, deck_id)
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.post(
    "/{deck_id}/categories",
    response_model=DeckCategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_deck_category(
    deck_id: int,
    body: DeckCategoryCreate,
    user_id: int = Depends(get_current_user_id),
):
    """Add a custom category to an owned deck."""
    name = normalize_category_name(body.name)
    in_deck = (
        body.in_deck
        if body.in_deck is not None
        else category_in_deck_default(name)
    )
    if not category_in_deck_default(name):
        in_deck = False
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                sort_order = (
                    body.sort_order
                    if body.sort_order is not None
                    else next_category_sort_order(cur, deck_id)
                )
                cur.execute(
                    """
                    INSERT INTO deck_categories (deck_id, name, sort_order, in_deck)
                    VALUES (%(deck_id)s, %(name)s, %(sort_order)s, %(in_deck)s)
                    RETURNING id, name, sort_order, in_deck
                    """,
                    {
                        "deck_id": deck_id,
                        "name": name,
                        "sort_order": sort_order,
                        "in_deck": in_deck,
                    },
                )
                row = cur.fetchone()
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(status_code=409, detail="category_name_taken") from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return category_out(row)


@router.patch("/{deck_id}/categories/{category_id}", response_model=DeckCategoryOut)
def update_deck_category(
    deck_id: int,
    category_id: int,
    body: DeckCategoryUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """Rename, reorder, or set whether a category is part of the RIG."""
    if body.name is None and body.sort_order is None and body.in_deck is None:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    name = normalize_category_name(body.name) if body.name is not None else None
    in_deck = body.in_deck
    if name is not None and not category_in_deck_default(name):
        in_deck = False
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                _id, current_name, _sort = require_category_on_deck(
                    cur, deck_id, category_id
                )
                check_name = name if name is not None else current_name
                if not category_in_deck_default(check_name):
                    in_deck = False

                cur.execute(
                    """
                    UPDATE deck_categories
                       SET name = COALESCE(%(name)s, name),
                           sort_order = COALESCE(%(sort_order)s, sort_order),
                           in_deck = COALESCE(%(in_deck)s, in_deck)
                     WHERE deck_id = %(deck_id)s
                       AND id = %(category_id)s
                    RETURNING id, name, sort_order, in_deck
                    """,
                    {
                        "name": name,
                        "sort_order": body.sort_order,
                        "in_deck": in_deck,
                        "deck_id": deck_id,
                        "category_id": category_id,
                    },
                )
                row = cur.fetchone()
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(status_code=409, detail="category_name_taken") from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return category_out(row)


@router.delete(
    "/{deck_id}/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_deck_category(
    deck_id: int,
    category_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Remove a category from an owned deck (must be empty)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                require_category_on_deck(cur, deck_id, category_id)

                cur.execute(
                    """
                    SELECT 1
                    FROM deck_has_cards
                    WHERE deck_id = %(deck_id)s
                      AND category_id = %(category_id)s
                    LIMIT 1
                    """,
                    {"deck_id": deck_id, "category_id": category_id},
                )
                if cur.fetchone() is not None:
                    raise HTTPException(status_code=409, detail="category_in_use")

                cur.execute(
                    """
                    DELETE FROM deck_categories
                    WHERE deck_id = %(deck_id)s
                      AND id = %(category_id)s
                    """,
                    {"deck_id": deck_id, "category_id": category_id},
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.get("/{deck_id}/cards", response_model=list[DeckCardEntry])
def list_deck_cards(
    deck_id: int,
    category_id: int | None = Query(default=None, gt=0),
    user_id: int | None = Depends(get_optional_user_id),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """List cards in a readable deck (public or owned), optionally by category."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
                if category_id is not None:
                    require_category_on_deck(cur, deck_id, category_id)
                return fetch_deck_cards(
                    cur,
                    deck_id,
                    category_id,
                    bypass=is_admin,
                    include_preview=include_preview,
                )
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.post(
    "/{deck_id}/cards",
    response_model=DeckCardEntry,
    status_code=status.HTTP_201_CREATED,
)
def add_card_to_deck(
    deck_id: int,
    body: AddCardRequest,
    user_id: int = Depends(get_current_user_id),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """
    Add a card to a deck category.

    If the same card+category already exists, quantities are summed.
    Non-subscribers may only add published cards; subscribers may also add
    preview cards; admins may add any catalogue card.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)

                cur.execute(
                    f"""
                    SELECT card_name
                      FROM cards
                     WHERE id = %(card_id)s
                       AND {catalogue_visibility_sql("cards", bypass=is_admin, include_preview=include_preview)}
                    """,
                    {"card_id": body.card_id},
                )
                card_row = cur.fetchone()
                if card_row is None:
                    raise HTTPException(status_code=404, detail="card_not_found")

                category_id = (
                    body.category_id
                    if body.category_id is not None
                    else default_category_id(cur, deck_id)
                )
                _, category_name, _ = require_category_on_deck(cur, deck_id, category_id)

                sort_order = (
                    body.sort_order
                    if body.sort_order is not None
                    else next_card_sort_order(cur, deck_id, category_id)
                )

                cur.execute(
                    """
                    INSERT INTO deck_has_cards
                        (deck_id, card_id, category_id, quantity, sort_order)
                    VALUES
                        (%(deck_id)s, %(card_id)s, %(category_id)s, %(quantity)s, %(sort_order)s)
                    ON CONFLICT (deck_id, card_id, category_id)
                    DO UPDATE SET
                        quantity = deck_has_cards.quantity + EXCLUDED.quantity,
                        sort_order = COALESCE(
                            EXCLUDED.sort_order,
                            deck_has_cards.sort_order
                        )
                    RETURNING card_id, quantity, category_id, sort_order
                    """,
                    {
                        "deck_id": deck_id,
                        "card_id": body.card_id,
                        "category_id": category_id,
                        "quantity": body.quantity,
                        "sort_order": sort_order,
                    },
                )
                entry = cur.fetchone()
                result = fetch_one_deck_card(
                    cur,
                    deck_id,
                    int(entry[0]),
                    int(entry[2]),
                    bypass=is_admin,
                    include_preview=include_preview,
                )
            conn.commit()
    except ForeignKeyViolation as e:
        raise HTTPException(status_code=404, detail="card_not_found") from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return result


@router.patch("/{deck_id}/cards/{card_id}", response_model=DeckCardEntry)
def update_deck_card(
    deck_id: int,
    card_id: int,
    body: UpdateCardRequest,
    category_id: int = Query(
        gt=0,
        description="Current category of the entry to update",
    ),
    user_id: int = Depends(get_current_user_id),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """Update quantity, move category, and/or set sort_order for one entry."""
    if body.quantity is None and body.category_id is None and body.sort_order is None:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    new_category_id = (
        body.category_id if body.category_id is not None else category_id
    )

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                require_category_on_deck(cur, deck_id, category_id)

                cur.execute(
                    """
                    SELECT quantity, category_id, sort_order
                    FROM deck_has_cards
                    WHERE deck_id = %(deck_id)s
                      AND card_id = %(card_id)s
                      AND category_id = %(category_id)s
                    """,
                    {
                        "deck_id": deck_id,
                        "card_id": card_id,
                        "category_id": category_id,
                    },
                )
                existing = cur.fetchone()
                if existing is None:
                    raise HTTPException(status_code=404, detail="deck_card_not_found")

                quantity = body.quantity if body.quantity is not None else existing[0]
                sort_order = (
                    body.sort_order if body.sort_order is not None else existing[2]
                )

                if new_category_id != category_id:
                    require_category_on_deck(cur, deck_id, new_category_id)
                    cur.execute(
                        """
                        DELETE FROM deck_has_cards
                        WHERE deck_id = %(deck_id)s
                          AND card_id = %(card_id)s
                          AND category_id = %(category_id)s
                        """,
                        {
                            "deck_id": deck_id,
                            "card_id": card_id,
                            "category_id": category_id,
                        },
                    )
                    cur.execute(
                        """
                        INSERT INTO deck_has_cards
                            (deck_id, card_id, category_id, quantity, sort_order)
                        VALUES
                            (%(deck_id)s, %(card_id)s, %(category_id)s, %(quantity)s, %(sort_order)s)
                        ON CONFLICT (deck_id, card_id, category_id)
                        DO UPDATE SET
                            quantity = EXCLUDED.quantity,
                            sort_order = EXCLUDED.sort_order
                        RETURNING card_id, quantity, category_id, sort_order
                        """,
                        {
                            "deck_id": deck_id,
                            "card_id": card_id,
                            "category_id": new_category_id,
                            "quantity": quantity,
                            "sort_order": sort_order,
                        },
                    )
                else:
                    cur.execute(
                        """
                        UPDATE deck_has_cards
                           SET quantity = %(quantity)s,
                               sort_order = %(sort_order)s
                         WHERE deck_id = %(deck_id)s
                           AND card_id = %(card_id)s
                           AND category_id = %(category_id)s
                        RETURNING card_id, quantity, category_id, sort_order
                        """,
                        {
                            "quantity": quantity,
                            "sort_order": sort_order,
                            "deck_id": deck_id,
                            "card_id": card_id,
                            "category_id": category_id,
                        },
                    )

                entry = cur.fetchone()
                result = fetch_one_deck_card(
                    cur,
                    deck_id,
                    int(entry[0]),
                    int(entry[2]),
                    bypass=is_admin,
                    include_preview=include_preview,
                )
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(
            status_code=409,
            detail="card_already_in_target_category",
        ) from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return result


@router.delete("/{deck_id}/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_card_from_deck(
    deck_id: int,
    card_id: int,
    category_id: int = Query(gt=0),
    user_id: int = Depends(get_current_user_id),
):
    """Remove one card entry from a deck category."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                require_category_on_deck(cur, deck_id, category_id)
                cur.execute(
                    """
                    DELETE FROM deck_has_cards
                    WHERE deck_id = %(deck_id)s
                      AND card_id = %(card_id)s
                      AND category_id = %(category_id)s
                    """,
                    {
                        "deck_id": deck_id,
                        "card_id": card_id,
                        "category_id": category_id,
                    },
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="deck_card_not_found")
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.put("/{deck_id}/cards/order", response_model=list[DeckCardEntry])
def reorder_deck_cards(
    deck_id: int,
    body: ReorderCardsRequest,
    user_id: int = Depends(get_current_user_id),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """
    Set sort_order for many entries at once.

    Each item must already exist in the deck at the given category.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_owned_deck(cur, user_id=user_id, deck_id=deck_id)

                for item in body.items:
                    cur.execute(
                        """
                        UPDATE deck_has_cards
                           SET sort_order = %(sort_order)s
                         WHERE deck_id = %(deck_id)s
                           AND card_id = %(card_id)s
                           AND category_id = %(category_id)s
                        """,
                        {
                            "sort_order": item.sort_order,
                            "deck_id": deck_id,
                            "card_id": item.card_id,
                            "category_id": item.category_id,
                        },
                    )
                    if cur.rowcount == 0:
                        raise HTTPException(
                            status_code=404,
                            detail=f"deck_card_not_found:{item.card_id}:{item.category_id}",
                        )

                cards = fetch_deck_cards(
                    cur,
                    deck_id,
                    bypass=is_admin,
                    include_preview=include_preview,
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return cards
