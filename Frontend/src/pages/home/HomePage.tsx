import { PageHeader } from "@/components/common/PageHeader"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { sharedImages } from "@/assets"
import type { CSSProperties } from "react"

export function HomePage() {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
     
      <div className=" absolute inset-0 bg-black/40" aria-hidden />


      <div className=" font-buahs93 items-center text-cyan-300 relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
        <img
          src={sharedImages.HOME_BANNER}
          alt="Mirror Image banner"
          className="fade-edges clip-angled w-full max-w-3xl"
          style={{ "--feather": "20%", "--angle": "75px" } as CSSProperties}
        />

        <PageHeader
          glitchTitle
          title="MIRRORIMAGE THE CRPCG"
          description={
            <>
              In the <span className="italic">MIRRORIMAGE</span> Collectible
              Role-Playing Card Game, you will either choose or create a pilot
              character and equip them with augments to enhance yourself or your
              squad of units, cyberspells, and thaumatechnologies, then enter
              the fight against opposing pilots and monsters—to fight for
              freedom, tyranny, or the highest bidder at the end of the world.
              Featuring a blend of artwork and real horrors only a machine can
              imagine, <span className="italic">MIRRORIMAGE</span> is designed
              for trading card players, respectable collectors, role-playing
              enthusiasts, and those interested in new ideas and a fresh,
              unique take on the fantasy-punk genre. Set on a planet ravaged by
              thousands of years of war and now on the brink of destruction by
              the resurgence of a feared rogue AI shadow government—once
              defeated at great cost—it returns to finish its ruthless conquest
              for control.
            </>
          }
        />

        <div className="flex flex-wrap gap-3">
          <GlitchFx
            label="CREAT ACCOUNT"
            size="lg"
            className="font-buahs93 h-14  rounded-none bg-cyan-700 px-10 text-lg hover:bg-cyan-900 active:bg-cyan-400"
          />
        </div>
      </div>
    </section>
  )
}
