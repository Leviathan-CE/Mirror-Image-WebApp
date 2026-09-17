# MIRROR IMAGE — Comprehensive Rules

---

## 100. General

100.1. These rules govern play of *Mirror Image*. If a card's text conflicts with these rules, follow the card.

100.2. Each non-resource card is an **Asset** with base type **Entity** or **Cyberspell**. If a card does not list Cyberspell as a supertype, its base type is Entity.

100.3. Whenever card text uses the word "this," it refers to the card that printed that text.

100.4. The only way to win is by **victory points (VP)**. Whenever you gain VP, if your VP is greater than or equal to the **victory number printed on your pilot**, you win immediately (see rules 250.7 and 400.2.2.3).

> 100.4.1. Life, drawing from an empty deck, and beginning a turn with 0 resources in your stockpile do **not** win or eliminate a player. Combat damage and defeat still apply to units.
>
> 100.4.2. Different pilots can have different victory numbers. Conquer can win mid-turn. Hold VP is only on your start of turn.
>
> 100.4.3. There is **no** end-of-turn VP.

100.5. The primary way to score is controlling **objectives**: Conquer when you gain control of one, and Hold at the start of your turn (see section 250).

100.6. **`[TLV]` (Threat Level).** Only cards with the Unit supertype have a `[TLV]` on the card.

> 100.6.1. **Split format `[dmg|hp]`.** When printed as two numbers separated by a vertical bar (for example, `3|2`), the first number is the unit's **damage value** and the second is its **health value**.
>
> 100.6.2. **Combined format `[dmg+hp]`.** When printed as a single number (for example, `3`), that number is both the unit's damage value and its health value.
>
> 100.6.3. In these rules, a unit's **damage value** is the damage it deals in combat; its **health value** is how much marked damage it can take before it is defeated. Effects that modify `[TLV]` modify the corresponding value unless stated otherwise.

### 100.7. Multiple supertypes and subtypes

100.7. A card may have multiple supertypes and subtypes. It has all applicable rules from each type printed on it.

> 100.7.1. If two type rules conflict, the more permissive rule applies unless card text says otherwise (see rule 100.1).
>
> 100.7.2. **Attack.** If the card has the Unit supertype, it may attack even if another of its types says it cannot attack.
>
> 100.7.3. **Objectives.** Attacks are declared at **objectives**, not at a player or a chosen unit (see section 603). There is no attack target.

### 100.8. Targeting

> 100.8.1. Some effects use the word "target." Those effects require one or more legal targets to be chosen.
>
> 100.8.2. A target is legal only if it meets **every** restriction printed on that effect (type, controller, zone, game state, and so on).
>
> 100.8.3. If an effect names a supertype or subtype (for example, "Technology"), the target must have that type. A card with multiple types has all of them (see rule 100.7).
>
> 100.8.4. If an effect uses an exclusion (for example, "non-Unit"), the target is illegal if it has the excluded supertype or subtype, even if it also satisfies a required type.
>
> 100.8.5. You cannot choose an illegal target. If a card or ability requires targets and no legal targets exist, you cannot play that card or activate that ability.
>
> 100.8.6. Declare targets when the effect enters the lock or a queue (see rules 500.4 and 800.2.3).
>
> 100.8.7. If every target of a targeted effect is illegal when that effect resolves, the effect does nothing to those targets.
>
> 100.8.8. Keywords and other rules may further restrict or modify targeting and what can happen to a chosen target (see section 800.3).
>
> 100.8.9. Attacks are declared at objectives. Who takes combat damage is decided in the damage step, not by choosing an attack target (see section 603).
>
> 100.8.10. If an effect does not specify a zone, only cards and objects on the battlefield may be chosen (see rule 200.3). Units on an objective are not on the battlefield. To target a card in the stockpile, hand, discard pile, dismantle pile, pilot zone, on an objective, or another zone, the effect must say so.

---

## 200. Zones

200.1. **Pilot zone** — Holds your pilot. You may play your pilot from here by paying its invoke cost. When your pilot is defeated or would change zones, you may return it here and increase its cost by `[GEN2]` for the rest of the game.

200.2. **Deck** — Your face-down shuffled deck of entity and cyberspell cards.

200.3. **Battlefield** — Where played entities go unless time counters were used (see rule 700.4). Units on an objective are not on the battlefield (see rule 200.11).

200.4. **Stockpile** — Where readied resources are stored and where time-counter cards wait. **Expend** a resource (turn it 90° horizontal) to add its color to your resource pool.

