import base64
import binascii
import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from psycopg2 import OperationalError
from psycopg2.errors import CheckViolation, NotNullViolation
from psycopg2.extras import Json

from app.db import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cards", tags=["cards"])


class CardCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    is_deprecated: bool = False
    card_set_name: str = "BASE"
    card_name: str = ""

    artwork_base64: str | None = None
    artwork_mime_type: str | None = None
    artwork_width_px: int | None = None
    artwork_height_px: int | None = None

    artwork_thumbnail_base64: str | None = None
    artwork_thumbnail_mime_type: str | None = None
    artwork_thumbnail_width_px: int | None = None
    artwork_thumbnail_height_px: int | None = None

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

    is_summon: bool = False
    atk: int = Field(default=0, ge=0)
    def_: int = Field(default=0, ge=0, alias="def")

    is_pilot: bool = False

    ram_capacity: int = Field(default=0, ge=0)
    pow_capacity: int = Field(default=0, ge=0)
    met_capacity: int = Field(default=0, ge=0)
    lif_capacity: int = Field(default=0, ge=0)
    hand_size: int = Field(default=0, ge=0)

    lagality: str = "Legal"


class CardCreated(BaseModel):
    id: int
    card_name: str


class CardThumbnailUploaded(BaseModel):
    id: int
    thumbnail_path: str
    thumbnail_size_bytes: int


def _b64_to_bytes(raw: str | None) -> bytes | None:
    if raw is None or raw == "":
        return None
    try:
        return base64.standard_b64decode(raw)
    except (ValueError, binascii.Error) as e:
        raise HTTPException(status_code=400, detail="invalid_artwork_base64") from e


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip().lower())
    return slug.strip("_") or "unassigned"


@router.post("/", response_model=CardCreated, status_code=201)
def create_card(body: CardCreate):
    insert_cols = {
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
        "card_set_name": body.card_set_name,
        "is_summon": body.is_summon,
        "atk": body.atk,
        "def": body.def_,
        "is_pilot": body.is_pilot,
        "ram_capacity": body.ram_capacity,
        "pow_capacity": body.pow_capacity,
        "met_capacity": body.met_capacity,
        "lif_capacity": body.lif_capacity,
        "hand_size": body.hand_size,
        "lagality": body.lagality,
    }

    columns = ", ".join(insert_cols.keys())
    placeholders = ", ".join(f"%({k})s" for k in insert_cols.keys())
    sql = f"""
        INSERT INTO cards ({columns})
        VALUES ({placeholders})
        RETURNING id, card_name
    """

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, insert_cols)
                row = cur.fetchone()
            conn.commit()
    except CheckViolation as e:
        logger.warning("card check constraint: %s", e)
        raise HTTPException(status_code=400, detail="constraint_violation") from e
    except NotNullViolation as e:
        logger.warning("card null violation: %s", e)
        raise HTTPException(status_code=400, detail="missing_required_field") from e
    except OperationalError as e:
        logger.warning("db error on card insert: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on card insert: %s", e)
        raise HTTPException(status_code=500, detail="card_insert_failed") from e

    return CardCreated(id=row[0], card_name=row[1])


@router.post("/{card_id}/thumbnail", response_model=CardThumbnailUploaded)
async def upload_card_thumbnail(card_id: int, file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="thumbnail_must_be_image")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty_thumbnail_file")

    max_size = 5 * 1024 * 1024
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
