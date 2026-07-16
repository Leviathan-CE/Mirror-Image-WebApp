"""Auth helper unit tests (no database required)."""

from app.security import hash_password, verify_password, create_access_token, decode_access_token


def test_password_hash_roundtrip():
    hashed = hash_password("correct-horse-battery")
    assert hashed != "correct-horse-battery"
    assert verify_password("correct-horse-battery", hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_roundtrip():
    token = create_access_token(user_id=42, user_name="pilot", email="pilot@example.com")
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["user_name"] == "pilot"
    assert payload["email"] == "pilot@example.com"
