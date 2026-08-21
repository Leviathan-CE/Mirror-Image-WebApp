"""Signed image URLs — the publish gate for card art.

No Postgres required except where a fixture asks for it.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.media_urls import (
    MEDIA_WINDOW_SEC,
    media_expiry,
    resolve_media_file,
    sign_media_key,
    signed_media_path,
    storage_key,
    verify_media_signature,
)
from app.routers.media import MEDIA_DIR

ART_PATH = "thumbnails/aeratheas_clamity/hard-light_thumbnail.png"
ART_KEY = "aeratheas_clamity/hard-light_thumbnail.png"


def _parts(signed: str) -> tuple[str, int, str]:
    parsed = urlparse(signed)
    query = parse_qs(parsed.query)
    key = parsed.path.removeprefix("media/")
    return key, int(query["exp"][0]), query["sig"][0]


def test_storage_key_strips_the_mount_prefix() -> None:
    assert storage_key(ART_PATH) == ART_KEY
    assert storage_key("/thumbnails/set/a.png") == "set/a.png"
    assert storage_key("decks/12/deck_cover.png") == "decks/12/deck_cover.png"
    assert storage_key("thumbnails\\set\\a.png") == "set/a.png"


def test_no_path_means_no_url() -> None:
    assert signed_media_path(None) is None
    assert signed_media_path("") is None
    assert signed_media_path("thumbnails/") is None


def test_signed_path_verifies() -> None:
    key, exp, sig = _parts(signed_media_path(ART_PATH) or "")

    assert key == ART_KEY
    assert verify_media_signature(key, exp, sig) is True


def test_signature_is_bound_to_the_key() -> None:
    key, exp, sig = _parts(signed_media_path(ART_PATH) or "")

    assert verify_media_signature("decks/12/deck_cover.png", exp, sig) is False
    assert verify_media_signature(key, exp + 1, sig) is False
    assert verify_media_signature(key, exp, sig[:-1] + "x") is False
    assert verify_media_signature(key, exp, "") is False


def test_signature_expires() -> None:
    exp = media_expiry(1_000_000)
    sig = sign_media_key(ART_KEY, exp)

    assert verify_media_signature(ART_KEY, exp, sig, now=exp - 1) is True
    assert verify_media_signature(ART_KEY, exp, sig, now=exp) is False
    assert verify_media_signature(ART_KEY, exp, sig, now=exp + 60) is False


def test_url_is_stable_inside_a_window() -> None:
    """A stable URL keeps images from refetching on every payload refresh."""
    now = 1_000_000
    first = signed_media_path(ART_PATH, now=now)

    assert signed_media_path(ART_PATH, now=now + 60) == first
    assert signed_media_path(ART_PATH, now=now + 2 * MEDIA_WINDOW_SEC) != first


def test_expiry_always_leaves_at_least_one_window() -> None:
    for offset in range(0, MEDIA_WINDOW_SEC, 137):
        now = 1_000_000 + offset
        assert media_expiry(now) - now > MEDIA_WINDOW_SEC


def test_resolve_rejects_traversal(tmp_path: Path) -> None:
    (tmp_path / "inside.png").write_bytes(b"png")
    outside = tmp_path.parent / "outside.png"
    outside.write_bytes(b"png")

    assert resolve_media_file(tmp_path, "inside.png") is not None
    assert resolve_media_file(tmp_path, "../outside.png") is None
    assert resolve_media_file(tmp_path, "sub/../../outside.png") is None
    assert resolve_media_file(tmp_path, "") is None
    assert resolve_media_file(tmp_path, "missing.png") is None


@pytest.fixture
def probe_image() -> Iterator[Path]:
    """A real file under the media dir, removed afterwards."""
    path = MEDIA_DIR / "pytest_media" / "probe.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\nprobe")
    yield path
    path.unlink(missing_ok=True)
    try:
        path.parent.rmdir()
    except OSError:
        pass


def test_media_route_serves_a_signed_image(
    client: TestClient, probe_image: Path
) -> None:
    signed = signed_media_path("pytest_media/probe.png")
    assert signed is not None

    response = client.get(f"/{signed}")

    assert response.status_code == 200
    assert response.content == probe_image.read_bytes()
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "no-store"


def test_media_route_needs_a_signature(
    client: TestClient, probe_image: Path
) -> None:
    """The old open mount is gone: guessing the path is not enough."""
    assert client.get("/media/pytest_media/probe.png").status_code == 422
    assert (
        client.get("/media/pytest_media/probe.png?exp=99999999999&sig=nope").status_code
        == 404
    )
    assert client.get("/thumbnails/pytest_media/probe.png").status_code == 404


def test_media_route_rejects_an_expired_signature(
    client: TestClient, probe_image: Path
) -> None:
    exp = media_expiry(1_000_000)
    sig = sign_media_key("pytest_media/probe.png", exp)

    response = client.get(f"/media/pytest_media/probe.png?exp={exp}&sig={sig}")

    assert response.status_code == 404


def test_media_route_rejects_traversal(client: TestClient) -> None:
    key = "../../../main.py"
    exp = media_expiry()
    response = client.get(f"/media/{key}?exp={exp}&sig={sign_media_key(key, exp)}")

    assert response.status_code == 404


def test_library_art_is_signed(client: TestClient, require_db: None) -> None:
    """Catalogue payloads must hand out signed URLs, not storage paths."""
    response = client.get("/cards/library?limit=25&offset=0")
    assert response.status_code == 200

    paths = [
        item["card_art_path"]
        for item in response.json()["items"]
        if item.get("card_art_path")
    ]
    if not paths:
        pytest.skip("no published card art in database")

    for path in paths:
        assert path.startswith("media/")
        assert "sig=" in path
        assert "thumbnails/" not in path
