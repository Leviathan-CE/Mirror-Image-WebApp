# MIRROR IMAGE — Objective VP Mode

Play using [Rules.md](Rules.md) except as stated here.

This mode replaces life / empty-deck / starve wins with victory points (VP) scored from shared **objectives**. The only way to win is by VP. It does not reprint The Lock, pips, types, or keywords.

---

## MP100. Setup

MP100.1. This mode is for 2–4 players.

MP100.2. Place shared **objectives** in the center of the table, not in any player's battlefield.

> MP100.2.1. If there are **2** players, place **2** objectives.
>
> MP100.2.2. If there are **3 or more** players, place **H = max(3, number of players − 1)** objectives (3 players → 3; 4 players → 3).

MP100.3. Each player uses a normal commander deck and pilot as in `Rules.md`.

MP100.4. Each player starts at **0 VP**. Your **victory number** is the VP printed on your pilot.

---

## MP200. Occupancy

MP200.1. An objective is empty, or occupied by **any number of non-pilot units** (a stack). Units of more than one player may occupy the same objective (that objective is **contested**).

MP200.2. The pilot cannot occupy an objective.

MP200.3. Programs, technologies, and resources cannot occupy an objective unless they are also a unit.

MP200.4. If a unit leaves play, is retreated, or is otherwise moved off an objective, it leaves that objective. Other occupants stay. Last-touch does **not** keep control.

MP200.5. You **control** an objective if you have at least one occupying unit there and no opponent does. Contested and empty objectives are not controlled.

---

## MP250. Enter play

MP250.1. When a unit enters the battlefield, it enters **expended**, unless it has Blitz, in which case it enters **readied**. This replaces the controller's readied/expended choice in `300.2.2` and `300.2.7.7`.

MP250.2. A unit still cannot attack during the turn it entered the battlefield unless it has Blitz (see rule `800.3.3`).

---

## MP260. Start of turn

MP260.1. After `400.2.2.1` (ready all entities you control), apply MP260.2 then MP265.

MP260.2. **Heal.** Remove **1** marked damage (not below 0) from each unit you control on the **battlefield**, and from your **pilot** (the pilot is a unit).

> MP260.2.1. Units occupying an objective are not on the battlefield for this step and do not heal.
>
> MP260.2.2. Opponent units do not heal on your turn.

MP265. **Hold VP.** Gain **1 VP** for each objective you control. Then check win (see MP600). Contested and empty objectives score 0.

---

## MP300. Moving onto an objective

MP300.1. During your main phase, as a default game action: choose an objective and a unit you control on the battlefield that is not waiting on a time counter. Move that unit onto the objective as an occupant.

MP300.2. **Empty objective** (no occupying units): do **not** expend the unit. It keeps its current readied or expended state.

MP300.3. **Friendly only** (your occupying units, no opponent): do **not** expend (you are not moving on to fight).

MP300.4. **Moving to fight** (at least one opponent occupying unit): **expend** that unit as it joins the stack. If it was already expended, it stays expended.

MP300.5. If this move causes you to **gain control** of the objective, apply MP500.2 (conquer).

---

## MP400. Combat on an objective

MP400.1. Attacks are declared **at an objective**. Combat uses `Rules.md` (expend attackers, intercept, Preemptive Strike, hit back, Durable) except as overridden here (`603.3`, `601.2`, `601.5`).

> MP400.1.1. Attacking units that are not already occupying that objective move onto it **expended** as they attack (this is moving to fight; see MP300.4). Units already occupying it still expend to attack as in `603.2`.

MP400.2. You cannot declare an attack against a unit that is not occupying an objective.

MP400.3. The attack target must be an occupying unit the defending player controls **on that objective**.

> MP400.3.1. If that player has a **readied** occupying unit on that objective, you must target a readied occupying unit if able (see rules `601.2` and `603.3`).
>
> MP400.3.2. If they have **no** readied occupying unit on that objective, you may target an **expended** occupying unit on that objective. This is the exception to “if none, you cannot attack.”

MP400.4. **Retreat** (`601.5`) in this mode:

> MP400.4.1. Only a **readied occupying** unit may retreat. Units not on an objective cannot retreat. Expended occupants cannot retreat.
>
> MP400.4.2. A unit that moved onto an empty objective without expending may still be readied, so it can retreat. A unit that moved on to fight is expended and cannot retreat until it readies.
>
> MP400.4.3. To retreat: that unit leaves the objective, returns to the battlefield **expended**, and takes the 1 retreat damage. The attack is negated (no combat damage). Other occupants stay.

MP400.5. After the attack resolves:

> MP400.5.1. If the defending unit **and** at least one attacking unit both survived, the attacking units **return to their controller's battlefield expended**. They leave the objective. Other occupying units stay.
>
> MP400.5.2. If the defending unit did not survive, every occupying unit that is still in play **stays on that objective**, including surviving attackers (they remain expended).

MP400.6. If combat or retreat causes a player to **gain control** of the objective, apply MP500.2 (conquer).

---

## MP500. Scoring

MP500.1. Control is defined in MP200.5.

MP500.2. **Conquer.** When you **gain control** of an objective (you did not control it, and now you do), you immediately gain **1 VP**, then check win (see MP600).

> MP500.2.1. Typical cases: you occupy an empty objective; the last opponent occupant leaves or is defeated while you still occupy it.
>
> MP500.2.2. Walking onto a contested objective does not conquer until you are the sole occupying player.
>
> MP500.2.3. Reinforcing an objective you already control is not a conquer.

MP500.3. **Hold.** At the start of your turn (MP265), gain 1 VP per objective you control.

MP500.4. There is **no** end-of-turn VP.

---

## MP600. Winning

MP600.1. The only way to win is by VP (see MP600.2). This mode replaces `100.4`, `100.5`, and starve-loss (`400.2.2.4`). Life, empty-deck draws, and 0 stockpile do **not** win or eliminate a player. Combat damage and defeat still apply to units as in `Rules.md`.

MP600.2. Whenever you gain VP, if your VP is greater than or equal to the **victory number printed on your pilot**, you win immediately.

MP600.3. Different pilots can have different victory numbers. Conquer can win mid-turn. Hold VP is only on your start of turn.

---

## MP700. Table and combat pairing

MP700.1. Turn order is clockwise from the first player.

MP700.2. Combat is still pairwise: the attacker versus the defending occupant's controller. Other players occupying the same objective are not in that combat unless a card targets them.
