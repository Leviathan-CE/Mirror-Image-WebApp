"""In-memory two-seat playtester rooms (signaling + action relay).

Seat/room state lives in `app.play_rooms_state` so deck reads can pool card
visibility across the players sitting in a room.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.play_rooms_state import (
    PlayRoom,
    RoomSeat,
    Seat,
    code_for_user,
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
            if host_seat and host_seat.user_id == user_id:
                host_seat.deck_id = body.deck_id
                return {
                    "code": room.code,
                    "seat": "p1",
                    "deck_id": body.deck_id,
                }
            # Creating must always seat you as host. A stale guest seat in
            # someone else's room would otherwise hand you p2 and mirror your
            # own table to the opponent row.
            guest_seat = room.seats["p2"]
            if guest_seat and guest_seat.user_id == user_id:
                room.seats["p2"] = None
            forget_user(user_id)
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


@router.websocket("/play/ws/rooms/{code}")
async def room_socket(ws: WebSocket, code: str, token: str | None = None) -> None:
    """JWT via `?token=`. Forwards signaling and compact action/fog payloads."""
    await ws.accept()
    if not token:
        await ws.close(code=4401)
        return
    try:
        user_id = _user_id_from_token(token)
    except HTTPException:
        await ws.close(code=4401)
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
                    await ws.close(code=4409)
                    return
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
            raw = await ws.receive_json()
            if not isinstance(raw, dict):
                continue
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
            if kind in ("signal", "action", "intent", "event", "fog", "snapshot"):
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
            if holder and holder.ws is ws:
                holder.ws = None
                left = True
        if left:
            await _broadcast(room, {"type": "peer-left", "seat": seat})
