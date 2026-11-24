"""Tags used on public decks with a close stat signature."""

from __future__ import annotations

from dataclasses import dataclass

_COLORS = ("LIF", "MET", "POW", "RAM", "TIM", "STL")
_SKIP_SECTIONS = {
    "pilot",
    "objective/augments",
    "objectives",
    "augments",
}
_NEAREST = 20
_MIN_NEIGHBORS = 3
_DISTANCE_CAP = 6.0
_TAG_LIMIT = 8


@dataclass(frozen=True)
class Signature:
    size: float
    mean_invoke: float
    colors: tuple[float, float, float, float, float, float]
    unit: float
    cyberspell: float
    process: float
    quick_hack: float
    mean_health: float


def counts_in_deck(name: str, in_deck: bool | None) -> bool:
    if name.strip().casefold() in _SKIP_SECTIONS:
        return False
    return in_deck is not False


def signature_distance(left: Signature, right: Signature) -> float:
    total = abs(left.size - right.size) / 10
    total += abs(left.mean_invoke - right.mean_invoke)
    for index in range(len(_COLORS)):
        total += abs(left.colors[index] - right.colors[index])
    total += abs(left.unit - right.unit)
    total += abs(left.cyberspell - right.cyberspell)
    total += abs(left.process - right.process)
    total += abs(left.quick_hack - right.quick_hack)
    total += abs(left.mean_health - right.mean_health)
    return total


def signature_from_cards(cards: list[dict]) -> Signature:
    size = 0
    invoke_sum = 0.0
    invoke_count = 0
    solids = [0, 0, 0, 0, 0, 0]
    hybrid = 0
    unit = 0
    cyberspell = 0
    process = 0
    quick_hack = 0
    health_sum = 0.0
    health_count = 0
    for card in cards:
        quantity = int(card.get("quantity") or 0)
        if quantity <= 0:
            continue
        size += quantity
        if card.get("has_invoke_cost") is not False:
            invoke_sum += int(card.get("invoke_cost") or 0) * quantity
            invoke_count += quantity
        _add_pips(card.get("cost"), quantity, solids)
        hybrid += _hybrid_count(card.get("cost")) * quantity
        supers = card.get("super_types") or []
        subs = card.get("sub_types") or []
        if _has_type(supers, "unit"):
            unit += quantity
        if _has_type(supers, "cyberspell"):
            cyberspell += quantity
        if _has_type(subs, "process"):
            process += quantity
        if _has_type(subs, "quick hack"):
            quick_hack += quantity
        if card.get("has_tlv") is True:
            health = _health(card.get("threat_level"))
            if health is not None:
                health_sum += health * quantity
                health_count += quantity
    pip_total = sum(solids) + hybrid
    if size <= 0:
        return Signature(0, 0, (0, 0, 0, 0, 0, 0), 0, 0, 0, 0, 0)
    colors = _color_shares(solids, pip_total)
    mean_invoke = invoke_sum / invoke_count if invoke_count else 0
    mean_health = health_sum / health_count if health_count else 0
    return Signature(
        float(size),
        mean_invoke,
        colors,
        unit / size,
        cyberspell / size,
        process / size,
        quick_hack / size,
        mean_health,
    )


def rank_similar_tags(
    source: Signature,
    neighbors: list[tuple[Signature, list[str]]],
    own_tags: list[str],
) -> dict:
    own = {tag.strip().casefold() for tag in own_tags if tag.strip()}
    scored: list[tuple[float, list[str]]] = []
    for signature, tags in neighbors:
        if not tags:
            continue
        distance = signature_distance(source, signature)
        if distance > _DISTANCE_CAP:
            continue
        scored.append((distance, tags))
    scored.sort(key=lambda row: row[0])
    kept = scored[:_NEAREST]
    if len(kept) < _MIN_NEIGHBORS:
        return {"tags": [], "compared": len(kept)}
    counts: dict[str, int] = {}
    for _distance, tags in kept:
        seen: set[str] = set()
        for tag in tags:
            key = tag.strip().casefold()
            if not key or key in own or key in seen:
                continue
            seen.add(key)
            counts[tag] = counts.get(tag, 0) + 1
    ranked = sorted(
        counts.items(),
        key=lambda item: (-item[1], item[0].casefold()),
    )
    top = ranked[:_TAG_LIMIT]
    return {
        "tags": [{"tag": tag, "decks": count} for tag, count in top],
        "compared": len(kept),
    }


