from app.notifications import (
    KIND_CARD_CREATED,
    KIND_CARD_REMOVED,
    KIND_CARD_UPDATED,
    allowed_kinds_from_prefs,
    classify_card_change,
)


def test_unpublished_stays_silent():
    assert (
        classify_card_change(
            "not published",
            "not published",
            {"card_name": "A"},
            {"card_name": "B"},
        )
        is None
    )


def test_first_publish_is_created():
    assert (
        classify_card_change(
            "not published",
            "published",
            {"card_name": "A"},
            {"card_name": "A"},
        )
        == KIND_CARD_CREATED
    )


def test_preview_text_change_is_updated():
    assert (
        classify_card_change(
            "preview",
            "preview",
            {"card_name": "A", "description": "old"},
            {"card_name": "A", "description": "new"},
        )
        == KIND_CARD_UPDATED
    )


def test_unpublish_is_removed():
    assert (
        classify_card_change(
            "published",
            "not published",
            {"card_name": "A"},
            {"card_name": "A"},
        )
        == KIND_CARD_REMOVED
    )


def test_muted_blog_drops_announcement_kind():
    kinds = allowed_kinds_from_prefs(
        {"notify_blog": False, "notify_cards": True}
    )
    assert "announcement.published" not in kinds
    assert "card.created" in kinds


def test_missing_pref_keys_keep_both_channels_on():
    kinds = allowed_kinds_from_prefs({})
    assert "announcement.published" in kinds
    assert "card.updated" in kinds
