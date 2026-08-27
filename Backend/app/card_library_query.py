"""Shared catalogue browse filters (user library + admin cards DB)."""

from __future__ import annotations

from typing import Any

from psycopg2.extras import Json


def escape_like(value: str) -> str:
    """Escape %, _, and \\ for ILIKE patterns."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


_NUMBERED_GEN = frozenset(f"GEN{i}" for i in range(11))  # GEN0 … GEN10


def cost_is_pure_numbered_gen(tokens: list[str]) -> bool:
    """True when every cost pip is GEN0–GEN10 (no chromatic / bare GEN / STL)."""
    cleaned = [(raw or "").strip().upper() for raw in tokens if (raw or "").strip()]
    return bool(cleaned) and all(token in _NUMBERED_GEN for token in cleaned)


def cost_has_stl_identity(
    tokens: list[str], *, include_pure_numbered_gen: bool = False
) -> bool:
    """
    Whether invoke-cost pips count as steel for library colour filters.

    Always: bare GEN, explicit STL, STL hybrids (e.g. LIF-STL).
    When include_pure_numbered_gen (STL filter alone): also pure GEN0–GEN10
    costs with no other colours, and empty/no-cost cards (colorless).
    """
    cleaned = [(raw or "").strip().upper() for raw in tokens if (raw or "").strip()]
    if include_pure_numbered_gen:
        # No cost pips ⇒ colorless ⇒ steel when STL is the only colour filter.
        if not cleaned:
            return True
        if cost_is_pure_numbered_gen(tokens):
            return True
    for token in cleaned:
        if token == "GEN":
            return True
        # Solid STL or a hybrid segment (LIF-STL, STL-TIM, …).
        parts = token.split("-")
        if "STL" in parts:
            return True
    return False


def sql_card_matches_stl(
    alias: str = "cards", *, include_pure_numbered_gen: bool = False
) -> str:
    """
    STL identity for library colour filters (resources/tokens excluded):
    - cost includes an STL symbol (including hybrids like LIF-STL), or
    - cost includes bare GEN (steel pip — not GEN1 / GEN2 / …), or
    - when include_pure_numbered_gen: every cost pip is GEN0–GEN10 only,
      or the card has no cost pips (empty cost / colorless, e.g. free augments).
    """
    pure_numbered = ""
    if include_pure_numbered_gen:
        pure_numbered = f"""
        OR jsonb_array_length(COALESCE({alias}.cost, '[]'::jsonb)) = 0
        OR (
          jsonb_array_length(COALESCE({alias}.cost, '[]'::jsonb)) > 0
          AND NOT EXISTS (
            SELECT 1
              FROM jsonb_array_elements_text({alias}.cost) AS token(value)
             WHERE UPPER(BTRIM(token.value)) !~ '^GEN(10|[0-9])$'
          )
        )
        """
    return f"""
    (
      NOT (
        {alias}.super_types @> '["Resource"]'::jsonb
        OR {alias}.super_types @> '["Token"]'::jsonb
      )
      AND (
        EXISTS (
          SELECT 1
            FROM jsonb_array_elements_text({alias}.cost) AS token(value)
           WHERE UPPER(BTRIM(token.value)) = 'GEN'
              OR UPPER(BTRIM(token.value)) ~ '(^|[-])STL([-]|$)'
        )
        {pure_numbered}
      )
    )
    """


def apply_catalogue_filters(
    where: list[str],
    params: dict[str, Any],
    *,
    alias: str = "cards",
    q: str | None = None,
    description: str | None = None,
    invoke_cost_min: int | None = None,
    invoke_cost_max: int | None = None,
    color: list[str] | None = None,
    types_line: str | None = None,
    super_type: str | None = None,
    sub_type: str | None = None,
) -> bool:
    """Append library filter clauses. Returns True when a name query is active."""
    needle = (q or "").strip()
    if needle:
        escaped = escape_like(needle)
        where.append(f"{alias}.card_name ILIKE %(name_pattern)s ESCAPE '\\'")
        params["name_pattern"] = f"%{escaped}%"
        params["name_prefix"] = f"{escaped}%"

    desc = (description or "").strip()
    if desc:
        escaped_desc = escape_like(desc)
        where.append(f"{alias}.description ILIKE %(desc_pattern)s ESCAPE '\\'")
        params["desc_pattern"] = f"%{escaped_desc}%"

    if invoke_cost_min is not None:
        where.append(f"{alias}.invoke_cost >= %(invoke_cost_min)s")
        params["invoke_cost_min"] = invoke_cost_min
    if invoke_cost_max is not None:
        where.append(f"{alias}.invoke_cost <= %(invoke_cost_max)s")
        params["invoke_cost_max"] = invoke_cost_max

    colors: list[str] = []
    for raw in color or []:
        token = raw.strip().upper()
        if token and token not in colors:
            colors.append(token)
    # Pure GEN0–GEN10 and empty/no-cost (colorless) only count as STL when
    # STL is the sole colour filter.
    stl_include_pure_numbered = colors == ["STL"]
    for index, token in enumerate(colors):
        if token == "STL":
            where.append(
                sql_card_matches_stl(
                    alias, include_pure_numbered_gen=stl_include_pure_numbered
                )
            )
            continue
        key = f"color_{index}"
        where.append(
            f"""EXISTS (
              SELECT 1
                FROM jsonb_array_elements_text({alias}.cost) AS token(value)
               WHERE UPPER(BTRIM(token.value)) = %({key})s
                  OR UPPER(BTRIM(token.value))
                     ~ ('(^|[-])' || %({key})s || '([-]|$)')
            )"""
        )
        params[key] = token

    type_line = (types_line or "").strip()
    if type_line:
        escaped_type = escape_like(type_line)
        where.append(f"{alias}.types_line ILIKE %(types_line_pattern)s ESCAPE '\\'")
        params["types_line_pattern"] = f"%{escaped_type}%"

    super_val = (super_type or "").strip()
    if super_val:
        where.append(f"{alias}.super_types @> %(super_type_json)s::jsonb")
        params["super_type_json"] = Json([super_val])

    sub_val = (sub_type or "").strip()
    if sub_val:
        where.append(f"{alias}.sub_types @> %(sub_type_json)s::jsonb")
        params["sub_type_json"] = Json([sub_val])

    return bool(needle)


# Library browse sort modes (query param `sort`).
CATALOGUE_SORT_NAME = "name"
CATALOGUE_SORT_NAME_DESC = "name_desc"
CATALOGUE_SORT_INVOKE = "invoke"
CATALOGUE_SORT_INVOKE_DESC = "invoke_desc"
CATALOGUE_SORT_RELEVANCE = "relevance"
CATALOGUE_SORT_MODES = frozenset(
    {
        CATALOGUE_SORT_NAME,
        CATALOGUE_SORT_NAME_DESC,
        CATALOGUE_SORT_INVOKE,
        CATALOGUE_SORT_INVOKE_DESC,
        CATALOGUE_SORT_RELEVANCE,
    }
)


def catalogue_order_sql(
    has_name_query: bool,
    alias: str = "cards",
    sort: str = CATALOGUE_SORT_NAME,
) -> str:
    """
    ORDER BY clause for catalogue browse.

    - name / name_desc: A–Z / Z–A
    - invoke / invoke_desc: invoke cost ↑ / ↓, then A–Z
    - relevance: prefix-first name ranking (only meaningful with a name query;
      falls back to A–Z when there is no `q`)
    """
    mode = sort if sort in CATALOGUE_SORT_MODES else CATALOGUE_SORT_NAME

    if mode == CATALOGUE_SORT_INVOKE:
        return (
            f"{alias}.invoke_cost ASC, "
            f"lower({alias}.card_name) ASC, "
            f"{alias}.card_name ASC"
        )

    if mode == CATALOGUE_SORT_INVOKE_DESC:
        return (
            f"{alias}.invoke_cost DESC, "
            f"lower({alias}.card_name) ASC, "
            f"{alias}.card_name ASC"
        )

    if mode == CATALOGUE_SORT_NAME_DESC:
        return f"lower({alias}.card_name) DESC, {alias}.card_name DESC"

    if mode == CATALOGUE_SORT_RELEVANCE and has_name_query:
        return f"""
            CASE
              WHEN {alias}.card_name ILIKE %(name_prefix)s ESCAPE '\\' THEN 0
              ELSE 1
            END,
            LENGTH({alias}.card_name) ASC,
            {alias}.card_name ASC
        """

    return f"lower({alias}.card_name) ASC, {alias}.card_name ASC"
