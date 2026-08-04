"""Shared catalogue browse filters (user library + admin cards DB)."""

from __future__ import annotations

from typing import Any

from psycopg2.extras import Json


def escape_like(value: str) -> str:
    """Escape %, _, and \\ for ILIKE patterns."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def cost_has_stl_identity(tokens: list[str]) -> bool:
    """
    Whether invoke-cost pips count as steel for library colour filters.

    Bare GEN is steel (same as playtester / Unity). Numbered GEN0–GEN10 are
    generic mana and do not count. Explicit STL / hybrids (e.g. LIF-STL) do.
    """
    for raw in tokens:
        token = (raw or "").strip().upper()
        if not token:
            continue
        if token == "GEN":
            return True
        # Solid STL or a hybrid segment (LIF-STL, STL-TIM, …).
        parts = token.split("-")
        if "STL" in parts:
            return True
    return False


def sql_card_matches_stl(alias: str = "cards") -> str:
    """
    STL identity for library colour filters (resources/tokens excluded):
    - cost includes an STL symbol (including hybrids like LIF-STL), or
    - cost includes bare GEN (steel pip — not GEN1 / GEN2 / …).
    """
    return f"""
    (
      NOT (
        {alias}.super_types @> '["Resource"]'::jsonb
        OR {alias}.super_types @> '["Token"]'::jsonb
      )
      AND EXISTS (
        SELECT 1
          FROM jsonb_array_elements_text({alias}.cost) AS token(value)
         WHERE UPPER(BTRIM(token.value)) = 'GEN'
            OR UPPER(BTRIM(token.value)) ~ '(^|[-])STL([-]|$)'
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
    for index, token in enumerate(colors):
        if token == "STL":
            where.append(sql_card_matches_stl(alias))
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


def catalogue_order_sql(has_name_query: bool, alias: str = "cards") -> str:
    if has_name_query:
        return f"""
            CASE
              WHEN {alias}.card_name ILIKE %(name_prefix)s ESCAPE '\\' THEN 0
              ELSE 1
            END,
            LENGTH({alias}.card_name) ASC,
            {alias}.card_name ASC
        """
    return f"{alias}.card_name ASC"
