"""Admin user management: list/create/patch/delete, roles, feature grants, invite."""

from __future__ import annotations

import logging
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import UniqueViolation

from app.db import get_connection
from app.email_tokens import email_http_error, issue_and_send_invite, issue_and_send_verify
from app.features import (
    load_feature_catalog,
    load_granted_feature_keys,
    sync_user_feature_grants,
)
from app.security import get_current_admin_user_id, hash_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin-users"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
ALLOWED_ROLES = frozenset({"user", "admin", "distributor"})


class FeatureCatalogItem(BaseModel):
    key: str
    label: str
    description: str = ""


class AdminUserItem(BaseModel):
    id: int
    user_name: str
    email: str
    role: str
    is_active: bool
    email_verified: bool
    subscription_status: str
    subscription_type: str
    features: list[str]
    created_at: str | None = None


class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    limit: int
    offset: int


class AdminCreateUserRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_name: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "user"
    feature_keys: list[str] = Field(default_factory=list)

    @field_validator("user_name")
    @classmethod
    def _valid_username(cls, value: str) -> str:
        if not _USERNAME_RE.fullmatch(value):
            raise ValueError(
                "user_name must be 3–32 chars: letters, numbers, underscore only"
            )
        return value

    @field_validator("role")
    @classmethod
    def _valid_role(cls, value: str) -> str:
        role = value.strip().lower()
        if role not in ALLOWED_ROLES:
            raise ValueError("invalid_role")
        return role


class AdminInviteUserRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    user_name: str | None = Field(default=None, min_length=3, max_length=32)
    role: str = "user"
    feature_keys: list[str] = Field(default_factory=list)

    @field_validator("user_name")
    @classmethod
    def _valid_username(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not _USERNAME_RE.fullmatch(value):
            raise ValueError(
                "user_name must be 3–32 chars: letters, numbers, underscore only"
            )
        return value

    @field_validator("role")
    @classmethod
    def _valid_role(cls, value: str) -> str:
        role = value.strip().lower()
        if role not in ALLOWED_ROLES:
            raise ValueError("invalid_role")
        return role


class AdminPatchUserRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    role: str | None = None
    is_active: bool | None = None
    feature_keys: list[str] | None = None
    resend_verification: bool = False

    @field_validator("role")
    @classmethod
    def _valid_role(cls, value: str | None) -> str | None:
        if value is None:
            return None
        role = value.strip().lower()
        if role not in ALLOWED_ROLES:
            raise ValueError("invalid_role")
        return role


def _row_to_item(row: tuple, features: list[str]) -> AdminUserItem:
    created = row[8]
    return AdminUserItem(
        id=int(row[0]),
        user_name=row[1],
        email=row[2],
        role=row[3],
        is_active=bool(row[4]),
        email_verified=bool(row[5]),
        subscription_status=row[6] or "none",
        subscription_type=row[7] or "",
        features=features,
        created_at=created.isoformat() if created is not None else None,
    )


def _count_active_admins(cur) -> int:
    cur.execute(
        """
        SELECT COUNT(*)::int
          FROM users
         WHERE role = 'admin'
           AND is_active = TRUE
        """
    )
    return int(cur.fetchone()[0])


def _load_user_admin_row(cur, user_id: int) -> tuple | None:
    cur.execute(
        """
        SELECT id, user_name, email, role, is_active,
               email_verification_received, subscription_status, subscription_type,
               created_at
          FROM users
         WHERE id = %(id)s
        """,
        {"id": user_id},
    )
    return cur.fetchone()


@router.get("/features", response_model=list[FeatureCatalogItem])
def list_features(_admin_id: int = Depends(get_current_admin_user_id)):
    """Feature catalog for admin grant toggles (DB is source of truth)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                rows = load_feature_catalog(cur)
    except OperationalError as e:
        logger.warning("db error on admin features: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    return [
        FeatureCatalogItem(key=key, label=label, description=desc)
        for key, label, desc in rows
    ]


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    q: str | None = Query(default=None, max_length=80),
    role: str | None = Query(default=None, max_length=20),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _admin_id: int = Depends(get_current_admin_user_id),
):
    where = ["TRUE"]
    params: dict = {"limit": limit, "offset": offset}
    needle = (q or "").strip()
    if needle:
        where.append(
            "(user_name ILIKE %(q)s ESCAPE '\\' OR email ILIKE %(q)s ESCAPE '\\')"
        )
        escaped = (
            needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        params["q"] = f"%{escaped}%"
    if role:
        role_clean = role.strip().lower()
        if role_clean not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail="invalid_role")
        where.append("role = %(role)s")
        params["role"] = role_clean
    if is_active is not None:
        where.append("is_active = %(is_active)s")
        params["is_active"] = is_active

    where_sql = " AND ".join(where)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*)::int FROM users WHERE {where_sql}",
                    params,
                )
                total = int(cur.fetchone()[0])
                cur.execute(
                    f"""
                    SELECT id, user_name, email, role, is_active,
                           email_verification_received, subscription_status,
                           subscription_type, created_at
                      FROM users
                     WHERE {where_sql}
                     ORDER BY created_at DESC, id DESC
                     LIMIT %(limit)s OFFSET %(offset)s
                    """,
                    params,
                )
                rows = cur.fetchall()
                items: list[AdminUserItem] = []
                for row in rows:
                    grants = load_granted_feature_keys(cur, int(row[0]))
                    items.append(_row_to_item(row, grants))
    except OperationalError as e:
        logger.warning("db error on admin list users: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e

    return AdminUserListResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@router.post("/users", response_model=AdminUserItem, status_code=201)
def create_user(
    body: AdminCreateUserRequest,
    admin_id: int = Depends(get_current_admin_user_id),
):
    email = str(body.email).lower()
    password_hash = hash_password(body.password)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (user_name, email, password, role, is_active)
                    VALUES (%(user_name)s, %(email)s, %(password)s, %(role)s, TRUE)
                    RETURNING id, user_name, email, role, is_active,
                              email_verification_received, subscription_status,
                              subscription_type, created_at
                    """,
                    {
                        "user_name": body.user_name,
                        "email": email,
                        "password": password_hash,
                        "role": body.role,
                    },
                )
                row = cur.fetchone()
                user_id = int(row[0])
                try:
                    grants = sync_user_feature_grants(
                        cur,
                        user_id=user_id,
                        feature_keys=body.feature_keys,
                        granted_by=admin_id,
                    )
                except ValueError as e:
                    conn.rollback()
                    raise HTTPException(status_code=400, detail=str(e)) from e
                try:
                    issue_and_send_verify(
                        cur,
                        user_id=user_id,
                        email=email,
                        user_name=body.user_name,
                    )
                except Exception as e:
                    conn.rollback()
                    mapped = email_http_error(e)
                    raise HTTPException(
                        status_code=mapped["status_code"],
                        detail=mapped["detail"],
                    ) from e
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(
            status_code=409, detail="username_or_email_taken"
        ) from e
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on admin create user: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e

    return _row_to_item(row, grants)


