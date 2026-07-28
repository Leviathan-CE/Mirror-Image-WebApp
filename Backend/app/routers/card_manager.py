"""Card creation and thumbnail upload API routes."""

import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import CheckViolation, DataError, NotNullViolation, UniqueViolation
from psycopg2.extras import Json

from app.db import get_connection
from app.card_library_query import apply_catalogue_filters, catalogue_order_sql
from app.card_publish import catalogue_visibility_sql, get_optional_include_preview
from app.security import get_current_admin_user_id, get_optional_is_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cards", tags=["cards"])


class CardCreate(BaseModel):
    """Payload used to create a new card record."""

    model_config = ConfigDict(populate_by_name=True)

    # Unity CardCreatePayload: public Int32 ID → JSON key "ID" (barcode id, required).
    id: int = Field(gt=0, validation_alias=AliasChoices("id", "Id", "ID"))
    
    is_deprecated: bool = False   
    card_name: str = ""

    cost: list[Any] = Field(default_factory=list)
    invoke_cost: int = Field(default=0, ge=0)
    
    super_types: list[Any] = Field(default_factory=list)
    sub_types: list[Any] = Field(default_factory=list)
    types_line: str = ""
    
    keywords: list[Any] = Field(default_factory=list)

    show_help_text: bool = True
    description: str = ""
    
    rarity: str = "Common"

    artist_name: str = "Levi Boswell AI assisted"
    card_number: int = 0
    card_count: int = -1
    legal_info: str = "© 2026 Leviathan Creative Entertiament."
    card_set_name: str = "unassigned"
    card_printing: str = "standard"

    is_summon: bool = False
    is_pilot: bool = False
    is_augment: bool = False

    # Unity CardData.Threat_level is string (e.g. "0", "3").
    threat_level: str = Field(
        default="0",
        validation_alias=AliasChoices("threat_level", "Threat_level", "atk"),
    )

    @field_validator("threat_level", mode="before")
    @classmethod
    def _threat_level_as_str(cls, value: Any) -> str:
        if value is None:
            return "0"
        return str(value).strip() or "0"

    ram_capacity: int = Field(default=0, ge=0)
    power_capacity: int = Field(
        default=0,
        ge=0,
        validation_alias=AliasChoices("power_capacity", "pow_capacity"),
    )
    metal_capacity: int = Field(
        default=0,
        ge=0,
        validation_alias=AliasChoices("metal_capacity", "met_capacity"),
    )
    spirit_capacity: int = Field(default=0, ge=0)
    steel_capacity: int = Field(default=0, ge=0)
    time_capacity: int = Field(
        default=0,
        ge=0,
        validation_alias=AliasChoices("time_capacity", "tim_capacity"),
    )
    lif_capacity: int = Field(default=0, ge=0)
    hand_size: int = Field(default=0, ge=0)

    lagality: str = "Legal"


class CardCreated(BaseModel):
    """Response returned after a card is inserted successfully."""

    model_config = ConfigDict(serialize_by_alias=True)

    id: int = Field(serialization_alias="ID")
    card_name: str


class CardThumbnailUploaded(BaseModel):
    """Response returned after a thumbnail is stored and linked."""

    id: int
    thumbnail_path: str
    thumbnail_size_bytes: int
    card_art_version: int | None = None


class CardByNameResponse(BaseModel):
    """Full card payload returned when querying by id or name."""

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: int = Field(serialization_alias="ID", validation_alias=AliasChoices("id", "Id", "ID"))
    is_deprecated: bool
    card_set_name: str
    card_name: str
    cost: list[Any]
    invoke_cost: int
    super_types: list[Any]
    sub_types: list[Any]
    types_line: str
    keywords: list[Any]
    show_help_text: bool
    description: str
    rarity: str
    artist_name: str
    card_number: int
    card_count: int
    legal_info: str
    card_printing: str
    is_summon: bool
    is_pilot: bool
    is_augment: bool
    threat_level: str
    ram_capacity: int
    power_capacity: int
    metal_capacity: int
    spirit_capacity: int
    steel_capacity: int
    time_capacity: int
    lif_capacity: int
    hand_size: int
    lagality: str
    card_art_path: str | None = None
    card_art_mime_type: str | None = None


