"""Pydantic request/response models for the decks API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.cards.schemas import CardSummary


class DeckSummary(BaseModel):
    id: int
    name: str | None
    description: str | None
    is_public: bool
    author_name: str
    cover_image_path: str | None
    card_count: int
    like_count: int = 0
    view_count: int = 0
    tags: list[str] = Field(default_factory=list)
    liked_by_me: bool = False
    # Pilot illustration on the deck tile (no frame or costs).
    card_art_path: str | None = None
    card_art_version: int | None = None
    # Pilot invoke cost pips (deck-building identity).
    identity_cost: list[str] = Field(default_factory=list)
    # NULL = standard price, 0 = free, else custom cents.
    print_price_cents: int | None = None


class DeckListPage(BaseModel):
    items: list[DeckSummary]
    total: int
    limit: int
    offset: int


class DeckTagBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    tag: str = Field(min_length=1, max_length=32)


class DeckTagSuggestion(BaseModel):
    tag: str
    uses: int = 0


class DeckTagSuggestResponse(BaseModel):
    tags: list[DeckTagSuggestion]


class SimilarTag(BaseModel):
    tag: str
    decks: int = 0


class SimilarTagsResponse(BaseModel):
    tags: list[SimilarTag]
    compared: int = 0


class DeckCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool = True
    # Optional starting section names (from client local prefs).
    start_sections: list[str] | None = Field(default=None, max_length=12)
    # Types for those sections, keyed by name. Missing uses account prefs.
    start_section_types: dict[str, list[str]] | None = None


class DeckUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool | None = None


class DeckCoverUploaded(BaseModel):
    deck_id: int
    cover_image_path: str
    cover_size_bytes: int


class DeckCategoryOut(BaseModel):
    id: int
    name: str
    sort_order: int
    in_deck: bool = True
    # Types this section claims. Empty means it does not auto-file cards.
    accept_types: list[str] = Field(default_factory=list)


class DeckCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    sort_order: int | None = Field(default=None, ge=0)
    in_deck: bool | None = None


class DeckCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    sort_order: int | None = Field(default=None, ge=0)
    in_deck: bool | None = None
    accept_types: list[str] | None = Field(default=None, max_length=12)


class DeckCardEntry(BaseModel):
    """One deck membership row: section placement + nested card summary."""

    quantity: int
    category_id: int
    category_name: str
    sort_order: int
    card: CardSummary
    # True when preview / unpublished content was stripped for this viewer.
    is_classified: bool = False
    # "classified" (preview lock) | "top_secret" (not published) | null.
    classification: str | None = None
    # Raw publish_cards.published when visible (for PREVIEW ribbon).
    published: str | None = None


class DeckDetail(DeckSummary):
    categories: list[DeckCategoryOut]
    cards: list[DeckCardEntry]


class AddCardRequest(BaseModel):
    card_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=99)
    category_id: int | None = Field(default=None, gt=0)
    sort_order: int | None = Field(default=None, ge=0)


class UpdateCardRequest(BaseModel):
    quantity: int | None = Field(default=None, ge=1, le=99)
    category_id: int | None = Field(default=None, gt=0)
    sort_order: int | None = Field(default=None, ge=0)


class CardOrderItem(BaseModel):
    card_id: int = Field(gt=0)
    category_id: int = Field(gt=0)
    sort_order: int = Field(ge=0)


class ReorderCardsRequest(BaseModel):
    items: list[CardOrderItem] = Field(min_length=1)

    @field_validator("items")
    @classmethod
    def _unique_keys(cls, items: list[CardOrderItem]) -> list[CardOrderItem]:
        seen: set[tuple[int, int]] = set()
        for item in items:
            key = (item.card_id, item.category_id)
            if key in seen:
                raise ValueError("duplicate card_id+category_id in order list")
            seen.add(key)
        return items


class DefaultCategoriesResponse(BaseModel):
    categories: list[str]
