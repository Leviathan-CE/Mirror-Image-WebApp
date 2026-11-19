"""
Stripe / store offer catalog.

Edit ``OFFERS`` to add or change products. Price *ids* still live in env
(test vs live differ); this file owns labels, copy, entitlements, and
local pricing rules (e.g. per-card print minimum).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

OfferKind = Literal["subscription", "one_time"]


@dataclass(frozen=True)
class PerCardPricing:
    """One-time charge: max(min_cents, cards * cents_per_card)."""

    cents_per_card: int
    min_cents: int

    def amount_cents(self, card_count: int) -> int:
        if self.cents_per_card < 0 or self.min_cents < 0:
            raise ValueError("pricing_must_be_non_negative")
        if card_count <= 0:
            return int(self.min_cents)
        raw = int(card_count) * int(self.cents_per_card)
        return max(int(self.min_cents), raw)


@dataclass(frozen=True)
class Offer:
    id: str
    kind: OfferKind
    label: str
    tagline: str = ""
    features: tuple[str, ...] = ()
    # Env var that holds the Stripe Price id for this offer (optional
    # for dynamic one-time amounts that do not use a fixed Price).
    price_id_env: str | None = None
    # Written to users.subscription_type when Stripe has no nickname.
    subscription_type_label: str | None = None
    # Feature keys unlocked while this subscription is entitled.
    entitlements: tuple[str, ...] = ()
    per_card: PerCardPricing | None = None
    # Free print PDFs per calendar month; None = unlimited.
    print_downloads_per_month: int | None = None
    # Marketing price shown on the Subscribe page (Stripe Price is source
    # of charge; keep this in sync with the Dashboard amount).
    display_amount_cents: int | None = None
    display_interval: str = "month"


# ---------------------------------------------------------------------------
# Catalog — add rows here
# ---------------------------------------------------------------------------

OFFERS: tuple[Offer, ...] = (
    Offer(
        id="level1_archivist",
        kind="subscription",
        label="LEVEL 1 — ARCHIVIST",
        tagline=(
            "Support Mirror Image at the entry tier and unlock "
            "early-access play with a modest print allowance."
        ),
        features=(
            "Access preview cards still in design.",
            "5 free print-and-play PDF downloads per month.",
            "Helping support solo development of Mirror Image.",
        ),
        price_id_env="STRIPE_PRICE_ID_LVL_1",
        subscription_type_label="LEVEL 1 — ARCHIVIST",
        entitlements=("preview_cards", "deck_printout"),
        print_downloads_per_month=5,
        display_amount_cents=499,
    ),
    Offer(
        id="level2_dataminer",
        kind="subscription",
        label="LEVEL 2 — DATAMINER",
        tagline=(
            "More print downloads each month while you build and "
            "play with preview cards."
        ),
        features=(
            "Access preview cards still in design.",
            "15 free print-and-play PDF downloads per month.",
            "Helping support solo development of Mirror Image.",
        ),
        price_id_env="STRIPE_PRICE_ID_LVL_2",
        subscription_type_label="LEVEL 2 — DATAMINER",
        entitlements=("preview_cards", "deck_printout"),
        print_downloads_per_month=15,
        display_amount_cents=999,
    ),
    Offer(
        id="level3_warmachine",
        kind="subscription",
        label="LEVEL 3 — WARMACHINE",
        tagline=(
            "Full supporter tier: unlimited print downloads and "
            "early-access cards for play-spaces."
        ),
        features=(
            "Access preview cards still in design, with new ones added "
            "each month to build and play with.",
            "Unlimited duplex print-and-play PDF downloads from your decks.",
            "Helping support a solo developer and illustrator work full "
            "time on this project and bring it to life.",
        ),
        price_id_env="STRIPE_PRICE_ID_LVL_3",
        subscription_type_label="LEVEL 3 — WARMACHINE",
        entitlements=("preview_cards", "deck_printout"),
        print_downloads_per_month=None,
        display_amount_cents=1999,
    ),
    Offer(
        id="deck_print_download",
        kind="one_time",
        label="Deck print download",
        tagline=(
            "One-time download of a print-and-play PDF. "
            "25¢ per card, $1.99 minimum (decks under 8 cards)."
        ),
        # Floor SKU in Stripe ($1.99). Unit price env is STRIPE_PRICE_ID_POD.
        price_id_env="STRIPE_PRICE_ID_POD_MIN",
        per_card=PerCardPricing(cents_per_card=25, min_cents=199),
    ),
)

PRIMARY_SUBSCRIPTION_OFFER_ID = "level3_warmachine"
DECK_PRINT_OFFER_ID = "deck_print_download"
POD_UNIT_PRICE_ENV = "STRIPE_PRICE_ID_POD"


def all_offers() -> tuple[Offer, ...]:
    return OFFERS


def subscription_offers() -> tuple[Offer, ...]:
    return tuple(o for o in OFFERS if o.kind == "subscription")


def get_offer(offer_id: str) -> Offer | None:
    wanted = (offer_id or "").strip()
    if not wanted:
        return None
    for offer in OFFERS:
        if offer.id == wanted:
            return offer
    return None


def require_offer(offer_id: str) -> Offer:
    offer = get_offer(offer_id)
    if offer is None:
        raise KeyError(f"unknown_offer:{offer_id}")
    return offer


def primary_subscription_offer() -> Offer:
    return require_offer(PRIMARY_SUBSCRIPTION_OFFER_ID)


def deck_print_offer() -> Offer:
    return require_offer(DECK_PRINT_OFFER_ID)


def resolve_price_id(offer: Offer) -> str:
    """Read the Stripe Price id from the offer's env var (may be empty)."""
    if not offer.price_id_env:
        return ""
    return (os.environ.get(offer.price_id_env) or "").strip()


