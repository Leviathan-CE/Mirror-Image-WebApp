"""Shared card catalogue projections used by decks, library, and playtester."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CardSummary(BaseModel):
    """
    Shared catalogue projection — the card half of a deck entry, and the
    base of library / admin detail rows.

    Keep this aligned with Frontend ``CardSummary`` in ``lib/api/cards.ts``.
    """

    id: int
    card_name: str
    card_art_path: str | None = None
    # Epoch seconds from cards.updated_at — bust browser image cache.
    card_art_version: int | None = None
    invoke_cost: int = 0
    # Invoke-cost icon list (LIF, MET, GEN2, …) — used by playtester Accumulate.
    cost: list[Any] = Field(default_factory=list)
    threat_level: str = "0"
    types_line: str = ""
    super_types: list[Any] = Field(default_factory=list)
    sub_types: list[Any] = Field(default_factory=list)
    is_pilot: bool = False
    is_augment: bool = False
    # Pilot starting values (also present on other cards; usually 0).
    hand_size: int = 0
    ram_capacity: int = 0
    power_capacity: int = 0
    metal_capacity: int = 0
    spirit_capacity: int = 0
    steel_capacity: int = 0
    time_capacity: int = 0
    # Starting life total on pilots (not a resource token).
    lif_capacity: int = 0


class CardLibraryItem(CardSummary):
    """
    Catalogue browse / detail row = summary + set/rarity/text metadata.

    Used by the public library and as the base of admin card detail.
    Keep aligned with Frontend ``CardLibraryItem`` in ``lib/api/cards.ts``.
    """

    card_set_name: str
    rarity: str
    description: str = ""
    keywords: list[Any] = Field(default_factory=list)
    show_help_text: bool = True