200.5. **In play** — Battlefield and stockpile together. Effects on "in play" affect both unless specified.

200.6. **Discard pile** — Where defeated units, resolved cyberspells, and trashed cards go.

200.7. **Dismantle pile** — Removed-from-game pile. Cards in the dismantle pile are always face up. When you would gain a resource token, you may take one from the dismantle pile instead.

200.8. **Resource pool** — Imaginary zone where expended resources go until end of turn; spend pool resources to pay invoke costs.

200.9. **Lock** — Holds at most one card or effect before it resolves (see section 700).

200.10. **Queue** — Holds overflow effects while the lock is full (see rule 700.3).

200.11. **Objective** — Shared zone in the center of the table, not part of any player's battlefield. Units on an objective are not on the battlefield. You still control those units. They ready as entities you control (see rule 400.2.2.1).

---

## 250. Objectives

250.1. This game is for **2–4 players**. Shared objectives are placed during setup (see rule 400.1.6).

250.2. An objective is empty, or has **any number of units** on it (a stack). Units of more than one player may be on the same objective.

250.3. The **pilot is a unit**. It may be on an objective and counts toward controlling that objective.

250.4. Programs, technologies, and resources cannot be on an objective unless they are also a unit.

250.5. If a unit leaves play, is retreated, or is otherwise moved off an objective, it leaves that objective. Other units on that objective stay. Last-touch does **not** keep control.

250.6. You **control** an objective if you have at least one unit on it and no opponent does. Otherwise you do not control it.

### 250.7. Scoring

250.7.1. **Conquer.** When you **gain control** of an objective (you did not control it, and now you do), you immediately gain **1 VP**, then check win (see rule 100.4).

> 250.7.1.1. Typical cases: you move onto an empty objective; the last opponent unit on it leaves or is defeated while you still have a unit on it.
>
> 250.7.1.2. Walking onto an objective another player controls does not conquer until you are the only player with a unit on it.
>
> 250.7.1.3. Reinforcing an objective you already control is not a conquer.
>
> 250.7.1.4. If you move a unit off an objective you control and it becomes empty, moving a unit back onto that same empty objective is **not** a conquer. You do not gain VP. This applies even if it is a different unit, and even if you wait before returning. It stops applying once another player has controlled that objective.

250.7.2. **Hold.** At the start of your turn (see rule 400.2.2.3), gain 1 VP per objective you control. Then check win (see rule 100.4). Objectives you do not control score 0.

---

## 300. Card Types

### 300.1. Base types

> 300.1.1. **Cyberspell** — After resolving (or being overwritten), goes to the discard pile.
>
> 300.1.2. **Entity** — After resolving, goes to the battlefield unless played with time counters (then stockpile). If overwritten, goes to the discard pile.
>
> 300.1.3. Playing any entity or cyberspell card puts it in the lock unless time counters replace that step (see rules 500 and 700.4). Tokens are not played this way (see rule 300.2.7).
>
> 300.1.4. A card may list more than one supertype or subtype. When type rules overlap or conflict, apply rule 100.7.

### 300.2. Supertypes

> 300.2.1. **Pilot [Entity]** — Starts in the pilot zone; a unit you may play from there. The pilot may be on an objective and counts toward controlling it (see rule 250.3).
>
> 300.2.2. **Unit [Entity]** — Call-in combatants (see rule 100.6). After resolving, enter the battlefield unless time was used (see rule 700.4). When a unit you control enters the battlefield, it enters **readied**.
>
> 300.2.2.1. **Summoning sick.** A unit cannot attack during the turn it entered the battlefield unless it has Blitz (see rule 800.3.3). Moving onto an opponent-controlled objective is an attack (see rule 606.4), so a summoning-sick unit cannot do that.
>
> 300.2.2.2. A summoning-sick unit **may** move onto an objective you **control** (see rule 606.3). It cannot move onto an empty objective (empty is not friendly).
>
> 300.2.2.3. If a unit enters the battlefield because the last time counter was removed from it (see rule 700.4.4), it enters **as though it has Blitz**. Apply rules 300.2.2 and 300.2.2.1 as if it had Blitz (it enters readied and may attack this turn). It does not gain the Blitz keyword for other effects.
>
> 300.2.3. **Program [Entity]** — Stays in play; cannot attack.
>
> 300.2.4. **Technology [Entity]** — Support or counter-play; cannot attack.
>
> 300.2.5. **Prototype [Any]** — Limited to one copy per deck.
>
> 300.2.6. **Resource [Entity]** — Tokens gained readied into stockpile; usable immediately.
>
> 300.2.7. **Token [Entity]** — Usually created by an effect, not played from hand or other zones.
>
> 300.2.7.1. Tokens do not go to the discard pile when defeated or trashed.
>
> 300.2.7.2. You may use your own objects as tokens if it is clear which token they represent and whether they are expended.
>
> 300.2.7.3. You cannot use non-token MIRROR IMAGE cards as tokens.
>
> 300.2.7.4. When an effect creates a token, that creation may enter the lock if it is empty, or its controller's queue if the lock is full (see section 700).
>
> 300.2.7.5. The token is not created until the creating effect resolves.
>
> 300.2.7.6. When a resource token is created, put it into the stockpile readied (see rule 300.2.6).
>
> 300.2.7.7. When any other token is created, put it onto the battlefield. If it is a unit, it enters readied (see rule 300.2.2); otherwise it enters readied.

