from datetime import date

from app.analytics import fill_activity_points, should_skip_path


def test_fill_week_pads_zeros():
    today = date(2026, 9, 3)
    rows = {date(2026, 9, 3): (2, 10, 1)}
    points = fill_activity_points(rows, range_key="week", today=today)
    assert len(points) == 7
    assert points[0]["label"] == "2026-08-28"
    assert points[-1]["unique_users"] == 2
    assert points[-1]["requests"] == 10
    assert points[0]["unique_users"] == 0


def test_fill_year_is_twelve_months():
    today = date(2026, 9, 3)
    points = fill_activity_points({}, range_key="year", today=today)
    assert [p["label"] for p in points] == [
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
    ]


def test_skip_analytics_path():
    assert should_skip_path("/admin/analytics") is True
    assert should_skip_path("/health") is True
    assert should_skip_path("/decks/1") is False


def test_analytics_requires_admin(client, auth_headers, require_db):
    missing = client.get("/admin/analytics")
    assert missing.status_code == 401

    forbidden = client.get("/admin/analytics", headers=auth_headers)
    assert forbidden.status_code == 403


def test_analytics_ok_for_admin(client, admin_headers, require_db):
    response = client.get("/admin/analytics?range=week", headers=admin_headers)
    if response.status_code == 503:
        return
    assert response.status_code == 200
    body = response.json()
    assert "logged_in" in body
    assert "paid_users" in body
    assert "host" in body
    assert body["activity_range"] == "week"
    assert len(body["activity"]) == 7
