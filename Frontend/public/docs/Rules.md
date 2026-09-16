# MIRROR IMAGE — Comprehensive Rules

---

## 100. General

100.1. These rules govern play of *Mirror Image*. If a card's text conflicts with these rules, follow the card.

100.2. Each non-resource card is an **Asset** with base type **Entity** or **Cyberspell**. If a card does not list Cyberspell as a supertype, its base type is Entity.

100.3. Whenever card text uses the word "this," it refers to the card that printed that text.

100.4. A player wins by reducing an opponent's life to 0, decking them out (each draw from an empty deck costs 1 life), or if an opponent begins their turn with 0 resources in their stockpile.

100.5. The most direct path to victory is reducing life to 0 by attacking with units, weapons, or the pilot.

100.6. **`[TLV]` (Threat Level).** Only cards with the Unit supertype have a `[TLV]` on the card.

> 100.6.1. **Split format `[dmg|hp]`.** When printed as two numbers separated by a vertical bar (for example, `3|2`), the first number is the unit's **damage value** and the second is its **health value**.
>
> 100.6.2. **Combined format `[dmg+hp]`.** When printed as a single number (for example, `3`), that number is both the unit's damage value and its health value.
>
> 100.6.3. In these rules, a unit's **damage value** is the damage it deals in combat; its **health value** is how much marked damage it can take before it is defeated. Effects that modify `[TLV]` modify the corresponding value unless stated otherwise. The pilot is a unit, but it is not defeated by marked damage (see rules 300.2.1 and 603.8).
>
> 100.6.4. **Combat rating.** Weapons and augments print a **combat rating** instead of `[TLV]`. A weapon's combat rating is its damage value when it attacks. An augment's combat rating is how much it reduces an attacker when used to block, and the depletion total at which it is trashed (see rule 100.9).

### 100.7. Multiple supertypes and subtypes

100.7. A card may have multiple supertypes and subtypes. It has all applicable rules from each type printed on it.

> 100.7.1. If two type rules conflict, the more permissive rule applies unless card text says otherwise (see rule 100.1).
>
> 100.7.2. **Attack.** If the card has the Unit supertype, it may attack even if another of its types says it cannot attack. If the card has the Weapon subtype, it may use its innate attack ability (see rule 603.10) even if another of its types says it cannot attack. There is no Strike cyberspell subtype; a cyberspell attacks only if its text says so.
>
> 100.7.3. **Intercept.** While you control a readied **non-pilot** unit on the battlefield, an opponent must target a readied non-pilot unit you control when declaring an attack (see rules 601.2 and 603.3).

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
> 100.8.9. Attack targeting is handled by combat rules in addition to these rules (see section 603).
>
> 100.8.10. If an effect does not specify a zone, only cards and objects on the battlefield may be chosen (see rule 200.3). To target a card in the stockpile, hand, discard pile, dismantle pile, or another non-battlefield zone, the effect must say so.

### 100.9. Depletion