### 300.3. Subtypes

> 300.3.1. **Process [Cyberspell]** — Playable during your main phase while the lock is empty. Cannot attack. See rule 500.8 for full timing.
>
> 300.3.2. **Quick Hack [Cyberspell]** — Playable whenever a Process can be played, plus at end of turn, during an attack, while the lock holds a card, or when an opponent's effect empties the lock. Cannot attack. See rule 500.8 for full timing.

---

## 350. Resource Pips and Invoke Costs

350.1. A card's **invoke cost** is the row of symbols in its upper-left corner. Each symbol in an invoke cost is a **resource pip** (or **pip**).

350.2. To play a card, pay every pip in its invoke cost from your resource pool unless an effect says otherwise (see section 500). A card with no invoke cost in the upper-left corner cannot be played unless an effect allows it. By default, cards are played from hand (see rule 500.2.1).

### 350.3. Colored pips

> 350.3.1. **Solid colored pips** represent one resource of that color. The colored pip types are life `[LIF]`, metal `[MET]`, power `[POW]`, RAM `[RAM]`, time `[TIM]`, and steel `[STL]`.
>
> 350.3.2. **Hybrid pips** show two colors on one symbol (for example `[LIF-MET]`). Pay one resource that matches either color shown.
>
> 350.3.3. Colored pips may be gained when you accumulate resources (see rule 602.1).

### 350.4. Generic pips

> 350.4.1. **Generic pips** are grey numbered symbols such as `[GEN1]`, `[GEN2]`, and other numbered generic values through `[GEN10]`, plus `[GEN]` and `[GENX]` where printed.
>
> 350.4.2. Each generic pip may be paid with one resource of **any** color from your pool (see rule 500.6).
>
> 350.4.3. Generic pips are not colored pips. They are ignored when accumulating resources (see rule 602.1).
>
> 350.4.4. Time counters may reduce generic pip costs only (see rule 700.4).

---

## 400. Setup and Turns

### 400.1. Setup

> 400.1.1. This game is for 2–4 players. Each player needs a pilot, a deck, life tracking, VP tracking, damage dice, time-counter dice, resource tokens, and shared **objectives**.
>
> 400.1.2. Place pilot in the pilot zone; shuffle your deck; place pilot's starting resources readied in stockpile; set life and draw a starting hand per pilot values. Each player starts at **0 VP**. Your **victory number** is the VP printed on your pilot.
>
> 400.1.3. Determine first player randomly; that player chooses whether to go first. Turn order is clockwise from the first player.
>
> 400.1.4. Each player may mulligan once (first player mulligans first): put any number of hand cards on the bottom of the deck, then draw that many. There is no maximum hand size after the game begins.
>
> 400.1.5. The player who takes the first turn chooses two resources in their stockpile and `[EXPEND]`s them (turn them 90° horizontal). If that player controls fewer than two resources in their stockpile, they expend all of them. Those resources do **not** ready during that player's first start-of-turn step (see rule 400.2.2.1); they ready normally on later turns.
>
> 400.1.6. Place shared **objectives** in the center of the table, not in any player's battlefield.
>
> 400.1.6.1. If there are **2** players, place **2** objectives.
>
> 400.1.6.2. If there are **3 or more** players, place **H = max(3, number of players − 1)** objectives (3 players → 3; 4 players → 3).

### 400.2. Turn structure

400.2.1. Each turn has three phases in order: start of turn, main, end-of-turn.

#### 400.2.2. Start of turn

