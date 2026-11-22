"""Auth helper unit tests (no database required)."""

import jwt
import pytest
from fastapi import HTTPException

from app.security import (
    ALGORITHM,
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    signing_secret,
)


def test_password_hash_roundtrip():
    hashed = hash_password("correct-horse-battery")
    assert hashed != "correct-horse-battery"
    assert verify_password("correct-horse-battery", hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_roundtrip():
    token = create_access_token(
        user_id=42,
        user_name="pilot",
        email="pilot@example.com",
        role="user",
    )
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "user"
    assert "email" not in payload
    assert "user_name" not in payload


def test_single_purpose_email_token_is_not_a_valid_session_token():
    """
    Mailing-list/account email-link tokens (e.g. ``blog_email_unsub``)
    are signed with the same secret as login tokens but must never be
    usable to impersonate a user via ``get_current_user_id``. A real
    login token never carries a ``purpose`` claim, so any token that
    does must be rejected here.
    """
    forged_session_token = jwt.encode(
        {"purpose": "blog_email_unsub", "sub": "1234"},
        signing_secret(),
        algorithm=ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(forged_session_token)
    assert exc_info.value.status_code == 401
