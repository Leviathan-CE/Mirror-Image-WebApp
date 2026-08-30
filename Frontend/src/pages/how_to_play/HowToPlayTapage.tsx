import { useState, type CSSProperties, type ReactNode } from "react"

import { Link } from "react-router-dom"
import {
    BackToTocButton,
    Important,
    Note,
    Section,
    SectionLink,
    TableOfContents,
    Term,
    type TocEntry,
} from "@/components/docs"
import { GameIcon } from "@/components/common/GameIcon"
import { KEYWORD_ABILITIES } from "@/lib/howToPlay/keywords"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { howToPlayImages, sharedImages } from "@/assets"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

const SECTIONS: TocEntry[] = [
    { id: "story", label: "The Story" },
    { id: "how-to-win", label: "How to Win" },
    { id: "playmat", label: "Playmat Area" },
    { id: "how-to-play-basics", label: "Setup & Turns" },
    { id: "reading-cards", label: "Reading Your Cards" },
    { id: "card-types", label: "Card Types" },
    { id: "how-to-play-actions", label: "Core Actions" },
    { id: "lock", label: "The Lock & Time Counters" },
    { id: "timing", label: "Timing, Triggers & Keywords" },
    { id: "keywords", label: "Keyword Abilities" },
    { id: "deck-building", label: "Deck Building" },
]

const KEYWORDS = KEYWORD_ABILITIES

/** Green check icon used to mark eligible/allowed symbols in rules legends. */
function CheckMark() {
    return (
        <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-6 w-6 shrink-0 text-green-400 lg:h-7 lg:w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 6L9 17l-5-5" />
        </svg>
    )
}

/** Red cross icon used to mark ineligible/ignored symbols in rules legends. */
function CrossMark() {
    return (
        <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-6 w-6 shrink-0 text-red-500 lg:h-7 lg:w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 6L6 18M6 6l12 12" />
        </svg>
    )
}

type PlaymatZone = {
    id: string
    label: string
    description: ReactNode
    /** Hotspot rectangle as percentages of the image, matching PLAY_MAT.png. */
    top: string
    left: string
    width: string
    height: string
}

const PLAYMAT_ZONES: PlaymatZone[] = [
    {
        id: "pilot",
        label: "Pilot",
        description: (
            <>
                Where you put your pilot card. Play it by paying its cost. When your pilot is defeated
                or moves zones, you may instead return it here and increase its cost by{" "}
                <GameIcon name="gen2" />.
            </>
        ),
        top: "5%",
        left: "3%",
        width: "11%",
        height: "28%",
    },
    {
        id: "rig",
        label: "Deck (R.I.G.)",
        description:
            "Your deck — called a R.I.G. (Regressive Integrated Gear) on the playmat. Place it face down and shuffle it before the game. It holds the entity and cyberspell cards you assembled.",
        top: "35%",
        left: "2.8%",
        width: "11.5%",
        height: "29%",
    },
    {
        id: "trashyard",
        label: "Discard pile (Trashyard)",
        description:
            "Your discard pile — labeled Trashyard on the playmat. Cards go here when they leave play, for example when a unit is defeated or a cyberspell finishes resolving.",
        top: "65%",
        left: "2.8%",
        width: "11.5%",
        height: "29%",
    },
    {
        id: "in-play",
        label: "In Play",
        description:
            "A reference to both the Battlefield and the Stockpile. Anything that affects “in play” affects both zones.",
        top: "41%",
        left: "14.5%",
        width: "3.5%",
        height: "18%",
    },
    {
        id: "battlefield",
        label: "Battlefield",
        description:
            "Where all your entities go when played from anywhere. The exception: cards paid for with time counters wait in the stockpile until their counters are gone.",
        top: "5%",
        left: "16.5%",
        width: "80.5%",
        height: "43%",
    },
    {
        id: "stockpile",
        label: "Stockpile",
        description:
            "Where your resources are stored. Expend a resource (turn it 90°) to add its color and pay for cards and abilities. Cards played with time counters also live here.",
        top: "51%",
        left: "16.5%",
        width: "80.5%",
        height: "42.5%",
    },
]



/**
 * Interactive playmat diagram. Renders the playmat image with invisible
 * hotspot buttons layered on top (positioned via percentage coordinates from
 * `PLAYMAT_ZONES`). Hovering or focusing a zone highlights it and shows its
 * description below; the "In Play" zone additionally highlights the combined
 * battlefield + stockpile area. The description box is hidden when no zone is active.
 */
function InteractivePlaymat() {
    const [activeId, setActiveId] = useState<string | null>(null)
    const activeZone = PLAYMAT_ZONES.find((zone) => zone.id === activeId)

    const clearIfActive = (id: string) =>
        setActiveId((current) => (current === id ? null : current))

    return (
        <div className="space-y-4">
            <div className="relative mx-auto w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
                <img
                    src={howToPlayImages.PLAY_MAT}
                    alt="Mirror Image playmat layout"
                    className="w-full select-none"
                />
                {activeId === "in-play" && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute rounded-sm border border-cyan-300 bg-cyan-400/20"
                        style={{ top: "5%", left: "16.5%", width: "80.5%", height: "91%" }}
                    />
                )}
                {PLAYMAT_ZONES.map((zone) => (
                    <button
                        key={zone.id}
                        type="button"
                        aria-label={zone.label}
                        onMouseEnter={() => setActiveId(zone.id)}
                        onFocus={() => setActiveId(zone.id)}
                        onMouseLeave={() => clearIfActive(zone.id)}
                        onBlur={() => clearIfActive(zone.id)}
                        className={cn(
                            "absolute rounded-sm border transition-colors",
                            activeId === zone.id
                                ? "border-cyan-300 bg-cyan-400/20"
                                : "border-transparent hover:border-cyan-400/60 hover:bg-cyan-400/10"
                        )}
                        style={{
                            top: zone.top,
                            left: zone.left,
                            width: zone.width,
                            height: zone.height,
                        }}
                    />
                ))}
            </div>

            {activeZone && (
                <div
                    className="rounded-md border border-cyan-500/20 bg-black/60 p-4"
                    aria-live="polite"
                >
                    <h3 className="font-glitch mb-1 text-xl text-cyan-300 lg:text-2xl 2xl:text-3xl">
                        {activeZone.label}
                    </h3>
                    <p className="text-base text-gray-300 lg:text-lg 2xl:text-xl">{activeZone.description}</p>
                </div>
            )}
        </div>
    )
}

/**
 * The Page 
 */
