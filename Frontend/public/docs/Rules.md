# MIRROR IMAGE — Comprehensive Rules

---

## 100. General

100.1. These rules govern play of *Mirror Image*. If a card's text conflicts with these rules, follow the card.

100.2. Each non-resource card is an **Asset** with base type **Entity** or **Cyberspell**. If a card does not list Cyberspell as a supertype, its base type is Entity.

100.3. Whenever card text uses the word "this," it refers to the card that printed that text.

100.4. A player wins by reducing an opponent's life to 0, decking them out (each draw from an empty deck costs 1 life), or if an opponent begins their turn with 0 resources in their stockpile.

100.5. The most direct path to victory is reducing life to 0 by attacking with units or weapons.

### 100.6. Multiple supertypes and subtypes

100.6. A card may have multiple supertypes and subtypes. It has all applicable rules from each type printed on it.

> 100.6.1. If two type rules conflict, the more permissive rule applies unless card text says otherwise (see rule 100.1).
>
> 100.6.2. **Attack.** If the card has the Unit supertype, it may attack even if another of its types says it cannot attack. If the card has the Weapon subtype, it may use its innate attack ability (see rule 603.10) even if another of its types says it cannot attack.
>
> 100.6.3. **Block.** If any supertype or subtype on the card allows blocking, the card may block using any blocking method available to any of its types.

### 100.7. Targeting

> 100.7.1. Some effects use the word "target." Those effects require one or more legal targets to be chosen.
>
> 100.7.2. A target is legal only if it meets **every** restriction printed on that effect (type, controller, zone, game state, and so on).
>
> 100.7.3. If an effect names a supertype or subtype (for example, "Technology"), the target must have that type. A card with multiple types has all of them (see rule 100.6).
>
> 100.7.4. If an effect uses an exclusion (for example, "non-Augment"), the target is illegal if it has the excluded supertype or subtype, even if it also satisfies a required type.
>
> 100.7.5. You cannot choose an illegal target. If a card or ability requires targets and no legal targets exist, you cannot play that card or activate that ability.
>
> 100.7.6. Declare targets when the effect enters the lock or a queue (see rules 500.4 and 800.2.3).
>
> 100.7.7. If every target of a targeted effect is illegal when that effect resolves, the effect does nothing to those targets.
>
> 100.7.8. Keywords and other rules may further restrict or modify targeting and what can happen to a chosen target (see section 800.3).
>
> 100.7.9. Attack targeting is handled by combat rules in addition to these rules (see section 603).
>
> 100.7.10. If an effect does not specify a zone, only cards and objects on the battlefield may be chosen (see rule 200.3). To target a card in the stockpile, hand, trashyard, dismantled zone, pilot zone, or another zone, the effect must say so.

---

## 200. Zones

200.1. **Pilot zone** — Holds your pilot. You may play your pilot from here by paying its invoke cost. When your pilot is defeated or would change zones, you may return it here and increase its cost by `[GEN2]` for the rest of the game.

200.2. **R.I.G. (deck zone)** — Your face-down shuffled deck of entity and cyberspell cards.

200.3. **Battlefield** — Where played entities go unless time counters were used (see rule 700.4).

200.4. **Stockpile** — Where readied resources are stored and where time-counter cards wait. **Expend** a resource (turn it 90° horizontal) to add its color to your resource pool.

200.5. **In play** — Battlefield and stockpile together. Effects on "in play" affect both unless specified.

200.6. **Discard pile (Trashyard)** — Where defeated units, resolved cyberspells, and trashed cards go.

200.7. **Dismantled zone** — Removed-from-game pile. Cards in the dismantled zone are always face up. When you would gain a resource token, you may take one from dismantled instead.

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
> 300.1.4. A card may list more than one supertype or subtype. When type rules overlap or conflict, apply rule 100.6.

### 300.2. Supertypes

> 300.2.1. **Pilot [Entity]** — Starts in the pilot zone; a unit you may play from there. Pilot invoke cost plus augments define deck colors (see rule 900).
>
> 300.2.2. **Unit [Entity]** — Call-in combatants. Have `[TLV]` (health and damage). After resolving, enter the battlefield unless time was used (see rule 700.4). Units can attack the turn they enter the battlefield.
>
> 300.2.3. **Program [Entity]** — Stays in play; has `[TLV]`; cannot attack; may block (see rule 601).
>
> 300.2.4. **Technology [Entity]** — Support or counter-play; has `[TLV]`; cannot attack; may block (see rule 601).
>
> 300.2.5. **Augment [Entity]** — Equipment starting on the battlefield; limited by deck size; no duplicate names in a deck. Has `[TLV]`; cannot attack; may block by expending (see rule 601.4.2).
>
> 300.2.6. **Prototype [Any]** — Limited to one copy per deck capacity.
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
> 300.2.8.7. When any other token is created, put it onto the battlefield readied.