> 400.2.2.1. Ready all entities you control.
>
> 400.2.2.2. **Heal.** Remove **1** marked damage (not below 0) from each unit you control on the **battlefield**, including your pilot if it is on the battlefield. Units on an objective are not on the battlefield for this step and do not heal (including your pilot if it is on an objective). Opponent units do not heal on your turn.
>
> 400.2.2.3. **Hold VP.** Gain **1 VP** for each objective you control. Then check win (see rule 100.4). Objectives you do not control score 0.
>
> 400.2.2.4. Trigger all abilities with the start-of-turn tag.
>
> 400.2.2.5. Remove one time counter from each card you control in play; resolve effects when the last counter is removed from a stockpile card.

#### 400.2.3. Main phase

> 400.2.3.1. You may play cards, activate abilities, make attacks, move units onto or off objectives, allocate a resource to a unit, or accumulate resources, in any order where timing allows.
>
> 400.2.3.2. See sections 600–606 for default game actions.

#### 400.2.4. End-of-turn phase

> 400.2.4.1. Players may play Quick Hacks or activate abilities, active player first, until both pass.
>
> 400.2.4.2. Trigger end-of-turn abilities.
>
> 400.2.4.3. Lose unspent resources in your resource pool (not stockpile).
>
> 400.2.4.4. Draw until your hand equals your pilot's `[HAND SIZE]` minus 2; for each card you cannot draw, lose 1 life.

---

## 500. Playing Cards

500.1. Each playable card has an invoke cost made of resource pips (see section 350) in the upper-left corner.

500.2. To play a card, have the required resources in your resource pool, pay the cost, reveal the card, and put it in the lock. If the lock is empty, the card becomes the lock occupant. If the lock is full, only a Quick Hack played by the active player may enter the lock; it overwrites the lock occupant (see rules 500.8.3, 700.2.3, and 700.2.4). Only effects go to a queue when the lock is full (see rule 700.2.2).

> 500.2.1. **Where you may play from.** By default, you play cards from your hand. You may play a card from another zone only if a card ability or effect explicitly allows it — for example, from your pilot zone, discard pile, or dismantle pile. Such a play still follows rules 500.3–500.5 and 700.4 unless the ability says otherwise.

500.3. If the card targets, you must have legal targets before playing it (see section 100.8).

500.4. When the card enters the lock, declare targets and resolve `[INVOKE]` tags immediately. The card remains the lock occupant until it resolves or is overwritten by another played card.

> 500.4.1. While it is the lock occupant, the active player may overwrite it with a Quick Hack or take other actions allowed while the lock is full (see section 700).

500.5. If the lock occupant is not overwritten, it resolves when the lock process allows: put the card in its zone (battlefield for entities, discard pile for cyberspells), resolve its `[EFFECT]` tag, then other triggers such as `[ENTERS PLAY]`.

500.6. Generic pips may be paid with any one pool resource each; time counters may reduce generic pip costs (see rules 350.4 and 700.4).

500.7. Resource tokens usually have `[EXPEND]` abilities that add one or two resources of their color to your pool.

> 500.7.1. Using a resource's `[EXPEND]` ability does not use the lock; expend the resource and add its color to your resource pool immediately.
>
> 500.7.2. You may use resource abilities while the lock is full (see rule 700.5.1).

### 500.8. When you may play cards

500.8.1. **Process speed** — You may play a Process cyberspell during your main phase on your turn while the lock is empty (see rule 300.3.1). You may play an entity from your hand during your main phase on your turn while the lock is empty unless an effect gives another timing. Playing your pilot from the pilot zone follows rule 200.1.

500.8.2. **Quick Hack speed** — A Quick Hack cyberspell may be played whenever you could play a Process, and also (see rule 300.3.2):

> 500.8.2.1. During the end-of-turn phase (see rule 400.2.4.1).
>
> 500.8.2.2. During an attack response window (see rule 603.5).
>
> 500.8.2.3. While the lock holds a card — only the active player, and only by overwriting the lock occupant (see rules 700.2.3 and 700.3.6).
>
> 500.8.2.4. When an opponent's effect empties the lock.

500.8.3. **While the lock is full** — You cannot play a Process or entity while the lock is full. The only card you may play while the lock is full is a Quick Hack, and only if you are the active player and you overwrite the lock occupant (see section 700).

500.8.4. **Quick Hack timing elsewhere** — Activated abilities, Recycle, Surge, and other effects that use Quick Hack timing follow the windows in rule 500.8.2 unless stated otherwise (see rules 800.2.1, 800.2.5, and 800.3.22).

---

## 600. Default Game Actions

### 601. Block and retreat

601.1. Blocking is not a default game action. Attacks are declared at objectives (see section 603). You cannot block by discarding from hand or expending programs, technologies, or cyberspells.