> 100.9.1. Some combat uses **depletion counters** on weapons and augments.
>
> 100.9.2. When a weapon or augment has depletion counters greater than or equal to its printed combat rating, trash it (put it into its owner's discard pile).

---

## 200. Zones

200.1. **Pilot zone** — A slot on the battlefield that holds your pilot. It is in play. Your pilot starts the game here and remains on the battlefield for the rest of the game (see rule 300.2.1).

200.2. **Deck** — Your face-down shuffled deck of entity and cyberspell cards.

200.3. **Battlefield** — Where played entities go unless time counters were used (see rule 700.4). Your pilot and starting augments are placed here during setup.

200.4. **Stockpile** — Where readied resources are stored and where time-counter cards wait. **Expend** a resource (turn it 90° horizontal) to add its color to your resource pool.

200.5. **In play** — Battlefield and stockpile together. Effects on "in play" affect both unless specified.

200.6. **Discard pile** — Where defeated units, resolved cyberspells, and trashed cards go.

200.7. **Dismantle pile** — Removed-from-game pile. Cards in the dismantle pile are always face up. When you would gain a resource token, you may take one from the dismantle pile instead.

200.8. **Resource pool** — Imaginary zone where expended resources go until end of turn; spend pool resources to pay invoke costs.

200.9. **Lock** — Holds at most one card or effect before it resolves (see section 700).

200.10. **Queue** — Holds overflow effects while the lock is full (see rule 700.3).

---

## 300. Card Types

### 300.1. Base types

> 300.1.1. **Cyberspell** — After resolving (or being overwritten), goes to the discard pile.
>
> 300.1.2. **Entity** — After resolving, goes to the battlefield unless played with time counters (then stockpile). If overwritten, goes to the discard pile.
>
> 300.1.3. Playing any entity or cyberspell card puts it in the lock unless time counters replace that step (see rules 500 and 700.4). Tokens are not played this way (see rule 300.2.8).
>
> 300.1.4. A card may list more than one supertype or subtype. When type rules overlap or conflict, apply rule 100.7.

### 300.2. Supertypes

> 300.2.1. **Pilot [Entity]** — A unit that starts on the battlefield in your pilot zone and stays there for the entire game.
>
> 300.2.1.1. You do not play the pilot from a command zone and there is no recast tax.
>
> 300.2.1.2. Damage dealt to the pilot is loss of life (one track). The pilot is not defeated by marked damage.
>
> 300.2.1.3. If the pilot would leave play (discard pile, dismantle pile, or another zone), expend it instead. If it is already expended, put a time counter on it instead (this can stack). Time-counter rules apply (see rule 700.4.2.1).
>
> 300.2.1.4. The pilot retaliates only while readied (see rule 603.8). The pilot cannot retreat.
>
> 300.2.2. **Unit [Entity]** — Call-in combatants (see rule 100.6). After resolving, enter the battlefield unless time was used (see rule 700.4). When a unit you control enters the battlefield, you choose whether it enters readied or expended. A unit cannot attack during the turn it entered the battlefield unless it has Blitz (see rule 800.3.3).
>
> 300.2.3. **Program [Entity]** — Stays in play; cannot attack. Cannot block unless its text says so.
>
> 300.2.4. **Technology [Entity]** — Support or counter-play; cannot attack. Cannot block unless its text says so.
>
> 300.2.5. **Augment [Entity]** — Equipment or cybernetics. Starts the game on the battlefield, readied. Cannot attack unless its text says so. Not a unit; it has a combat rating (see rule 100.6.4), not `[TLV]`, unless it also has the Unit supertype.
>
> 300.2.5.1. You cannot equip two augments with the same name unless a card allows it (see **Hard Point**, rule 800.3.7).
>
> 300.2.6. **Prototype [Any]** — Limited to one copy per deck.
>
> 300.2.7. **Resource [Entity]** — Tokens gained readied into stockpile; usable immediately.
>
> 300.2.8. **Token [Entity]** — Usually created by an effect, not played from hand or other zones.
>
> 300.2.8.1. Tokens do not go to the discard pile when defeated or trashed.
>
> 300.2.8.2. You may use your own objects as tokens if it is clear which token they represent and whether they are expended.
>
> 300.2.8.3. You cannot use non-token MIRROR IMAGE cards as tokens.
>
> 300.2.8.4. When an effect creates a token, that creation may enter the lock if it is empty, or its controller's queue if the lock is full (see section 700).
>
> 300.2.8.5. The token is not created until the creating effect resolves.
>
> 300.2.8.6. When a resource token is created, put it into the stockpile readied (see rule 300.2.7).
>
> 300.2.8.7. When any other token is created, put it onto the battlefield. If it is a unit, its controller chooses whether it enters readied or expended (see rule 300.2.2); otherwise it enters readied.

### 300.3. Subtypes

> 300.3.1. **Process [Cyberspell]** — Playable during your main phase while the lock is empty. Cannot attack. See rule 500.8 for full timing.
>
> 300.3.2. **Quick Hack [Cyberspell]** — Playable whenever a Process can be played, plus at end of turn, during an attack, while the lock holds a card, or when an opponent's effect empties the lock. Cannot attack. See rule 500.8 for full timing.
>
> 300.3.3. **Weapon** — Entity subtype with an innate ability to attack (see rule 603.10). Using a weapon's innate attack ability is not an activated ability. A weapon is not a unit and does not deal damage back.

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
>
> 350.3.4. Colored pips restrict **payment**, not deck construction. A deck may include cards of any colors (see section 900).

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

> 400.1.1. Each player needs a pilot, augments as allowed by their RIG class (see section 900), a deck, life tracking, damage dice, time-counter dice, and resource tokens.
>
> 400.1.2. Place your pilot on the battlefield in the pilot zone. Shuffle your deck. Place your augments on the battlefield, readied. Place the pilot's starting resources readied in the stockpile. Set life and draw a starting hand per the pilot's printed values.
>
> 400.1.3. Determine first player randomly; that player chooses whether to go first.
>
> 400.1.4. Each player may mulligan once (first player mulligans first): put any number of hand cards on the bottom of the deck, then draw that many. There is no maximum hand size after the game begins.

### 400.2. Turn structure

400.2.1. Each turn has three phases in order: start of turn, main, end-of-turn.

#### 400.2.2. Start of turn

> 400.2.2.1. Ready all entities you control.
>
> 400.2.2.2. Trigger all abilities with the start-of-turn tag.
>
> 400.2.2.3. Remove one time counter from each card you control in play; resolve effects when the last counter is removed from a stockpile card.
>
> 400.2.2.4. If you control no resources in your stockpile, you lose the game.

#### 400.2.3. Main phase

> 400.2.3.1. You may play cards, activate abilities, make attacks, allocate a resource to a unit, or accumulate resources, in any order where timing allows.
>
> 400.2.3.2. See sections 600–605 for default game actions.

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

> 500.2.1. **Where you may play from.** By default, you play cards from your hand. You may play a card from another zone only if a card ability or effect explicitly allows it — for example, from your discard pile or dismantle pile. Such a play still follows rules 500.3–500.5 and 700.4 unless the ability says otherwise.

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

500.8.1. **Process speed** — You may play a Process cyberspell during your main phase on your turn while the lock is empty (see rule 300.3.1). You may play an entity from your hand during your main phase on your turn while the lock is empty unless an effect gives another timing.

500.8.2. **Quick Hack speed** — A Quick Hack cyberspell may be played whenever you could play a Process, and also (see rule 300.3.2):

> 500.8.2.1. During the end-of-turn phase (see rule 400.2.4.1).
>
> 500.8.2.2. During an attack response window (see rule 603.5).
>
> 500.8.2.3. While the lock holds a card — only the active player, and only by overwriting the lock occupant (see rules 700.2.3 and 700.3.6).
>
> 500.8.2.4. When an opponent's effect empties the lock.

500.8.3. **While the lock is full** — You cannot play a Process or entity while the lock is full. The only card you may play while the lock is full is a Quick Hack, and only if you are the active player and you overwrite the lock occupant (see section 700).

500.8.4. **Quick Hack timing elsewhere** — Activated abilities, Recycle, Surge, and other effects that use Quick Hack timing follow the windows in rule 500.8.2 unless stated otherwise (see rules 800.2.1, 800.2.5, and 800.3.18).

---

## 600. Default Game Actions

### 601. Block

601.1. Blocking is not a default game action. Intercept, pitch, augment block, and retreat happen as part of an attack (see section 603). Programs, technologies, and cyberspells do not block unless their text says so.

601.2. **Intercept.** While you control a readied **non-pilot** unit on the battlefield, an opponent declaring an attack must choose a readied non-pilot unit you control as the attack target (see rule 603.3).

601.3. When a **non-pilot** unit is the attack target and is readied when combat damage is dealt, it deals damage back (see rule 603.7). An expended non-pilot unit deals 0 damage back even if it is attacked.

601.4. Damage directed at you that is not from an attack resolved against your pilot still becomes loss of life. You cannot intercept that damage with units, pitch cards, or augments unless an effect says so.

601.5. **Pitch (face only).** When the attack target is the defending player's **pilot**, that player may pitch any number of cards from hand that have a printed combat rating or `[TLV]` damage value. Sum those values onto **one** attacker of their choice. A single pitched card contributes at most **4**. For each pitched card, that player chooses: put it on the **bottom of their deck** or into their **discard pile**. Pitching does not use the lock.

601.6. **Augment block (face only).** When the attack target is the defending player's **pilot**, that player may `[EXPEND]` any number of augments they control. Each expended augment is assigned to an attacker, reduces that attacker's damage by the augment's combat rating, then gets a depletion counter (see rule 100.9). Augment block does not use the lock.

### 602. Accumulate resources

602.1. Once per turn during your main phase, reveal a card from hand and gain up to two resource tokens from its colored pips (ignore generic pips; see section 350).

602.2. Put gained resources readied into stockpile; put the revealed card on the bottom of your deck.

602.3. This action does not use the lock.

602.4. Resource tokens created this way are created immediately in the stockpile; they do not use the lock-and-resolve flow in rule 300.2.8.

### 603. Attack

603.1. Attacking is a primary way to deal damage and pressure opponent resources. Damage marked on units persists until healed.

603.2. **Declare attackers** — Choose unit(s) on the battlefield, weapon(s) using their innate attack ability (see rule 603.10), and/or other legal attackers whose text allows an attack. Multiple attackers are one attack sharing one target; each attacker is treated separately for damage assignment and for pitch/augment assignment. A unit may attack if it has the Unit supertype, including when it also has a type that otherwise cannot attack (see rules 100.7 and 100.7.2).

> 603.2.1. A card with one or more time counters on it cannot attack (see rule 700.4.2.1). When the last counter is removed from a stockpile card, it moves to the battlefield (see rules 700.4.4 and 300.2.2).
>
> 603.2.2. A unit cannot attack during the turn it entered the battlefield under your control unless it has Blitz (see rules 300.2.2 and 800.3.3). The pilot was placed during setup and may attack on the first turn unless it has time counters.

603.3. **Declare target** — Expend unit attackers. Pay each weapon attacker's innate cost (see rule 603.10.2). Choose as the attack target either (a) a **non-pilot unit** on the battlefield the defender controls, or (b) the defender's **pilot**. Trigger on-attack abilities.

> 603.3.1. If the defender controls one or more readied **non-pilot** units on the battlefield, you must choose one of those as the attack target. If they control none, you may attack their pilot.
>
> 603.3.2. Cards in other zones — including the stockpile, discard pile, and deck — cannot be chosen as attack targets unless an effect says otherwise. The pilot is a legal attack target because it is on the battlefield.
>
> 603.3.3. **Retreat.** After the target is declared, if the target is a **non-pilot** unit that did not enter the battlefield under the defender's control this turn (or that has Blitz), the defender may retreat it: `[EXPEND]` that unit and mark **1 damage** on it. The attack is negated (attackers deal 0 combat damage). The 1 marked damage still applies and can defeat the unit. The pilot cannot retreat.

603.4. **Attack step** — Attackers are now attacking. Pay additional costs such as Stealth if required. If the target is the pilot, the defender may use pitch and augment block (see rules 601.5 and 601.6).

603.5. **Response window** — Players play Quick Hacks or activate abilities, active player first, until both pass.

> 603.5.1. If a non-pilot unit on the battlefield would become readied, an attack targeting that player's pilot becomes illegal and redirects to a readied non-pilot unit on the battlefield that player controls, chosen by the attacker.

603.6. **Preemptive Strike damage** — Attackers with Preemptive Strike deal damage equal to their damage value (printed damage or combat rating, plus allocate and other card text).

603.7. **Combat damage** — If Preemptive Strike damage was not dealt, attackers deal damage equal to their damage value (printed damage or combat rating, plus allocate and other card text) to the attack target. A readied defending **non-pilot** unit deals damage equal to its damage value back; an expended defending non-pilot unit deals 0. Damage is simultaneous.

> 603.7.1. If there are multiple attackers, the defending player divides the defending unit's damage among them as they choose.
>
> 603.7.2. After damage, a non-pilot unit is defeated if marked damage ≥ its printed health value. Trigger on-defeat abilities; put defeated units in the discard pile.

603.8. **Pilot damage** — If the attack target is the defending player's pilot, damage that gets through pitch and augment block becomes loss of life. Then:

> 603.8.1. If the pilot is **readied** and has no time counters, it retaliates: it deals its damage value back, split among the attackers as the defending player chooses, then `[EXPEND]`s.
>
> 603.8.2. If the pilot is expended or has one or more time counters, it cannot retaliate (0 damage back).
>
> 603.8.3. The attack ends.

### 603.10. Weapon attacks

603.10.1. A weapon you control has an **innate ability** to attack. Using it is not an activated ability and does not use the lock.

603.10.2. To attack with a weapon, `[EXPEND]` that weapon. There is no dismantle cost.

603.10.3. Choose targets following the same rules as attacking with units (see rules 603.3 and 603.5.1).

603.10.4. A weapon may join the same attack as one or more units (see rule 603.2).

603.10.5. If a weapon deals damage to a **readied** non-pilot unit or a **readied** pilot, put a depletion counter on that weapon (see rule 100.9). Dealing damage to an expended unit or expended pilot does not add depletion.

603.10.6. Otherwise, a weapon in an attack follows rules 603.4–603.8 like other attackers. Weapons do not deal damage back.

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

---

## 700. The Lock and Time Counters

### 700.1. Lock overview

> 700.1.1. The lock holds at most one card or effect and determines timing, active player, Quick Hack overwrite rights, and when effects resolve.
>
> 700.1.2. At the start of a turn, the turn player is the active player.
>
> 700.1.3. When a card or effect enters the lock, its controller becomes the non-active player; their opponent becomes active.
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

> 700.4.2.1. While the card has one or more time counters on it, it has no abilities (except abilities with the `[ATOMIC]` tag; see rule 800.1.2). It cannot attack, regardless of zone or ready state. A pilot with one or more time counters cannot retaliate (see rule 603.8.2).

700.4.3. At the start of each of your turns, remove one counter from each of your time-counter cards.

700.4.4. When the last counter is removed from a stockpile card, resolve its effects without using the lock, then move it to the battlefield (entity) or discard pile (cyberspell). If an entity unit moves to the battlefield this way, apply rule 300.2.2. If the last counter is removed from a card already on the battlefield (including the pilot), it stays there.

700.4.5. You may have at most two time-counter cards in stockpile. Time counters on a battlefield pilot from rule 300.2.1.3 do not count toward this stockpile limit.

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
> 800.2.8. **Innate abilities** — Abilities on a card that are neither activated abilities nor tags. They follow their rules and do not use the lock unless those rules say otherwise (see rule 603.10 for weapon attacks).

### 800.3. Keywords

> 800.3.1. Keywords are static unless noted. Duplicate keywords on one entity do not stack except numerical values, which add. Combat uses printed damage and health (plus allocate and other card text). There is no Block, Lethal, Weakened, Durable, or Hardened keyword.
>
> 800.3.2. **Airborne** — Only Airborne or Long Range can attack this entity.
>
> 800.3.3. **Blitz** — This unit may attack during the turn it entered the battlefield (see rules 300.2.2 and 603.2.2). It may also retreat that turn (see rule 603.3.3).
>
> 800.3.4. **Corrosive Bile** — Whenever this entity deals damage to a unit, destroy that unit. (The pilot is not destroyed this way; apply rule 300.2.1.3.)
>
> 800.3.5. **Degrade X** — Affected player mills X from their deck.
>
> 800.3.6. **Preemptive Strike** — Deals damage first in a fight unless the opponent also has Preemptive Strike.
>
> 800.3.7. **Hard Point** — You may equip a second copy of this card as an augment (in addition to the unique-name limit in rule 300.2.5.1).
>
> 800.3.8. **Insatiable Hunger** — Attacks must target a non-pilot unit the defender controls if they control a readied one (see rule 603.3.1).
>
> 800.3.9. **Invulnerable** — Cannot be trashed, dismantled, or destroyed by those effects; cannot be chosen as target for them.
>
> 800.3.10. **Long Range** — Can attack Airborne units.
>
> 800.3.11. **Pierce** — Excess damage to a unit's controller is redirected to that player (loss of life / the pilot).
>
> 800.3.12. **Recursive** — You may play this card from the discard pile by paying its invoke cost (see rules 500.2 and 500.2.1). Allocate the top card of your deck face down to the played card; the next time this asset would go to the discard pile, dismantle it and the face-down card instead.
>
> 800.3.13. **Refurbished** — Dismantle cards from the discard pile to pay `[GEN]` costs on this card.
>
> 800.3.14. **Spirit Link** — Damage this asset deals is gained as life by its controller.
>
> 800.3.15. **Stalwart** — Does not expend when attacking.
>
> 800.3.16. **Stationary** — Cannot attack.
>
> 800.3.17. **Stealth X** — Additional cost to target or attack with cyberspells/abilities/attacks.
>
> 800.3.18. **Sturdy** — Cannot be destroyed by "destroy" effects.
>
> 800.3.19. **Surge** — Invokable whenever a Quick Hack can be played.
>
> 800.3.20. **Desperate Maneuver X** — When you draw this card, you may reveal it. If you do, dismantle X and play it immediately as though it had Surge without paying its invoke cost. Otherwise you may put it into your hand.
>
> 800.3.21. **PEER X** — Look at the top X cards of your deck. You may put any of them into your discard pile, then put the rest back on top of your deck in any order.

---

## 900. Deck Building

900.1. A legal deck has entity and cyberspell cards, exactly one pilot, and augments as allowed by RIG class. The pilot and equipped augments do not count toward the deck's card minimum.

### 900.2. RIG class

| R.I.G. (deck) | Capacity (# cards) | Equip slots (# augments) |
| --- | --- | --- |
| Light weight | 30–39 | 1 |
| Medium weight | 40–59 | 2 |
| Heavy weight | 60–70 | 3 |

### 900.3. Deck rules

> 900.3.1. One pilot only.
>
> 900.3.2. Meet the card-count range for the chosen RIG class (entity and cyberspell cards only).
>
> 900.3.3. Up to three copies per non-pilot name in the deck.
>
> 900.3.4. Prototype limited to one copy in the deck.
>
> 900.3.5. Equip at most as many augments as the RIG class allows. Unique names among equipped augments, except Hard Point (see rules 300.2.5.1 and 800.3.7).
>
> 900.3.6. There is no colour-identity or colour-combination restriction. Any colours may be included; invoke costs are still paid with matching pool resources (see section 350).
>
> 900.3.7. There is no sideboard; include any extra cards in the deck's capacity when building.

---

*"He forgot to mention HAIs, man..." — Svn*
