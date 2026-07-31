"""Catalogue publish visibility SQL."""

from app.card_publish import (
    classified_deck_card_overrides,
    catalogue_visibility_sql,
    deck_card_classification,
    should_classify_publish_status,
)


def test_visibility_published_only_by_default():
    sql = catalogue_visibility_sql("cards")
    assert "published" in sql
    assert "preview" not in sql
    assert sql != "TRUE"


def test_visibility_includes_preview_for_subscribers():
    sql = catalogue_visibility_sql("c", include_preview=True)
    assert "published" in sql
    assert "preview" in sql
    assert sql != "TRUE"


def test_visibility_bypass_for_admins():
    assert catalogue_visibility_sql("cards", bypass=True) == "TRUE"
    # bypass wins even if include_preview is set
    assert (
        catalogue_visibility_sql("cards", bypass=True, include_preview=True) == "TRUE"
    )


def test_should_classify_preview_for_anonymous():
    assert should_classify_publish_status("preview") is True
    assert should_classify_publish_status("published") is False
    assert should_classify_publish_status(None) is True
    assert should_classify_publish_status("not published") is True


def test_should_classify_preview_allowed_for_subscriber():
    assert (
        should_classify_publish_status("preview", include_preview=True) is False
    )
    assert (
        should_classify_publish_status("not published", include_preview=True)
        is True
    )


def test_should_classify_never_for_admin_bypass():
    assert (
        should_classify_publish_status(
            "preview", bypass=True, include_preview=False
        )
        is False
    )
    assert should_classify_publish_status(None, bypass=True) is False


def test_deck_card_classification_kinds():
    assert deck_card_classification("preview") == "classified"
    assert deck_card_classification("preview", include_preview=True) is None
    assert deck_card_classification("published") is None
    assert deck_card_classification("not published") == "top_secret"
    assert deck_card_classification(None) == "top_secret"
    assert deck_card_classification(None, bypass=True) is None


def test_classified_overrides_strip_art_and_stats():
    overrides = classified_deck_card_overrides("classified")
    assert overrides["is_classified"] is True
    assert overrides["classification"] == "classified"
    assert overrides["card_art_path"] is None
    assert overrides["card_art_version"] is None
    assert overrides["cost"] == []
    assert overrides["types_line"] == "CLASSIFIED"
    assert overrides["time_capacity"] == 0


def test_top_secret_overrides():
    overrides = classified_deck_card_overrides("top_secret")
    assert overrides["classification"] == "top_secret"
    assert overrides["types_line"] == "TOP SECRET"
    assert overrides["is_classified"] is True