### 300.3. Subtypes

> 300.3.1. **Process [Cyberspell]** — Playable during your main phase. Has `[TLV]`; cannot attack; may block (see rule 601).
>
> 300.3.2. **Quick Hack [Cyberspell]** — Playable whenever a Process can be played, plus at end of turn, during an attack, while the lock holds a card, or when an opponent's effect empties the lock. Has `[TLV]`; cannot attack; may block (see rule 601).
>
> 300.3.3. **Weapon** — Entity subtype with an innate ability to attack (see rule 603.10). Using a weapon's innate attack ability is not an activated ability.

---

## 350. Resource Pips and Invoke Costs

350.1. A card's **invoke cost** is the row of symbols in its upper-left corner. Each symbol in an invoke cost is a **resource pip** (or **pip**).

350.2. To play a card, pay every pip in its invoke cost from your resource pool unless an effect says otherwise (see section 500). A card with no invoke cost in the upper-left corner cannot be played unless an effect allows it. By default, cards are played from hand (see rule 500.2.1).

### 350.3. Colored pips

> 350.3.1. **Solid colored pips** represent one resource of that color. The colored pip types are life `[LIF]`, metal `[MET]`, power `[POW]`, RAM `[RAM]`, time `[TIM]`, and steel `[STL]`.
>
> 350.3.2. **Hybrid pips** show two colors on one symbol (for example `[LIF-MET]`). Pay one resource that matches either color shown.
>
> 350.3.3. Colored pips define deck color requirements (see section 900.4) and may be gained when you accumulate resources (see rule 602.1).

### 350.4. Generic pips

> 350.4.1. **Generic pips** are grey numbered symbols such as `[GEN1]`, `[GEN2]`, and other numbered generic values through `[GEN10]`, plus `[GEN]` and `[GENX]` where printed.
>
> 350.4.2. Each generic pip may be paid with one resource of **any** color from your pool (see rule 500.6).
>
> 350.4.3. Generic pips are not colored pips. They are ignored when checking deck color legality and when accumulating resources (see rules 602.1 and 900.4.3).
>
> 350.4.4. Time counters may reduce generic pip costs only (see rule 700.4).

---

## 400. Setup and Turns

### 400.1. Setup

> 400.1.1. Each player needs a pilot, augments, a deck, life tracking, damage dice, time-counter dice, and resource tokens.
>
> 400.1.2. Place pilot in the pilot zone; shuffle deck into the R.I.G. zone; place augments readied on the battlefield; place pilot's starting resources readied in stockpile; set life and draw a starting hand per pilot values.
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

> 400.2.3.1. You may play cards, activate abilities, make attacks, allocate a resource to a unit, accumulate resources, or block incoming damage directed at you, in any order where timing allows.
>
> 400.2.3.2. See sections 600–603 for default game actions.

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

500.2. To play a card, have the required resources in your resource pool, pay the cost, reveal the card, and put it in the lock. If the lock is empty, the card becomes the lock occupant. If the lock is full, the played card overwrites the lock occupant (see rules 700.2.3 and 700.2.4). Only effects go to a queue when the lock is full (see rule 700.2.2).

> 500.2.1. **Where you may play from.** By default, you play cards from your hand. You may play a card from another zone only if a card ability or effect explicitly allows it — for example, from your pilot zone, trashyard, or dismantled zone. Such a play still follows rules 500.3–500.5 and 700.4 unless the ability says otherwise.

500.3. If the card targets, you must have legal targets before playing it (see section 100.7).

500.4. When the card enters the lock, declare targets and resolve `[INVOKE]` tags immediately. The card remains the lock occupant until it resolves or is overwritten by another played card.

> 500.4.1. While it is the lock occupant, the active player may overwrite it with a Quick Hack or take other actions allowed while the lock is full (see section 700).