_CARD_SELECT_SQL = """
    SELECT id, is_deprecated, card_set_name, card_name, cost, invoke_cost,
           super_types, sub_types, types_line, keywords, show_help_text,
           description, rarity, artist_name, card_number, card_count,
           legal_info, card_printing, is_summon, is_pilot, is_augment,
           threat_level, ram_capacity, power_capacity, metal_capacity,
           spirit_capacity, steel_capacity, time_capacity, lif_capacity,
           hand_size, lagality, card_art_path, card_art_mime_type
      FROM cards
"""


def _card_row_to_response(row) -> CardByNameResponse:
    return CardByNameResponse(
        id=row[0],
        is_deprecated=row[1],
        card_set_name=row[2],
        card_name=row[3],
        cost=row[4],
        invoke_cost=row[5],
        super_types=row[6],
        sub_types=row[7],
        types_line=row[8],
        keywords=row[9],
        show_help_text=row[10],
        description=row[11],
        rarity=row[12],
        artist_name=row[13],
        card_number=row[14],
        card_count=row[15],
        legal_info=row[16],
        card_printing=row[17],
        is_summon=row[18],
        is_pilot=row[19],
        is_augment=row[20],
        threat_level=row[21],
        ram_capacity=row[22],
        power_capacity=row[23],
        metal_capacity=row[24],
        spirit_capacity=row[25],
        steel_capacity=row[26],
        time_capacity=row[27],
        lif_capacity=row[28],
        hand_size=row[29],
        lagality=row[30],
        card_art_path=row[31],
        card_art_mime_type=row[32],
    )


def _fetch_card_row(cur, sql: str, params: dict) -> tuple | None:
    cur.execute(sql, params)
    return cur.fetchone()


def _slugify(value: str) -> str:
    """Convert a string into a filesystem-safe lowercase slug."""

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip().lower())
    return slug.strip("_") or "unassigned"


@router.post("/", response_model=CardCreated, status_code=201)
def create_card(
    body: CardCreate,
    _admin_id: int = Depends(get_current_admin_user_id),
):
    """Create a card row in Postgres and return its id and name. Admin only."""

    insert_cols = {
        "id": body.id,
        "is_deprecated": body.is_deprecated,
        "card_set_name": body.card_set_name,
        "card_name": body.card_name,
        "cost": Json(body.cost),
        "invoke_cost": body.invoke_cost,
        "super_types": Json(body.super_types),
        "sub_types": Json(body.sub_types),
        "types_line": body.types_line,
        "keywords": Json(body.keywords),
        "show_help_text": body.show_help_text,
        "description": body.description,
        "rarity": body.rarity,
        "artist_name": body.artist_name,
        "card_number": body.card_number,
        "card_count": body.card_count,
        "legal_info": body.legal_info,
        "card_printing": body.card_printing,
        "is_summon": body.is_summon,
        "is_pilot": body.is_pilot,
        "is_augment": body.is_augment,
        "threat_level": body.threat_level,
        "ram_capacity": body.ram_capacity,
        "power_capacity": body.power_capacity,
        "metal_capacity": body.metal_capacity,
        "spirit_capacity": body.spirit_capacity,
        "steel_capacity": body.steel_capacity,
        "time_capacity": body.time_capacity,
        "lif_capacity": body.lif_capacity,
        "hand_size": body.hand_size,
        "lagality": body.lagality,
    }

    columns = ", ".join(insert_cols.keys())
    placeholders = ", ".join(f"%({k})s" for k in insert_cols.keys())
    update_assignments = ", ".join(
        f"{col} = EXCLUDED.{col}" for col in insert_cols if col != "id"
    )
    sql = f"""
        INSERT INTO cards ({columns})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET
            {update_assignments},
            updated_at = NOW()
        RETURNING id, card_name
    """

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, insert_cols)
                row = cur.fetchone()
            conn.commit()
    except UniqueViolation as e:
        logger.warning("card duplicate id: %s", e)
        raise HTTPException(status_code=409, detail="card_id_already_exists") from e
    except CheckViolation as e:
        logger.warning("card check constraint: %s", e)
        raise HTTPException(status_code=400, detail="constraint_violation") from e
    except NotNullViolation as e:
        logger.warning("card null violation: %s", e)
        raise HTTPException(status_code=400, detail="missing_required_field") from e
    except DataError as e:
        logger.warning("card data error: %s", e)
        raise HTTPException(status_code=400, detail="invalid_card_data") from e
    except OperationalError as e:
        logger.warning("db error on card insert: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on card insert: %s", e)
        raise HTTPException(status_code=500, detail="card_insert_failed") from e

    return CardCreated(id=row[0], card_name=row[1])


