"""Section type sets: duplicates, clashes, and legal overlaps."""

from app.decks.section_types import (
    prepare_section_types,
    section_can_claim_types,
)


def test_same_set_is_rejected_regardless_of_order_and_case():
    cleaned, problem = prepare_section_types(
        ["Quick Hack", "CyberSpell"],
        [["cyberspell", "quick hack"]],
    )
    assert cleaned == []
    assert problem == "taken"


def test_shared_type_with_a_different_partner_is_legal():
    cleaned, problem = prepare_section_types(
        ["CyberSpell", "Process"],
        [["CyberSpell", "Quick Hack"]],
    )
    assert problem is None
    assert cleaned == ["CyberSpell", "Process"]


def test_one_section_cannot_list_a_type_twice():
    cleaned, problem = prepare_section_types(
        ["CyberSpell", " cyberspell "],
        [],
    )
    assert cleaned == []
    assert problem == "repeated"


def test_empty_sets_do_not_clash():
    cleaned, problem = prepare_section_types(["  "], [[]])
    assert cleaned == []
    assert problem is None


def test_pilot_and_objective_slots_cannot_claim_types():
    assert section_can_claim_types("Pilot") is False
    assert section_can_claim_types("Objective/Augments") is False
    assert section_can_claim_types("Cyberspell") is True