500.5. If the lock occupant is not overwritten, it resolves when the lock process allows: put the card in its zone (battlefield for entities, discard pile for cyberspells), resolve its `[EFFECT]` tag, then other triggers such as `[ENTERS PLAY]`.

500.6. Generic pips may be paid with any one pool resource each; time counters may reduce generic pip costs (see rules 350.4 and 700.4).

500.7. Resource tokens usually have `[EXPEND]` abilities that add one or two resources of their color to your pool.

> 500.7.1. Using a resource's `[EXPEND]` ability does not use the lock; expend the resource and add its color to your resource pool immediately.
>
> 500.7.2. You may use resource abilities while the lock is full (see rule 700.5.1).

---

## 600. Default Game Actions

### 601. Block

601.1. Blocking is a default game action.

601.2. Whenever damage is directed at you as a player — from an attack, cyberspell, card effect, or any other source — you may block before that damage becomes loss of life.

601.3. You may block whenever you could take other default game actions while the lock is full (see rule 700.5).

601.4. You may block in any order:

> 601.4.1. Discard any number of hand cards with a `[TLV]` rating (including processes and quick hacks). Each card contributes up to 4 `[TLV]` toward block (Block keyword raises this). Reduce incoming damage from a damage source of your choice by the total.
>
> 601.4.2. Expend any number of augments you control; for each, choose a damage source, reduce damage by that augment's `[TLV]`, and add a depletion counter to it.
>
> 601.4.3. Expend any number of non-unit entities you control (programs, technologies, etc.); for each, choose a damage source, reduce damage by that entity's `[TLV]`, then trash the expended entity.
>
> 601.4.4. A card with one or more time counters on it cannot be used to block (see rule 700.4.2.1).

601.5. Unblocked damage directed at you becomes loss of life.

601.6. During an attack, blocking happens before player damage from that attack is applied (see rule 603.8).

### 602. Accumulate resources

602.1. Once per turn during your main phase, reveal a card from hand and gain up to three resource tokens from its colored pips (ignore generic pips; see section 350).

602.2. Put gained resources readied into stockpile; put the revealed card on the bottom of your deck.

602.3. This action does not use the lock.

602.4. Resource tokens created this way are created immediately in the stockpile; they do not use the lock-and-resolve flow in rule 300.2.8.

### 603. Attack

603.1. Attacking is a primary way to deal damage and pressure opponent resources. Damage marked on units persists until healed.

603.2. **Declare attackers** — Choose unit(s) on the battlefield, weapon(s) using their innate attack ability (see rule 603.10), and/or activate an augment that makes an attack. Multiple attackers are one attack sharing one target; each attacker is treated separately for blocking and damage assignment. A unit may attack if it has the Unit supertype, including when it also has a type that otherwise cannot attack (see rules 100.6 and 100.6.2).

> 603.2.1. A card with one or more time counters on it cannot attack (see rule 700.4.2.1). When the last counter is removed from a stockpile card, it moves to the battlefield before it can attack (see rules 700.4.4 and 300.2.2).

603.3. **Declare target** — Expend unit attackers. Pay each weapon attacker's innate cost (see rule 603.10.2). Choose the defending player or a unit on the battlefield as the attack target, and trigger on-attack abilities. You must target a readied unit on the battlefield the defender controls if able; if none, you cannot attack.

> 603.3.1. Cards in other zones — including the stockpile, trashyard, pilot zone, and R.I.G. — cannot be chosen as attack targets unless an effect says otherwise.

603.4. **Attack step** — Attackers are now attacking. Pay additional costs such as Stealth if required.

603.5. **Response window** — Players play Quick Hacks or activate abilities, active player first, until both pass.

> 603.5.1. If a unit on the battlefield would become readied, an illegal player target redirects to a readied unit on the battlefield the attacker chooses.

603.6. **Block window** — Before player damage becomes loss of life, the defending player may block (see rule 601).

603.7. **Preemptive Strike damage** — Attackers with Preemptive Strike deal `[TLV]` damage (including modifiers).

603.8. **Combat damage** — If Preemptive Strike damage was not dealt, attackers deal `[TLV]` to the attack target. A readied defending unit deals `[TLV]` back; an expended defending unit deals 0. Damage is simultaneous.

> 603.8.1. If there are multiple attackers, the defending player divides the defending unit's damage among them as they choose.
>
> 603.8.2. After damage, a unit is defeated if marked damage ≥ its `[TLV]` (or `[TLV]` + X with Durable X). Trigger on-defeat abilities; put defeated units in the discard pile.