class CardSearchHit(BaseModel):
    """Compact card row for typeahead search results."""

    id: int
    card_name: str
    card_set_name: str
    rarity: str
    card_art_path: str | None = None
    card_art_version: int | None = None


@router.get("/search", response_model=list[CardSearchHit])
def search_cards(
    q: str = Query(min_length=1, max_length=80),
    limit: int = Query(default=12, ge=1, le=40),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """
    Typeahead search by card name.

    Prefers prefix matches, then substring matches.
    Skips deprecated cards. Non-subscribers only see published cards;
    subscribers also see preview; admins see the full catalogue.
    """
    needle = q.strip()
    if not needle:
        return []

    visibility = catalogue_visibility_sql(
        "c", bypass=is_admin, include_preview=include_preview
    )

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT
                        c.id,
                        c.card_name,
                        c.card_set_name,
                        c.rarity,
                        c.card_art_path,
                        EXTRACT(EPOCH FROM c.updated_at)::bigint
                      FROM cards c
                     WHERE c.is_deprecated = false
                       AND {visibility}
                       AND c.card_name ILIKE %(pattern)s
                     ORDER BY
                       CASE
                         WHEN c.card_name ILIKE %(prefix)s THEN 0
                         ELSE 1
                       END,
                       LENGTH(c.card_name) ASC,
                       c.card_name ASC
                     LIMIT %(limit)s
                    """,
                    {
                        "pattern": f"%{needle}%",
                        "prefix": f"{needle}%",
                        "limit": limit,
                    },
                )
                rows = cur.fetchall()
    except OperationalError as e:
        logger.warning("db error on card search: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on card search: %s", e)
        raise HTTPException(status_code=500, detail="card_search_failed") from e

    return [
        CardSearchHit(
            id=int(row[0]),
            card_name=row[1],
            card_set_name=row[2],
            rarity=row[3],
            card_art_path=row[4],
            card_art_version=int(row[5]) if row[5] is not None else None,
        )
        for row in rows
    ]


class CardLibraryItem(BaseModel):
    """Card row for the public library browser."""

    id: int
    card_name: str
    card_set_name: str
    rarity: str
    invoke_cost: int
    cost: list[Any] = Field(default_factory=list)
    super_types: list[Any] = Field(default_factory=list)
    sub_types: list[Any] = Field(default_factory=list)
    types_line: str = ""
    description: str = ""
    keywords: list[Any] = Field(default_factory=list)
    show_help_text: bool = True
    threat_level: str = "0"
    card_art_path: str | None = None
    card_art_version: int | None = None


class CardLibraryResponse(BaseModel):
    items: list[CardLibraryItem]
    total: int
    limit: int
    offset: int


class CardLibraryFacets(BaseModel):
    colors: list[str]
    super_types: list[str]
    sub_types: list[str]
    types_lines: list[str]
    invoke_cost_min: int
    invoke_cost_max: int


_COLOR_COST_TOKENS = ("LIF", "MET", "POW", "RAM", "TIM", "STL")


@router.get("/facets", response_model=CardLibraryFacets)
def card_library_facets(
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """Distinct filter values for the card library UI."""
    visibility = catalogue_visibility_sql(
        "cards", bypass=is_admin, include_preview=include_preview
    )
    visibility_c = catalogue_visibility_sql(
        "c", bypass=is_admin, include_preview=include_preview
    )
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT MIN(invoke_cost), MAX(invoke_cost)
                      FROM cards
                     WHERE is_deprecated = false
                       AND {visibility}
                    """
                )
                cost_row = cur.fetchone()
                invoke_min = int(cost_row[0] or 0)
                invoke_max = int(cost_row[1] or 0)

                # Always expose the full colour set (even if unused in current data).
                colors = list(_COLOR_COST_TOKENS)

                cur.execute(
                    f"""
                    SELECT DISTINCT token.value
                      FROM cards c,
                           LATERAL jsonb_array_elements_text(c.super_types) AS token(value)
                     WHERE c.is_deprecated = false
                       AND {visibility_c}
                       AND BTRIM(token.value) <> ''
                     ORDER BY 1
                    """
                )
                super_types = [row[0] for row in cur.fetchall()]

                cur.execute(
                    f"""
                    SELECT DISTINCT token.value
                      FROM cards c,
                           LATERAL jsonb_array_elements_text(c.sub_types) AS token(value)
                     WHERE c.is_deprecated = false
                       AND {visibility_c}
                       AND BTRIM(token.value) <> ''
                     ORDER BY 1
                    """
                )
                sub_types = [row[0] for row in cur.fetchall()]

                cur.execute(
                    f"""
                    SELECT DISTINCT BTRIM(types_line)
                      FROM cards
                     WHERE is_deprecated = false
                       AND {visibility}
                       AND BTRIM(types_line) <> ''
                     ORDER BY 1
                    """
                )
                types_lines = [row[0] for row in cur.fetchall()]
    except OperationalError as e:
        logger.warning("db error on card facets: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on card facets: %s", e)
        raise HTTPException(status_code=500, detail="card_facets_failed") from e

    return CardLibraryFacets(
        colors=colors,
        super_types=super_types,
        sub_types=sub_types,
        types_lines=types_lines,
        invoke_cost_min=invoke_min,
        invoke_cost_max=invoke_max,
    )


