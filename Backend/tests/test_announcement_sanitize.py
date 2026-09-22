from app.announcement_sanitize import (
    extract_image_refs,
    parse_image_ref,
    parse_youtube_id,
    sanitize_announcement_markdown,
    sanitize_title,
    slugify_title,
    sniff_image,
)


def test_strips_html_and_script():
    out = sanitize_announcement_markdown(
        "Hello <script>alert(1)</script><b>world</b>"
    )
    assert "<script>" not in out
    assert "alert" in out
    assert "<b>" not in out


def test_strips_code_fences_and_inline():
    out = sanitize_announcement_markdown(
        "Hi ```DROP TABLE users;``` and `rm -rf` done"
    )
    assert "DROP TABLE" not in out
    assert "rm -rf" not in out
    assert "Hi" in out
    assert "done" in out


def test_drops_remote_and_javascript_images():
    out = sanitize_announcement_markdown(
        "![x](https://attacker.example/a.png) ![y](javascript:alert(1)) ![ok](media:12)"
    )
    assert "attacker" not in out
    assert "javascript" not in out
    assert "![ok](media:12)" in out


def test_keeps_card_image_refs():
    out = sanitize_announcement_markdown(
        "![art](card-art:9) ![t](card-thumb:9)"
    )
    assert extract_image_refs(out) == [("card-art", 9), ("card-thumb", 9)]


def test_youtube_ids():
    assert parse_youtube_id("dQw4w9wgXcQ") == "dQw4w9wgXcQ"
    assert (
        parse_youtube_id("https://www.youtube.com/watch?v=dQw4w9wgXcQ")
        == "dQw4w9wgXcQ"
    )
    assert parse_youtube_id("https://youtu.be/dQw4w9wgXcQ") == "dQw4w9wgXcQ"
    assert parse_youtube_id("https://attacker.example/watch?v=dQw4w9wgXcQ") is None
    assert parse_youtube_id("javascript:alert(1)") is None


def test_sniff_rejects_svg_and_empty():
    assert sniff_image(b"") is None
    assert sniff_image(b"<svg xmlns='http://www.w3.org/2000/svg'></svg>") is None
    assert sniff_image(b"\x89PNG\r\n\x1a\nrest") == (".png", "image/png")
    assert sniff_image(b"\xff\xd8\xff\xe0") == (".jpg", "image/jpeg")
    assert sniff_image(b"RIFF....WEBP....") == (".webp", "image/webp")


def test_title_and_slug():
    assert "<" not in sanitize_title("Hi <script>")
    assert slugify_title("Hello, World!") == "hello-world"
    assert parse_image_ref("media:3") == ("media", 3)
    assert parse_image_ref("https://x") is None
