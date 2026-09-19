"""Role helpers + card-manager gate."""

from app.roles import can_manage_cards, is_admin_role
from app.security import create_access_token


def test_role_helpers():
    assert is_admin_role("admin") is True
    assert is_admin_role("developer") is False
    assert can_manage_cards("admin") is True
    assert can_manage_cards("developer") is True
    assert can_manage_cards("user") is False


def test_developer_can_open_admin_cards_user_cannot(client, require_db):
    dev = create_access_token(
        user_id=1,
        user_name="dev",
        email="dev@example.com",
        role="developer",
    )
    user = create_access_token(
        user_id=2,
        user_name="player",
        email="player@example.com",
        role="user",
    )
    allowed = client.get(
        "/cards/admin/library",
        headers={"Authorization": f"Bearer {dev}"},
    )
    denied = client.get(
        "/cards/admin/library",
        headers={"Authorization": f"Bearer {user}"},
    )
    assert allowed.status_code != 403
    assert denied.status_code == 403
    assert denied.json()["detail"] == "card_manager_required"