@router.get("/library", response_model=CardLibraryResponse)
def browse_card_library(
    q: str | None = Query(default=None, max_length=80),
    description: str | None = Query(default=None, max_length=200),
    invoke_cost_min: int | None = Query(default=None, ge=0, le=99),
    invoke_cost_max: int | None = Query(default=None, ge=0, le=99),
    color: list[str] | None = Query(default=None),
    types_line: str | None = Query(default=None, max_length=80),
    super_type: str | None = Query(default=None, max_length=60),
    sub_type: str | None = Query(default=None, max_length=60),
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """
    Browse / filter the card catalogue.

    Name search (`q`) uses the same closest-match ranking as `/cards/search`
    (prefix first, then substring, shorter names preferred).
    Non-subscribers only see published cards; subscribers also see preview;
    admins see the full catalogue.
    """
    where = [
        "is_deprecated = false",
        catalogue_visibility_sql(
            "cards", bypass=is_admin, include_preview=include_preview
        ),
    ]
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    has_name_query = apply_catalogue_filters(
        where,
        params,
        q=q,
        description=description,
        invoke_cost_min=invoke_cost_min,
        invoke_cost_max=invoke_cost_max,
        color=color,
        types_line=types_line,
        super_type=super_type,
        sub_type=sub_type,
    )

    where_sql = " AND ".join(where)
    order_sql = catalogue_order_sql(has_name_query)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*)::int FROM cards WHERE {where_sql}",
                    params,
                )
                total = int(cur.fetchone()[0])

                cur.execute(
                    f"""
                    SELECT
                        id,
                        card_name,
                        card_set_name,
                        rarity,
                        invoke_cost,
                        cost,
                        super_types,
                        sub_types,
                        types_line,
                        description,
                        keywords,
                        show_help_text,
                        threat_level,
                        card_art_path,
                        EXTRACT(EPOCH FROM updated_at)::bigint
                      FROM cards
                     WHERE {where_sql}
                     ORDER BY {order_sql}
                     LIMIT %(limit)s OFFSET %(offset)s
                    """,
                    params,
                )
                rows = cur.fetchall()
    except OperationalError as e:
        logger.warning("db error on card library: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on card library: %s", e)
        raise HTTPException(status_code=500, detail="card_library_failed") from e

    items = [
        CardLibraryItem(
            id=int(row[0]),
            card_name=row[1],
            card_set_name=row[2],
            rarity=row[3],
            invoke_cost=int(row[4] or 0),
            cost=row[5] or [],
            super_types=row[6] or [],
            sub_types=row[7] or [],
            types_line=row[8] or "",
            description=row[9] or "",
            keywords=row[10] or [],
            show_help_text=bool(row[11]),
            threat_level=str(row[12] if row[12] is not None else "0"),
            card_art_path=row[13],
            card_art_version=int(row[14]) if row[14] is not None else None,
        )
        for row in rows
    ]
    return CardLibraryResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{card_id}", response_model=CardByNameResponse)
