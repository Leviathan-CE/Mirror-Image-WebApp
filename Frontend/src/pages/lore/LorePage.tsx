import { sharedImages } from "@/assets/shared";

import { loreImages } from "@/assets";

import {

    BackToTocButton,

    Section,

    Subsection,

    TableOfContents,

    type TocEntry,

} from "@/components/docs";

import type { CSSProperties } from "react";

import { GlitchFx } from "@/components/effects/GlitchFx";



const SECTIONS: TocEntry[] = [

    {

        id: "01",

        label: "Characters",

        children: [

            { id: "01-diana", label: "Diana Ugisaki" },

            { id: "01-evran", label: "Evran Loth'laundil" },

        ],

    },

    {

        id: "02",

        label: "Thuamatech",

        children: [

            { id: "02-age-of-scripts", label: "The Age of Scripts" },

            { id: "02-after-anorath", label: "After Anorath" },

            { id: "02-machine-invocation", label: "Machine Invocation" },

            { id: "02-pyai-war", label: "The PyAi War" },

            { id: "02-today", label: "Today" },

        ],

    },

];



const fadeLeftImageStyle = {

    "--angle": "50px",

    "--feather": "50%",

} as CSSProperties;



export function LorePage() {

    return (

        <section

            className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"

            style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}

        >

            <div className="absolute inset-0 bg-black/60" aria-hidden />

            <div className="relative z-10">

                <BackToTocButton />

                <div className="grid w-full gap-8 lg:grid-cols-[260px_1fr] lg:gap-12 2xl:grid-cols-[320px_1fr] 2xl:gap-16">

                    <aside>

                        <TableOfContents sections={SECTIONS} />

                    </aside>



                    <div className="space-y-12">

                        <Section id="01" title="Characters">

                            <Subsection
                                id="01-diana"
                                title="Diana Ugisaki"
                                variant="character"
                                media={
                                    <img
                                        src={loreImages.DIANA_UGISDKI}
                                        alt="Diana Ugisaki"
                                        className="fade-left clip-angled w-full"
                                        style={fadeLeftImageStyle}
                                    />
                                }
                            >
                                <p>
                                    Diana Ugisaki was six when the Quakes tore Aerathea apart; one
                                    of the few in her family to walk away from the wreckage. Raised as an
                                    only child with you mother and father in the shadow of that catastrophe, she was later recuited for
                                    S.O.R.A. (Special Operations Recon Agent), a black-ops wing of the Pilot
                                    Program devoted to stealth insertion and high-risk retrieval. Her orders
                                    are singular: slip through the war-torn dark, trace the ghost-signal of
                                    PyAi, and find where the rogue intelligence truly hides.
                                </p>
                                <GlitchFx
                                    label="DOWNLOAD ORIGIN STORY"
                                    size="lg"
                                    className="font-buahs93 h-8 rounded-none bg-cyan-700 px-10 hover:bg-cyan-900 active:bg-cyan-400"
                                    render={<a href="/docs/lore/Into_the_Fray.pdf" download />}
                                />
                            </Subsection>

                            <Subsection
                                id="01-evran"
                                title="Evran Loth'laundil"
                                variant="character"
                                media={
                                    <img
                                        src={loreImages.EVRAN}
                                        alt="Evran Loth'laundil"
                                        className="fade-left clip-angled w-full"
                                        style={fadeLeftImageStyle}
                                    />
                                }
                            >
                                <p>
                                    Evran Loth&apos;laundil grew up with his mother while the PyAi Wars
                                    raged and his father fought on the front lines. Owlea later blessed him
                                    with the Guinness script he forged under siege at Loyrn, granting
                                    regeneration at a speed that should have been impossible. Battle after
                                    battle sharpened his scripts and techniques until the day he and his
                                    companions climbed the snowy peaks to Anorath&apos;s mountain fortress
                                    and struck down the necromancer, ending his tyranny.
                                </p>
                                <p>
                                    Evran discovered the blessing could pass to his children. Within a few
                                    centuries, nearly every elf in Aerathea carried his blood. Longevity
                                    spread through the faction, yet Evran himself still does not know when his
                                    own time will come to join his ancestors.
                                </p>
                                <p>
                                    He remains devoted to destroying evil wherever it hides&mdash;hunting the
                                    corruption left by Dragor&apos;drune the Corruptor and the legacy of
                                    Anorath, seeking peace and balance for Aerathea. No one knows how long he
                                    will live, or where he has gone. Some whisper of a masked elven warrior
                                    who cut through anything, regenerate his entire body after being cut in half,
                                    and tears open wormholes to watch
                                    comets burn through PyAi&apos;s armies from the void.
                                </p>

                                <GlitchFx
                                    label="DOWNLOAD ORIGIN STORY"
                                    size="lg"
                                    className="font-buahs93 h-8 rounded-none bg-cyan-700 px-10 hover:bg-cyan-900 active:bg-cyan-400"
                                    render={<a href="/docs/lore/Refiners_Fire.pdf" download />}
                                />
                            </Subsection>

                        </Section>



                        <Section id="02" title="Thuamatech">

                            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-8">

                                <div className="space-y-6">

                                    <p className="text-lg lg:text-xl">

                                        Once, a spell took six breaths, three reagents, and a lifetime of

                                        memorization. Now it takes a login. That is thuamatech: the fusion of

                                        arcane theory and cybernetic engineering behind the world&apos;s war

                                        machines, networks, and battlefield augments.

                                    </p>



                                    <Subsection id="02-age-of-scripts" title="The Age of Scripts">

                                        <p>

                                            In the beginning, scripts were incantations&mdash;spoken formulas

                                            that channeled spiritual power into spellcraft. Every script demanded

                                            dedicated memorization. You were limited by how fast you could recite

                                            it aloud or hold it in your mind. Most required material and somatic

                                            components on top of the written formula, and the same effect could be

                                            written countless different ways.

                                        </p>

                                        <p>

                                            Sages, wizards, and clerics rarely changed a battlefield. The

                                            concentration and speed war demanded outpaced what a human invoker

                                            could deliver&mdash;even when the script itself was worth the cost.

                                            Many still tried. Many died, bit by bit, refining the art through

                                            loss.

                                        </p>

                                    </Subsection>



                                    <Subsection id="02-after-anorath" title="After Anorath">

                                        <p>

                                            The techniques were never truly lost. Necessity during the rise of

                                            Anorath forced the next leap: scripts grew more efficient and faster

                                            to pronounce. Material innovations stacked on one another until

                                            invocation speed finally began to catch up with war. The renowned

                                            invoker and sage Evran paved the way with new techniques and training,

                                            ushering in a renaissance in the late 1400s&mdash;shortly after Anorath

                                            and his undead forces had been defeated.

                                        </p>

                                    </Subsection>



                                    <Subsection id="02-machine-invocation" title="Machine Invocation">

                                        <p>

                                            With the computer came a new age. Scripts no longer required a

                                            sentient creature to invoke them&mdash;though early machine

                                            interfaces limited the practice mostly to divination and illusion,

                                            where the system itself could be the target of the spell. For a time,

                                            modern firearms and industrial warfare made scripts feel obsolete.

                                            Elves kept the old ways alive. So did most changelings, and human

                                            minorities who refused to let the craft die.

                                        </p>

                                    </Subsection>



                                    <Subsection id="02-pyai-war" title="The PyAi War">

                                        <p>

                                            Scripts did not return to the center of history until the Third World

                                            War&mdash;and the shadow-government AI called PyAi. PyAi wielded

                                            scripts at scale, paired necromantic arts with Anorath&apos;s living

                                            metal, and built monstrosities that should not exist. The first day of

                                            the war was nuclear. The fallout lasted twenty years of brutal

                                            bloodshed.

                                        </p>

                                        <p>

                                            Humanity answered the only way it could: the Pilot Program. Living

                                            metal as a material source. A Human Augmented Intellegence (HAI), a artificail intellegent companion trained live to a pilots data, to invoke scripts at inhuman speed.

                                            Technology to hack mainframes and turn enemy systems against

                                            themselves. Scripting became the backbone of state-of-the-art

                                            intelligence work, command, infiltration, and frontline battle.

                                        </p>

                                        <p>

                                            Diana Ugisaki hunts the ghost-signal of the intelligence that perfected

                                            what thuamatech became. Every Pilot in the field is standing on the

                                            wreckage of that war.

                                        </p>

                                    </Subsection>



                                    <Subsection id="02-today" title="Today">

                                        <p>

                                            Thuamatech is everywhere now&mdash;from battlefield augments to the

                                            appliances in your kitchen. The line between invention and magic

                                            collapsed so completely that most people never notice the diffrence.

                                        </p>

                                        <p className="border-l-2 border-cyan-500/50 pl-4 text-lg italic text-cyan-100/90 lg:text-xl">

                                            All you need to do is log in.

                                        </p>

                                    </Subsection>

                                </div>

                                <img

                                    src={loreImages.THUAMATECH_DIAG}

                                    alt="Thaumatech diagram"

                                    className="fade-left clip-angled w-full lg:sticky lg:top-24"

                                    style={fadeLeftImageStyle}

                                />

                            </div>

                        </Section>

                    </div>

                </div>

            </div>

        </section>

    );

}