603.9. **Player damage** — Unblocked damage directed at a player becomes loss of life. The attack ends.

### 603.10. Weapon attacks

603.10.1. A weapon you control has an **innate ability** to attack. Using it is not an activated ability and does not use the lock.

603.10.2. To attack with a weapon, `[EXPEND]` that weapon and `[DISMANTLE]` a resource of your choice you control.

603.10.3. Choose targets following the same rules as attacking with units (see rules 603.3 and 603.5.1).

603.10.4. A weapon may join the same attack as one or more units (see rule 603.2).

603.10.5. If a weapon deals damage to a readied unit, put a depletion counter on that weapon.

603.10.6. Otherwise, a weapon in an attack follows rules 603.4–603.9 like other attackers.

### 604. Allocate a resource to a unit

604.1. Once per turn on your turn, when you could play a Process, you may allocate a resource to a unit you control.

604.2. Expend the resource `[EXPEND]` and choose the unit. Each allocated resource gives +1 `[TLV]` to that unit.

604.3. This does not use the lock and resolves immediately.

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
> 700.1.6. Paying costs, using resource abilities, activating into your queue, and blocking may be done by whoever is currently adding effects (including the non-active player during Alternate); Quick Hack overwrite remains active-player only.

### 700.2. Scenario 1 — Lock occupant, cards, and Quick Hacks

> 700.2.1. **Empty lock** — A played card or lock-using effect enters the lock.
>
> 700.2.2. **Full lock — effects** — A lock-using effect goes to its controller's queue instead. It does not enter the lock.
>
> 700.2.3. **Full lock — cards** — A played card overwrites the lock occupant and becomes the new occupant. It does not go to a queue.
>
> 700.2.4. **Overwrite result** — When a card overwrites the lock occupant, the replaced card goes to its controller's stockpile with two time counters (or is discarded if stockpile already has three time-counter cards). A replaced effect does nothing. Recalculate active player; restart "while lock is full."
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

> 700.4.2.1. While the card has one or more time counters on it, it has no abilities (except abilities with the `[ATOMIC]` tag; see rule 800.1.2). It cannot attack or block, regardless of zone or ready state.

700.4.3. At the start of each of your turns, remove one counter from each of your time-counter cards.

700.4.4. When the last counter is removed from a stockpile card, resolve its effects without using the lock, then move it to the battlefield (entity) or discard pile (cyberspell).

700.4.5. You may have at most three time-counter cards in stockpile.

### 700.5. Actions while lock is full

> 700.5.1. Pay costs and use resource abilities (do not use the lock).
>
> 700.5.2. Allocate a resource to a unit (see rule 604).
>
> 700.5.3. Activate an ability that uses the lock — it goes to your queue.
>
> 700.5.4. Block incoming damage directed at you (see rule 601).

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
> 800.1.8.1. If the condition refers to **playing** a card, the condition is met when that play is complete under rule 500.2 (the card enters or overwrites the lock occupant) or rule 700.4.2 (time counters replace the lock step). This includes plays from zones other than hand when an ability allows (see rule 500.2.1), such as Recursive from the trashyard. The triggered effect then enters the lock or its controller's queue like other triggered abilities (see section 700).
>
> 800.1.9. `[STATIC]` — Always active in play.
>
> 800.1.10. `[EFFECT]` — When the played card resolves; default for untagged non-activated abilities.
>
> 800.1.11. `[DEFEATED]` — When the unit is put into the discard pile from play.

### 800.2. Activated abilities

> 800.2.1. Format: `[cost]: [effect]`. Playable whenever a Quick Hack can be played unless stated otherwise.
>
> 800.2.2. If an activated ability targets, it cannot be activated unless at least one legal target exists (see section 100.7).
>
> 800.2.3. To activate, pay costs; if the lock is empty the effect enters the lock, otherwise your queue. Declare legal targets when the effect enters the lock or queue.
>
> 800.2.4. **Expend `[EXPEND]`** — Turn a card 90° from vertical (readied = vertical).
>
> 800.2.5. **Recycle `[RECYCLE]`** — Discard from hand at Quick Hack timing.
>
> 800.2.6. **Trash `[TRASH]`** — From battlefield; put printed card in discard pile as cost.
>
> 800.2.7. **Dismantle `[DISMANTLE]`** — From play; put the printed card face up in the dismantled zone as a cost (see rule 200.7).
>
> 800.2.8. **Innate abilities** — Abilities on a card that are neither activated abilities nor tags. They follow their rules and do not use the lock unless those rules say otherwise (see rule 603.10 for weapon attacks).