601.2. Readied units on an objective deal combat damage back during the damage step (see rule 603.7). An expended unit deals 0 combat damage even if it is in that fight.

601.3. Damage directed at you as a player that is not from combat on an objective becomes loss of life. You cannot block that damage with units. Life loss does not win the game (see rule 100.4.1).

601.4. **Retreat.** After an attack is declared at an objective, the defending player may retreat a **readied** unit they control on that objective if it did not enter the battlefield under their control this turn, or if it has Blitz (see rule 800.3.3).

> 601.4.1. Units not on an objective cannot retreat. Expended units on an objective cannot retreat.
>
> 601.4.2. A unit that moved onto an empty objective without expending may still be readied, so it can retreat. A unit that moved on as an attack is expended and cannot retreat until it readies.
>
> 601.4.3. To retreat: that unit leaves the objective, returns to the battlefield **expended**, and takes **2** retreat damage. It is not in the damage step. Other units on that objective stay; the attack continues. The 2 damage from retreating is not combat damage from that attack; apply it when you retreat, then check for defeat as usual (see rule 603.7.5).
>
> 601.4.4. Retreat is not available for a unit that entered the battlefield under your control this turn unless that unit has Blitz.
>
> 601.4.5. If retreat causes a player to **gain control** of the objective, apply rule 250.7.1 (conquer).

### 602. Accumulate resources

602.1. Once per turn during your main phase, reveal a card from hand and gain up to two resource tokens from its colored pips (ignore generic pips; see section 350).

602.2. Put gained resources readied into stockpile; put the revealed card on the bottom of your deck.

602.3. This action does not use the lock.

602.4. Resource tokens created this way are created immediately in the stockpile; they do not use the lock-and-resolve flow in rule 300.2.7.

### 603. Attack

603.1. Attacks are declared **at an objective**, not at a unit or a player. Combat is how you contest objectives. Damage marked on units persists until healed (see rule 400.2.2.2).

603.2. **Declare attackers** — Choose unit(s) you control that are legal attackers: units on the battlefield and/or units already on that objective. Multiple attackers are one attack. A unit may attack if it has the Unit supertype, including when it also has a type that otherwise cannot attack (see rules 100.7 and 100.7.2).

> 603.2.1. A card with one or more time counters on it cannot attack (see rule 700.4.2.1). When the last counter is removed from a stockpile card, it moves to the battlefield (see rules 700.4.4 and 300.2.2).
>
> 603.2.2. A unit cannot attack during the turn it entered the battlefield under your control unless it has Blitz (see rules 300.2.2.1 and 800.3.3).
>
> 603.2.3. You cannot declare an attack at an objective that has no opposing unit on it.
>
> 603.2.4. If the attackers are not already on that objective, they move onto it as they attack (see rule 606.4). Units already on it still expend to attack as in this section.
>
> 603.2.5. Combat is pairwise: the attacker versus the controller of the defending units in that fight. Other players with units on the same objective are not in that combat unless a card targets them.

603.3. **Declare the objective** — Expend unit attackers. Trigger `[ATTACK]` tags and other on-attack abilities. Do **not** choose an attack target. Who takes damage is decided in the damage step (see rule 603.7).

> 603.3.1. **Airborne.** If the defending player has at least one Airborne unit on that objective, the attack is legal only if at least one attacking unit has Airborne or Long Range (see rules 800.3.2 and 800.3.13). That one unit enables the entire attack force.
>
> 603.3.2. **Stealth.** If the defending player has at least one unit with Stealth on that objective, pay Stealth as an additional cost of the attack (see rules 800.3.20 and 603.4). Pay **once** for the entire attack force. If more than one such unit is on that objective, pay the highest Stealth X among them.
>
> 603.3.3. Other additional costs that would be paid to attack or target a unit on that objective are paid once for the entire attack force, using the highest value among those units if more than one applies.

603.4. **Attack step** — Attackers are now attacking. Pay additional costs as required by rule 603.3.

603.5. **Response window** — Players play Quick Hacks or activate abilities, active player first, until both pass.

> 603.5.1. The defending player may retreat a readied unit they control on that objective if able (see rule 601.4).

603.6. **Preemptive Strike damage** — Attackers with Preemptive Strike deal damage equal to their damage value (including modifiers). The attacking player divides that damage among the defending player's units on that objective, as they choose (rule 603.7.4 still applies). If Preemptive Strike damage was dealt, skip ordinary combat damage as in rule 603.7.

603.7. **Combat damage** — If Preemptive Strike damage was not dealt, combat damage is simultaneous.

