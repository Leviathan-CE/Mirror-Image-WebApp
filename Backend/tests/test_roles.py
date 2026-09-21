from app.roles import is_admin_role, is_allowed_role, is_staff_role


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