export function HowToPlayPage() {
    return (
        <section
            className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
            style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
        >
            <div className="absolute inset-0 bg-black/60" aria-hidden />
            <BackToTocButton />

            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-6 xl:max-w-7xl 2xl:max-w-[110rem]">
                <img
                    src={howToPlayImages.BANNER}
                    alt="Mirror Image banner"
                    className="clip-angled w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
                    style={{ "--angle": "50px" } as CSSProperties}
                />

                <div className="flex flex-wrap justify-center gap-4">
                    <GlitchFx
                        label="DOWNLOAD COMPREHENSIVE RULES"
                        size="lg"
                        className="font-buahs93 w-auto h-auto min-h-8 shrink whitespace-normal rounded-none bg-amber-700 px-10 hover:bg-amber-900 active:bg-amber-500"
                        render={
                            <a
                                href="/docs/Rules.pdf"
                                download="Mirror-Image-Comprehensive-Rules.pdf"
                            />
                        }
                    />
                    <GlitchFx
                        label="DOWNLOAD SAMPLE DECK [SPECAIL OPERATIONS]"
                        size="lg"
                        className="font-buahs93 w-auto h-auto min-h-8 shrink whitespace-normal rounded-none bg-cyan-700 px-10 hover:bg-cyan-900 active:bg-cyan-400"
                        render={<a href="/docs/deck_samples/Demo_Starter_Specail_Operations.pdf" download />}
                    />
                    <GlitchFx
                        label="DOWNLOAD SAMPLE DECK [HUNTER KILLER]"
                        size="lg"
                        className="font-buahs93  w-auto h-auto min-h-8 shrink whitespace-normal rounded-none bg-cyan-700 px-10 hover:bg-cyan-900 active:bg-cyan-400"
                        render={<a href="/docs/deck_samples/Demo_Starter_Hunter_Killer.pdf" download />}
                    />
                </div>

                <Note className="max-w-4xl text-center">
                    This page is an introduction to Mirror Image. For rules questions, timing
                    disputes, or anything not covered here, use the{" "}
                    <strong>Comprehensive Rules</strong>{" "}
                    (
                    <a
                        href="/docs/Rules.pdf"
                        download="Mirror-Image-Comprehensive-Rules.pdf"
                        className="text-cyan-300 underline hover:text-cyan-200 not-italic"
                    >
                        PDF
                    </a>
                    {" / "}
                    <a
                        href="/docs/Rules.md"
                        download="Mirror-Image-Comprehensive-Rules.md"
                        className="text-cyan-300 underline hover:text-cyan-200 not-italic"
                    >
                        source
                    </a>
                    ). If this page and the Comprehensive Rules disagree, follow the Comprehensive
                    Rules unless a card says otherwise.
                </Note>

                <div className="grid w-full gap-8 lg:grid-cols-[260px_1fr] lg:gap-12 2xl:grid-cols-[320px_1fr] 2xl:gap-16">
                    <aside>
                        <TableOfContents sections={SECTIONS} />
                    </aside>

                    <div className="space-y-12 2xl:space-y-16">
                        <Section id="story" title="INTRODUCTION">
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
                                The choice is yours. To learn more, see our{" "}
                                <Link
                                    to={ROUTES.LORE}
                                    className="text-cyan-300 underline hover:text-cyan-200"
                                >
                                    LORE
                                </Link>
                                .
                            </p>
                        </Section>

                        <Section id="how-to-win" title="How to Win">
                            <p>
                                The most straightforward way to victory is to reduce your
                                opponent's life points to 0 by attacking with units (a type of
                                entity) or weapons (a type of entity).
                            </p>
                            <p>
                                Another way to win is to run your opponent out of cards in their
                                deck. This doesn't end the game immediately, but each card they try
                                to draw from an empty deck causes them to lose 1 life.
                                The final way to win is if your opponent starts their turn with 0
                                resources in their stockpile zone.
                            </p>
                        </Section>

                        <Section id="playmat" title="Playmat Area">
                            <p>
                                <Note>Hover over each zone of the playmat to see what it does.</Note>
                            </p>
                            <InteractivePlaymat />
                            <p>
                                <Term>Dismantled:</Term> Not shown on the mat&mdash;the dismantled
                                zone holds cards removed from the game; they stay there, unusable,
                                until the game ends. Cards in the dismantled zone are always face up.
                                It functions like a separate discard pile, placed wherever you choose
                                so long as it is not part of the main areas above. Whenever you gain
                                a resource card into your stockpile, you may instead take one from the
                                dismantled zone&mdash;the same applies when creating tokens (which
                                resources are).
                            </p>
                        </Section>

                        <Section id="how-to-play-basics" title="Setup & Turns">
                            <h3 className="font-glitch text-xl text-cyan-200 lg:text-2xl">Setting Up</h3>
                            <p>
                                For your first time, we recommend using a premade starter deck; it has
                                everything you need to play:
                            </p>
                            <ul className="list-disc space-y-1 pl-6">
                                <li>A pilot</li>
                                <li>2 augments</li>
                                <li>A medium-weight deck of 40 cards, with no more than 3 copies of a named card</li>
                                <li>A 20-sided dice health tracker or other way to track life totals</li>
                                <li>5  or more red damage 6-sided dice</li>
                                <li>5 or more green time-counter 6-sided dice</li>
                                <li>Resource and other tokens</li>
                            </ul>


                            <p>
                                First, place your pilot in the pilot zone. Then shuffle your deck and
                                place it in the deck zone (labeled R.I.G. on the mat). Next, place your augments on the
                                battlefield, readied. Finally, grab the starting resource tokens
                                noted on your pilot and place them in your stockpile readied (vertical,
                                90 degrees). Set your life total and draw a hand of cards based on your pilots starting values in the same
                                fashion.
                            </p>

                            <p>
                                Once all players have done this, randomly determine who goes first;
                                the winner decides whether they want the first turn. (A setup demo
                                using the blue/yellow starter is shown below.)
                            </p>
                            <Note>
                                Note: You may change which side you prefer to have your deck, pilot zone, and discard pile
                                for convenience. When designing the game they were defaulted to the left; you may have them
                                on the right if that is more comfortable.
                            </Note>

                            <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                <img
                                    src={howToPlayImages.SETUP}
                                    alt="Setting up the starting game board for a player"

                                />
                            </div>

                            <p>
                                Once players know who is going first, they may look at their hand.
                                Each player has one chance to mulligan unwanted cards from their
                                opening hand; this happens only once. The player going first mulligans
                                first. To mulligan, choose any number of cards from your hand, put them
                                on the bottom of your deck, and draw that many cards from the top
                                of your deck. Once all players have decided, the player going
                                first begins the first turn. Once the game starts, there is no maximum
                                hand size.
                            </p>

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">Turn Phases</h3>
                            <p>
                                There are three phases: start of turn, the
                                main phase, and the end-of-turn phase. Take them in order on your
                                turn.
                            </p>
                            <div className="space-y-1">
                                <p className="flex items-center gap-2 font-semibold text-cyan-200">
                                    Start of Turn
                                </p>
                                <div className="border-l-2 border-cyan-500/0 pl-4">
                                    <ol className="list-decimal space-y-1 pl-6">                                        
                                        <li>Ready all entities you control.</li>
                                        <li> Trigger all Abilities with the <GameIcon name="start" /> tag.</li>
                                        <li>Remove a time counter from each card you control in play, and resolve any effect triggered when the last time counter is removed from a card in your stockpile.</li>
                                        <li>If you control no resoruces in your stockpile, you loose the game.</li>
                                    </ol>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-cyan-200">Main Phase</p>
                                <div className="space-y-1 border-l-2 border-cyan-500/0 pl-4">
                                    <p>
                                        You may play cards, activate abilities, make attacks,
                                        allocate a resource to a unit you control, accumulate resources,
                                        or block incoming damage directed at you, in any order where
                                        timing allows.
                                    </p>
                                    <p>To make an attack, in brief:</p>
                                    <ol className="list-decimal space-y-1 pl-6">
                                        <li>Choose and expend your attacker(s), then declare a target. Then trigger any units attacking with a <GameIcon name="attack" /> tag.</li>
                                        <li>Players may play Quick Hacks or activate abilities, starting with the active player, until no one adds more effects.</li>
                                        <li>Deal damage (Preemptive Strike first, then simultaneous). Defeated units go to the discard pile. Before loss of life is dealt to a player, they may block using the default Block action.</li>
                                    </ol>
                                    <p>
                                        See <SectionLink href="#how-to-block">How to Block</SectionLink>{" "}
                                        and <SectionLink href="#how-to-attack">How to Attack</SectionLink>{" "}
                                        under Core Actions for the full step-by-step.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="flex items-center gap-2 font-semibold text-cyan-200">
                                    End-of-Turn Phase
                                </p>
                                <div className="border-l-2 border-cyan-500/0 pl-4">
                                    <ol className="list-decimal space-y-1 pl-6">
                                        <li>Players may play Quick Hacks or activate abilities, starting with the active player, until no one adds more effects.</li>
                                        <li>Trigger any ability with the <GameIcon name="endTurn" /> tag.</li>
                                        <li>Players Lose any unspent resources in your resource pool (not your stockpile).</li>
                                        <li>You draw cards until you have cards in hand equal to your pilots <GameIcon name="hand_size" />-2. if you have no cards left in deck instead loose 1 life for each card you would have drawn to get to your pilots <GameIcon name="hand_size" />-2</li>
                                    </ol>
                                </div>
                            </div>
                        </Section>

                        <Section id="reading-cards" title="Reading Your Cards">

                            <Important>
                                <Term>! Important !</Term> If there is a conflict between a card's
                                text and the Comprehensive Rules, follow the text on the card. Cards
                                often have abilities that get around the rules to make things
                                exciting, weird, or interesting. For any other rules question, use
                                the Comprehensive Rules (download at the top of this page), not this
                                guide alone.
                            </Important>

                            <div className="mx-auto flex w-full max-w justify-center">
                                <img
                                    src={howToPlayImages.CARD_PILOT}
                                    alt="Example pilot card"
                                    className="w-full"
                                />
                            </div>

                            <div className="mx-auto flex w-full max-w justify-center">
                                <img
                                    src={howToPlayImages.CARD_AUGMENT}
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
                            <Important>
                                <Term>! Important !</Term> Whenever an ability, effect, or text uses
                                the word "this," it always refers to the card it is printed on,
                                regardless of context.
                            </Important>


                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">Base Types</h3>
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

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">Super Types</h3>
                            <Important>
                                <Term>Multiple types:</Term> A card may have more than one supertype or
                                subtype. When type rules conflict, the more permissive rule applies unless
                                card text says otherwise. If the card has the Unit supertype, it may
                                attack even if another type says it cannot. If the card has the Weapon
                                subtype, it may use its innate attack ability (see{" "}
                                <SectionLink href="#how-to-attack">How to Attack</SectionLink>)
                                even if another type says it cannot. If any type allows blocking, the
                                card may block using any method available to its types.
                            </Important>
                            <p>
                                <Term>PILOT [ Entity ]:</Term> Your pilot is the center of
                                attention, commanding drones, mechs, hacks, spells, and other
                                effects from your deck in the pilot zone. You can also have them join
                                the heat of battle if you choose, to show off why you picked this
                                pilot. The pilot is a unit that starts in your pilot zone and can be
                                played from that zone by paying its invoke cost. Whenever your pilot
                                moves zones you may instead of moving the pilot to that zone back to the pilot
                                zone instead increasing the pilots cost for the rest of the game by {" "} <GameIcon name="gen2" />. Lastly, your pilot's invoke cost&mdash;combined with your
                                augments&mdash;determines your deck's color combination (see Deck Building for more details).
                            </p>
                            <p>
                                <Term>UNIT [ Entity ]:</Term> Units are call-ins that back up your
                                pilot, ranging from drones, turrets, and tanks to spacecraft,
                                helping you eliminate your opponent tactfully or with overwhelming
                                force. All Units have a <GameIcon name="threat_lvl" /> number this is both thier health and damage value. To play a unit, pay its invoke cost (see{" "}
                                <SectionLink href="#how-to-play-actions">How to Play a Card</SectionLink>
                                ). If it resolves, it goes to the battlefield&mdash;provided you chose
                                not to use time as part of its cost (see Time Counters). Units can attack the turn they enter the battlefield.
                            </p>
                            <p>
                                <Term>PROGRAM [ Entity ]:</Term> A type of card that tends to be
                                synergistic, stays in play once played, and has a variety of effects
                                and abilities. Programs have a <GameIcon name="threat_lvl" /> rating.
                                They cannot attack. You may use that rating only to block (see{" "}
                                <SectionLink href="#how-to-block">How to Block</SectionLink>).
                            </p>
                            <p>
                                <Term>TECHNOLOGY [ Entity ]:</Term> A type of card that tends to be a
                                counter-play or support piece, stays in play once played, and has a
                                variety of effects and abilities. Technologies have a{" "}
                                <GameIcon name="threat_lvl" /> rating. They cannot attack. You may
                                use that rating only to block (see{" "}
                                <SectionLink href="#how-to-block">How to Block</SectionLink>).
                            </p>
                            <p>
                                <Term>AUGMENT [ Entity ]:</Term> Pieces of equipment or cybernetic
                                enhancements your pilot uses in battle to augment your game plan and
                                strategy. They start the game on the battlefield and are limited
                                based on the number of cards in your deck. You cannot have two
                                augments with the same name in your deck. Augments have a{" "}
                                <GameIcon name="threat_lvl" /> rating. They cannot attack. You may
                                block by expending an augment (see{" "}
                                <SectionLink href="#how-to-block">How to Block</SectionLink>).
                            </p>
                            <p>
                                <Term>PROTOTYPE [ ANY ]:</Term> Prototype weapons, spells, and
                                equipment, often rare in the lore. A card with this type is
                                restricted to a single copy in your deck.
                            </p>
                            <p>
                                <Term>RESOURCE [ Entity ]:</Term> Resource tokens you use to play
                                cards (assets) from different zones of play. Whenever a card
                                says to "gain" a resource, create a token of the specified color and
                                put it into your stockpile readied (90 degrees vertical). You can use
                                resources as soon as they enter play&mdash;no need to wait as a unit
                                does.
                            </p>
                            <p>
                                <Term>TOKEN [ Entity ]:</Term> Usually created by an effect, not played
                                from hand or other zones; tokens do not go to the discard pile when
                                defeated or trashed. You may use your own objects as tokens, so long as
                                it is clear which token they represent and whether they are expended.
                                You cannot use non-token MIRROR IMAGE cards as tokens. When an effect
                                creates a token, that creation may enter the lock if it is empty, or its
                                controller's queue if the lock is full. The token is not created until
                                the creating effect resolves: resource tokens enter the stockpile
                                readied; other tokens enter the battlefield readied.
                            </p>

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">Sub Types</h3>
                            <p>
                                <Term>PROCESS [ Cyberspell ]:</Term> This cyberspell can be played
                                any time during your main phase. Processes represent a combination of
                                magic and technology&mdash;complex programs or scripts that take
                                significant time to play in battle. Processes have a{" "}
                                <GameIcon name="threat_lvl" /> rating. They cannot attack. You may
                                use that rating only to block (see{" "}
                                <SectionLink href="#how-to-block">How to Block</SectionLink>).
                            </p>
                            <p>
                                <Term>QUICK HACK [ Cyberspell ]:</Term> This cyberspell can be played
                                any time you can play a Process. You may also play it at the end of
                                each turn, during an attack, when there is a card in the lock, or
                                when an effect not controlled by you resolves and the lock becomes
                                empty. (See Using the Lock for details.) Quick Hacks represent the
                                fastest scripts you can play, letting you disrupt your opponent or
                                protect yourself. Quick Hacks have a <GameIcon name="threat_lvl" />{" "}
                                rating. They cannot attack. You may use that rating only to block
                                (see <SectionLink href="#how-to-block">How to Block</SectionLink>).
                            </p>
                            <p>
                                <Term>WEAPON:</Term> A subtype on entity cards. A weapon has an{" "}
                                <strong>innate ability</strong> to attack&mdash;this is not an activated
                                ability. To attack with a weapon,{" "}
                                <GameIcon name="expend" /> the weapon and{" "}
                                <GameIcon name="dismantle" /> a resource of your choice you control
                                (you do not need to dismantle a resource if you control your pilot on
                                the battlefield), then choose targets using the same rules as attacking
                                with units. A
                                weapon may join the same attack as your units. If a weapon deals
                                damage to a readied unit, put a depletion counter on that weapon. See{" "}
                                <SectionLink href="#how-to-attack">How to Attack</SectionLink>.
                            </p>
                        </Section>

                        <Section id="how-to-play-actions" title="Core Actions">
                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                Accumulate Resources
                            </h3>
                            <p>
                                You may accumulate resources only once on your turn in your main phase, To do so, choose a card in hand, reveal it, and then "gain"
                                (grab) up to three resource tokens from its listed invoke cost
                                (ignoring the grey numbered costs) and add them to your stockpile
                                readied. Then put the revealed card on the bottom of your deck.
                                This action does not use the lock.
                            </p>

                            <div className="space-y-3 rounded-md border border-cyan-500/20 bg-black/40 p-4">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                    <CheckMark />
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <GameIcon name="ram" />
                                        <GameIcon name="steel" />
                                        <GameIcon name="time" />
                                        <GameIcon name="life" />
                                        <GameIcon name="power" />
                                        <GameIcon name="metal" />
                                    </span>
                                    <span className="text-base text-gray-300 lg:text-lg">
                                        Colored resource symbols can be gained.
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                    <CrossMark />
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <GameIcon name="gen0" />
                                        <GameIcon name="gen1" />
                                        <GameIcon name="gen2" />
                                        <span className="px-1 text-gray-400">. . . . .</span>
                                        <GameIcon name="gen10" />
                                        <GameIcon name="genX" />
                                    </span>
                                    <span className="text-base text-gray-300 lg:text-lg">
                                        Grey numbered (generic) costs are ignored.
                                    </span>
                                </div>
                            </div>

                            <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                <img
                                    src={howToPlayImages.GAIN_RESOURCE}
                                    alt="Mirror Image banner"

                                />
                            </div>



                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                How to Allocate a Resource to a Unit
                            </h3>
                            <p>
                                This ability can be used any time you can play a cyberspell process, and only once per turn, on your turn.
                                Each resource allocated to a unit gives it a +1<GameIcon name="threat_lvl" /> rating for
                                each resource allocated. To allocate a resource, expend it "<GameIcon name="expend" />" and choose
                                a unit you control. This ability does not use the lock and thus happens immediately. An
                                Example of what a unit looks like with a resource allocated to it found below:

                            </p>
                            <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                <img
                                    src={howToPlayImages.ALLOCATION}
                                    alt="Mirror Image banner"

                                />
                            </div>
                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                How to Play a Card
                            </h3>
                            <p>
                                Each card has an invoke cost printed on it; pay that cost to play the card. A card
                                without an invoke cost in the upper-left corner cannot be played unless an effect
                                allows it. You normally play from your hand; you may play from another zone
                                (pilot zone, trashyard, dismantled zone, and so on) only when a card ability or
                                effect says you can. To pay the cost, you must have the required resources in your
                                resource pool&mdash;an imaginary area where resources go when a card says to
                                "add" a resource of the color you need; they stay there until the end
                                of the turn.

                                <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                    <img
                                        src={howToPlayImages.PLAYING_CARD_1}
                                        alt="Mirror Image banner"

                                    />
                                </div>

                            </p>
                            <p>
                                For example, say I want to play the Needle Jet card. I need a
                                RAM (blue) and Unit of Power (yellow) in my resource pool to play the card. I
                                already have a RAM and a unit of Power readied in my stockpile:
                                I then activate the RAM's ability of "<GameIcon name="expend" />: Add a <GameIcon name="ram" /> to your resource pool"
                                by turing the ram sideways as that is the cost then. i get to add a <GameIcon name="ram" /> to
                                my resource pool.

                            </p>
                            <p>
                                Because I have what I need, I'll expend both the RAM and Unit of Power
                                resources, which adds resources of the respective color when I expend
                                them, as shown in the images below.

                                <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                    <img
                                        src={howToPlayImages.PLAYING_CARD_2}
                                        alt="Mirror Image banner"

                                    />
                                </div>
                                Resources in Resource pool: <GameIcon name="ram" />
                                <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                    <img
                                        src={howToPlayImages.PLAYING_CARD_3}
                                        alt="Mirror Image banner"

                                    />
                                </div>
                                Resources in Resource pool: <GameIcon name="ram" /><GameIcon name="power" />
                            </p>
                            <p>
                                Once you have paid the cost by removing the resources in your resource pool equal to the invoke cost&mdash;and if the card says to target, you
                                must have legal targets before you play the card, or you cannot play
                                it; then reveal the card you intend to play. Put it in the lock if the
                                lock is empty, or overwrite the lock occupant if the lock is full (only
                                effects go to a queue when the lock is full&mdash;see{" "}
                                <SectionLink href="#lock">The Lock</SectionLink>). Declare its legal
                                targets, then trigger any{" "}
                                <GameIcon name="invoke" /> tags printed on the card and resolve those tags immediately. The card remains the lock occupant until it resolves or is overwritten.
                            </p>


                            <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                <img
                                    src={howToPlayImages.PLAYING_CARD_4}
                                    alt="Mirror Image banner"

                                />
                            </div>
                            <p> Resources in Resource pool: empty</p>


                            <p>
                                While a card is the lock occupant, the active player may overwrite it
                                with a Quick Hack or take other actions allowed while the lock is full
                                (see <SectionLink href="#lock">The Lock</SectionLink>). If the lock
                                occupant is not overwritten, it resolves when the lock process allows:
                                first, put the card in its respective zone (the battlefield for
                                entities, the discard pile for cyberspells), then resolve its effects in
                                order as written on the card (<GameIcon name="effect" /> see this tag for
                                details), then resolve any other triggers such as the{" "}
                                <GameIcon name="entersPlay" /> tag. The card has now finished being
                                played. If your card's invoke cost has colorless symbols, you can use
                                any color of resource in your pool to pay for 1 of the cost it requires,
                                and/or reduce that cost by one for each time counter. See The Lock &
                                Time Counters for more details.
                            </p>
                            <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                <img
                                    src={howToPlayImages.PLAYING_CARD_5}
                                    alt="Mirror Image banner"

                                />
                            </div>

                            <h3
                                id="how-to-block"
                                className="font-glitch scroll-mt-24 pt-2 text-xl text-cyan-200 lg:text-2xl"
                            >
                                How to Block
                            </h3>
                            <p>
                                You can block incoming damage whenever damage is directed at
                                you as a player — from an attack, a cyberspell, a card effect, or any
                                other source — you may block to reduce that damage before it becomes
                                loss of life. You may block any time you could take other
                                game actions while the lock is full (see{" "}
                                <SectionLink href="#lock">The Lock</SectionLink>).
                            </p>
                            <p>You may, in any order:</p>
                            <ul className="list-disc space-y-1 pl-6">
                                <li>
                                    Discard any number of cards in hand with a{" "}
                                    <GameIcon name="threat_lvl" /> rating (including processes and
                                    quick hacks). The maximum a card can block using its{" "}
                                    <GameIcon name="threat_lvl" /> is 4; the Block keyword can
                                    increase this limit. Add the discarded cards together and reduce
                                    the incoming damage from a damage source of your choice by that
                                    total.
                                </li>
                                <li>
                                    Expend any number of augments you control, choose a damage
                                    source for each, reduce the incoming damage by that augment's{" "}
                                    <GameIcon name="threat_lvl" /> rating, and add a depletion
                                    counter to that augment.
                                </li>
                                <li>
                                    Expend any number of non-unit entities you control (including
                                    programs and technologies), choose a damage source for each,
                                    reduce the incoming damage by that entity's{" "}
                                    <GameIcon name="threat_lvl" /> rating, and then trash the
                                    entity(s) you expended.
                                </li>
                            </ul>
                            <Note>
                                Cards with one or more time counters on them cannot be used to block
                                (see <SectionLink href="#lock">Time Counters</SectionLink> under The
                                Lock).
                            </Note>
                            <p>
                                Any damage directed at you that was not blocked is dealt as loss of
                                life. During an attack, blocking happens before player damage from
                                that attack is applied; see{" "}
                                <SectionLink href="#how-to-attack">How to Attack</SectionLink> for
                                the full combat sequence.
                            </p>

                            <h3
                                id="how-to-attack"
                                className="font-glitch scroll-mt-24 pt-2 text-xl text-cyan-200 lg:text-2xl"
                            >
                                How to Attack
                            </h3>
                            <p>
                                Attakcing is the primary way to get damage in along with potentailly reducing you opponents resources
                                on there turn to mount a counter attack. <Important> NOTE: Damage stays marked on a unit turn after turn. you can heal the damage
                                    with cards and effect that say to heal it. </Important>
                            </p>
                            <ol className="list-decimal space-y-1 pl-6">
                                <li>
                                    Choose unit(s), weapon(s) using their innate attack ability, and/or
                                    activate an augment that says it makes an attack. When attacking
                                    with multiple attackers, the group is considered a single attack
                                    and must share the same target, but each attacker is treated
                                    separately when blocking or assigning damage. A unit may attack if
                                    it has the Unit supertype, including when it also has a type that
                                    otherwise cannot attack (see Card Types). To attack with a weapon,
                                    pay its innate cost: <GameIcon name="expend" /> the weapon and{" "}
                                    <GameIcon name="dismantle" /> a resource of your choice you
                                    control (you do not need to dismantle a resource if you control
                                    your pilot on the battlefield). All other cards with a{" "}
                                    <GameIcon name="threat_lvl" /> rating can be used to block incoming
                                    damage.
                                </li>
                                <li>
                                    Expend chosen unit(s). Declare an attack target — the defending
                                    player or a unit on the battlefield (not the stockpile or other
                                    zones unless an effect says otherwise) — and trigger the{" "}
                                    <GameIcon name="attack" /> abilities of the attacking units and
                                    weapons. When declaring the target of your attack you must target
                                    a readied unit on the battlefield the defending player controls if
                                    able. (Every readied unit has this requirement built in.)
                                    <Note>If you cannot target a readied unit on the battlefield that a defending player controls, you cannot make the attack. If they control more than one, you choose which to target.</Note>
                                </li>
                                <li>
                                    The unit(s) and/or weapon(s) are now considered attacking. In this
                                    step you must choose whether to pay additional costs for cards with
                                    them such as stealth.
                                </li>
                                <li>Players may play Quick Hacks or activate abilities,
                                    starting with the active player, until no one wants to adds more effects.
                                <li>If a Unit would become readied, the attacking target becomes illegal and is redirected to the readied unit instead.
                                    If there ar multiple readied units then the attacker my choose which one to redirect the attack to.
                                </li>
                                    <Note>The Active player is usually the one attacking see the lock for details.</Note>
                                    
                                </li>
                                <li>
                                    Before damage directed at a player would become loss of life,
                                    that player may block using the Block action (see{" "}
                                    <SectionLink href="#how-to-block">How to Block</SectionLink>).
                                </li>
                                <li>
                                    The attacker(s) deal Preemptive Strike damage equal to their{" "}
                                    <GameIcon name="threat_lvl" /> (including modifiers).
                                </li>
                                <li>
                                    If the attacker(s) did not already deal Preemptive Strike
                                    damage, they deal damage equal to their{" "}
                                    <GameIcon name="threat_lvl" /> (including modifiers) to the
                                    target of the attack. Then the defending unit deals damage
                                    back:
                                    <ul className="list-disc space-y-1 pl-6 pt-1">
                                        <li>
                                            If it is <span className="font-semibold text-cyan-200">readied</span>,
                                            it deals damage equal to its{" "}
                                            <GameIcon name="threat_lvl" /> including all
                                            modifiers (such as Lethal).
                                        </li>
                                        <li>
                                            If it is <span className="font-semibold text-cyan-200">expended</span>,
                                            it deals 0 damage.
                                        </li>
                                    </ul>
                                    If there are
                                    multiple attackers, the defending player divides
                                    this damage among them as they choose.
                                    Damage dealt this way is simultaneous. If a weapon dealt damage to
                                    a readied unit, put a depletion counter on that weapon.
                                </li>
                                <li>
                                    After damage is dealt, check each unit that took damage. A unit
                                    is defeated if its marked damage is at least its{" "}
                                    <GameIcon name="threat_lvl" /> — unless it has Durable X, in
                                    which case it survives until marked damage is at least its{" "}
                                    <GameIcon name="threat_lvl" /> + X. When a unit is defeated
                                    this way, trigger its <GameIcon name="defeated" /> tag (if any)
                                    and any other on-defeat abilities, then put it into the discard
                                    pile.
                                    <Note>
                                        Example: Threat Level 3 with Durable 2 is defeated at 5
                                        damage, not 3.
                                    </Note>
                                </li>
                                <li>Any damage directed at a player that was not blocked is dealt as loss of life to that player. Then the attack ends.</li>
                            </ol>
                        </Section>

                        <Section id="lock" title="The Lock & Time Counters">
                            <p>
                                The lock is a special zone that holds at most one card or effect.
                                Playing a card without time counters goes to the lock and overwrites
                                the occupant if the lock is already full. An effect that uses the
                                lock goes to the lock if it is empty, or to that controller's queue
                                if the lock is already full (see Scenario 2).
                            </p>
                            <p className="font-semibold text-cyan-200">The lock does 4 things:</p>
                            <ol className="list-decimal space-y-1 pl-6">
                                <li>Determines timing.</li>
                                <li>Determines who is the active and non-active player.</li>
                                <li>Determines who can overwrite the lock occupant with a Quick Hack.</li>
                                <li>Determines when an ability or asset resolves its effect.</li>
                            </ol>
                            <p>
                                Whoever controls the lock occupant is the non-active player; the
                                other player is the active player. At the start of each the player whos 
                                turn it is, is the active player. The active player may take game actions until
                                a card or effect is added to the lock. Then the controller of that
                                occupant becomes non-active, and their opponent becomes active. If
                                two effects would enter an empty lock at the same time, the active
                                player puts one of theirs into the lock first; the rest go to queues.
                            </p>
                            <Note>
                                Note: only the active player may play a Quick Hack to overwrite the lock. Paying
                                costs, using resource abilities, and activating into your queue are
                                allowed for whoever is currently adding effects (active batch,
                                non-active batch, or your turn in Alternate); even if you are
                                the non-active player.
                            </Note>

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                Scenario 1 &mdash; The lock occupant and Quick Hacks
                            </h3>
                            <p>
                                The lock holds at most one card or effect.
                            </p>
                            <ul className="list-disc space-y-1 pl-6">
                                <li>
                                    <strong className="text-cyan-100">Empty lock:</strong> a card
                                    you play, or an effect that uses the lock, goes to the lock.
                                </li>
                                <li>
                                    <strong className="text-cyan-100">Full lock — card:</strong> a
                                    card you play overwrites the lock occupant and becomes the new
                                    occupant. It does not go to a queue (see Overwrite result below).
                                </li>
                                <li>
                                    <strong className="text-cyan-100">Full lock — effect:</strong> that
                                    effect goes to its controller's queue instead. It does not enter
                                    the lock.
                                </li>
                                <li>
                                    <strong className="text-cyan-100">Overwrite result:</strong> when
                                    any played card overwrites the lock occupant, the replaced card goes
                                    to its controller's stockpile with 2 time counters on it. If that
                                    player already has the maximum number of cards with time counters in
                                    their stockpile (3), the replaced card is discarded instead and does
                                    not resolve. If the replaced occupant was an effect, it does nothing.
                                    Recalculate who is active; restart from &ldquo;while the lock is full.&rdquo;
                                </li>
                                <li>
                                    <strong className="text-cyan-100">Quick Hack overwrite:</strong> during
                                    Scenario 2 (see below), only the active player may play a Quick Hack to
                                    overwrite the lock occupant. Apply the overwrite result above, then
                                    restart from &ldquo;while the lock is full.&rdquo;
                                </li>
                            </ul>
                            <p>
                                Queued effects never overwrite the lock. Only played cards can overwrite
                                the lock occupant; Quick Hack overwrites during Scenario 2 are limited to
                                the active player.
                            </p>

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                Scenario 2 &mdash; The queue (lock is full)
                            </h3>
                            <p>
                                Whenever an ability or effect would be added to the lock but the lock
                                already holds a card or effect, it is not added to the lock. Put it
                                on its controller's queue. Queues record whose overflow effects are
                                waiting. The turn does not continue as free play until the lock and
                                all queues are empty.
                            </p>
                            <p>Then, with the lock still occupied:</p>
                            <ol className="list-decimal space-y-2 pl-6">
                                <li>
                                    <strong className="text-cyan-100">Active batch.</strong> The
                                    active player may add any legal overflow effects to their queue.
                                    They then resolve their entire queue, one effect at a time, in an
                                    order they choose. Each effect fully resolves before the next. If
                                    a resolved effect would go to the lock, it goes to its
                                    controller's queue instead. Effects that land on the active
                                    player's queue during this batch are still part of this batch.
                                    Effects that land on the non-active player's queue wait.
                                </li>
                                <li>
                                    <strong className="text-cyan-100">Non-active batch.</strong> The
                                    non-active player does the same: add, then resolve their entire
                                    queue, one at a time, in an order they choose. Same overflow rule.
                                </li>
                                <li>
                                    <strong className="text-cyan-100">Alternate.</strong> Starting
                                    with the active player, a player either puts one overflow effect
                                    on their queue and resolves that one effect, or passes. After a
                                    player resolves one, it is the other player's turn to add-one-or-pass.
                                    When both players pass in succession, stop. On your
                                    add-one-or-pass turn you may pay costs and use resource abilities
                                    to activate an ability into your queue, even if you are the
                                    non-active player. (Example: the active player passes; you are
                                    non-active; you may still spend resources, pay the activation
                                    cost, add that effect to your queue, and resolve it.) You still
                                    cannot Quick Hack overwrite unless you are the active player.
                                </li>
                                <li>
                                    <strong className="text-cyan-100">Lock occupant resolves.</strong>{" "}
                                    Then: if the lock is full and any queue is not empty, repeat
                                    steps 1–4. If the lock is empty, queues must also be empty before
                                    the player who turn it is, is active again and play continues.
                                </li>
                            </ol>
                            <p>
                                A Quick Hack during steps 1–3 is not a queue effect: it overwrites
                                the lock (Scenario 1) and you restart from “while the lock is full.”
                                Only the active player may play that Quick Hack.
                            </p>
                            <p>
                                While the lock is full, the player who is currently adding effects
                                (active batch, non-active batch, or their Alternate turn) may:
                            </p>
                            <ol className="list-decimal space-y-1 pl-6">
                                <li>Pay costs and use resource abilities (those abilities do not use the lock).</li>
                                <li>Allocate a resource to a unit you control (once per turn on your turn, when you could play a Process). Each resource allocated to a unit gives it a +1 <GameIcon name="threat_lvl" /> rating. To allocate a resource, expend it and choose a unit. This ability does not use the lock and happens immediately.</li>
                                <li>Activate an activated ability that uses the lock: it goes to your queue, not the lock.</li>
                                <li>Block incoming damage directed at you (see <SectionLink href="#how-to-block">How to Block</SectionLink>).</li>
                            </ol>
                            <p>
                                Overwriting the lock with a Quick Hack is only legal for the active
                                player.
                            </p>

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">Time Counters</h3>
                            <p>
                                Time counters shape how you interact with the lock: you can reduce a
                                card's invoke cost by <GameIcon name="gen1" /> for each time counter you place on it after you
                                play it. You can only reduce grey numbered-value costs this way. When
                                you do, instead of putting the card into the lock, you ignore the lock
                                entirely&mdash;protecting your asset&mdash;and place it in your
                                stockpile revealed with the number of time counters you used to reduce its
                                cost. However, you do not get any of the card's effects right away:
                                while the card has one or more time counters on it, it has no abilities
                                (except abilities with the <GameIcon name="atomic" /> tag) and cannot
                                attack or block&mdash;regardless of zone or ready state. At the start
                                of each of your turns, remove 1 counter from each card you have in play
                                with time counters on it. When the last time counter is removed from a
                                card in your stockpile, resolve its effects without using the lock and
                                in an order of your choosing; then move the card to the battlefield if
                                it's an entity, or to the discard pile if it's a cyberspell. You may have
                                up to 3 cards with time counters on them in your stockpile at any given
                                time.
                            </p>
                        </Section>

                        <Section id="timing" title="Timing, Triggers & Keywords">
                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                Targeting
                            </h3>
                            <p>
                                Some effects use the word &ldquo;target.&rdquo; A target is legal only if
                                it meets <strong>every</strong> restriction on that effect (type,
                                controller, zone, and so on). If an effect names a type (for example,
                                &ldquo;Technology&rdquo;), the target must have that type. If an effect
                                uses an exclusion (for example, &ldquo;non-Augment&rdquo;), the target is
                                illegal if it has the excluded type, even if it also has a required type.
                                If an effect does not name a zone, you may only choose targets on the
                                battlefield. You cannot choose an illegal target.
                            </p>
                            <p>
                                If a card or activated ability requires targets, you must have at least
                                one legal target before you play or activate it. Declare targets when the
                                effect enters the lock or a queue. If every target is illegal when the
                                effect resolves, it does nothing to those targets. Keywords such as
                                Invulnerable and Stealth may further restrict targeting (see Keyword
                                Abilities).
                            </p>
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
                                    <span>Triggers when this card enters play for the first time, whether the battlefield or the stockpile. This ability always has the  <GameIcon name="atomic" className="mt-0.5 shrink-0" />  tag.</span>
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
                                    <span>Triggers when you play the card this tag is printed on, as the card goes to the lock; it always resolves as soon as it is triggered. (This is the Invoke tag.)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="conditional" className="mt-0.5 shrink-0" />
                                    <span>
                                        Triggers when a condition is met, formatted (ignoring the
                                        brackets) as [condition], [effect]. If the condition refers to
                                        playing a card (for example, &ldquo;whenever you play a
                                        cyberspell&rdquo;), the condition is met as soon as that play
                                        finishes entering the lock or, if you used time counters,
                                        going to your stockpile&mdash;not when the played card&apos;s{" "}
                                        <GameIcon name="effect" className="inline align-text-bottom" />{" "}
                                        resolves. The triggered effect then uses the lock or a queue
                                        like other triggers.
                                    </span>
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
                                    <span>Triggers when the unit it is printed on is defeated, meaning put into the discard pile from play.</span>
                                </li>
                            </ul>

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                Activated Abilities
                            </h3>
                            <p>
                                Activated abilities are formatted (ignoring the brackets) as [cost 1,
                                cost 2, etc.]: [effect]. Unless they say otherwise, they can be
                                activated any time you can play a Quick Hack. If an activated ability
                                targets, it cannot be activated unless at least one legal target exists
                                (see Targeting above). To activate one, pay the cost written on the
                                card. If the lock is empty, the effect goes to the lock. If the lock is
                                full, the effect goes to your queue instead (see The Lock). Declare
                                legal targets when the effect enters the lock or queue.
                            </p>
                            <p>
                                Example: the activated ability "<GameIcon name="expend" />, <GameIcon name="power" /> <GameIcon name="gen1" /> : Draw a
                                card" means to expend the card the ability is printed on, then pay 1
                                yellow unit of power and 1 of any color of your choice, to add the
                                "draw a card" effect to the lock&mdash;after which it resolves.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <GameIcon name="expend" className="mt-0.5 shrink-0" />
                                    <span>The Expend ability and symbol. Turn a card in play 90 degrees from vertical to horizontal. (Note: to ready an entity is the opposite of expending; a readied entity is vertical.)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="recycle" className="mt-0.5 shrink-0" />
                                    <span>The Recycle ability and symbol. Discard this card from hand to gain an effect, at any time you can play a Quick Hack.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <GameIcon name="trash" className="mt-0.5 shrink-0" />
                                    <span>The Trash ability and symbol. It can only be activated while the card it is printed on is on the battlefield; as part of a cost, put that card into the discard pile.</span>
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
                            <Important>
                                <Term>! Important !</Term> Multiple instances of the same keyword on
                                one entity do not stack, unless that keyword has a numerical value; in
                                that case, they add together. Any keyword with X has a numerical
                                value.
                            </Important>
                            <dl className="space-y-3">
                                {KEYWORDS.map((keyword) => (
                                    <div key={keyword.name} className="grid gap-1 sm:grid-cols-[200px_1fr]">
                                        <dt className="font-semibold text-cyan-200">{keyword.name}</dt>
                                        <dd>{keyword.text}</dd>
                                    </div>
                                ))}
                            </dl>
                        </Section>

                        <Section id="deck-building" title="Deck Building">
                            <p>
                                You now have everything you need to play, so let's finish up by talking
                                about making your own deck.
                            </p>
                            <p>
                                Your deck holds the entity and cyberspell cards you bring to battle.
                                On the playmat it is labeled <Term>R.I.G.</Term> (Regressive Integrated Gear).
                                Your deck setup also includes your pilot and augments. There are three deck sizes:
                                light-weight, medium-weight, and heavy-weight. Your deck size
                                determines the minimum number of cards in your deck, the number of
                                augments you can equip, and your starting resource allocation. A lightweight
                                deck lets you gain one resource of your choice at the start of the game; a
                                medium-weight deck has no change; a heavy-weight deck requires you to
                                dismantle one resource of your choice at the start.
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-base lg:text-lg 2xl:text-xl">
                                    <thead>
                                        <tr className="border-b border-cyan-500/30 text-left text-cyan-200">
                                            <th className="py-2 pr-4">Deck size</th>
                                            <th className="py-2 pr-4">Capacity (# cards)</th>
                                            <th className="py-2">Equip slots (# augments)</th>
                                            <th className="py-2">Modifier</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        <tr>
                                            <td className="py-2 pr-4">Heavy weight</td>
                                            <td className="py-2 pr-4">30</td>
                                            <td className="py-2">3</td>
                                            <td className="py-2">Max 2 copies instead of three per named card</td>

                                        </tr>
                                        <tr>
                                            <td className="py-2 pr-4">Medium weight</td>
                                            <td className="py-2 pr-4">40&ndash;50</td>
                                            <td className="py-2">2</td>
                                            <td className="py-2">NA</td>

                                        </tr>
                                        <tr>
                                            <td className="py-2 pr-4">Light weight</td>
                                            <td className="py-2 pr-4">60&ndash;70</td>
                                            <td className="py-2">1</td>
                                            <td className="py-2">Your Pilots coloured invoke cost count as double for determining your colour combination</td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p>Once you've chosen a R.I.G class, keep a few rules in mind when building a deck:</p>
                            <ol className="list-decimal space-y-2 pl-6">
                                <li>Pilots cannot be part of the deck's capacity, and you are limited to a single pilot card.</li>
                                <li>Any non-pilot card may have up to three copies with the same name as part of your deck's capacity (heavy-weight decks: max two copies per name).</li>
                                <li>You cannot equip two augments with the same name and do not count toward your deck's capacity.</li>
                                <li>Any card with the Prototype supertype is limited to a single copy in your deck's capacity.</li>
                                <li>You cannot put cards in your deck that are not supported by your pilot's and augments' color combination.</li>
                            </ol>

                            <h3 className="font-glitch pt-2 text-xl text-cyan-200 lg:text-2xl">
                                Your Deck's Color Combination
                            </h3>
                            <p>
                                Your pilot's invoke cost plus your chosen augments' augment color
                                determine your deck's color combination (see Reading Your Cards for an
                                image). There are is one requirement; a card must meet to be included in
                                your deck:
                            </p>
                            <ol className="list-decimal space-y-2 pl-6">
                                <li>Each card's invoke cost must have the same number of colored symbols or fewer than the combined colored symbols of your pilot's invoke cost and your augments' augment color.</li>
                                <li>A card whose invoke cost contains only grey numbered-value symbols (and no colored symbols) may be included in any deck.</li>
                            </ol>
                            <Note>
                                Note: grey numbered-value symbols are ignored when checking color
                                combination legality. They do not count as colored symbols and do not
                                count as steel.
                            </Note>
                            <p>
                                For this starter deck, your color combination of: <GameIcon name="ram" /><GameIcon name="ram" /><GameIcon name="ram" /><GameIcon name="power" /><GameIcon name="power" /><GameIcon name="power" /><GameIcon name="steel" /> allows you to include
                                any card with up to 3 blue, 3 yellow, and access to colourless steel cards.
                            </p>
                            <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                <img
                                    src={howToPlayImages.DECKBUILDING_1}
                                    alt="Mirror Image banner"

                                />
                            </div>
                            <p>
                                In the examples below you can see how the system works. Grey colorless numbered
                                symbols do not count as steel. That's why our HMIV MK IV unit is
                                legal.
                            </p>


                            <p>
                                Finally, the Flame Kin Elementalist requires blue (which we have) and
                                red (which we lack). We cannot
                                include it, because we lack the red symbol.
                            </p>

                            <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                                <img
                                    src={howToPlayImages.DECKBUILDING_2}
                                    alt="Mirror Image banner"

                                />
                            </div>

                            <p>That concludes deck building.</p>
                            <p>
                                A few guidelines for building a functional deck: the number of cards of
                                a given color determines how likely you are to draw that color,
                                especially if you plan to build outside your pilot's starting
                                resources&mdash;you will likely need to accumulate a card of that color
                                before you can play others in it, so be careful.
                            </p>
                            <p>
                                Secondly, lighter-weight decks have less variance, but they also limit
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
                                perfect deck, the heat of battle, or creative self-expression with your
                                resources, pilot, and augments, or collecting cards for themeatic experince.
                                Good luck and have fun!
                            </p>
                            <Note>
                                "He forgot to mention HAIs, man. I'm kind of a big deal&mdash;being
                                attached to a pilot and all... (someone wishipering in the mic) yeah... oh, right, for the next batch...
                                got it. Well then, log complete for the new pilot, I guess. Until we
                                meet again on the field of battle, signing off..." &mdash;Svn
                            </Note>
                        </Section>
                    </div>
                </div>
            </div>
        </section>
    )
}
