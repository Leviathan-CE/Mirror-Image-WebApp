"""Catalogue colour-filter helpers."""

from app.card_library_query import (
    apply_catalogue_filters,
    apply_deck_color_filters,
    cost_has_stl_identity,
    cost_is_pure_numbered_gen,
    sql_card_matches_stl,
)


def test_bare_gen_is_steel():
    assert cost_has_stl_identity(["GEN"]) is True
    assert cost_has_stl_identity(["LIF", "GEN"]) is True
    assert cost_has_stl_identity(["GEN", "GEN"]) is True


def test_numbered_gen_is_not_steel_when_paired():
    assert cost_has_stl_identity(["GEN0"]) is False
    assert cost_has_stl_identity(["GEN1"]) is False
    assert cost_has_stl_identity(["GEN5"]) is False
    assert cost_has_stl_identity(["GEN10"]) is False
    assert cost_has_stl_identity([]) is False
    assert cost_has_stl_identity(["LIF", "POW"]) is False
    # Mixed with a colour — never "pure numbered GEN".
    assert cost_has_stl_identity(["LIF", "GEN3"], include_pure_numbered_gen=True) is False


def test_empty_cost_counts_only_when_stl_alone():
    """Colorless / no-cost cards (e.g. free augments) match STL-only filter."""
    assert cost_has_stl_identity([], include_pure_numbered_gen=True) is True
    assert cost_has_stl_identity([""], include_pure_numbered_gen=True) is True
    assert cost_has_stl_identity([], include_pure_numbered_gen=False) is False


def test_pure_numbered_gen_counts_only_when_stl_alone():
    assert cost_is_pure_numbered_gen(["GEN0"]) is True
    assert cost_is_pure_numbered_gen(["GEN3", "GEN10"]) is True
    assert cost_is_pure_numbered_gen(["GEN", "GEN3"]) is False
    assert cost_is_pure_numbered_gen(["STL"]) is False
    assert cost_is_pure_numbered_gen([]) is False

    assert cost_has_stl_identity(["GEN3"], include_pure_numbered_gen=True) is True
    assert cost_has_stl_identity(["GEN0", "GEN10"], include_pure_numbered_gen=True) is True
    assert cost_has_stl_identity(["GEN3"], include_pure_numbered_gen=False) is False


def test_explicit_stl_and_hybrids():
    assert cost_has_stl_identity(["STL"]) is True
    assert cost_has_stl_identity(["LIF-STL"]) is True
    assert cost_has_stl_identity(["STL-TIM"]) is True


def test_sql_stl_alone_includes_pure_numbered_gen():
    alone = sql_card_matches_stl("cards", include_pure_numbered_gen=True)
    assert "= 'GEN'" in alone
    assert "STL" in alone
    assert "^GEN(10|[0-9])$" in alone
    assert "jsonb_array_length(COALESCE(cards.cost, '[]'::jsonb)) = 0" in alone


def test_sql_stl_paired_excludes_pure_numbered_gen_branch():
    paired = sql_card_matches_stl("cards", include_pure_numbered_gen=False)
    assert "= 'GEN'" in paired
    assert "STL" in paired
    assert "^GEN(10|[0-9])$" not in paired
    assert "jsonb_array_length(COALESCE(cards.cost, '[]'::jsonb)) = 0" not in paired
    # Old “no chromatic ⇒ STL” branch must stay gone.
    assert "MULTI" not in paired
    assert "LIF|MET|POW|RAM|TIM" not in paired


def test_catalogue_order_name_is_alphabetical():
    from app.card_library_query import catalogue_order_sql

    sql = catalogue_order_sql(has_name_query=True, sort="name")
    assert "lower(cards.card_name) ASC" in sql
    assert "invoke_cost" not in sql
    assert "name_prefix" not in sql


def test_catalogue_order_invoke_then_name():
    from app.card_library_query import catalogue_order_sql

    sql = catalogue_order_sql(has_name_query=False, sort="invoke")
    assert "cards.invoke_cost ASC" in sql
    assert "lower(cards.card_name) ASC" in sql


def test_catalogue_order_name_desc_is_za():
    from app.card_library_query import catalogue_order_sql

    sql = catalogue_order_sql(has_name_query=False, sort="name_desc")
    assert "lower(cards.card_name) DESC" in sql
    assert "invoke_cost" not in sql


def test_catalogue_order_invoke_desc():
    from app.card_library_query import catalogue_order_sql

    sql = catalogue_order_sql(has_name_query=False, sort="invoke_desc")
    assert "cards.invoke_cost DESC" in sql
    assert "lower(cards.card_name) ASC" in sql


def test_catalogue_order_relevance_only_with_name_query():
    from app.card_library_query import catalogue_order_sql

    with_q = catalogue_order_sql(has_name_query=True, sort="relevance")
    assert "name_prefix" in with_q
    without_q = catalogue_order_sql(has_name_query=False, sort="relevance")
    assert "lower(cards.card_name) ASC" in without_q
    assert "name_prefix" not in without_q


def test_apply_deck_color_filters_or_and_not():
    where_or: list[str] = []
    params_or: dict = {}
    apply_deck_color_filters(
        where_or, params_or, colors=["LIF", "MET"], color_mode="or"
    )
    assert len(where_or) == 1
    assert " OR " in where_or[0]
    assert where_or[0].strip().startswith("EXISTS")
    assert params_or["deck_color_0"] == "LIF"
    assert params_or["deck_color_1"] == "MET"

    where_and: list[str] = []
    params_and: dict = {}
    apply_deck_color_filters(
        where_and, params_and, colors=["LIF", "POW"], color_mode="and"
    )
    assert len(where_and) == 2
    assert all("EXISTS" in clause for clause in where_and)

    where_not: list[str] = []
    params_not: dict = {}
    apply_deck_color_filters(
        where_not, params_not, colors=["STL"], color_mode="not"
    )
    assert len(where_not) == 1
    assert where_not[0].strip().startswith("NOT EXISTS")
    # STL-only uses sql_card_matches_stl (no deck_color_N param).
    assert params_not == {}


def test_apply_deck_color_filters_ignores_empty():
    where: list[str] = ["uhd.is_public = TRUE"]
    params: dict = {}
    apply_deck_color_filters(where, params, colors=[], color_mode="and")
    apply_deck_color_filters(where, params, colors=None, color_mode="or")
    assert where == ["uhd.is_public = TRUE"]
    assert params == {}


def test_sub_type_matches_declared_or_types_line():
    where: list[str] = []
    params: dict = {}
    state = apply_catalogue_filters(where, params, sub_type="Soldier")
    assert state.has_sub_type_query is True
    assert state.has_name_query is False
    assert len(where) == 1
    clause = where[0]
    assert "sub_types @>" in clause
    assert "types_line ILIKE" in clause
    assert params["sub_type_json"].adapted == ["Soldier"]
    assert params["sub_type_types_line_pattern"] == "%Soldier%"
    assert params["sub_type_types_line_prefix"] == "Soldier%"


def test_catalogue_order_sub_type_prefix_rank():
    from app.card_library_query import catalogue_order_sql

    sql = catalogue_order_sql(
        has_name_query=False,
        sort="name",
        has_sub_type_query=True,
    )
    assert "sub_type_types_line_prefix" in sql
    assert "LENGTH(cards.types_line) ASC" in sql
    assert "lower(cards.card_name) ASC" in sql