def resolve_pod_unit_price_id() -> str:
    """Stripe Price id for the per-card POD SKU (may be empty)."""
    return (os.environ.get(POD_UNIT_PRICE_ENV) or "").strip()


def offer_for_price_id(price_id: str) -> Offer | None:
    """Match a Stripe Price id to a catalog subscription offer."""
    wanted = (price_id or "").strip()
    if not wanted:
        return None
    for offer in subscription_offers():
        if resolve_price_id(offer) == wanted:
            return offer
    return None


def offer_for_subscription_type_label(label: str) -> Offer | None:
    """
    Match users.subscription_type (or similar) to a catalog offer.

    Compares against subscription_type_label, display label, and offer id.
    """
    wanted = (label or "").strip().casefold()
    if not wanted:
        return None
    for offer in subscription_offers():
        type_label = (
            offer.subscription_type_label or offer.label or ""
        ).strip().casefold()
        if type_label and type_label == wanted:
            return offer
        if (offer.label or "").strip().casefold() == wanted:
            return offer
        if offer.id.casefold() == wanted:
            return offer
    return None


def subscription_type_label(offer: Offer | None = None) -> str:
    target = offer or primary_subscription_offer()
    label = (target.subscription_type_label or target.label or "").strip()
    return label or "standard"


def print_amount_cents(card_count: int) -> int:
    offer = deck_print_offer()
    if offer.per_card is None:
        raise ValueError("print_offer_missing_per_card_pricing")
    return offer.per_card.amount_cents(card_count)


def resolve_subscription_offer(offer_id: str | None) -> Offer:
    """Resolve a subscription offer id, defaulting to the primary tier."""
    cleaned = (offer_id or "").strip()
    if not cleaned:
        return primary_subscription_offer()
    offer = get_offer(cleaned)
    if offer is None or offer.kind != "subscription":
        raise KeyError(f"unknown_subscription_offer:{cleaned}")
    return offer


def format_offer_price_display(offer: Offer) -> str:
    cents = offer.display_amount_cents
    if cents is None:
        return "—"
    dollars = cents / 100
    if cents % 100 == 0:
        money = f"${cents // 100}"
    else:
        money = f"${dollars:.2f}"
    interval = (offer.display_interval or "month").strip()
    return f"{money} / {interval}"
