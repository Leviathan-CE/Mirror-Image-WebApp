"""Unit tests for deck access helpers and optional JWT auth."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers.decks import _require_readable_deck
from app.security import create_access_token, get_optional_user_id
from fastapi.security import HTTPAuthorizationCredentials


class _FakeCursor:
    def __init__(self, row: tuple | None) -> None:
        self._row = row
        self.last_sql: str | None = None
        self.last_params: dict | None = None

    def execute(self, sql: str, params: dict | None = None) -> None:
        self.last_sql = sql
        self.last_params = params

    def fetchone(self) -> tuple | None:
        return self._row


def test_readable_public_deck_allows_anonymous():
    # id, name, desc, cover, mime, is_public, author, owner_id
    row = (10, "Public Ops", "desc", None, None, True, "pilot", 3)
    cur = _FakeCursor(row)

    result = _require_readable_deck(cur, deck_id=10, user_id=None)

    # Full row including owner_id (needed for view-count / ownership checks).
    assert result == row
    assert result[5] is True
    assert result[7] == 3


def test_readable_private_deck_rejects_anonymous():
    row = (11, "Secret", None, None, None, False, "pilot", 3)
    cur = _FakeCursor(row)

    with pytest.raises(HTTPException) as exc:
        _require_readable_deck(cur, deck_id=11, user_id=None)

    assert exc.value.status_code == 404
    assert exc.value.detail == "deck_not_found"


def test_readable_private_deck_allows_owner():
    row = (11, "Secret", None, None, None, False, "pilot", 3)
    cur = _FakeCursor(row)

    result = _require_readable_deck(cur, deck_id=11, user_id=3)

    assert result[0] == 11
    assert result[6] == "pilot"


def test_readable_private_deck_rejects_other_user():
    row = (11, "Secret", None, None, None, False, "pilot", 3)
    cur = _FakeCursor(row)

    with pytest.raises(HTTPException) as exc:
        _require_readable_deck(cur, deck_id=11, user_id=99)

    assert exc.value.status_code == 404


def test_readable_missing_deck_raises_404():
    cur = _FakeCursor(None)

    with pytest.raises(HTTPException) as exc:
        _require_readable_deck(cur, deck_id=404, user_id=1)

    assert exc.value.status_code == 404


def test_get_optional_user_id_none_without_credentials():
    assert get_optional_user_id(None) is None


def test_get_optional_user_id_from_bearer():
    token = create_access_token(
        user_id=7, user_name="ops", email="ops@example.com", role="user"
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    assert get_optional_user_id(credentials) == 7


def test_get_optional_user_id_rejects_bad_scheme():
    credentials = HTTPAuthorizationCredentials(scheme="Basic", credentials="x")
    assert get_optional_user_id(credentials) is None
