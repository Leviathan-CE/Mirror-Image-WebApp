"""Community deck engagement: likes, tags, views."""

from __future__ import annotations

import re

from fastapi import HTTPException

_TAG_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,31}$")
_TAG_WORD_START = re.compile(r"(^| )([a-zA-Z])")


def title_case_tag_words(tag: str) -> str:
    """Force capital letters at the start of the tag and after each space."""
    return _TAG_WORD_START.sub(
        lambda m: m.group(1) + m.group(2).upper(),
        tag,
    )


def normalize_deck_tag(raw: str) -> str:
    tag = title_case_tag_words((raw or "").strip())
    if not tag or not _TAG_RE.fullmatch(tag):
        raise HTTPException(
            status_code=400,
            detail="invalid_tag",
        )
    return tag


def fetch_like_count(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(like_count, 0)::int FROM decks WHERE id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    row = cur.fetchone()
    return int(row[0] or 0) if row else 0


def fetch_view_count(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(view_count, 0)::int FROM decks WHERE id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    row = cur.fetchone()
    return int(row[0] or 0) if row else 0


def fetch_deck_tags(cur, deck_id: int) -> list[str]:
    cur.execute(
        """
        SELECT tag
          FROM deck_tags
         WHERE deck_id = %(deck_id)s
         ORDER BY lower(tag), tag
        """,
        {"deck_id": deck_id},
    )
    return [str(r[0]) for r in cur.fetchall()]


def suggest_deck_tags(
    cur,
    *,
    q: str = "",
    limit: int = 12,
    exclude: list[str] | None = None,
) -> list[dict]:
    """
    Distinct tags across all decks with closest-name ranking (same idea as
    card search): prefix matches first, then shorter names, then usage.

    Returns [{"tag": str, "uses": int}, ...].
    """
    needle = (q or "").strip()
    exclude_lower = {t.strip().lower() for t in (exclude or []) if t.strip()}
    limit_n = max(1, min(int(limit), 40))
    params: dict = {"limit": limit_n}

    where = ["TRUE"]
    order_sql = "uses DESC, lower(tag) ASC, tag ASC"
    if needle:
        where.append("lower(tag) LIKE lower(%(pattern)s)")
        params["pattern"] = f"%{needle}%"
        params["prefix"] = f"{needle}%"
        # Closest match: starts-with → shorter → alphabetical → popularity.
        order_sql = """
            CASE WHEN lower(tag) LIKE lower(%(prefix)s) THEN 0 ELSE 1 END,
            LENGTH(tag) ASC,
            lower(tag) ASC,
            uses DESC,
            tag ASC
        """

    if exclude_lower:
        params["limit"] = min(40, limit_n + len(exclude_lower))

    sql = f"""
        SELECT tag, COUNT(*)::int AS uses
          FROM deck_tags
         WHERE {" AND ".join(where)}
         GROUP BY tag
         ORDER BY {order_sql}
         LIMIT %(limit)s
    """
    cur.execute(sql, params)
    out: list[dict] = []
    for tag, uses in cur.fetchall():
        if str(tag).strip().lower() in exclude_lower:
            continue
        out.append({"tag": str(tag), "uses": int(uses)})
        if len(out) >= limit_n:
            break
    return out


def viewer_liked_deck(cur, *, deck_id: int, user_id: int | None) -> bool:
    if user_id is None:
        return False
    cur.execute(
        """
        SELECT 1
          FROM deck_likes
         WHERE deck_id = %(deck_id)s
           AND user_id = %(user_id)s
         LIMIT 1
        """,
        {"deck_id": deck_id, "user_id": user_id},
    )
    return cur.fetchone() is not None


def community_fields(
    cur,
    deck_id: int,
    *,
    viewer_id: int | None = None,
) -> dict:
    return {
        "like_count": fetch_like_count(cur, deck_id),
        "view_count": fetch_view_count(cur, deck_id),
        "tags": fetch_deck_tags(cur, deck_id),
        "liked_by_me": viewer_liked_deck(cur, deck_id=deck_id, user_id=viewer_id),
    }


def increment_deck_view(cur, deck_id: int) -> int:
    cur.execute(
        """
        UPDATE decks
           SET view_count = COALESCE(view_count, 0) + 1
         WHERE id = %(deck_id)s
     RETURNING view_count
        """,
        {"deck_id": deck_id},
    )
    row = cur.fetchone()
    return int(row[0] or 0) if row else 0


def add_deck_like(cur, *, deck_id: int, user_id: int) -> None:
    """Insert like membership and bump cached like_count only if new."""
    cur.execute(
        """
        INSERT INTO deck_likes (user_id, deck_id)
        VALUES (%(user_id)s, %(deck_id)s)
        ON CONFLICT DO NOTHING
        RETURNING deck_id
        """,
        {"user_id": user_id, "deck_id": deck_id},
    )
    if cur.fetchone() is None:
        return
    cur.execute(
        """
        UPDATE decks
           SET like_count = COALESCE(like_count, 0) + 1
         WHERE id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )


def remove_deck_like(cur, *, deck_id: int, user_id: int) -> None:
    """Remove like membership and decrement cached like_count only if removed."""
    cur.execute(
        """
        DELETE FROM deck_likes
         WHERE user_id = %(user_id)s
           AND deck_id = %(deck_id)s
     RETURNING deck_id
        """,
        {"user_id": user_id, "deck_id": deck_id},
    )
    if cur.fetchone() is None:
        return
    cur.execute(
        """
        UPDATE decks
           SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
         WHERE id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )


def add_deck_tag(cur, *, deck_id: int, tag: str, created_by: int) -> str:
    normalized = normalize_deck_tag(tag)
    cur.execute(
        """
        INSERT INTO deck_tags (deck_id, tag, created_by)
        VALUES (%(deck_id)s, %(tag)s, %(created_by)s)
        ON CONFLICT DO NOTHING
        """,
        {"deck_id": deck_id, "tag": normalized, "created_by": created_by},
    )
    # Unique index is on lower(trim(tag)); ON CONFLICT DO NOTHING needs constraint name
    # — use explicit check if insert skipped.
    return normalized


def ensure_deck_tag(cur, *, deck_id: int, tag: str, created_by: int) -> str:
    """Insert tag if missing (case-insensitive). Returns stored tag text."""
    normalized = normalize_deck_tag(tag)
    cur.execute(
        """
        SELECT tag FROM deck_tags
         WHERE deck_id = %(deck_id)s
           AND lower(trim(tag)) = lower(%(tag)s)
         LIMIT 1
        """,
        {"deck_id": deck_id, "tag": normalized},
    )
    existing = cur.fetchone()
    if existing:
        return str(existing[0])

    cur.execute(
        """
        INSERT INTO deck_tags (deck_id, tag, created_by)
        VALUES (%(deck_id)s, %(tag)s, %(created_by)s)
        RETURNING tag
        """,
        {"deck_id": deck_id, "tag": normalized, "created_by": created_by},
    )
    return str(cur.fetchone()[0])


def remove_deck_tag(cur, *, deck_id: int, tag: str) -> bool:
    normalized = normalize_deck_tag(tag)
    cur.execute(
        """
        DELETE FROM deck_tags
         WHERE deck_id = %(deck_id)s
           AND lower(trim(tag)) = lower(%(tag)s)
        """,
        {"deck_id": deck_id, "tag": normalized},
    )
    return cur.rowcount > 0
