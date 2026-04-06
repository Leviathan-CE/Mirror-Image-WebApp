import base64
import binascii
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
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


def _b64_to_bytes(raw: str | None) -> bytes | None:
    if raw is None or raw == "":
        return None
    try:
        return base64.standard_b64decode(raw)
    except (ValueError, binascii.Error) as e:
        raise HTTPException(status_code=400, detail="invalid_artwork_base64") from e


@router.post("/", response_model=CardCreated, status_code=201)
def create_card(body: CardCreate):
    artwork_data = _b64_to_bytes(body.artwork_base64)
    thumb_data = _b64_to_bytes(body.artwork_thumbnail_base64)

    insert_cols = {
        "is_deprecated": body.is_deprecated,
        "card_set_name": body.card_set_name,
        "card_name": body.card_name,
        "artwork_data": artwork_data,
        "artwork_mime_type": body.artwork_mime_type,
        "artwork_width_px": body.artwork_width_px,
        "artwork_height_px": body.artwork_height_px,
        "artwork_thumbnail_data": thumb_data,
        "artwork_thumbnail_mime_type": body.artwork_thumbnail_mime_type,
        "artwork_thumbnail_width_px": body.artwork_thumbnail_width_px,
        "artwork_thumbnail_height_px": body.artwork_thumbnail_height_px,
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

    return CardCreated(id=row[0], card_name=row[1])
