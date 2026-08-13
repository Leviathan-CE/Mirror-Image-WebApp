"""Google login policy unit tests (no live Google / DB required)."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from app.google_oauth import (
    GoogleIdClaims,
    allocate_unique_username,
    link_google_with_password,
    resolve_google_login,
    username_seed_from_email,
)
from app.security import hash_password, verify_password


@dataclass
class FakeDb:
    users: dict[int, dict] = field(default_factory=dict)
    oauth: dict[tuple[str, str], int] = field(default_factory=dict)
    next_id: int = 1
    last_sql: str = ""
    last_params: dict | None = None

    def cursor(self) -> "FakeCursor":
        return FakeCursor(self)


class FakeCursor:
    def __init__(self, db: FakeDb):
        self.db = db
        self._result: list | None = None
        self._row: tuple | None = None

    def execute(self, sql: str, params: dict | None = None):
        self.db.last_sql = " ".join(sql.split())
        self.db.last_params = params or {}
        sql_l = self.db.last_sql.lower()
        p = self.db.last_params

        if "from user_oauth_identities" in sql_l and "select user_id" in sql_l:
            uid = self.db.oauth.get(("google", p["subject"]))
            self._row = (uid,) if uid is not None else None
            return

        if "from users where id" in sql_l:
            user = self.db.users.get(int(p["id"]))
            self._row = _user_tuple(user) if user else None
            return

        if "from users where lower(email)" in sql_l:
            email = p["email"].lower()
            user = next(
                (u for u in self.db.users.values() if u["email"].lower() == email),
                None,
            )
            self._row = _user_tuple(user) if user else None
            return

        if "from users where lower(user_name)" in sql_l:
            name = p["name"].lower()
            taken = any(u["user_name"].lower() == name for u in self.db.users.values())
            self._row = (1,) if taken else None
            return

        if sql_l.startswith("insert into users"):
            uid = self.db.next_id
            self.db.next_id += 1
            user = {
                "id": uid,
                "user_name": p["user_name"],
                "email": p["email"],
                "role": "user",
                "subscription_status": "none",
                "subscription_type": "",
                "is_active": True,
                "email_verified": True,
                "password": None,
            }
            self.db.users[uid] = user
            self._row = _user_tuple(user)
            return

        if sql_l.startswith("update users") and "password = null" in sql_l:
            user = self.db.users[int(p["id"])]
            user["password"] = None
            user["email_verified"] = True
            self._row = None
            return

        if sql_l.startswith("insert into user_oauth_identities"):
            key = (p["provider"], p["subject"])
            if key not in self.db.oauth:
                self.db.oauth[key] = int(p["user_id"])
            self._row = None
            return

        raise AssertionError(f"unhandled SQL in fake cursor: {self.db.last_sql}")

    def fetchone(self):
        return self._row


def _user_tuple(user: dict | None) -> tuple | None:
    if user is None:
        return None
    return (
        user["id"],
        user["user_name"],
        user["email"],
        user["role"],
        user["subscription_status"],
        user["subscription_type"],
        user["is_active"],
        user["email_verified"],
        user["password"],
    )


def _claims(email: str = "you@gmail.com", sub: str = "google-sub-1") -> GoogleIdClaims:
    return GoogleIdClaims(sub=sub, email=email, email_verified=True)


def test_username_seed_sanitizes():
    seed = username_seed_from_email("Cool.Name+tag@gmail.com")
    assert " " not in seed
    assert len(seed) >= 3
    assert len(username_seed_from_email("ab@x.com")) >= 3


def test_create_new_google_user():
    db = FakeDb()
    cur = db.cursor()
    result = resolve_google_login(cur, _claims())
    assert result.outcome == "created"
    assert result.user_id == 1
    assert db.users[1]["password"] is None
    assert db.oauth[("google", "google-sub-1")] == 1


def test_login_existing_oauth_identity():
    db = FakeDb()
    db.users[5] = {
        "id": 5,
        "user_name": "pilot",
        "email": "you@gmail.com",
        "role": "user",
        "subscription_status": "none",
        "subscription_type": "",
        "is_active": True,
        "email_verified": True,
        "password": None,
    }
    db.oauth[("google", "google-sub-1")] = 5
    db.next_id = 6

    result = resolve_google_login(db.cursor(), _claims())
    assert result.outcome == "login"
    assert result.user_id == 5


def test_claim_unverified_password_squatter_wipes_password():
    db = FakeDb()
    db.users[2] = {
        "id": 2,
        "user_name": "squatter",
        "email": "you@gmail.com",
        "role": "user",
        "subscription_status": "none",
        "subscription_type": "",
        "is_active": True,
        "email_verified": False,
        "password": hash_password("attacker-pass"),
    }
    db.next_id = 3

    result = resolve_google_login(db.cursor(), _claims())
    assert result.outcome == "claimed_unverified"
    assert result.user_id == 2
    assert db.users[2]["password"] is None
    assert db.oauth[("google", "google-sub-1")] == 2


def test_verified_password_account_requires_link():
    db = FakeDb()
    db.users[3] = {
        "id": 3,
        "user_name": "real_you",
        "email": "you@gmail.com",
        "role": "user",
        "subscription_status": "none",
        "subscription_type": "",
        "is_active": True,
        "email_verified": True,
        "password": hash_password("your-real-pass"),
    }
    db.next_id = 4

    result = resolve_google_login(db.cursor(), _claims())
    assert result.outcome == "needs_password_link"
    assert ("google", "google-sub-1") not in db.oauth


def test_link_with_password_success():
    db = FakeDb()
    hashed = hash_password("your-real-pass")
    db.users[3] = {
        "id": 3,
        "user_name": "real_you",
        "email": "you@gmail.com",
        "role": "user",
        "subscription_status": "none",
        "subscription_type": "",
        "is_active": True,
        "email_verified": True,
        "password": hashed,
    }

    result = link_google_with_password(
        db.cursor(),
        _claims(),
        password="your-real-pass",
        verify_password=verify_password,
    )
    assert result.outcome == "login"
    assert db.oauth[("google", "google-sub-1")] == 3


def test_link_with_wrong_password_fails():
    db = FakeDb()
    db.users[3] = {
        "id": 3,
        "user_name": "real_you",
        "email": "you@gmail.com",
        "role": "user",
        "subscription_status": "none",
        "subscription_type": "",
        "is_active": True,
        "email_verified": True,
        "password": hash_password("your-real-pass"),
    }

    with pytest.raises(PermissionError, match="invalid_credentials"):
        link_google_with_password(
            db.cursor(),
            _claims(),
            password="wrong",
            verify_password=verify_password,
        )
    assert ("google", "google-sub-1") not in db.oauth


def test_allocate_unique_username_avoids_collision():
    db = FakeDb()
    db.users[1] = {
        "id": 1,
        "user_name": "cool",
        "email": "other@x.com",
        "role": "user",
        "subscription_status": "none",
        "subscription_type": "",
        "is_active": True,
        "email_verified": True,
        "password": None,
    }
    name = allocate_unique_username(db.cursor(), "cool@gmail.com")
    assert name.lower() != "cool"
