"""Feature entitlement helper tests."""

from app.features import (
    FEATURE_DECK_PRINTOUT,
    FEATURE_PLAYTESTER,
    FEATURE_PREVIEW_CARDS,
    effective_feature_keys,
    is_public_feature,
    user_has_feature,
)


def test_admin_has_all_catalog_features():
    keys = effective_feature_keys(
        role="admin",
        subscription_status="none",
        granted_keys=[],
        catalog_keys=[
            FEATURE_PREVIEW_CARDS,
            FEATURE_PLAYTESTER,
            FEATURE_DECK_PRINTOUT,
        ],
    )
    assert keys == [
        FEATURE_PREVIEW_CARDS,
        FEATURE_PLAYTESTER,
        FEATURE_DECK_PRINTOUT,
    ]


def test_playtester_is_always_public():
    assert is_public_feature(FEATURE_PLAYTESTER)
    assert not is_public_feature(FEATURE_PREVIEW_CARDS)
    assert user_has_feature(
        role="user",
        subscription_status="none",
        granted_keys=[],
        feature_key=FEATURE_PLAYTESTER,
    )


def test_subscriber_gets_preview_and_public_playtester():
    assert user_has_feature(
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
