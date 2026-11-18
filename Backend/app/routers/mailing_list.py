"""Public blog mailing-list subscribe / unsubscribe."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedTable

from app.db import get_connection
from app.mailer import EmailNotConfiguredError
from app.mailing_list import (
    send_subscribe_thank_you,
    subscribe_email,
    unsubscribe_by_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mailing-list", tags=["mailing-list"])


class SubscribeBody(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class SubscribeResult(BaseModel):
    subscribed: bool
    already_subscribed: bool = False


class UnsubscribeResult(BaseModel):
    unsubscribed: bool
    kind: str


@router.post("/subscribe", response_model=SubscribeResult)
def subscribe(body: SubscribeBody):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                result = subscribe_email(cur, body.email)
            conn.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UndefinedTable as exc:
        raise HTTPException(
            status_code=503,
            detail="mailing_list_schema_missing",
        ) from exc
    except OperationalError as exc:
        logger.warning("db error on mailing subscribe: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="database_unavailable",
        ) from exc

    if result["created"] and result["raw_token"]:
        try:
            send_subscribe_thank_you(
                to=result["email"],
                raw_token=result["raw_token"],
            )
        except EmailNotConfiguredError as exc:
            raise HTTPException(
                status_code=503,
                detail="email_not_configured",
            ) from exc
        except Exception as exc:
            logger.exception("thank-you email failed")
            raise HTTPException(
                status_code=502,
                detail="email_send_failed",
            ) from exc
        return SubscribeResult(subscribed=True, already_subscribed=False)

    return SubscribeResult(subscribed=True, already_subscribed=True)


@router.get("/unsubscribe", response_model=UnsubscribeResult)
def unsubscribe(token: str = Query(min_length=8, max_length=2048)):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                kind = unsubscribe_by_token(cur, token)
            conn.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UndefinedTable as exc:
        raise HTTPException(
            status_code=503,
            detail="mailing_list_schema_missing",
        ) from exc
    except OperationalError as exc:
        logger.warning("db error on mailing unsubscribe: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="database_unavailable",
        ) from exc
    return UnsubscribeResult(unsubscribed=True, kind=kind)
