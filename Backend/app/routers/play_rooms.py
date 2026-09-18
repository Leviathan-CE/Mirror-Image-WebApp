"""In-memory two-seat playtester rooms (signaling + action relay).

Seat/room state lives in `app.play_rooms_state` so deck reads can pool card
visibility across the players sitting in a room.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.play_room_limits import (
    WS_AUTH_TIMEOUT_S,
    WS_MAX_BYTES,
    allow_room_get,
    allow_snapshot,
    allow_ws_connect,
    allow_ws_handshake,
)
from app.play_rooms_state import (
    PlayRoom,
    RoomSeat,
    Seat,
    code_for_user,
    drop_room_if_empty,
    forget_user,
    live_room,
    lock,
    new_code,
    register_room,
    remember_user,
    room_for_user,
)
from app.security import decode_access_token, get_current_user_id

router = APIRouter(tags=["play_rooms"])


class CreateRoomBody(BaseModel):
    deck_id: int = Field(gt=0)


def _user_id_from_token(token: str) -> int:
    payload = decode_access_token(token)
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token_subject",
        ) from e


@router.post("/play/rooms")
async def create_room(
    body: CreateRoomBody,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    async with lock:
        room = room_for_user(user_id)
        if room is not None:
            host_seat = room.seats["p1"]
            # Only reuse the room if you are still the live host socket.
            # After Leave, ws is None but the seat used to linger — that made
            # "Create room" return the dead code and the next WS look lost.
            if (
                host_seat
                and host_seat.user_id == user_id
                and host_seat.ws is not None
            ):
                host_seat.deck_id = body.deck_id
                return {
                    "code": room.code,
                    "seat": "p1",
                    "deck_id": body.deck_id,
                }
            # Stale host / guest seat after disconnect — free it and mint new.
            for seat_name, holder in list(room.seats.items()):
                if holder is not None and holder.user_id == user_id:
                    room.seats[seat_name] = None
            forget_user(user_id)
            drop_room_if_empty(room)
        code = new_code()
        room = PlayRoom(code=code, host_user_id=user_id, created_at=time.time())
        room.seats["p1"] = RoomSeat(user_id=user_id, deck_id=body.deck_id)
        register_room(room)
        remember_user(user_id, code)
        return {"code": code, "seat": "p1", "deck_id": body.deck_id}


@router.get("/play/rooms/{code}")
async def get_room(
    code: str,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    # Count misses too — probing unknown codes must not be free.
    if not allow_room_get(user_id):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limited")
    async with lock:
        room = live_room(code)
        if not room:
            raise HTTPException(status_code=404, detail="room_not_found")
        return {
            "code": room.code,
            "host_user_id": room.host_user_id,
            "seats": {
                seat: (
                    None
                    if holder is None
                    else {"user_id": holder.user_id, "deck_id": holder.deck_id}
                )
                for seat, holder in room.seats.items()
            },
            "you": user_id,
        }


async def _broadcast(room: PlayRoom, message: dict[str, Any], skip: WebSocket | None = None) -> None:
    for holder in room.seats.values():
        if holder is None or holder.ws is None or holder.ws is skip:
            continue
        try:
            await holder.ws.send_json(message)
        except Exception:
            holder.ws = None


async def _receive_capped(ws: WebSocket) -> dict[str, Any]:
    """JSON object, or disconnect. Drops frames larger than ``WS_MAX_BYTES``."""
    message = await ws.receive()
    kind = message.get("type")
    if kind == "websocket.disconnect":
        raise WebSocketDisconnect(message.get("code") or 1000)
    if kind != "websocket.receive":
        raise WebSocketDisconnect(1003)
    text = message.get("text")
    if text is None:
        raw = message.get("bytes") or b""
        if len(raw) > WS_MAX_BYTES:
            await ws.close(code=4408)
            raise WebSocketDisconnect(4408)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise WebSocketDisconnect(1003) from exc
        if not isinstance(parsed, dict):
            raise WebSocketDisconnect(1003)
        return parsed
    if len(text.encode("utf-8")) > WS_MAX_BYTES:
        await ws.close(code=4408)
        raise WebSocketDisconnect(4408)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise WebSocketDisconnect(1003) from exc
    if not isinstance(parsed, dict):
        raise WebSocketDisconnect(1003)
    return parsed


async def _auth_first_frame(ws: WebSocket) -> int | None:
    """JWT in the first JSON frame — never on the URL (query strings hit logs)."""
    try:
        first = await asyncio.wait_for(
            _receive_capped(ws),
            timeout=WS_AUTH_TIMEOUT_S,
        )
    except TimeoutError:
        await ws.close(code=4401)
        return None
    except WebSocketDisconnect:
        return None
    if first.get("type") != "auth":
        await ws.close(code=4401)
        return None
    token = first.get("token")
    if not isinstance(token, str) or not token:
        await ws.close(code=4401)
        return None
    try:
        return _user_id_from_token(token)
    except HTTPException:
        await ws.close(code=4401)
        return None


@router.websocket("/play/ws/rooms/{code}")
async def room_socket(ws: WebSocket, code: str) -> None:
    """First frame ``{type, token}`` then relay. Query-string JWT is rejected."""
    await ws.accept()
    ip = ws.client.host if ws.client else "unknown"
    if not allow_ws_handshake(ip):
        await ws.close(code=4429)
        return
    user_id = await _auth_first_frame(ws)
    if user_id is None:
        return
    if not allow_ws_connect(user_id):
        await ws.close(code=4429)
        return

    code = code.upper()
    async with lock:
        room = live_room(code)
        if not room:
            await ws.close(code=4404)
            return

        seat: Seat | None = None
        # Host is always p1 — never infer seat only from "user already in room",
        # or a creator who once joined as guest keeps rendering on the far side.
        if room.host_user_id == user_id:
            holder = room.seats["p1"]
            if holder is None:
                holder = RoomSeat(user_id=user_id)
                room.seats["p1"] = holder
            holder.user_id = user_id
            holder.ws = ws
            seat = "p1"
            guest = room.seats["p2"]
            if guest is not None and guest.user_id == user_id:
                room.seats["p2"] = None
        else:
            holder = room.seats["p2"]
            if holder is not None and holder.user_id == user_id:
                holder.ws = ws
                seat = "p2"
            elif holder is None:
                old = code_for_user(user_id)
                if old and old != code:
                    stale = live_room(old)
                    # Block only if still live-connected elsewhere. A Leave
                    # that only cleared ws used to leave the map pointing at
                    # the old code and 4409'd every new join/create socket.
                    still_live = False
                    if stale is not None:
                        for other_holder in stale.occupied_seats():
                            if (
                                other_holder.user_id == user_id
                                and other_holder.ws is not None
                            ):
                                still_live = True
                                break
                    if still_live:
                        await ws.close(code=4409)
                        return
                    forget_user(user_id)
                room.seats["p2"] = RoomSeat(user_id=user_id)
                room.seats["p2"].ws = ws
                seat = "p2"
            else:
                await ws.close(code=4403)
                return
        remember_user(user_id, code)

    other: Seat = "p2" if seat == "p1" else "p1"
    peer = room.seats.get(other)
    await ws.send_json(
        {
            "type": "welcome",
            "code": code,
            "seat": seat,
            "host": room.host_user_id == user_id,
            "peer": (
                None
                if peer is None
                else {
                    "seat": other,
                    "deckId": peer.deck_id,
                    "connected": peer.ws is not None,
                    "user_id": peer.user_id,
                }
            ),
        }
    )
    await _broadcast(
        room,
        {"type": "peer-joined", "seat": seat, "user_id": user_id},
        skip=ws,
    )

    try:
        while True:
            raw = await _receive_capped(ws)
            kind = raw.get("type")
            if kind == "join":
                deck_id = raw.get("deckId") or raw.get("deck_id")
                async with lock:
                    holder = room.seats.get(seat)  # type: ignore[arg-type]
                    if holder:
                        holder.deck_id = int(deck_id) if deck_id else holder.deck_id
                await _broadcast(
                    room,
                    {
                        "type": "seat-deck",
                        "seat": seat,
                        "deckId": deck_id,
                    },
                    skip=ws,
                )
                continue
            if kind == "snapshot":
                if not allow_snapshot(code, str(seat)):
                    continue
                payload = {**raw, "fromSeat": seat}
                await _broadcast(room, payload, skip=ws)
                continue
            if kind in (
                "signal",
                "action",
                "intent",
                "event",
                "fog",
                "hover",
                "browse",
                "fx",
                "selection",
            ):
                payload = {**raw, "fromSeat": seat}
                await _broadcast(room, payload, skip=ws)
                continue
    except WebSocketDisconnect:
        pass
    finally:
        left = False
        async with lock:
            holder = room.seats.get(seat) if seat else None  # type: ignore[arg-type]
            # Only announce leave if this socket is still the seat's live link.
            # A reconnect replaces `holder.ws`; the old socket must not broadcast
            # peer-left or the other seat thinks you disconnected.
            # Keep the seat + user→room map so Reconnect can reclaim; Create
            # room only reuses when `ws is not None` (see create_room).
            if holder and holder.ws is ws:
                holder.ws = None
                left = True
        if left:
            await _broadcast(room, {"type": "peer-left", "seat": seat})
