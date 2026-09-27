from app.roles import (
    ROLE_PLAYTESTER,
    is_admin_role,
    is_allowed_role,
    is_playtester_role,
    is_staff_role,
)


def test_developer_is_staff_not_admin():
    assert is_staff_role("developer") is True
    assert is_admin_role("developer") is False
    assert is_allowed_role("developer") is True


def test_admin_is_staff_and_admin():
    assert is_staff_role("admin") is True
    assert is_admin_role("admin") is True


def test_plain_user_is_neither():
    assert is_staff_role("user") is False
    assert is_admin_role("user") is False


def test_playtester_is_allowed_and_not_staff():
    assert is_playtester_role(ROLE_PLAYTESTER) is True
    assert is_playtester_role("user") is False
    assert is_playtester_role("play") is False
    assert is_playtester_role(None) is False
    assert is_staff_role(ROLE_PLAYTESTER) is False
    assert is_admin_role(ROLE_PLAYTESTER) is False
    assert is_allowed_role(ROLE_PLAYTESTER) is True