> 603.7.1. The **attacking player** divides combat damage from attacking units among the defending player's units on that objective, as they choose.
>
> 603.7.2. The **defending player** divides combat damage from their units on that objective among the attacking units, as they choose. A readied defending unit deals its damage value; an expended defending unit deals 0.
>
> 603.7.3. A player may assign all of a unit's damage to one opposing unit, or split it among more than one. Assign all of that unit's damage.
>
> 603.7.4. You cannot assign damage from an attacking unit to an Airborne unit unless that attacking unit has Airborne or Long Range.
>
> 603.7.5. After damage, a unit is defeated if marked damage ≥ its health value (or health value + X with Durable X). Trigger on-defeat abilities; put defeated units in the discard pile.
>
> 603.7.6. If combat causes a player to **gain control** of the objective, apply rule 250.7.1 (conquer).

603.8. After the attack resolves:

> 603.8.1. If at least one defending unit **and** at least one attacking unit both survived, the attacking units **return to their controller's battlefield expended**. They leave the objective. Other units on that objective stay.
>
> 603.8.2. If no defending unit survived, every unit that is still in play **stays on that objective**, including surviving attackers (they remain expended).

### 604. Allocate a resource to a unit

604.1. Allocating a resource to a unit is a default game action.

604.2. Once per turn on your turn, when you could play a Process, you may allocate a resource to a unit you control.

604.3. Expend the resource `[EXPEND]` and choose the unit. Each allocated resource gives that unit +1 damage value and +1 health value.

604.4. This does not use the lock and resolves immediately.

604.5. You cannot allocate while the lock is full.

### 605. Play a card

605.1. Playing a card is a default game action.

605.2. Which cards you may play, and when, depend on card type, phase, and lock state (see rule 500.8).

605.3. See section 500 for invoke costs, zones you may play from, targeting, and lock interaction.

### 606. Move onto or off an objective

606.1. During your main phase, as a default game action: choose an objective and a unit(s) you control on the battlefield that is not waiting on a time counter (this includes your pilot). Move that unit onto the objective.

606.2. **Empty objective** (no units on it): do **not** expend the unit. It keeps its current readied or expended state. This is not an attack. A summoning-sick unit cannot move onto an empty objective (see rule 300.2.2.2).

606.3. **You control it** (your units on it, no opponent): do **not** expend. This is not an attack. A summoning-sick unit **may** move onto this objective (see rule 300.2.2.2).

606.4. **Opponent controls it:** This move is declaring an **attack** with that unit (see section 603). Expend the unit as it joins the stack (if it was already expended, it stays expended). Because this is an attack, `[ATTACK]` tags and other attack triggers resolve, and players may play Quick Hacks in the attack response window (see rules 500.8.2.2 and 603.5).

> 606.4.1. The unit must be a legal attacker (see rules 603.2, 603.2.2, and 300.2.2.1).

606.5. If this move causes you to **gain control** of the objective, apply rule 250.7.1 (conquer).

606.6. **Leave an objective.** During your main phase, as a default game action: choose a **readied** unit you control on an objective. `[EXPEND]` it and move it to your battlefield. This is not an attack and not a retreat (no retreat damage).

> 606.6.1. You may leave with more than one unit in the same action; expend each chosen unit.
>
> 606.6.2. An expended unit on an objective cannot leave this way.
>
> 606.6.3. If this causes a player to **gain control** of the objective, apply rule 250.7.1 (conquer).

---

## 700. The Lock and Time Counters

### 700.1. Lock overview

> 700.1.1. The lock holds at most one card or effect and determines timing, active player, Quick Hack overwrite rights, and when effects resolve.
>
> 700.1.2. At the start of a turn, the turn player is the active player.
>
> 700.1.3. When a card or effect enters the lock, its controller becomes the non-active player; an opponent of that player becomes active. Other players are not in that lock unless a card targets them.
>
> 700.1.4. If multiple effects would enter an empty lock simultaneously, the active player puts one of theirs in first; others go to queues.
>
> 700.1.5. Only the active player may play a Quick Hack to overwrite the lock during Scenario 2 (see rule 700.3.6).
>
> 700.1.6. Paying costs, using resource abilities, and activating into your queue may be done by whoever is currently adding effects (including the non-active player during Alternate); Quick Hack overwrite remains active-player only.

### 700.2. Scenario 1 — Lock occupant, cards, and Quick Hacks