def get_card_by_id(
    card_id: int,
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """Fetch a card by primary key (Unity barcode id)."""
    if card_id <= 0:
        raise HTTPException(status_code=400, detail="invalid_card_id")

    sql = (
        _CARD_SELECT_SQL
        + " WHERE id = %(card_id)s"
        + f" AND {catalogue_visibility_sql('cards', bypass=is_admin, include_preview=include_preview)}"
    )
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_card_row(cur, sql, {"card_id": card_id})
    except OperationalError as e:
        logger.warning("db error on card by-id query: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on card by-id query: %s", e)
        raise HTTPException(status_code=500, detail="card_fetch_failed") from e

    if row is None:
        raise HTTPException(status_code=404, detail="card_not_found")

    return _card_row_to_response(row)


@router.get("/by-name/{card_name}", response_model=CardByNameResponse)
def get_card_by_name(
    card_name: str,
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """Fetch a card by exact card name (case-insensitive)."""
    normalized_name = card_name.replace("+", " ").strip()

    sql = (
        _CARD_SELECT_SQL
        + " WHERE LOWER(card_name) = LOWER(%(card_name)s)"
        + f" AND {catalogue_visibility_sql('cards', bypass=is_admin, include_preview=include_preview)}"
        + " ORDER BY id DESC LIMIT 1"
    )
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_card_row(cur, sql, {"card_name": normalized_name})
    except OperationalError as e:
        logger.warning("db error on card by-name query: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on card by-name query: %s", e)
        raise HTTPException(status_code=500, detail="card_fetch_failed") from e

    if row is None:
        raise HTTPException(status_code=404, detail="card_not_found")

    return _card_row_to_response(row)





@router.post("/{card_id}/thumbnail", response_model=CardThumbnailUploaded)
async def upload_card_thumbnail(
    card_id: int,
    file: UploadFile = File(...),
    _admin_id: int = Depends(get_current_admin_user_id),
):
    """Upload a card thumbnail, persist it on disk, and store its path. Admin only."""

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="thumbnail_must_be_image")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty_thumbnail_file")

    max_size = 8 * 1024 * 1024  # card art can exceed 2MB (e.g. full lore PNGs)
    if len(data) > max_size:
        raise HTTPException(status_code=413, detail="thumbnail_too_large")

    ext_map = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
    }
    extension = ext_map.get(file.content_type)
    if extension is None:
        raise HTTPException(status_code=400, detail="unsupported_thumbnail_type")

    select_sql = """
        SELECT id, card_set_name, card_name
        FROM cards
        WHERE id = %(card_id)s
    """
    update_sql = """
        UPDATE cards
           SET card_art_path = %(card_art_path)s,
               card_art_mime_type = %(mime_type)s,
               updated_at = NOW()
         WHERE id = %(card_id)s
    """

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(select_sql, {"card_id": card_id})
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="card_not_found")

                _, card_set_name, card_name = row
                set_slug = _slugify(card_set_name)
                card_slug = _slugify(card_name)

                base_dir = Path(__file__).resolve().parent.parent / "thumbnails"
                set_dir = base_dir / set_slug
                set_dir.mkdir(parents=True, exist_ok=True)

                # One stable path per card in the DB. The frontend appends
                # ?v=<updated_at> so browsers fetch again after a re-upload.
                file_name = f"{card_slug}_thumbnail{extension}"
                file_path = set_dir / file_name
                file_path.write_bytes(data)

                # Clean leftover hashed names from an older upload scheme.
                for old in set_dir.glob(f"{card_slug}_thumbnail_*"):
                    try:
                        old.unlink()
                    except OSError:
                        pass

                relative_path = f"thumbnails/{set_slug}/{file_name}"
                cur.execute(
                    update_sql,
                    {
                        "card_art_path": relative_path,
                        "mime_type": file.content_type,
                        "card_id": card_id,
                    },
                )
                cur.execute(
                    """
                    SELECT EXTRACT(EPOCH FROM updated_at)::bigint
                      FROM cards
                     WHERE id = %(card_id)s
                    """,
                    {"card_id": card_id},
                )
                version_row = cur.fetchone()
            conn.commit()
    except OperationalError as e:
        logger.warning("db error on thumbnail upload: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except OSError as e:
        logger.warning("thumbnail file write error: %s", e)
        raise HTTPException(status_code=500, detail="thumbnail_write_failed") from e

    return CardThumbnailUploaded(
        id=card_id,
        thumbnail_path=relative_path,
        thumbnail_size_bytes=len(data),
        card_art_version=int(version_row[0]) if version_row and version_row[0] is not None else None,
    )
