"""Catalogue publish visibility SQL."""

from app.card_publish import catalogue_visibility_sql


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