> 700.2.1. **Empty lock** — A played card or lock-using effect enters the lock.
>
> 700.2.2. **Full lock — effects** — A lock-using effect goes to its controller's queue instead. It does not enter the lock.
>
> 700.2.3. **Full lock — cards** — A played card overwrites the lock occupant and becomes the new occupant. It does not go to a queue.
>
> 700.2.4. **Overwrite result** — When a card overwrites the lock occupant, the replaced card goes to its controller's stockpile with two time counters (or is discarded if stockpile already has two time-counter cards). A replaced effect does nothing. Recalculate active player; restart "while lock is full."
>
> 700.2.5. Queued effects never overwrite the lock.

### 700.3. Scenario 2 — Queues

> 700.3.1. While the lock is full, overflow effects go to queues. The turn does not return to free play until lock and all queues are empty.
>
> 700.3.2. **Active batch** — Active player adds legal overflow to their queue, then resolves their entire queue in chosen order.
>
> 700.3.3. **Non-active batch** — Non-active player does the same.
>
> 700.3.4. **Alternate** — Starting with the active player, each player either adds one queue effect and resolves it, or passes; when both pass in succession, stop.
>
> 700.3.5. **Lock occupant resolves** — If lock is still full and any queue is non-empty, repeat 700.3.2–700.3.4. When lock is empty, queues must also be empty before normal play resumes.
>
> 700.3.6. A Quick Hack during batches overwrites per Scenario 1; only the active player may do so.

### 700.4. Time counters

700.4.1. When playing a card, you may place time counters on it to reduce generic pip costs by `[GEN1]` each (see section 350.4).

700.4.2. If you used time counters when playing the card, skip the lock entirely: put the card revealed in your stockpile with those time counters on it.

> 700.4.2.1. While the card has one or more time counters on it, it has no abilities (except abilities with the `[ATOMIC]` tag; see rule 800.1.2). It cannot attack, regardless of zone or ready state.

700.4.3. At the start of each of your turns, remove one counter from each of your time-counter cards.

700.4.4. When the last counter is removed from a stockpile card, resolve its effects without using the lock, then move it to the battlefield (entity) or discard pile (cyberspell). If an entity unit moves to the battlefield this way, apply rule 300.2.2 (including rule 300.2.2.3).

700.4.5. You may have at most two time-counter cards in stockpile.

### 700.5. Actions while lock is full

> 700.5.1. Pay costs and use resource abilities (do not use the lock).
>
> 700.5.2. Activate an ability that uses the lock — it goes to your queue.

---

## 800. Timing, Triggers, and Keywords

### 800.1. Tags

> 800.1.1. Abilities appear as tags except `[EFFECT]` and activated abilities (see section 800.2). There are two tag types: **static** and **triggered**. A `[STATIC]` tag is always in effect while the card is in play; any tag that is not static is **triggered** and fires when its printed condition is met.
>
> 800.1.2. `[ATOMIC]` — Active even with time counters on the card.
>
> 800.1.3. `[ENTERS PLAY]` — First time entering battlefield or stockpile; always atomic.
>
> 800.1.4. `[ENTERS BATTLEFIELD]` / `[ENTERS STOCKPILE]` — First entry to that zone.
>
> 800.1.5. `[ATTACK]` — When you make an attack with that card.
>
> 800.1.6. `[START]` / `[END TURN]` — At start or end of your turn.
>
> 800.1.7. `[INVOKE]` — When the card goes to the lock; resolves immediately.
>
> 800.1.8. `[IF]` — `[condition], [effect]`. Triggers when the printed condition is met while this card is in play.
>
> 800.1.8.1. If the condition refers to **playing** a card, the condition is met when that play is complete under rule 500.2 (the card enters or overwrites the lock occupant) or rule 700.4.2 (time counters replace the lock step). This includes plays from zones other than hand when an ability allows (see rule 500.2.1), such as Recursive from the discard pile. The triggered effect then enters the lock or its controller's queue like other triggered abilities (see section 700).
>
> 800.1.9. `[STATIC]` — Always active in play.
>
> 800.1.10. `[EFFECT]` — When the played card resolves; default for untagged non-activated abilities.
>
> 800.1.11. `[DEFEATED]` — When the unit is put into the discard pile from play.

### 800.2. Activated abilities

