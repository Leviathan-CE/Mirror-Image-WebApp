"""Feature entitlement helper tests."""

from app.features import (
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
        catalog_keys=[FEATURE_PREVIEW_CARDS, FEATURE_PLAYTESTER],
    )
    assert keys == [FEATURE_PREVIEW_CARDS, FEATURE_PLAYTESTER]


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
