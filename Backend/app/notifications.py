"""Broadcast inbox events and per-user read filtering."""

from __future__ import annotations

from typing import Any

from psycopg2 import IntegrityError
from psycopg2.extras import Json
from psycopg2.errors import UndefinedTable, UniqueViolation

from app.features import FEATURE_PREVIEW_CARDS, user_has_feature
from app.roles import is_playtester_role, is_staff_role
from app.user_preferences import normalize_user_preferences

KIND_ANNOUNCEMENT_PUBLISHED = "announcement.published"
KIND_CARD_CREATED = "card.created"
KIND_CARD_UPDATED = "card.updated"
KIND_CARD_REMOVED = "card.removed"

SUBJECT_ANNOUNCEMENT = "announcement"
SUBJECT_CARD = "card"

AUDIENCE_ALL = "all"
AUDIENCE_PREVIEW = "preview"

VISIBLE_STATUSES = frozenset({"published", "preview"})

BLOG_KINDS = (KIND_ANNOUNCEMENT_PUBLISHED,)
CARD_KINDS = (KIND_CARD_CREATED, KIND_CARD_UPDATED, KIND_CARD_REMOVED)

SUMMARY_MAX = 240

CARD_STATE_SELECT = """
SELECT
    c.id,
    c.card_name,
    c.description,
    c.keywords,
    c.types_line,
    c.super_types,
    c.sub_types,
    c.cost,
    c.invoke_cost,
    c.threat_level,
    c.has_tlv,
    c.rarity,
    c.card_set_name,
    c.ram_capacity,
    c.power_capacity,
    c.metal_capacity,
    c.spirit_capacity,
    c.steel_capacity,
    c.time_capacity,
    c.lif_capacity,
    c.hand_size,
    c.is_pilot,
    c.is_augment,
    c.lagality,
    COALESCE(p.published, 'not published')
  FROM cards c
  LEFT JOIN publish_cards p ON p.card_id = c.id
"""


def _as_bool(value: Any, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in ("true", "1", "on", "yes"):
        return True
    if text in ("false", "0", "off", "no"):
        return False
    return default


def _json_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return list(value)
    return []


def _clip_summary(text: str) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= SUMMARY_MAX:
        return cleaned
    return cleaned[: SUMMARY_MAX - 1] + "…"


def allowed_kinds_from_prefs(prefs: dict[str, Any]) -> list[str]:
    normalized = normalize_user_preferences(prefs)
    kinds: list[str] = []
    if _as_bool(normalized.get("notify_blog"), True):
        kinds.extend(BLOG_KINDS)
    if _as_bool(normalized.get("notify_cards"), True):
        kinds.extend(CARD_KINDS)
    return kinds


def can_see_preview_audience(
    *,
    role: str,
    subscription_status: str,
    granted_keys: list[str],
) -> bool:
    if is_staff_role(role):
        return True
    if is_playtester_role(role):
        return True
    return user_has_feature(
        role=role,
        subscription_status=subscription_status,
        granted_keys=granted_keys,
        feature_key=FEATURE_PREVIEW_CARDS,
    )


def audience_for_visibility(visibility: str) -> str:
    if visibility == "preview":
        return AUDIENCE_PREVIEW
    return AUDIENCE_ALL


def snapshot_from_row(row: Any) -> dict[str, Any]:
    return {
        "card_name": row[1] or "",
        "description": row[2] or "",
        "keywords": _json_list(row[3]),
        "types_line": row[4] or "",
        "super_types": _json_list(row[5]),
        "sub_types": _json_list(row[6]),
        "cost": _json_list(row[7]),
        "invoke_cost": int(row[8] or 0),
        "threat_level": str(row[9] if row[9] is not None else "0"),
        "has_tlv": bool(row[10]),
        "rarity": row[11] or "",
        "card_set_name": row[12] or "",
        "ram_capacity": int(row[13] or 0),
        "power_capacity": int(row[14] or 0),
        "metal_capacity": int(row[15] or 0),
        "spirit_capacity": int(row[16] or 0),
        "steel_capacity": int(row[17] or 0),
        "time_capacity": int(row[18] or 0),
        "lif_capacity": int(row[19] or 0),
        "hand_size": int(row[20] or 0),
        "is_pilot": bool(row[21]),
        "is_augment": bool(row[22]),
        "lagality": row[23] or "Legal",
    }


def card_state_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": int(row[0]),
        "visibility": str(row[24] or "not published"),
        "snapshot": snapshot_from_row(row),
    }


def classify_card_change(
    old_visibility: str | None,
    new_visibility: str | None,
    old_snapshot: dict[str, Any] | None,
    new_snapshot: dict[str, Any] | None,
) -> str | None:
    old_vis = old_visibility or "not published"
    new_vis = new_visibility or "not published"
    old_visible = old_vis in VISIBLE_STATUSES
    new_visible = new_vis in VISIBLE_STATUSES
    if not old_visible and not new_visible:
        return None
    if not old_visible and new_visible:
        return KIND_CARD_CREATED
    if old_visible and not new_visible:
        return KIND_CARD_REMOVED
    if old_snapshot != new_snapshot:
        return KIND_CARD_UPDATED
    if old_vis != new_vis:
        return KIND_CARD_UPDATED
    return None