> 800.3.1. Keywords are static unless noted. Duplicate keywords on one entity do not stack except numerical values, which add.
>
> 800.3.2. **Airborne** — Only Airborne or Long Range can attack this entity.
>
> 800.3.3. **Block X** — When blocking, reduce damage by an additional X.
>
> 800.3.4. **Corrosive Bile** — Whenever this entity deals damage to a unit, destroy that unit.
>
> 800.3.5. **Degrade X** — Affected player mills X from their R.I.G.
>
> 800.3.6. **Durable X** — Defeated at `[TLV]` + X damage instead of `[TLV]`.
>
> 800.3.7. **Preemptive Strike** — Deals damage first in a fight unless the opponent also has Preemptive Strike.
>
> 800.3.8. **Hardened X** — Reduce damage taken by X.
>
> 800.3.9. **Hard Point** — May equip a second copy of this card as an augment.
>
> 800.3.10. **Insatiable Hunger** — Attacks must target a unit the defender controls if they control one.
>
> 800.3.11. **Invulnerable** — Cannot be trashed, dismantled, or destroyed by those effects; cannot be chosen as target for them.
>
> 800.3.12. **Lethal X** — Deals X additional damage when it deals damage.
>
> 800.3.13. **Long Range** — Can attack Airborne units.
>
> 800.3.14. **Pierce** — Excess damage to a unit's controller is redirected to that player.
>
> 800.3.15. **Recursive** — You may play this card from the trashyard by paying its invoke cost (see rules 500.2 and 500.2.1). Allocate the top R.I.G. card face down to the played card; the next time this asset would go to the discard pile, dismantle it and the face-down card instead.
>
> 800.3.16. **Refurbished** — Dismantle cards from trashyard to pay `[GEN]` costs on this card.
>
> 800.3.17. **Spirit Link** — Damage this asset deals is gained as life by its controller.
>
> 800.3.18. **Stalwart** — Does not expend when attacking.
>
> 800.3.19. **Stationary** — Cannot attack.
>
> 800.3.20. **Stealth X** — Additional cost to target or attack with cyberspells/abilities/attacks.
>
> 800.3.21. **Sturdy** — Cannot be destroyed by "destroy" effects.
>
> 800.3.22. **Surge** — Invokable whenever a Quick Hack can be played.
>
> 800.3.23. **Weakened X** — Deals X less damage.
>
> 800.3.24. **Desperate Maneuver X** — When you draw this card, you may reveal it. If you do, dismantle X and play it immediately as though it had Surge without paying its invoke cost. Otherwise you may put it into your hand.
>
> 800.3.25. **PEER X** — Look at the top X cards of your deck. You may put any of them into your discard pile, then put the rest back on top of your R.I.G. in any order.

---

## 900. Deck Building

900.1. Your R.I.G. is your deck plus pilot and augments (pilot and augments do not count toward capacity).

### 900.2. Deck sizes

| Class | Capacity | Augments | Modifier |
| --- | --- | --- | --- |
| Heavy weight | 30 | 3 | Max 2 copies per name |
| Medium weight | 40–50 | 2 | — |
| Light weight | 60–70 | 1 | Pilot colored pips count double for color combination |

### 900.3. Deck rules

> 900.3.1. One pilot only.
>
> 900.3.2. Up to three copies per non-pilot name (two on heavy weight).
>
> 900.3.3. No duplicate augment names; augments do not count toward capacity.
>
> 900.3.4. Prototype limited to one copy in capacity.
>
> 900.3.5. Every card must be legal for your pilot + augment color combination.

### 900.4. Color combination

> 900.4.1. Combined colored pips on pilot invoke cost plus augment colors define your palette.
>
> 900.4.2. A card is legal if its colored pips are fewer than or equal to your combined colored pips (see section 350.3).
>
> 900.4.3. Generic pips are ignored when determining color combination legality. They do not count as colored pips and do not count as steel.
>
> 900.4.4. A card whose invoke cost contains only generic pips (and no colored pips) may be included in any deck.
>
> 900.4.5. There is no sideboard; include sideboard cards in deck capacity when building.

---

 "He forgot to mention HAIs, man..." — Svn*
