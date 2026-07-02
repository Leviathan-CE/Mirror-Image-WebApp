import type { CSSProperties, ReactNode } from "react"

import { GameIcon } from "@/components/common/GameIcon"
import { GlitchFx } from "@/components/effects/GlitchFx"

const HOME_BACKGROUND_IMAGE = "/images/Zone-32B.png"
const BANNER = "/images/banner2.jpg"
const CARD_PILOT = "/images/card_pilot.png"
const CARD_AUGMENT = "/images/card_augment.png"

type TocEntry = { id: string; label: string }

const SECTIONS: TocEntry[] = [
    { id: "story", label: "The Story" },
    { id: "objective", label: "The Objective" },
    { id: "how-to-win", label: "How to Win" },
    { id: "playmat", label: "Playmat Area" },
    { id: "reading-cards", label: "Reading Your Cards" },
    { id: "card-types", label: "Card Types" },
    { id: "timing", label: "Timing, Triggers & Keywords" },
    { id: "keywords", label: "Keyword Abilities" },
    { id: "lock", label: "The Lock & Time Counters" },
    { id: "how-to-play", label: "How to Play" },
    { id: "deck-building", label: "Deck Building" },
]

const KEYWORDS: { name: string; text: ReactNode }[] = [
    { name: "AIRBORNE", text: "Only assets with Airborne or Long Range can attack this entity." },
    { name: "BLITZ", text: "This entity can attack the turn it enters the battlefield." },
    { name: "BLOCK X", text: "When you block with a unit, augment, or cyberspell to reduce the damage an asset would deal, reduce it by an additional X." },
    { name: "CORROSIVE BILE", text: "Whenever this entity deals damage to a unit, destroy that unit." },
    { name: "DEGRADE X", text: "The affected player puts the top X cards of their RIG into their trashyard. When card text says a player degrades X, that player is the affected player; if no player is stated, that player is you." },
    { name: "DURABLE X", text: <>This entity can take X damage more than its <GameIcon name="rating" /> rating before being defeated.</> },
    { name: "PREEMPTIVE STRIKE", text: "When this entity deals damage in a fight, it deals damage first, unless the opposing entity also has Preemptive Strike." },
    { name: "HARDENED X", text: "Whenever this entity takes damage, reduce that damage by X." },
    { name: "HARD POINT", text: "You may have a second copy of this card equipped as an augment for your RIG." },
    { name: "INSATIABLE HUNGER", text: "Whenever a unit with this keyword attacks, if the defending player controls a unit, that attack must target a unit that player controls." },
    { name: "INVULNERABLE", text: "This entity cannot be dismantled, trashed, or destroyed by effects that say to trash, dismantle, or destroy. Players cannot choose it as a valid target for those effects or costs." },
    { name: "LETHAL X", text: "Whenever this unit, cyberspell, or augment deals damage, it deals X additional damage." },
    { name: "LONG RANGE", text: "This asset can attack units with Airborne." },
    { name: "PEER X", text: "Look at the top X cards of your RIG. You may put any of them into your trashyard, then put the rest back on top of your RIG in any order." },
    { name: "PIERCE", text: "Any excess damage this asset deals to its target is redirected to the target's controller." },
    { name: "RADAR (Deprecated)", text: "Whenever a unit an opponent controls attacks, if it is the first attack in the main phase, you may redirect that attack to target a unit you control instead." },
    { name: "RECURSIVE", text: "You may invoke this asset from your trashyard by paying its invoke cost. If you do, allocate the top card of your RIG face down to the invoked card; the next time this asset would go to the trashyard, dismantle it and the face-down card instead." },
    { name: "REFURBISHED", text: <>Dismantle any number of cards from your trashyard; for each card dismantled this way, pay for one <GameIcon name="steel" /> of this card's costs.</> },
    { name: "SPIRIT LINK", text: "Damage this asset deals is gained as life by its controller." },
    { name: "STALWART", text: "When this entity attacks, it does not expend as part of the attack." },
    { name: "STATIONARY", text: "This entity cannot attack." },
    { name: "STEALTH X", text: "As an additional cost to target or attack this entity, the acting player must pay X for each cyberspell, ability, or attack. If they do not pay it, that action does nothing." },
    { name: "STURDY", text: 'This entity cannot be destroyed by effects that say "destroy."' },
    { name: "SURGE", text: "This card can be invoked any time a Quick Hack can be invoked." },
    { name: "TAUNT", text: "When an opponent makes an attack, triggers, or activates an ability, it must target this entity if able. If there are multiple units with Taunt, the attacker chooses which to target." },
    { name: "WEAKENED X", text: "Whenever this asset deals damage, it deals X less damage." },
]

function Section({
    id,
    title,
    children,
}: {
    id: string
    title: string
    children: ReactNode
}) {
    return (
        <section id={id} className="scroll-mt-24 space-y-4">
            <h2 className="font-glitch border-b border-cyan-500/30 pb-2 text-2xl text-cyan-300">
                {title}
            </h2>
            <div className="space-y-4 leading-relaxed text-gray-300">{children}</div>
        </section>
    )
}

function Term({ children }: { children: ReactNode }) {
    return <span className="font-semibold text-cyan-200">{children}</span>
}

function TableOfContents() {
    return (
        <nav
            aria-label="Table of contents"
            className="rounded-md border border-cyan-500/20 bg-black/60 p-4 lg:sticky lg:top-24"
        >
            <h2 className="font-glitch mb-3 text-lg text-cyan-300">Contents</h2>
            <ol className="space-y-1 text-sm">
                {SECTIONS.map((section, index) => (
                    <li key={section.id}>
                        <a
                            href={`#${section.id}`}
                            className="text-gray-400 transition-colors hover:text-cyan-200"
                        >
                            <span className="mr-2 text-cyan-500/60">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            {section.label}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    )
}

export function HowToPlayPage() {
    return (
        <section
            className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
            style={{ backgroundImage: `url(${HOME_BACKGROUND_IMAGE})` }}
        >
            <div className="absolute inset-0 bg-black/60" aria-hidden />

            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-6">
                <img
                    src={BANNER}
                    alt="Mirror Image banner"
                    className="clip-angled w-full max-w-3xl"
                    style={{ "--angle": "50px" } as CSSProperties}
                />

                <div className="flex flex-wrap justify-center gap-4">
                    <GlitchFx
                        label="DOWNLOAD GAMEPLAY GUIDE"
                        size="lg"
                        className="font-buahs93 h-8 rounded-none bg-cyan-700 px-10 hover:bg-cyan-900 active:bg-cyan-400"
                    />
                    <GlitchFx
                        label="PRINTABLE REMINDER SHEET"
                        size="lg"
                        className="font-buahs93 h-8 rounded-none bg-cyan-700 px-10 hover:bg-cyan-900 active:bg-cyan-400"
                    />
                </div>

                <div className="grid w-full gap-8 lg:grid-cols-[240px_1fr]">
                    <aside>
                        <TableOfContents />
                    </aside>

                    <div className="space-y-12">
                        <Section id="story" title="MIRRORIMAGE">
                            <p>
                                On the planet Aerathea, its people find themselves in the middle of
                                a war to end all wars. Two factions wage combat with might, magic,
                                technology, space, nuclear, chemical, and biological warfare across
                                a world already ravaged by thousands of years of conflict. The
                                Empire of Vrag, ruled by a rogue AI shadow government, seeks total
                                control and dominance over the entire world. Opposing it, the
                                United Democratic Countries (UDC)&mdash;an alliance of men, elves,
                                and the remnants of many other factions broken in the old wars&mdash;
                                fight to resist this oppressive threat to freedom and liberty.
                            </p>
                            <p>
                                You are among the elite of the cybernetic enhancement program known
                                as the Pilot Program, joining the ranks of the 3rd-generation
                                pilots: cybernetically enhanced soldiers armed to the teeth and
                                aided by a Human Augmented Intelligence (HAI). You can fight for
                                freedom, serve tyranny, or sell your skills to the highest bidder.
                                The choice is yours.
                            </p>
                        </Section>

                        <Section id="objective" title="The Objective">
                            <p>
                                In this game you fight against both the clock and your opponent,
                                racing to secure victory and survive on the battlefield with
                                limited resources. The goal is to defeat your opponent before you
                                run out of resources: either by reducing your opponent's life to 0,
                                or by outlasting them until they run out of resources in their
                                stockpile at the start of their turn.
                            </p>
                            <p>
                                To pursue victory, you build a deck of cards consisting of your
                                pilot, augments, entities, and cyberspells. These let you deal
                                damage, perform drastic maneuvers to stay alive, and generate the
                                resources you need to play the cards in your hand.
                            </p>
                        </Section>

                        <Section id="how-to-win" title="How to Win">
                            <p>
                                The most straightforward way to victory is to reduce your
                                opponent's life points to 0 by attacking with units (a type of
                                entity), strikes (a type of cyberspell), or weapons (a type of
                                entity).
                            </p>
                            <p>
                                Another way to win is to run your opponent out of cards in their
                                deck. This doesn't end the game immediately, but each card they try
                                to draw from an empty deck causes them to lose 1 life (or concede).
                                The final way to win is if your opponent starts their turn with 0
                                resources in their stockpile zone.
                            </p>
                        </Section>

                        <Section id="playmat" title="Playmat Area">
                            <p>
                                <Term>Battlefield:</Term> The zone where all your entities go when
                                they are played from anywhere. The only exception is when you use
                                time counters to pay for part of a card's casting cost&mdash;then it
                                goes into the stockpile until all the time counters are removed, at
                                which point it moves to the battlefield.
                            </p>
                            <p>
                                <Term>Stockpile:</Term> The zone where all your resources are
                                stored for use. To use a resource, turn it 90 degrees from vertical
                                to horizontal (this is called expending and is represented by the{" "}
                                <GameIcon name="expend" /> symbol). Expending a resource this way
                                adds its color to pay for the costs of cards and abilities. Cards
                                you play using time counters also go in the stockpile zone.
                            </p>
                            <p>
                                <Term>In Play:</Term> A reference to both the battlefield and the
                                stockpile. Anything that affects "in play" affects both of these
                                zones.
                            </p>
                            <p>
                                <Term>Pilot:</Term> The pilot zone is where you put your pilot card.
                                You may play your pilot from this zone by paying its cost. Whenever
                                your pilot is defeated or moves from one zone to another, you may
                                instead return it to your pilot zone and increase its cost.
                            </p>
                            <p>
                                <Term>RIG:</Term> The zone where you place your deck, face down and
                                shuffled, before the game starts. Your deck is called your RIG,
                                which stands for Regressive Integrated Gear, and is filled with the
                                entity and cyberspell cards you put together to create your deck.
                            </p>
                            <p>
                                <Term>Trashyard:</Term> The trashyard zone (a.k.a. the discard pile)
                                is where cards go when they leave play through various effects or
                                abilities&mdash;for example, when a unit is defeated or when you
                                complete the effect of playing a cyberspell.
                            </p>
                            <p>
                                <Term>Dismantled:</Term> The dismantled zone holds cards that are
                                removed from the game; they stay there, unusable, until the game
                                ends. It functions like a separate discard pile, placed wherever you
                                choose so long as it is not part of the main areas listed above.
                                Whenever you gain a resource card into your stockpile, you may
                                instead take one from the dismantled zone&mdash;the same applies when
                                creating tokens (which resources are).
                            </p>
                        </Section>

                        <Section id="reading-cards" title="Reading Your Cards">

                            <p className="rounded border-l-2 border-red-500/60 bg-red-950/30 p-3 text-sm">
                                <Term>! Important !</Term> If there is a conflict between a card's
                                text and this rulebook, follow the text on the card. Cards often
                                have abilities that get around the rules to make things exciting,
                                weird, or interesting.
                            </p>
                            <div className="mx-auto flex w-full max-w justify-center">
                                <img
                                    src={CARD_PILOT}
                                    alt="Example pilot card"
                                    className="w-full"
                                />
                            </div>

                            <div className="mx-auto flex w-full max-w justify-center">
                                <img
                                    src={CARD_AUGMENT}
                                    alt="Example pilot card"
                                    className="w-full"
                                />
                            </div>
                        </Section>

                        <Section id="card-types" title="Card Types">
                            <p>
                                Each non-resource card is called an Asset and has a base type of
                                either Entity or Cyberspell, along with an assortment of supertypes
                                and subtypes. If a card does not have the base type Cyberspell
                                written in its supertype text, it has the base type Entity&mdash;even
                                if it is not written on the card.
                            </p>
                            <p>
                                A card's type is shown in the Types box at the center of the card.
                                The following supertypes affect what a card does, with their
                                corresponding base type shown in [ ]. Many cards also have subtypes,
                                which can affect what the card does as well.
                            </p>
                            <p className="rounded border-l-2 border-red-500/60 bg-red-950/30 p-3 text-sm">
                                <Term>! Important !</Term> Whenever an ability, effect, or text uses
                                the word "this," it always refers to the card it is printed on,
                                regardless of context.
                            </p>
                          

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">Base Types</h3>
                            <p>
                                <Term>Cyberspell:</Term> When you play a card with this type, it
                                goes to the discard pile after its effect resolves or is
                                overwritten.
                            </p>
                            <p>
                                <Term>Entity:</Term> When you play a card with this type, it goes to
                                the battlefield if time counters are not used to play it (or to the
                                stockpile if time counters are used) after its effects resolve. If
                                it is overwritten, it goes to the discard pile.
                            </p>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">Super Types</h3>
                            <p>
                                <Term>PILOT [ Entity ]:</Term> Your pilot is the center of
                                attention, commanding drones, mechs, hacks, spells, and other
                                effects from your deck in the pilot zone. You can also have them join
                                the heat of battle if you choose, to show off why you picked this
                                pilot. The pilot is a unit that starts in your pilot zone and can be
                                played from that zone by paying its invoke cost. In addition to
                                paying that cost, your pilot's invoke cost&mdash;combined with your
                                augments&mdash;determines the colors of cards you can put into your
                                deck. (See Deck Building for more details.)
                            </p>
                            <p>
                                <Term>UNIT [ Entity ]:</Term> Units are call-ins that back up your
                                pilot, ranging from drones, turrets, and tanks to spacecraft,
                                helping you eliminate your opponent tactfully or with overwhelming
                                force. To play a unit, pay its invoke cost and place it into the lock
                                to see whether your opponent overwrites it with a Quick Hack. If they
                                don't, it goes directly to the battlefield&mdash;provided you chose
                                not to use time as part of its cost (see Time Counters for how the
                                time resource works). Units cannot attack the turn they are played.
                            </p>
                            <p>
                                <Term>PROGRAM [ Entity ]:</Term> A type of card that tends to be
                                synergistic, stays in play once played, and has a variety of effects
                                and abilities.
                            </p>
                            <p>
                                <Term>TECHNOLOGY [ Entity ]:</Term> A type of card that tends to be a
                                counter-play or support piece, stays in play once played, and has a
                                variety of effects and abilities.
                            </p>
                            <p>
                                <Term>AUGMENT [ Entity ]:</Term> Pieces of equipment or cybernetic
                                enhancements your pilot uses in battle to augment your game plan and
                                strategy. They start the game on the battlefield and are limited
                                based on the number of cards in your deck. You cannot have two
                                augments with the same name in your deck.
                            </p>
                            <p>
                                <Term>PROTOTYPE [ ANY ]:</Term> Prototype weapons, spells, and
                                equipment, often rare in the lore. A card with this type is
                                restricted to a single copy in your deck (RIG).
                            </p>
                            <p>
                                <Term>RESOURCE [ Entity ]:</Term> Resource tokens you use to play
                                (invoke) cards (assets) from different zones of play. Whenever a card
                                says to "gain" a resource, create a token of the specified color and
                                put it into your stockpile readied (90 degrees vertical). You can use
                                resources as soon as they enter play&mdash;no need to wait as a unit
                                does.
                            </p>
                            <p>
                                <Term>TOKEN [ Entity ]:</Term> Usually created by an effect; tokens
                                do not go to the discard pile when defeated or trashed. You may use
                                your own objects as tokens, so long as it is clear which token they
                                represent and whether they are expended.
                            </p>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">Sub Types</h3>
                            <p>
                                <Term>PROCESS [ Cyberspell ]:</Term> This cyberspell can be played
                                any time during your main phase. Processes represent a combination of
                                magic and technology&mdash;complex programs or scripts that take
                                significant time to invoke in battle.
                            </p>
                            <p>
                                <Term>STRIKE [ Cyberspell ]:</Term> This cyberspell can be played any
                                time during your main phase and counts as making an attack. When you
                                play this card, choose a target for its <GameIcon name="rating" />{" "}
                                damage. Any additional effects it has also target the same target,
                                unless the card says otherwise. Strikes tend to be special moves,
                                magic, or other attacks and feats of prowess your pilot can pull off
                                in the spur of the moment.
                            </p>
                            <p>
                                <Term>QUICK HACK [ Cyberspell ]:</Term> This cyberspell can be played
                                any time you can play a Process. You may also play it at the end of
                                each turn, during an attack, when there is a card in the lock, or
                                when an effect not controlled by you resolves and the lock becomes
                                empty. (See Using the Lock for details.) Quick Hacks represent the
                                fastest scripts you can invoke, letting you disrupt your opponent or
                                protect yourself.
                            </p>
                        </Section>

                        <Section id="timing" title="Timing, Triggers & Keywords">
                            <p>
                                Some cards include highlighted words or keyword abilities. All
                                abilities except the EFFECT tag and ACTIVATED abilities are displayed
                                as tags on a card; special keyword text is highlighted in black.
                                There are two types of tags: STATIC and TRIGGERED. A STATIC tag means
                                the ability is always in effect while it is in play; a TRIGGERED
                                ability triggers when a particular condition is met. When two
                                triggers are side by side, both are in effect in an "and"
                                relationship. Some tag conditions may be altered; when they are, the
                                condition is always printed first, followed by a comma and then the
                                effect, formatted (ignoring the brackets) as [condition], [effect].
                            </p>

                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <GameIcon name="atomic" className="mt-0.5 shrink-0" />
                                    <span>Abilities with this tag trigger and/or stay active even while there are time counters on the card.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="entersPlay" className="mt-0.5 shrink-0" />
                                    <span>Triggers when this card enters play for the first time, whether the battlefield or the stockpile. This ability always has this tag.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="battlefield" className="mt-0.5 shrink-0" />
                                    <span>Triggers when the card enters the battlefield for the first time.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="stockpile" className="mt-0.5 shrink-0" />
                                    <span>Triggers when the card enters the stockpile for the first time.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="attack" className="mt-0.5 shrink-0" />
                                    <span>Triggers when you make an attack with that card.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="endTurn" className="mt-0.5 shrink-0" />
                                    <span>Triggers on a card at the end of your turn.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="start" className="mt-0.5 shrink-0" />
                                    <span>Triggers on a card at the start of your turn.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="invoke" className="mt-0.5 shrink-0" />
                                    <span>Triggers when you play the card this tag is printed on, but before the card goes to the lock; it always resolves as soon as it is triggered.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="conditional" className="mt-0.5 shrink-0" />
                                    <span>Triggers when a condition is met, formatted (ignoring the brackets) as [condition], [effect].</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="static" className="mt-0.5 shrink-0" />
                                    <span>This ability is always active while the card is in play.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="effect" className="mt-0.5 shrink-0" />
                                    <span>Triggers when the played card resolves. Non-activatable abilities without any tag automatically have this one. (Note: effects are also referenced as what an ability does.)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="defeated" className="mt-0.5 shrink-0" />
                                    <span>Triggers when the unit it is printed on is defeated, meaning put into the trashyard from play.</span>
                                </li>
                            </ul>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">
                                Activated Abilities
                            </h3>
                            <p>
                                Activated abilities are formatted (ignoring the brackets) as [cost 1,
                                cost 2, etc.]: [effect]. Unless they say otherwise, they can be
                                activated any time you can play a Quick Hack; if you do, add it to
                                your queue of effects while the lock is full. You must choose legal
                                targets only when you put the effect into the lock; if no legal
                                target is found, the ability does nothing. To activate an activated
                                ability, pay the cost written on the card. Its effect then goes to
                                the lock and resolves.
                            </p>
                            <p>
                                Example: the activated ability "<GameIcon name="expend" /> : Draw a
                                card" means to expend the card the ability is printed on, then pay 1
                                yellow unit of power and 1 of any color of your choice, to add the
                                "draw a card" effect to the lock&mdash;after which it resolves.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <GameIcon name="expend" className="mt-0.5 shrink-0" />
                                    <span>The Expend ability and symbol. Turn a card in play 90 degrees from vertical to horizontal. If this is printed on a unit, it cannot be used the turn the unit enters play unless it has Blitz. (Note: to ready an entity is the opposite of expending; a readied entity is vertical.)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="recycle" className="mt-0.5 shrink-0" />
                                    <span>The Recycle ability and symbol. Discard this card from hand to gain an effect, at any time you can play a Quick Hack, except when the lock is full.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="trash" className="mt-0.5 shrink-0" />
                                    <span>The Trash ability and symbol. It can only be activated while the card it is printed on is on the battlefield; as part of a cost, put that card into the discard pile (trashyard).</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="dismantle" className="mt-0.5 shrink-0" />
                                    <span>The Dismantle ability and symbol. It can be activated while in play; as part of a cost, put the card it is printed on into the dismantled zone.</span>
                                </li>
                            </ul>
                        </Section>

                        <Section id="keywords" title="Keyword Abilities">
                            <p>
                                Keyword abilities are STATIC abilities found on many of the cards you
                                will play. Almost always their ability text is displayed on the card;
                                if not, here is the full list.
                            </p>
                            <p className="rounded border-l-2 border-red-500/60 bg-red-950/30 p-3 text-sm">
                                <Term>! Important !</Term> Multiple instances of the same keyword on
                                one entity do not stack, unless that keyword has a numerical value; in
                                that case, they add together. Any keyword with X has a numerical
                                value.
                            </p>
                            <dl className="space-y-3">
                                {KEYWORDS.map((keyword) => (
                                    <div key={keyword.name} className="grid gap-1 sm:grid-cols-[200px_1fr]">
                                        <dt className="font-semibold text-cyan-200">{keyword.name}</dt>
                                        <dd>{keyword.text}</dd>
                                    </div>
                                ))}
                            </dl>
                        </Section>

                        <Section id="lock" title="The Lock & Time Counters">
                            <p>
                                The lock is a special zone where only one effect or card can be at a
                                time. Every time you play (invoke) a card without using time
                                counters, or activate or trigger an ability, it goes to the lock
                                before resolving.
                            </p>
                            <p className="font-semibold text-cyan-200">The lock does 4 things:</p>
                            <ol className="list-decimal space-y-1 pl-6">
                                <li>Determines timing.</li>
                                <li>Determines who is the active and non-active player.</li>
                                <li>Determines who can overwrite an asset with a Quick Hack.</li>
                                <li>Determines when an ability or asset resolves its effect.</li>
                            </ol>
                            <p>
                                All effects, abilities, and cards use the lock. It works like an
                                imaginary zone before effects resolve, and can only ever hold one
                                effect at a time. Whoever controls the active effect in the lock
                                determines who is the active and non-active player. The active player
                                at the start of each turn is always whoever's turn it is. The active
                                player may take game actions until an ability or asset is added to the
                                lock. Then whoever controls that asset or ability becomes the
                                non-active player, and their opponent becomes the active player. (If
                                two abilities trigger at the same time, the active player chooses one
                                of theirs to add first.)
                            </p>
                            <p>
                                There are two scenarios, depending on whether the effect in the lock
                                is an asset (a physical card) or an ability generated by a card in
                                play, in hand, or in another zone.
                            </p>
                            <p>Note: the active player is the only one able to take actions.</p>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">
                                Scenario 1 &mdash; Assets and Quick Hacks
                            </h3>
                            <p>
                                When the active player adds an asset or effect to the lock, they
                                become the non-active player, and each player adds their ability
                                triggers to their queue of effects while the lock is full. The
                                now-active player may choose to invoke (play) their own Quick Hack and
                                overwrite the asset in the lock, preventing it from resolving and
                                sending it to the discard pile (trashyard). The non-active player is
                                the one who controls the asset or effect in the lock; the active
                                player is the one who does not. The active player may play a Quick
                                Hack of their own or let the asset in the lock resolve. If they
                                respond, control passes back and forth, recalculating who has an
                                asset or effect in the lock. If they decline, the asset in the lock
                                resolves, handing the opponent a free lock and active-player status.
                                If that player also declines to act, the active player reverts to
                                whoever's turn it is, and the turn continues as normal. If the lock is
                                empty but players have abilities in their queues, move to Scenario 2.
                            </p>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">
                                Scenario 2 &mdash; Ability Effects and the Queue
                            </h3>
                            <p>
                                This follows the same rules as Scenario 1, with two differences.
                                First, the turn does not continue (whoever's turn it is becomes the
                                active player) until all players' queues are empty. Second, effects
                                cannot be overwritten&mdash;only physical cards that are played
                                (invoked) can be overwritten.
                            </p>
                            <p>
                                While an effect is in the lock, there are a few things you can do:
                            </p>
                            <ol className="list-decimal space-y-1 pl-6">
                                <li>Pay costs (resource abilities do not use the lock) but still with the timing restriction of a Quick Hack, meaning you must be the active player.</li>
                                <li>Allocate a resource to a unit you control. This is also Quick Hack speed, but you can only do so if you control no units that already have expended resources allocated to them. Each resource allocated to a unit gives it a +1 <GameIcon name="rating" /> rating. To allocate a resource, expend it and choose a target. This ability does not use the lock and happens immediately.</li>
                                <li>Activate an activated ability and add it to your queue.</li>
                                <li>Block an attack.</li>
                            </ol>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">Time Counters</h3>
                            <p>
                                Time counters shape how you interact with the lock: you can reduce a
                                card's invoke cost by one for each counter you place on it after you
                                play it. You can only reduce grey numbered-value costs this way. When
                                you do, instead of putting the card into the lock, you ignore the lock
                                entirely&mdash;protecting your asset&mdash;and place it in your
                                stockpile with the number of time counters you used to reduce its
                                cost. However, you do not get any of the card's effects right away,
                                since cards with time counters on them have no abilities. At the start
                                of each of your turns, you may remove 1 counter from each card you
                                have in play with time counters on it. When the last time counter is
                                removed from a card in your stockpile, you may resolve any effects it
                                has by adding those effects to the lock/queue (but not the card
                                itself); then move the card to the battlefield if it's an entity, or
                                to the discard pile if it's a cyberspell. You may have up to 3 cards
                                with time counters on them in your stockpile at any given time. Cards
                                with time counters on them in your stockpile cannot be the target of
                                cyberspells or abilities.
                            </p>
                        </Section>

                        <Section id="how-to-play" title="How to Play">
                            <h3 className="font-glitch text-lg text-cyan-200">Setting Up</h3>
                            <p>
                                For your first time, we recommend using a premade starter deck; it has
                                everything you need to play:
                            </p>
                            <ul className="list-disc space-y-1 pl-6">
                                <li>A pilot</li>
                                <li>2 augments</li>
                                <li>A medium-weight RIG (deck) of 40 cards, with no more than 3 copies of a named card</li>
                                <li>A D20 health tracker</li>
                                <li>5 red damage dice</li>
                                <li>5 green time-counter dice</li>
                                <li>Resource tokens</li>
                            </ul>
                            <p>
                                First, place your pilot in the pilot zone. Then shuffle your deck and
                                place it in the RIG zone. Next, place your augments on the
                                battlefield, readied. Finally, grab the starting resource tokens
                                noted on your pilot and place them in your stockpile readied (vertical,
                                90 degrees). Set your life total and draw a hand of cards in the same
                                fashion.
                            </p>
                            <p>
                                Once all players have done this, randomly determine who goes first;
                                the winner decides whether they want the first turn. (A setup demo
                                using the blue/yellow starter is shown below.)
                            </p>
                            <p>
                                Once players know who is going first, they may look at their hand.
                                Each player has one chance to mulligan unwanted cards from their
                                opening hand; this happens only once. The player going first mulligans
                                first. To mulligan, choose any number of cards from your hand, put them
                                on the bottom of your deck (RIG), and draw that many cards from the top
                                of your deck (RIG). Once all players have decided, the player going
                                first begins the first turn. Once the game starts, there is no maximum
                                hand size.
                            </p>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">Turn Phases</h3>
                            <p>
                                There are three phases: the maintenance phase (start of turn), the
                                main phase, and the end-of-turn phase. Take them in order on your
                                turn. For a more challenging game mode, include the steps marked with
                                the [Hardcore] tag.
                            </p>
                            <div className="space-y-1">
                                <p className="flex items-center gap-2 font-semibold text-cyan-200">
                                    <GameIcon name="start" /> Maintenance Phase
                                </p>
                                <ol className="list-decimal space-y-1 pl-6">
                                    <li>Ready all entities you control.</li>
                                    <li>Remove a time counter from each card you control in play, and resolve any effect triggered when the last time counter is removed from a card in your stockpile.</li>
                                    <li>[Hardcore] Dismantle a resource you control.</li>
                                    <li>Draw a card, except the player going first on the first turn of the game.</li>
                                    <li>[Hardcore] Draw an additional card.</li>
                                </ol>
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-cyan-200">Main Phase</p>
                                <p>
                                    You may play (invoke) cards, activate abilities, make attacks,
                                    allocate a resource to a unit you control, or accumulate resources,
                                    in any order.
                                </p>
                                <p>To make an attack:</p>
                                <ol className="list-decimal space-y-1 pl-6">
                                    <li>Choose unit(s) that did not enter play this turn (units with Blitz qualify), play a cyberspell strike card, or activate an augment that says it makes an attack. When attacking with multiple units, the group is considered a single attack and must share the same target, but each attacker is treated separately for blocking purposes.</li>
                                    <li>Expend the chosen unit(s), declare an attack target (another unit or an opponent), and trigger the <GameIcon name="attack" /> abilities of the attacking units.</li>
                                    <li>
                                        Block incoming damage. You may, in any order:
                                        <ul className="list-disc space-y-1 pl-6 pt-1">
                                            <li>Expend unit(s) and redirect an attacker to the expended unit instead. You can do this even if the unit entered play this turn; when multiple units are part of a single attack, you may only redirect one of them. (Attacks redirected this way do not trigger effects like Stealth.)</li>
                                            <li>Discard any number of cards in hand with a <GameIcon name="rating" /> rating, add them together, and reduce the damage from an attacker of your choice by that total.</li>
                                            <li>Expend any number of augments you control, choose an attacker for each, reduce the incoming damage by that augment's <GameIcon name="rating" /> rating, and add a depletion counter to that augment.</li>
                                        </ul>
                                    </li>
                                    <li>Before damage is dealt, players may invoke Quick Hacks or activate abilities, starting with the active player, until no one adds more effects.</li>
                                    <li>Deal Preemptive Strike damage equal to your <GameIcon name="rating" /> + modifiers.</li>
                                    <li>If you did not already deal Preemptive Strike damage, deal damage equal to your <GameIcon name="rating" /> + modifiers to the target of your attack. If the target is readied, it deals damage equal to its <GameIcon name="rating" /> + modifiers back to the attacker. Damage dealt this way is simultaneous.</li>
                                    <li>If a unit's damage is greater than or equal to its <GameIcon name="rating" /> rating, it is defeated (the only exception being the Durable keyword), triggering its <GameIcon name="defeated" /> tag if it had one, along with any other triggered abilities that care about being defeated. A defeated unit goes to the trashyard (discard pile).</li>
                                    <li>Any damage directed at a player that was not blocked or redirected is dealt as loss of life to that player. Then the attack ends.</li>
                                </ol>
                            </div>
                            <div className="space-y-1">
                                <p className="flex items-center gap-2 font-semibold text-cyan-200">
                                    <GameIcon name="endTurn" /> End-of-Turn Phase
                                </p>
                                <ol className="list-decimal space-y-1 pl-6">
                                    <li>Players may invoke Quick Hacks or activate abilities, starting with the active player, until no one adds more effects.</li>
                                    <li>Lose any unspent resources in your resource pool (not your stockpile).</li>
                                </ol>
                            </div>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">
                                Accumulate Resources
                            </h3>
                            <p>
                                You may accumulate resources only once per turn, and only on your
                                turn. To do so, choose a card in hand, reveal it, and then "gain"
                                (grab) up to three resource tokens from its listed invoke cost
                                (ignoring the grey numbered costs) and add them to your stockpile
                                readied. Then put the revealed card on the bottom of your deck (RIG).
                                This action does not use the lock.
                            </p>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">
                                How to Allocate a Resource to a Unit
                            </h3>
                            <p>
                                This ability can be used any time a Quick Hack can, including{" "}
                                <GameIcon name="expend" /> while the lock is full&mdash;but only if
                                you control no units that already have an expended resource allocated
                                to them. Each resource allocated to a unit gives it a +1 rating for
                                each resource allocated. To allocate a resource, expend it and choose
                                a target. This ability does not use the lock and happens immediately.
                            </p>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">
                                How to Play (Invoke) a Card
                            </h3>
                            <p>
                                Each card has an invoke cost, which is what lets it be played; a card
                                without an invoke cost in the upper-left corner cannot be played. To
                                pay the cost, you must have the required resources in your resource
                                pool&mdash;an imaginary area where resources go when a card says to
                                "add" a resource of the color you need; they stay there until the end
                                of the turn. Most resource tokens have two abilities that "add" 1 or 2
                                resources of their color to your pool, which you then spend on the cost
                                to play a card.
                            </p>
                            <p>
                                For example, say I want to play the Flame Kin Elementalist. I need a
                                RAM (blue) and Spirit Power (red) in my pool to invoke the card. I
                                already have a RAM and a Spirit Power readied in my stockpile, and each
                                has abilities: the first adds a resource of its respective color to my
                                pool when I expend the resource card as a cost; the second makes me
                                lose 1 life and dismantle the resource, then adds 2 of its respective
                                color.
                            </p>
                            <p>
                                Because I have what I need, I'll expend both the RAM and Spirit Power
                                resources, which adds resources of the respective color when I expend
                                them, as shown in the image below.
                            </p>
                            <p>
                                Once you have paid the cost&mdash;and if the card says to target, you
                                must have legal targets before you invoke the asset, or you cannot play
                                it&mdash;reveal the card you intend to play. It goes to the lock;
                                declare its legal targets, then trigger any{" "}
                                <GameIcon name="invoke" /> tags printed on the card and resolve it right
                                away. If it is not overwritten by an opponent's Quick Hack while it's
                                in the lock, the card resolves: first, put the card in its respective
                                zone (the battlefield for entities, the trashyard/discard pile for
                                cyberspells), then resolve its effects (<GameIcon name="effect" /> see
                                this tag for details), then resolve any other triggers such as the{" "}
                                <GameIcon name="entersPlay" /> tag. The card has now finished being
                                played. If your card's invoke cost has colorless symbols, you can use
                                any color of resource in your pool to pay for 1 of the cost it requires,
                                and/or reduce that cost by one for each time counter. See The Lock &
                                Time Counters for more details.
                            </p>
                        </Section>

                        <Section id="deck-building" title="Deck Building">
                            <p>
                                You now have everything you need to play, so let's finish up by talking
                                about making your own RIG.
                            </p>
                            <p>
                                Your R.I.G. is your deck of cards for all intents and purposes, but it
                                also includes your pilot and augments. There are three RIG classes:
                                light-weight, medium-weight, and heavy-weight. Your RIG choice
                                determines the minimum number of cards in your deck and the number of
                                augments you can equip.
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-cyan-500/30 text-left text-cyan-200">
                                            <th className="py-2 pr-4">R.I.G. (deck)</th>
                                            <th className="py-2 pr-4">Capacity (# cards)</th>
                                            <th className="py-2">Equip slots (# augments)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        <tr>
                                            <td className="py-2 pr-4">Light weight</td>
                                            <td className="py-2 pr-4">30&ndash;39</td>
                                            <td className="py-2">1</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 pr-4">Medium weight</td>
                                            <td className="py-2 pr-4">40&ndash;59</td>
                                            <td className="py-2">2</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 pr-4">Heavy weight</td>
                                            <td className="py-2 pr-4">60&ndash;70</td>
                                            <td className="py-2">3</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p>Once you've chosen a class, keep a few rules in mind when building a deck:</p>
                            <ol className="list-decimal space-y-2 pl-6">
                                <li>Pilots cannot be part of the deck's capacity, and you are limited to a single pilot card.</li>
                                <li>Any non-pilot card may have up to three copies with the same name as part of your deck's capacity.</li>
                                <li>You cannot equip two augments with the same name.</li>
                                <li>Any card with the Prototype supertype is limited to a single copy in your deck's capacity.</li>
                                <li>You cannot put cards in your deck that are not supported by your pilot's and augments' color combination.</li>
                            </ol>

                            <h3 className="font-glitch pt-2 text-lg text-cyan-200">
                                Your Deck's Color Combination
                            </h3>
                            <p>
                                Your pilot's invoke cost plus your chosen augments' augment color
                                determine your deck's color combination (see Reading Your Cards for an
                                image). There are two requirements a card must meet to be included in
                                your deck:
                            </p>
                            <ol className="list-decimal space-y-2 pl-6">
                                <li>Each card's invoke cost must have the same number of colored symbols as&mdash;or fewer than&mdash;the combined colored symbols of your pilot's invoke cost and your augments' augment color.</li>
                                <li>The total invoke cost of the card must be less than the total invoke cost provided by the colored symbols across your augments and pilot, where each colored symbol on your pilot and augments counts as 2 toward the total.</li>
                            </ol>
                            <p>
                                Note: grey numbered-value symbols are disregarded for color but still
                                count as 2 toward colorless and steel <GameIcon name="steel" /> total
                                invoke costs.
                            </p>
                            <p>
                                For this starter deck, your total color combination allows you to play
                                any card costing up to 3 blue, 3 yellow, and 1 steel or colorless&mdash;
                                with a total invoke-cost budget of 2 for colorless and steel costs, 6
                                for blue, 6 for yellow, and 12 for blue and yellow combined.
                            </p>
                            <p>
                                In the examples below you can see how the system works. Grey colorless
                                symbols do not count as steel when other colors are involved; they only
                                count toward the total invoke cost. That's why our HMIV MK IV unit is
                                legal: we can afford up to 12 total invoke cost and also meet its
                                required 2 blue and 3 yellow symbols (numbered grey symbols only count
                                toward the total invoke cost). We have up to 2 invoke cost available for
                                steel and colorless cards; for our second example, the Heavy Duty RIG
                                card has a total invoke cost of 3 and no color, so we would need one
                                more steel symbol in our suite&mdash;or our pilot would need a grey
                                numbered symbol. That is why the Heavy Duty RIG card cannot be part of
                                the deck's capacity.
                            </p>
                            <p>
                                Finally, the Flame Kin Elementalist requires blue (which we have) and
                                red (which we lack). Even though our 3 blue provides a total invoke cost
                                of 6&mdash;enough for the card's total invoke cost of 2&mdash;we cannot
                                include it, because we lack the red symbol.
                            </p>
                            <p>That concludes deck building.</p>
                            <p>
                                A few guidelines for building a functional deck: the number of cards of
                                a given color determines how likely you are to draw that color,
                                especially if you plan to build outside your pilot's starting
                                resources&mdash;you will likely need to accumulate a card of that color
                                before you can play others in it, so be careful.
                            </p>
                            <p>
                                Secondly, lighter-weight RIGs have less variance, but they also limit
                                either the variety of assets you can include or the total power of your
                                cards, since many higher-cost cards are quite powerful.
                            </p>
                            <p>
                                Lastly, there is no sideboard in this game; whatever you decide to put
                                into the deck must include your potential sideboard as part of building
                                it.
                            </p>
                            <p>
                                May you find thorough enjoyment in the game, whether it be crafting the
                                perfect RIG, the heat of battle, or creative self-expression with your
                                resources, pilot, and augments. Good luck and have fun!
                            </p>
                            <p className="border-l-2 border-cyan-500/40 pl-4 text-sm italic text-gray-400">
                                "He forgot to mention HAIs, man. I'm kind of a big deal&mdash;being
                                attached to a pilot and all... yeah... oh, right, for the next batch...
                                got it. Well then, log complete for the new pilot, I guess. Until we
                                meet again on the field of battle, signing off..." &mdash;Svn
                            </p>
                        </Section>
                    </div>
                </div>
            </div>
        </section>
    )
}
