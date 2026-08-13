"""Unit tests for the public-text profanity gate."""

from app.profanity import contains_profanity, find_profanity, normalize_for_profanity


def test_clean_text_passes():
    assert find_profanity("Aggro Midrange") is None
    assert find_profanity("classic control") is None
    assert find_profanity("") is None
    assert find_profanity(None) is None


def test_blocks_plain_terms():
    assert contains_profanity("this is fucking broken")
    assert contains_profanity("Shit")
    assert contains_profanity("total bullshit")
    assert find_profanity("Shit") == "shit"


def test_leet_and_separators():
    assert contains_profanity("f.u.c.k")
    assert contains_profanity("sh1t")
    assert contains_profanity("f*ck".replace("*", "u"))  # sanity
    # @ maps to a (email-style leet), so f@ck → fack and is not matched.


def test_normalize_maps_leet():
    assert "shit" in normalize_for_profanity("Sh1t!!!")