def similar_tags_for_deck(cur, deck_id: int) -> dict:
    cur.execute(
        """
        SELECT
            uhd.deck_id,
            uhd.is_public,
            dc.name,
            dc.in_deck,
            dhc.quantity,
            c.invoke_cost,
            c.has_invoke_cost,
            c.cost,
            c.super_types,
            c.sub_types,
            c.threat_level,
            c.has_tlv
        FROM user_has_decks uhd
        JOIN deck_has_cards dhc ON dhc.deck_id = uhd.deck_id
        JOIN deck_categories dc ON dc.id = dhc.category_id
        JOIN cards c ON c.id = dhc.card_id
        WHERE uhd.is_public = TRUE
           OR uhd.deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    grouped: dict[int, list[dict]] = {}
    public_ids: set[int] = set()
    for row in cur.fetchall():
        deck_key = int(row[0])
        if not counts_in_deck(str(row[2] or ""), row[3]):
            continue
        if bool(row[1]) and deck_key != deck_id:
            public_ids.add(deck_key)
        grouped.setdefault(deck_key, []).append(
            {
                "quantity": int(row[4] or 0),
                "invoke_cost": int(row[5] or 0),
                "has_invoke_cost": bool(row[6]),
                "cost": list(row[7] or []),
                "super_types": list(row[8] or []),
                "sub_types": list(row[9] or []),
                "threat_level": str(
                    row[10] if row[10] is not None else ""
                ),
                "has_tlv": bool(row[11]),
            }
        )
    cur.execute(
        """
        SELECT dt.deck_id, dt.tag
          FROM deck_tags dt
          JOIN user_has_decks uhd ON uhd.deck_id = dt.deck_id
         WHERE uhd.is_public = TRUE
           AND uhd.deck_id <> %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    tags_by_deck: dict[int, list[str]] = {}
    for deck_key, tag in cur.fetchall():
        tags_by_deck.setdefault(int(deck_key), []).append(str(tag))
    cur.execute(
        """
        SELECT tag FROM deck_tags WHERE deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    own_tags = [str(row[0]) for row in cur.fetchall()]
    source = signature_from_cards(grouped.get(deck_id, []))
    neighbors: list[tuple[Signature, list[str]]] = []
    for neighbor_id in public_ids:
        neighbors.append(
            (
                signature_from_cards(grouped.get(neighbor_id, [])),
                tags_by_deck.get(neighbor_id, []),
            )
        )
    return rank_similar_tags(source, neighbors, own_tags)


def _color_shares(
    solids: list[int], pip_total: int
) -> tuple[float, float, float, float, float, float]:
    shares: list[float] = []
    for count in solids:
        if pip_total == 0:
            shares.append(0.0)
            continue
        shares.append(count / pip_total)
    return (
        shares[0],
        shares[1],
        shares[2],
        shares[3],
        shares[4],
        shares[5],
    )


def _has_type(values, name: str) -> bool:
    needle = name.casefold()
    for raw in values:
        if str(raw).strip().casefold() == needle:
            return True
    return False


def _tokens(cost) -> list[str]:
    if not cost:
        return []
    if isinstance(cost, list):
        return [str(token).strip().upper() for token in cost]
    return [str(cost).strip().upper()]


def _is_numbered_generic(token: str) -> bool:
    if token in {"GEN", "GENX"}:
        return False
    if not token.startswith("GEN"):
        return False
    return token[3:].isdigit()


def _add_pips(cost, quantity: int, solids: list[int]) -> None:
    for token in _tokens(cost):
        if _is_numbered_generic(token) or "-" in token:
            continue
        if token == "GEN":
            solids[5] += quantity
            continue
        if token not in _COLORS:
            continue
        solids[_COLORS.index(token)] += quantity


def _hybrid_count(cost) -> int:
    total = 0
    for token in _tokens(cost):
        if "-" not in token:
            continue
        parts = []
        for part in token.split("-"):
            if part in _COLORS and part not in parts:
                parts.append(part)
        if len(parts) == 2:
            total += 1
    return total


def _health(raw) -> float | None:
    text = str(raw or "").strip()
    if text == "":
        return None
    if "|" in text:
        text = text.split("|", 1)[1]
    try:
        return float(text)
    except ValueError:
        return None
