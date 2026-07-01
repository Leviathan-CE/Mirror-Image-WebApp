"""Card creation and thumbnail upload API routes."""

import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import CheckViolation, DataError, NotNullViolation, UniqueViolation
from psycopg2.extras import Json

from app.db import get_connection

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
           spirit_capacity, steel_capacity, lif_capacity, hand_size, lagality,
           card_art_path, card_art_mime_type
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
        lif_capacity=row[27],
        hand_size=row[28],
        lagality=row[29],
        card_art_path=row[30],
        card_art_mime_type=row[31],
    )


def _fetch_card_row(cur, sql: str, params: dict) -> tuple | None:
    cur.execute(sql, params)
    return cur.fetchone()


def _slugify(value: str) -> str:
    """Convert a string into a filesystem-safe lowercase slug."""

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip().lower())
    return slug.strip("_") or "unassigned"


@router.post("/", response_model=CardCreated, status_code=201)
def create_card(body: CardCreate):
    """Create a card row in Postgres and return its id and name."""

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


@router.get("/{card_id}", response_model=CardByNameResponse)
def get_card_by_id(card_id: int):
    """Fetch a single card by primary key (Unity barcode id)."""
    if card_id <= 0:
        raise HTTPException(status_code=400, detail="invalid_card_id")

    sql = _CARD_SELECT_SQL + " WHERE id = %(card_id)s"
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
def get_card_by_name(card_name: str):
    """Fetch a single card by exact card name (case-insensitive)."""
    normalized_name = card_name.replace("+", " ").strip()

    sql = (
        _CARD_SELECT_SQL
        + " WHERE LOWER(card_name) = LOWER(%(card_name)s) ORDER BY id DESC LIMIT 1"
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
async def upload_card_thumbnail(card_id: int, file: UploadFile = File(...)):
    """Upload a card thumbnail, persist it on disk, and store its path."""

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="thumbnail_must_be_image")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty_thumbnail_file")

    max_size = 2 * 1024 * 1024
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

                file_name = f"{card_slug}_thumbnail{extension}"
                file_path = set_dir / file_name
                file_path.write_bytes(data)

                relative_path = f"thumbnails/{set_slug}/{file_name}"
                cur.execute(
                    update_sql,
                    {
                        "card_art_path": relative_path,
                        "mime_type": file.content_type,
                        "card_id": card_id,
                    },
                )
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
    )
