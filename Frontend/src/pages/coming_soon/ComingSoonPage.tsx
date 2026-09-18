/**
 * Public splash while the admin coming-soon flag is on.
 */

import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { ROUTES } from "@/lib/route"

const loginCtaClass =
  "font-buahs93 h-12 rounded-none border border-cyan-500/50 bg-black/60 px-8 text-base text-cyan-100 hover:border-cyan-400 hover:bg-cyan-500/10 sm:h-14 sm:px-10 sm:text-lg"

export function ComingSoonPage() {
  const navigate = useNavigate()
  const { isAuthenticated, clearSession } = useAuth()

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-black text-cyan-50">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-16 pt-28 sm:pb-20 sm:pt-32">
        <div className="flex items-end gap-4 sm:gap-5">
          <img
            src={sharedImages.LOGO_MARK}
            alt=""
            className="h-16 w-auto shrink-0 object-contain sm:h-24 md:h-28"
          />
          <h1 className="font-glitch text-4xl leading-none tracking-wide text-cyan-200 sm:text-6xl md:text-7xl">
            MIRROR IMAGE
          </h1>
        </div>
        <p className="font-buahs93 text-xs tracking-[0.35em] text-cyan-400">
          COMING SOON
        </p>
        <h2 className="font-buahs93 max-w-2xl text-xl text-white sm:text-2xl md:text-3xl">
          The site is not open to the public yet.
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-cyan-100/80 sm:text-base">
          Check back later. Staff can sign in to open the site from the admin
          console.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {isAuthenticated ? (
            <GlitchFx
              label="SIGN OUT"
              size="lg"
              variant="outline"
              className={loginCtaClass}
              onClick={clearSession}
            />
          ) : (
            <GlitchFx
              label="LOGIN"
              size="lg"
              variant="outline"
              className={loginCtaClass}
              onClick={() => navigate(ROUTES.LOGIN)}
            />
          )}
        </div>
      </div>
    </section>
  )
}
