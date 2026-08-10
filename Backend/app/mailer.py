"""Real SMTP delivery via stdlib smtplib (no log-link fallback)."""

from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage


class EmailNotConfiguredError(RuntimeError):
    """Raised when required SMTP env vars are missing."""


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def smtp_config() -> dict[str, str | int | bool]:
    """
    Read SMTP settings. Raises EmailNotConfiguredError if incomplete.

    Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM
    Optional: SMTP_USE_TLS (default true), SMTP_USE_SSL (default false)
    """
    host = _env("SMTP_HOST")
    port_raw = _env("SMTP_PORT")
    user = _env("SMTP_USER")
    password = _env("SMTP_PASSWORD")
    mail_from = _env("MAIL_FROM")
    if not all([host, port_raw, user, password, mail_from]):
        raise EmailNotConfiguredError("email_not_configured")
    try:
        port = int(port_raw)
    except ValueError as exc:
        raise EmailNotConfiguredError("email_not_configured") from exc

    use_ssl = _env("SMTP_USE_SSL").lower() in {"1", "true", "yes"}
    use_tls_raw = _env("SMTP_USE_TLS")
    if use_tls_raw == "":
        use_tls = not use_ssl
    else:
        use_tls = use_tls_raw.lower() in {"1", "true", "yes"}

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "mail_from": mail_from,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
    }


def send_email(*, to: str, subject: str, text_body: str, html_body: str) -> None:
    """Send a multipart text/html message. Raises on config or SMTP failure."""
    cfg = smtp_config()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = str(cfg["mail_from"])
    msg["To"] = to
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    host = str(cfg["host"])
    port = int(cfg["port"])
    user = str(cfg["user"])
    password = str(cfg["password"])

    if cfg["use_ssl"]:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
        return

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        if cfg["use_tls"]:
            context = ssl.create_default_context()
            smtp.starttls(context=context)
            smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(msg)