> 800.2.1. Format: `[cost]: [effect]`. Playable whenever a Quick Hack can be played unless stated otherwise.
>
> 800.2.2. If an activated ability targets, it cannot be activated unless at least one legal target exists (see section 100.8).
>
> 800.2.3. To activate, pay costs; if the lock is empty the effect enters the lock, otherwise your queue. Declare legal targets when the effect enters the lock or queue.
>
> 800.2.4. **Expend `[EXPEND]`** — Turn a card 90° from vertical (readied = vertical).
>
> 800.2.5. **Recycle `[RECYCLE]`** — Discard from hand at Quick Hack timing.
>
> 800.2.6. **Trash `[TRASH]`** — From battlefield; put printed card in discard pile as cost.
>
> 800.2.7. **Dismantle `[DISMANTLE]`** — From play; put the printed card face up in the dismantle pile as a cost (see rule 200.7).
>
> 800.2.8. **Innate abilities** — Abilities on a card that are neither activated abilities nor tags. They follow their rules and do not use the lock unless those rules say otherwise.

### 800.3. Keyword abilities

800.3. Keyword abilities are **not** activated abilities. They do not use the `[cost]: [effect]` format, they are not played, and they do not use the lock unless a keyword's rule says otherwise.

> 800.3.1. Keywords are static unless noted. Duplicate keywords on one entity do not stack except numerical values, which add.
>
> 800.3.2. **Airborne** — Only Airborne or Long Range can attack this entity. To declare an attack at an objective that has at least one Airborne unit, at least one attacking unit must have Airborne or Long Range (see rule 603.3.1).
>
> 800.3.3. **Blitz** — This unit may attack during the turn it entered the battlefield (see rules 300.2.2.1 and 603.2.2).
>
> 800.3.4. **Corrosive Bile** — Whenever this entity deals damage to a unit, destroy that unit.
>
> 800.3.5. **Degrade X** — Affected player mills X from their deck.
>
> 800.3.6. **Durable X** — Defeated at health value + X damage instead of health value.
>
> 800.3.7. **Preemptive Strike** — Deals damage first in a fight unless the opponent also has Preemptive Strike (see rule 603.6).
>
> 800.3.8. **Hardened X** — Reduce damage taken by X.
>
> 800.3.9. **Hard Point** — You may include a second copy of this card in your deck (in addition to the normal copy limit).
>
> 800.3.10. **Insatiable Hunger** — You cannot declare an attack at an objective that has no unit the defender controls if that player controls a unit on an objective (see rule 603.2.3).
>
> 800.3.11. **Invulnerable** — Cannot be trashed, dismantled, or destroyed by those effects; cannot be chosen as target for them.
>
> 800.3.12. **Lethal X** — Deals X additional damage when it deals damage.
>
> 800.3.13. **Long Range** — Can attack Airborne units.
>
> 800.3.14. **Pierce** — Excess damage to a unit's controller is redirected to that player.
>
> 800.3.15. **Recursive** — You may play this card from the discard pile by paying its invoke cost (see rules 500.2 and 500.2.1). Allocate the top card of your deck face down to the played card; the next time this asset would go to the discard pile, dismantle it and the face-down card instead.
>
> 800.3.16. **Refurbished** — Dismantle cards from the discard pile to pay `[GEN]` costs on this card.
>
> 800.3.17. **Spirit Link** — Damage this asset deals is gained as life by its controller.
>
> 800.3.18. **Stalwart** — Does not expend when attacking.
>
> 800.3.19. **Stationary** — Cannot attack.
>
> 800.3.20. **Stealth X** — Additional cost to target or attack with cyberspells/abilities/attacks. To declare an attack at an objective that has Stealth, pay once for the entire attack force (see rule 603.3.2).
>
> 800.3.21. **Sturdy** — Cannot be destroyed by "destroy" effects.
>
> 800.3.22. **Surge** — Invokable whenever a Quick Hack can be played.
>
> 800.3.23. **Weakened X** — Deals X less damage.
>
> 800.3.24. **Desperate Maneuver X** — When you draw this card, you may reveal it. If you do, dismantle X and play it immediately as though it had Surge without paying its invoke cost. Otherwise you may put it into your hand.
>
> 800.3.25. **PEER X** — Look at the top X cards of your deck. You may put any of them into your discard pile, then put the rest back on top of your deck in any order.

---

## 900. Deck Building

900.1. A legal deck has at least 40 entity and cyberspell cards and exactly one pilot. The pilot does not count toward the 40-card minimum.

### 900.2. Deck rules

> 900.2.1. One pilot only.
>
> 900.2.2. At least 40 cards in the deck (entity and cyberspell cards only).
>
> 900.2.3. Up to three copies per non-pilot name.
>
> 900.2.4. Prototype limited to one copy in the deck.
>
> 900.2.5. There is no sideboard; include any extra cards in the 40-card minimum when building.

---

 "He forgot to mention HAIs, man..." — Svn*
