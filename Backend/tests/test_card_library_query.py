"""Catalogue colour-filter helpers."""

from app.card_library_query import cost_has_stl_identity, sql_card_matches_stl


def test_bare_gen_is_steel():
    assert cost_has_stl_identity(["GEN"]) is True
    assert cost_has_stl_identity(["LIF", "GEN"]) is True
    assert cost_has_stl_identity(["GEN", "GEN"]) is True


def test_numbered_gen_is_not_steel():
    assert cost_has_stl_identity(["GEN0"]) is False
    assert cost_has_stl_identity(["GEN1"]) is False
    assert cost_has_stl_identity(["GEN5"]) is False
    assert cost_has_stl_identity(["GEN10"]) is False
    assert cost_has_stl_identity([]) is False
    assert cost_has_stl_identity(["LIF", "POW"]) is False


def test_explicit_stl_and_hybrids():
    assert cost_has_stl_identity(["STL"]) is True
    assert cost_has_stl_identity(["LIF-STL"]) is True
    assert cost_has_stl_identity(["STL-TIM"]) is True


def test_sql_stl_clause_targets_bare_gen_not_colorless():
    sql = sql_card_matches_stl("cards")
    assert "= 'GEN'" in sql
    assert "STL" in sql
    # Old “no chromatic ⇒ STL” branch must stay gone.
    assert "MULTI" not in sql
    assert "LIF|MET|POW|RAM|TIM" not in sql
