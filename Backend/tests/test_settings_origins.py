"""Frontend origin allowlist / Stripe return host resolution."""

from __future__ import annotations

import os

import pytest

from app import settings


@pytest.fixture(autouse=True)
def _clean_frontend_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)
    monkeypatch.setenv("APP_ENV", "development")


def test_frontend_url_strips_inline_hash_comment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "FRONTEND_URL", "http://127.0.0.1:3000#https://mirrorimagetcg.net"
    )
    assert settings.frontend_url() == "http://127.0.0.1:3000"


def test_resolve_keeps_browser_localhost_not_127(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FRONTEND_URL", "http://127.0.0.1:3000")
    # Browser was on localhost — must return localhost so JWT localStorage matches.
    assert (
        settings.resolve_frontend_origin("http://localhost:3000")
        == "http://localhost:3000"
    )


def test_resolve_accepts_vite_dev_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FRONTEND_URL", "http://127.0.0.1:3000")
    assert (
        settings.resolve_frontend_origin("http://localhost:5173")
        == "http://localhost:5173"
    )


def test_dev_email_links_use_frontend_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.email_tokens import _app_public_url

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("FRONTEND_URL", "http://127.0.0.1:3000")
    monkeypatch.setenv("APP_PUBLIC_URL", "https://mirrorimagetcg.net")
    assert _app_public_url() == "http://127.0.0.1:3000"


def test_production_email_links_use_public_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.email_tokens import _app_public_url

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("FRONTEND_URL", "http://127.0.0.1:3000")
    monkeypatch.setenv("APP_PUBLIC_URL", "https://mirrorimagetcg.net")
    assert _app_public_url() == "https://mirrorimagetcg.net"