@router.post("/users/invite", response_model=AdminUserItem, status_code=201)
def invite_user(
    body: AdminInviteUserRequest,
    admin_id: int = Depends(get_current_admin_user_id),
):
    email = str(body.email).lower()
    local = email.split("@", 1)[0]
    local_clean = re.sub(r"[^a-zA-Z0-9_]", "_", local)[:24] or "player"
    user_name = body.user_name or f"{local_clean}_{secrets.token_hex(2)}"
    if not _USERNAME_RE.fullmatch(user_name):
        user_name = f"player_{secrets.token_hex(4)}"
    password_hash = hash_password(secrets.token_urlsafe(32))

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (user_name, email, password, role, is_active)
                    VALUES (%(user_name)s, %(email)s, %(password)s, %(role)s, TRUE)
                    RETURNING id, user_name, email, role, is_active,
                              email_verification_received, subscription_status,
                              subscription_type, created_at
                    """,
                    {
                        "user_name": user_name,
                        "email": email,
                        "password": password_hash,
                        "role": body.role,
                    },
                )
                row = cur.fetchone()
                user_id = int(row[0])
                try:
                    grants = sync_user_feature_grants(
                        cur,
                        user_id=user_id,
                        feature_keys=body.feature_keys,
                        granted_by=admin_id,
                    )
                except ValueError as e:
                    conn.rollback()
                    raise HTTPException(status_code=400, detail=str(e)) from e
                try:
                    issue_and_send_invite(
                        cur,
                        user_id=user_id,
                        email=email,
                        user_name=user_name,
                    )
                except Exception as e:
                    conn.rollback()
                    mapped = email_http_error(e)
                    raise HTTPException(
                        status_code=mapped["status_code"],
                        detail=mapped["detail"],
                    ) from e
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(
            status_code=409, detail="username_or_email_taken"
        ) from e
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on admin invite: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e

    return _row_to_item(row, grants)


@router.patch("/users/{user_id}", response_model=AdminUserItem)
def patch_user(
    user_id: int,
    body: AdminPatchUserRequest,
    admin_id: int = Depends(get_current_admin_user_id),
):
    if user_id == admin_id:
        if body.is_active is False:
            raise HTTPException(status_code=400, detail="cannot_disable_self")
        if body.role is not None and body.role != "admin":
            raise HTTPException(status_code=400, detail="cannot_demote_self")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _load_user_admin_row(cur, user_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="user_not_found")

                current_role = row[3]
                current_active = bool(row[4])
                new_role = body.role if body.role is not None else current_role
                new_active = (
                    body.is_active if body.is_active is not None else current_active
                )

                losing_admin = current_role == "admin" and current_active and (
                    new_role != "admin" or not new_active
                )
                if losing_admin and _count_active_admins(cur) <= 1:
                    raise HTTPException(
                        status_code=400, detail="cannot_remove_last_admin"
                    )

                cur.execute(
                    """
                    UPDATE users
                       SET role = %(role)s,
                           is_active = %(is_active)s,
                           updated_at = NOW()
                     WHERE id = %(id)s
                    """,
                    {
                        "role": new_role,
                        "is_active": new_active,
                        "id": user_id,
                    },
                )

                grants = load_granted_feature_keys(cur, user_id)
                if body.feature_keys is not None:
                    try:
                        grants = sync_user_feature_grants(
                            cur,
                            user_id=user_id,
                            feature_keys=body.feature_keys,
                            granted_by=admin_id,
                        )
                    except ValueError as e:
                        conn.rollback()
                        raise HTTPException(
                            status_code=400, detail=str(e)
                        ) from e

                if body.resend_verification and not bool(row[5]):
                    try:
                        issue_and_send_verify(
                            cur,
                            user_id=user_id,
                            email=row[2],
                            user_name=row[1],
                        )
                    except Exception as e:
                        conn.rollback()
                        mapped = email_http_error(e)
                        raise HTTPException(
                            status_code=mapped["status_code"],
                            detail=mapped["detail"],
                        ) from e

                row = _load_user_admin_row(cur, user_id)
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on admin patch user: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e

    assert row is not None
    return _row_to_item(row, grants)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    admin_id: int = Depends(get_current_admin_user_id),
):
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="cannot_delete_self")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _load_user_admin_row(cur, user_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="user_not_found")
                if (
                    row[3] == "admin"
                    and bool(row[4])
                    and _count_active_admins(cur) <= 1
                ):
                    raise HTTPException(
                        status_code=400, detail="cannot_remove_last_admin"
                    )
                cur.execute("DELETE FROM users WHERE id = %(id)s", {"id": user_id})
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on admin delete user: %s", e)
        raise HTTPException(status_code=409, detail="user_delete_blocked") from e