def fetch_card_notify_state(cur, card_id: int) -> dict[str, Any] | None:
    if card_id <= 0:
        return None
    cur.execute(
        CARD_STATE_SELECT + " WHERE c.id = %(card_id)s",
        {"card_id": card_id},
    )
    row = cur.fetchone()
    if row is None:
        return None
    return card_state_from_row(row)


def fetch_card_notify_states(
    cur,
    card_ids: list[int],
) -> dict[int, dict[str, Any]]:
    if not card_ids:
        return {}
    cur.execute(
        CARD_STATE_SELECT + " WHERE c.id = ANY(%(ids)s)",
        {"ids": card_ids},
    )
    out: dict[int, dict[str, Any]] = {}
    for row in cur.fetchall():
        state = card_state_from_row(row)
        out[int(state["id"])] = state
    return out


def insert_notification_event(
    cur,
    *,
    kind: str,
    subject_type: str,
    subject_id: int,
    title: str,
    summary: str = "",
    payload: dict[str, Any] | None = None,
    audience: str = AUDIENCE_ALL,
) -> int | None:
    heading = (title or "").strip()
    if not heading:
        return None
    cur.execute("SAVEPOINT notify_insert")
    try:
        cur.execute(
            """
            INSERT INTO notification_events (
                kind, subject_type, subject_id, title, summary,
                payload, audience
            )
            VALUES (
                %(kind)s, %(subject_type)s, %(subject_id)s, %(title)s,
                %(summary)s, %(payload)s, %(audience)s
            )
            RETURNING id
            """,
            {
                "kind": kind,
                "subject_type": subject_type,
                "subject_id": subject_id,
                "title": heading[:160],
                "summary": _clip_summary(summary),
                "payload": Json(payload or {}),
                "audience": audience,
            },
        )
        row = cur.fetchone()
        cur.execute("RELEASE SAVEPOINT notify_insert")
        if row is None:
            return None
        return int(row[0])
    except UniqueViolation:
        cur.execute("ROLLBACK TO SAVEPOINT notify_insert")
        return None
    except IntegrityError:
        cur.execute("ROLLBACK TO SAVEPOINT notify_insert")
        return None
    except UndefinedTable:
        cur.execute("ROLLBACK TO SAVEPOINT notify_insert")
        return None


def emit_announcement_published(
    cur,
    *,
    announcement_id: int,
    title: str,
    slug: str,
) -> int | None:
    heading = (title or "").strip() or "New update"
    return insert_notification_event(
        cur,
        kind=KIND_ANNOUNCEMENT_PUBLISHED,
        subject_type=SUBJECT_ANNOUNCEMENT,
        subject_id=announcement_id,
        title=heading,
        summary="A new Updates post was published.",
        payload={
            "announcement_id": announcement_id,
            "slug": slug,
        },
        audience=AUDIENCE_ALL,
    )


def emit_card_change(
    cur,
    old_state: dict[str, Any] | None,
    new_state: dict[str, Any] | None,
) -> int | None:
    old_vis = None if old_state is None else str(old_state["visibility"])
    new_vis = None if new_state is None else str(new_state["visibility"])
    old_snap = None if old_state is None else old_state["snapshot"]
    new_snap = None if new_state is None else new_state["snapshot"]
    kind = classify_card_change(old_vis, new_vis, old_snap, new_snap)
    if kind is None:
        return None
    card_id = int(
        (new_state or old_state or {}).get("id") or 0
    )
    if card_id <= 0:
        return None
    name = ""
    if new_snap and new_snap.get("card_name"):
        name = str(new_snap["card_name"])
    elif old_snap and old_snap.get("card_name"):
        name = str(old_snap["card_name"])
    if not name:
        name = f"Card #{card_id}"
    if kind == KIND_CARD_CREATED:
        title = f"New card: {name}"
        summary = "A card entered the catalogue."
        visibility = new_vis or "published"
    elif kind == KIND_CARD_REMOVED:
        title = f"Card removed: {name}"
        summary = "A catalogue card was unpublished or deleted."
        visibility = old_vis or "published"
    else:
        title = f"Card updated: {name}"
        summary = "A catalogue card changed."
        visibility = new_vis or old_vis or "published"
    return insert_notification_event(
        cur,
        kind=kind,
        subject_type=SUBJECT_CARD,
        subject_id=card_id,
        title=title,
        summary=summary,
        payload={
            "card_id": card_id,
            "action": kind.split(".", 1)[-1],
            "visibility": visibility,
            "before": old_snap,
            "after": new_snap,
        },
        audience=audience_for_visibility(visibility),
    )
