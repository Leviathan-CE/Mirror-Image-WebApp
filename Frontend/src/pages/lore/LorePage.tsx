import { sharedImages } from "@/assets/shared";
import { loreImages } from "@/assets";
import { BackToTocButton, Section, TableOfContents, type TocEntry } from "@/components/docs";
import type { CSSProperties } from "react";
import { GlitchFx } from "@/components/effects/GlitchFx";



const SECTIONS: TocEntry[] = [
    { id: "01", label: "Characters" },
    {id: "02", label: "Thuamatech"}
]

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
                            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-8">
                                <div className="space-y-4">
                                    <h3 className="font-glitch text-2xl text-cyan-200 lg:text-3xl 2xl:text-4xl">
                                        Diana Ugisaki
                                    </h3>
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
                                </div>
                                <img
                                    src={loreImages.DIANA_UGISDKI}
                                    alt="Diana Ugisaki"
                                    className="fade-left clip-angled w-full"
                                    style={
                                        {
                                            "--angle": "50px",
                                            "--feather": "50%",
                                        } as CSSProperties
                                    }
                                />
                            </div>
                        </Section>

                        <Section id="02" title="Thuamatech">
                            thuamatech
                            </Section>
                    </div>
                </div>
            </div>

        </section>
    )
}
