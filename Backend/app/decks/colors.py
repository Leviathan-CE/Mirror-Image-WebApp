"""Deck colour identity from pilot invoke-cost pips."""

from __future__ import annotations

from typing import Any

_IDENTITY_CATEGORY_NAMES = ("pilot",)


def fetch_deck_identity_costs(
    cur, deck_ids: list[int]
) -> dict[int, list[str]]:
    """
    Invoke-cost pips for each deck's pilot (category sort_order, card sort_order).
    """
    if not deck_ids:
        return {}

    cur.execute(
        """
        SELECT
            dhc.deck_id,
            c.cost,
            CASE WHEN lower(btrim(dc.name)) = 'pilot' THEN 0 ELSE 1 END AS section_rank,
            dhc.sort_order,
            dhc.card_id
          FROM deck_has_cards dhc
          JOIN deck_categories dc ON dc.id = dhc.category_id
          JOIN cards c ON c.id = dhc.card_id
         WHERE dhc.deck_id = ANY(%(deck_ids)s)
           AND lower(btrim(dc.name)) = ANY(%(category_names)s)
         ORDER BY
            dhc.deck_id,
            section_rank,
            dhc.sort_order ASC NULLS LAST,
            dhc.card_id ASC
        """,
        {
            "deck_ids": deck_ids,
            "category_names": list(_IDENTITY_CATEGORY_NAMES),
        },
    )

    merged: dict[int, list[str]] = {deck_id: [] for deck_id in deck_ids}
    for deck_id, cost_raw, *_rest in cur.fetchall():
        merged[int(deck_id)].extend(_cost_tokens(cost_raw))
    return merged


def _cost_tokens(cost_raw: Any) -> list[str]:
    if not cost_raw:
        return []
    if isinstance(cost_raw, list):
        return [str(token) for token in cost_raw]
    return [str(token) for token in list(cost_raw)]
