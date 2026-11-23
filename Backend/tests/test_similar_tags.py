"""Similar-deck tag ranking. No database."""

from app.decks.similar_tags import (
    Signature,
    rank_similar_tags,
    signature_distance,
    signature_from_cards,
)


def _signature(**overrides) -> Signature:
    base = Signature(
        size=40,
        mean_invoke=2,
        colors=(0.5, 0.5, 0, 0, 0, 0),
        unit=0.5,
        cyberspell=0.5,
        process=0.2,
        quick_hack=0.1,
        mean_health=2,
    )
    values = base.__dict__.copy()
    values.update(overrides)
    return Signature(**values)


def test_identical_decks_have_no_distance():
    left = signature_from_cards(
        [
            {
                "quantity": 2,
                "invoke_cost": 1,
                "has_invoke_cost": True,
                "cost": ["LIF", "LIF-MET"],
                "super_types": ["Unit"],
                "sub_types": ["Process"],
                "threat_level": "3|2",
                "has_tlv": True,
            }
        ]
    )
    assert signature_distance(left, left) == 0
    assert left.colors[0] == 0.5
    assert left.mean_health == 2


def test_rank_hides_owned_tags_and_far_decks():
    source = _signature()
    close = _signature()
    far = _signature(size=120)
    result = rank_similar_tags(
        source,
        [
            (close, ["Aggro", "Lif"]),
            (close, ["Aggro", "Blitz"]),
            (close, ["Lif"]),
            (far, ["Ignore Me"]),
        ],
        ["Lif"],
    )
    assert result["compared"] == 3
    assert result["tags"][0]["tag"] == "Aggro"
    assert result["tags"][0]["decks"] == 2
    assert all(row["tag"] != "Lif" for row in result["tags"])
    assert all(row["tag"] != "Ignore Me" for row in result["tags"])


def test_two_neighbors_are_not_enough():
    source = _signature()
    close = _signature()
    result = rank_similar_tags(
        source,
        [(close, ["Aggro"]), (close, ["Aggro"])],
        [],
    )
    assert result["compared"] == 2
    assert result["tags"] == []
