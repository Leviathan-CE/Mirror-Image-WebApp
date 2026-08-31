"""Deck pilot identity cost merging."""

from app.decks.colors import _cost_tokens


def test_cost_tokens_normalizes_json_list():
    assert _cost_tokens(["RAM", "POW"]) == ["RAM", "POW"]
    assert _cost_tokens([]) == []
    assert _cost_tokens(None) == []
