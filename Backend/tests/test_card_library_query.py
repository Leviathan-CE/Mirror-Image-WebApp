"""Catalogue colour-filter helpers."""

from app.card_library_query import (
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


def test_sql_stl_paired_excludes_pure_numbered_gen_branch():
    paired = sql_card_matches_stl("cards", include_pure_numbered_gen=False)
    assert "= 'GEN'" in paired
    assert "STL" in paired
    assert "^GEN(10|[0-9])$" not in paired
    # Old “no chromatic ⇒ STL” branch must stay gone.
    assert "MULTI" not in paired
    assert "LIF|MET|POW|RAM|TIM" not in paired
