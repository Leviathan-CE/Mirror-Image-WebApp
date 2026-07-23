"""Catalogue visibility helpers — public surfaces only expose published cards."""

PUBLISHED_STATUS = "published"

# SQL fragment: row in publish_cards with status published.
# Pass the cards table/alias that exposes `.id` (e.g. "cards", "c").
SQL_CARD_IS_PUBLISHED = """
EXISTS (
    SELECT 1
      FROM publish_cards pc
     WHERE pc.card_id = {alias}.id
       AND pc.published = '{status}'
)
""".strip()


def sql_card_is_published(alias: str = "cards") -> str:
    """Return an EXISTS predicate for catalogue publish visibility."""
    return SQL_CARD_IS_PUBLISHED.format(alias=alias, status=PUBLISHED_STATUS)


def catalogue_visibility_sql(alias: str = "cards", *, bypass: bool = False) -> str:
    """
    Publish gate for public/user catalogue queries.

    Admins pass ``bypass=True`` so preview / not-published cards remain visible
    when they use the normal app (library, search, deck builder).
    """
    if bypass:
        return "TRUE"
    return sql_card_is_published(alias)
