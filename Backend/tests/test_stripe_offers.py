"""Offer catalog helpers (no Stripe network)."""

from __future__ import annotations

import pytest

from app.stripe_offers import (
    DECK_PRINT_OFFER_ID,
    PRIMARY_SUBSCRIPTION_OFFER_ID,
    get_offer,
    offer_for_price_id,
    offer_for_subscription_type_label,
    print_amount_cents,
    primary_subscription_offer,
    resolve_pod_unit_price_id,
    resolve_price_id,
    subscription_offers,
    subscription_type_label,
)
from app.subscription import default_subscription_type, stripe_price_id


def test_primary_subscription_offer_fields():
    offer = primary_subscription_offer()
    assert offer.id == PRIMARY_SUBSCRIPTION_OFFER_ID
    assert offer.id == "level3_warmachine"
    assert offer.kind == "subscription"
    assert offer.label
    assert offer.features
    assert "deck_printout" in offer.entitlements
    assert offer.print_downloads_per_month is None
    assert offer.price_id_env == "STRIPE_PRICE_ID_LVL_3"


def test_three_subscription_tiers_exist():
    ids = {offer.id for offer in subscription_offers()}
    assert ids == {
        "level1_archivist",
        "level2_dataminer",
        "level3_warmachine",
    }
    lvl1 = get_offer("level1_archivist")
    lvl2 = get_offer("level2_dataminer")
    assert lvl1 is not None and lvl1.print_downloads_per_month == 5
    assert lvl2 is not None and lvl2.print_downloads_per_month == 15


def test_print_amount_uses_minimum_under_8_cards():
    # 25¢/card; $1.99 floor → under 8 cards stay at 199
    assert print_amount_cents(1) == 199
    assert print_amount_cents(7) == 199
    assert print_amount_cents(8) == 200
    assert print_amount_cents(40) == 1000


def test_subscription_type_comes_from_catalog_not_env(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("STRIPE_SUBSCRIPTION_TYPE", "should-be-ignored")
    assert default_subscription_type() == subscription_type_label()
    assert "WARMACHINE" in default_subscription_type().upper()


def test_price_id_reads_offer_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STRIPE_PRICE_ID_LVL_3", "price_sub_test")
    assert stripe_price_id() == "price_sub_test"
    print_offer = get_offer(DECK_PRINT_OFFER_ID)
    assert print_offer is not None
    monkeypatch.setenv("STRIPE_PRICE_ID_POD_MIN", "price_pod_min_test")
    monkeypatch.setenv("STRIPE_PRICE_ID_POD", "price_pod_unit_test")
    assert resolve_price_id(print_offer) == "price_pod_min_test"
    assert resolve_pod_unit_price_id() == "price_pod_unit_test"


def test_offer_for_price_id_matches_tier(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STRIPE_PRICE_ID_LVL_1", "price_lvl1")
    monkeypatch.setenv("STRIPE_PRICE_ID_LVL_2", "price_lvl2")
    monkeypatch.setenv("STRIPE_PRICE_ID_LVL_3", "price_lvl3")
    assert offer_for_price_id("price_lvl1").id == "level1_archivist"
    assert offer_for_price_id("price_lvl2").id == "level2_dataminer"
    assert offer_for_price_id("price_lvl3").id == "level3_warmachine"
    assert offer_for_price_id("price_unknown") is None


def test_offer_for_subscription_type_label_matches_tiers():
    lvl1 = offer_for_subscription_type_label("LEVEL 1 — ARCHIVIST")
    lvl2 = offer_for_subscription_type_label("LEVEL 2 — DATAMINER")
    lvl3 = offer_for_subscription_type_label("LEVEL 3 — WARMACHINE")
    assert lvl1 is not None and lvl1.print_downloads_per_month == 5
    assert lvl2 is not None and lvl2.print_downloads_per_month == 15
    assert lvl3 is not None and lvl3.print_downloads_per_month is None
    assert offer_for_subscription_type_label("level1_archivist") is not None
    assert offer_for_subscription_type_label("nope") is None
