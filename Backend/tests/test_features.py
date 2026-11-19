"""Feature entitlement helper tests."""

from app.features import (
    FEATURE_DECK_PRINTOUT,
    FEATURE_DUPLEX_PRINT,
    FEATURE_PLAYTESTER,
    FEATURE_PREVIEW_CARDS,
    FEATURE_UNPUBLISHED_CARDS,
    desired_subscription_entitlements,
    effective_feature_keys,
    is_public_feature,
    subscription_managed_feature_keys,
    user_has_feature,
)


def test_admin_has_all_catalog_features():
    keys = effective_feature_keys(
        role="admin",
        subscription_status="none",
        granted_keys=[],
        catalog_keys=[
            FEATURE_PREVIEW_CARDS,
            FEATURE_UNPUBLISHED_CARDS,
            FEATURE_PLAYTESTER,
            FEATURE_DECK_PRINTOUT,
            FEATURE_DUPLEX_PRINT,
        ],
    )
    assert keys == [
        FEATURE_PREVIEW_CARDS,
        FEATURE_UNPUBLISHED_CARDS,
        FEATURE_PLAYTESTER,
        FEATURE_DECK_PRINTOUT,
        FEATURE_DUPLEX_PRINT,
    ]


def test_developer_has_all_catalog_features():
    keys = effective_feature_keys(
        role="developer",
        subscription_status="none",
        granted_keys=[],
        catalog_keys=[
            FEATURE_PREVIEW_CARDS,
            FEATURE_UNPUBLISHED_CARDS,
            FEATURE_PLAYTESTER,
            FEATURE_DECK_PRINTOUT,
            FEATURE_DUPLEX_PRINT,
        ],
    )
    assert FEATURE_UNPUBLISHED_CARDS in keys
    assert FEATURE_PREVIEW_CARDS in keys
    assert FEATURE_DUPLEX_PRINT in keys


def test_playtester_is_always_public():
    assert is_public_feature(FEATURE_PLAYTESTER)
    assert not is_public_feature(FEATURE_PREVIEW_CARDS)
    assert user_has_feature(
        role="user",
        subscription_status="none",
        granted_keys=[],
        feature_key=FEATURE_PLAYTESTER,
    )


def test_subscriber_gets_print_not_preview_by_default():
    assert not user_has_feature(
        role="user",
        subscription_status="active",
        granted_keys=[],
        feature_key=FEATURE_PREVIEW_CARDS,
    )
    assert user_has_feature(
        role="user",
        subscription_status="active",
        granted_keys=[],
        feature_key=FEATURE_PLAYTESTER,
    )
    assert user_has_feature(
        role="user",
        subscription_status="active",
        granted_keys=[],
        feature_key=FEATURE_DECK_PRINTOUT,
    )
    assert not user_has_feature(
        role="user",
        subscription_status="active",
        granted_keys=[],
        feature_key=FEATURE_DUPLEX_PRINT,
    )


def test_duplex_requires_grant_or_staff():
    assert user_has_feature(
        role="user",
        subscription_status="active",
        granted_keys=[FEATURE_DUPLEX_PRINT],
        feature_key=FEATURE_DUPLEX_PRINT,
    )
    assert user_has_feature(
        role="admin",
        subscription_status="none",
        granted_keys=[],
        feature_key=FEATURE_DUPLEX_PRINT,
    )


def test_non_subscriber_needs_grant_for_deck_printout():
    assert not user_has_feature(
        role="user",
        subscription_status="none",
        granted_keys=[],
        feature_key=FEATURE_DECK_PRINTOUT,
    )
    assert user_has_feature(
        role="user",
        subscription_status="none",
        granted_keys=[FEATURE_DECK_PRINTOUT],
        feature_key=FEATURE_DECK_PRINTOUT,
    )


def test_subscriber_does_not_get_unpublished_cards():
    assert not user_has_feature(
        role="user",
        subscription_status="active",
        granted_keys=[],
        feature_key=FEATURE_UNPUBLISHED_CARDS,
    )
    assert user_has_feature(
        role="user",
        subscription_status="none",
        granted_keys=[FEATURE_UNPUBLISHED_CARDS],
        feature_key=FEATURE_UNPUBLISHED_CARDS,
    )


def test_grant_unlocks_without_stripe():
    assert user_has_feature(
        role="user",
        subscription_status="none",
        granted_keys=[FEATURE_PREVIEW_CARDS],
        feature_key=FEATURE_PREVIEW_CARDS,
    )
    assert not user_has_feature(
        role="user",
        subscription_status="none",
        granted_keys=[],
        feature_key=FEATURE_PREVIEW_CARDS,
    )


def test_distributor_needs_grant_or_stripe():
    assert not user_has_feature(
        role="distributor",
        subscription_status="none",
        granted_keys=[],
        feature_key=FEATURE_PREVIEW_CARDS,
    )
    assert user_has_feature(
        role="distributor",
        subscription_status="none",
        granted_keys=[FEATURE_PREVIEW_CARDS],
        feature_key=FEATURE_PREVIEW_CARDS,
    )


def test_tier_entitlements_match_plans():
    managed = subscription_managed_feature_keys()
    assert FEATURE_DECK_PRINTOUT in managed
    assert FEATURE_DUPLEX_PRINT in managed
    assert FEATURE_PREVIEW_CARDS not in managed

    lvl1 = desired_subscription_entitlements(
        role="user",
        subscription_status="active",
        subscription_type="LEVEL 1 — ARCHIVIST",
    )
    assert lvl1 == {FEATURE_DECK_PRINTOUT}

    lvl2 = desired_subscription_entitlements(
        role="user",
        subscription_status="active",
        subscription_type="LEVEL 2 — DATAMINER",
    )
    assert lvl2 == {FEATURE_DECK_PRINTOUT, FEATURE_DUPLEX_PRINT}

    lvl3 = desired_subscription_entitlements(
        role="user",
        subscription_status="active",
        subscription_type="LEVEL 3 — WARMACHINE",
    )
    assert lvl3 == {FEATURE_DECK_PRINTOUT, FEATURE_DUPLEX_PRINT}

    canceled = desired_subscription_entitlements(
        role="user",
        subscription_status="canceled",
        subscription_type="LEVEL 3 — WARMACHINE",
    )
    assert canceled == set()

