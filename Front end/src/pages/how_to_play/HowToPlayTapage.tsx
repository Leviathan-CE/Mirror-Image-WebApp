
import type { CSSProperties } from "react"

import { GlitchFx } from "@/components/effects/GlitchFx"


const HOME_BACKGROUND_IMAGE = "/images/Zone-32B.png"
const BANNER = "/images/banner.jpg"

export function HowToPlayPage() {
    return (
        <section
            className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
            style={{ backgroundImage: `url(${HOME_BACKGROUND_IMAGE})` }}
        >
            <div className=" absolute inset-0 bg-black/40" aria-hidden />

            <div className="relative z-10 flex flex-col items-center gap-6">
                <img
                    src={BANNER}
                    alt="Mirror Image banner"
                    className="clip-angled w-full max-w-3xl"
                    style={{ "--angle": "50px" } as CSSProperties}
                />

                <GlitchFx
                    label="DOWNLOAD GAMEPLAY GUIDE"
                    size="lg"
                    className="font-buahs93 h-8  rounded-none bg-cyan-700 px-10 hover:bg-cyan-900 active:bg-cyan-400"
                />

                <div className=" font-buahs93 items-left text-gray-400 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
                    On The Planet Aerathea, the people find themselves in a middle of a war to end all wars 2 factions wage, of might, magic, technology, space, nuclear, chemical, and biological warfare across an already war-ravaged world for thousands of years. The empire Vrag, who is ruled by a rouge AI shadow government seeks total control and dominance over the whole world, while the United Democratic Countries UDC an alliance of men, elves and the remains of many other broken factions from the old wars fight to oppose this oppressive threat to freedom and liberty, you are a among the elite in the cybernetic enhancement program known as the Pilot program joining the ranks in the 3rd generation pilots, cybernetically enhanced soldiers armed to the teeth and aided by a Human Augmented Intelligence you can fight for freedom, aid in tieriney, or to the highest bidder, the choice is yours.
                </div>
            </div>
        </section>
    )
}
