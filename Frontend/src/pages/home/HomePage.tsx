import { useEffect, type CSSProperties } from "react"
import { Link, useNavigate } from "react-router-dom"

import { loreImages, sharedImages } from "@/assets"
import { useAuth } from "@/app/providers/AuthProvider"
import { StripeWordmark } from "@/components/billing/StripeWordmark"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

import { homeCopy } from "./homeContent"

const primaryCtaClass =
  "font-buahs93 h-12 rounded-none bg-cyan-700 px-8 text-base text-white hover:bg-cyan-900 active:bg-cyan-400 sm:h-14 sm:px-10 sm:text-lg"

const secondaryCtaClass =
  "font-buahs93 h-12 rounded-none border border-cyan-500/50 bg-black/60 px-8 text-base text-cyan-100 hover:border-cyan-400 hover:bg-cyan-500/10 sm:h-14 sm:px-10 sm:text-lg"

const quietCtaClass =
  "font-buahs93 h-10 rounded-none border border-cyan-500/35 bg-black/70 px-5 text-sm text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10"

export function HomePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const goRegisterOrDecks = () =>
    navigate(isAuthenticated ? ROUTES.MAIN : ROUTES.REGISTER)

  const goSubscribe = () =>
    navigate(isAuthenticated ? ROUTES.SUBSCRIBE : ROUTES.REGISTER)

  useHomeReveal()

  return (
    <div className="bg-black text-cyan-50">
      {/* 1. Hero — world only */}
      <section className="home-hero relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
        <div
          className="home-hero-bg absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)]"
          aria-hidden
        />

        <div className="home-hero-content relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-16 pt-28 sm:pb-20 sm:pt-32">
          <div className="flex items-end gap-4 sm:gap-5">
            <img
              src={sharedImages.LOGO_MARK}
              alt=""
              className="h-16 w-auto shrink-0 object-contain sm:h-24 md:h-28"
            />
            <h1 className="font-glitch text-4xl leading-none tracking-wide text-cyan-200 sm:text-6xl md:text-7xl">
              {homeCopy.brand}
            </h1>
          </div>

          <h2 className="font-buahs93 max-w-2xl text-xl text-white sm:text-2xl md:text-3xl">
            {homeCopy.heroHeadline}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-cyan-100/80 sm:text-base">
            {homeCopy.heroSupport}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <GlitchFx
              label={
                isAuthenticated
                  ? homeCopy.ctaGoToDecks
                  : homeCopy.ctaCreateAccount
              }
              size="lg"
              className={primaryCtaClass}
              onClick={goRegisterOrDecks}
            />
            <GlitchFx
              label={homeCopy.ctaHowToPlay}
              size="lg"
              variant="outline"
              className={secondaryCtaClass}
              onClick={() => navigate(ROUTES.HOW_TO_PLAY)}
            />
          </div>
        </div>
      </section>

      {/* 2. Alpha strip */}
      <section className="relative border-y border-cyan-500/30 bg-cyan-950/40">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-cyan-400/80"
          aria-hidden
        />
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 sm:py-12">
          <p className="font-buahs93 text-xs tracking-[0.35em] text-cyan-400">
            {homeCopy.alphaEyebrow}
          </p>
          <h2 className="font-glitch text-2xl text-cyan-100 sm:text-3xl">
            {homeCopy.alphaHeadline}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-cyan-100/75 sm:text-base">
            {homeCopy.alphaBody}
          </p>
          <p className="max-w-2xl text-sm italic text-cyan-300/70">
            {homeCopy.alphaHonesty}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!isAuthenticated && (
              <GlitchFx
                label={homeCopy.ctaCreateAccount}
                className={quietCtaClass}
                onClick={() => navigate(ROUTES.REGISTER)}
              />
            )}
            <span className="inline-flex flex-col gap-1">
              <GlitchFx
                label={homeCopy.ctaSendFeedback}
                variant="outline"
                className={cn(quietCtaClass, "opacity-60")}
                disabled
                title={homeCopy.feedbackComingSoon}
              />
              <span className="font-buahs93 text-[10px] tracking-wide text-cyan-500/80">
                {homeCopy.feedbackComingSoon}
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. Three paths */}
      <section className="home-reveal mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <p className="font-buahs93 text-xs tracking-[0.3em] text-cyan-500/80">
          WHAT YOU CAN DO NOW
        </p>
        <div className="mt-8 grid gap-10 md:grid-cols-3 md:gap-6">
          <PathBeat
            title={homeCopy.pathBuildTitle}
            body={homeCopy.pathBuildBody}
            imageSrc={sharedImages.DECKBUILDING}
            imageAlt="Deck builder"
            onAction={goRegisterOrDecks}
            actionLabel={
              isAuthenticated ? homeCopy.ctaGoToDecks : homeCopy.ctaCreateAccount
            }
          />
          <PathBeat
            title={homeCopy.pathLearnTitle}
            body={homeCopy.pathLearnBody}
            imageSrc={sharedImages.SETUP}
            imageAlt="Game setup"
            onAction={() => navigate(ROUTES.HOW_TO_PLAY)}
            actionLabel={homeCopy.ctaHowToPlay}
          />
          <PathBeat
            title={homeCopy.pathSupportTitle}
            body={homeCopy.pathSupportBody}
            imageSrc={sharedImages.LOGO_MARK}
            imageAlt="Mirror Image"
            imageContain
            onAction={goSubscribe}
            actionLabel={
              isAuthenticated
                ? homeCopy.ctaSubscribe
                : homeCopy.ctaCreateAccount
            }
            showStripe={isAuthenticated}
          />
        </div>
      </section>

      {/* 4. Support development */}
      <section className="border-t border-cyan-500/20 bg-gradient-to-b from-cyan-950/30 to-black">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-[1.1fr_0.9fr] sm:py-20">
          <div className="flex flex-col gap-5">
            <h2 className="font-glitch text-3xl text-cyan-200 sm:text-4xl">
              {homeCopy.supportHeadline}
            </h2>
            <ul className="space-y-2 text-sm text-cyan-100/80 sm:text-base">
              {homeCopy.supportWhy.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 bg-cyan-400" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div>
              <p className="font-buahs93 text-xs tracking-wide text-cyan-400">
                WHAT YOU GET NOW
              </p>
              <ul className="mt-2 space-y-2 text-sm text-cyan-100/80 sm:text-base">
                {homeCopy.supportPerks.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span
                      className="mt-2 h-1 w-1 shrink-0 bg-cyan-400"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              {!isAuthenticated && (
                <GlitchFx
                  label={homeCopy.ctaCreateAccount}
                  className={primaryCtaClass}
                  onClick={() => navigate(ROUTES.REGISTER)}
                />
              )}
              <GlitchFx
                label={homeCopy.ctaSubscribe}
                leading={
                  <StripeWordmark decorative className="h-3.5 text-[#635BFF]" />
                }
                variant="outline"
                className={secondaryCtaClass}
                onClick={goSubscribe}
              />
            </div>
          </div>
          <div
            className="clip-angled relative min-h-[220px] border border-cyan-500/30 bg-black/50"
            style={{ "--angle": "48px" } as CSSProperties}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_40%,rgba(34,211,238,0.12),transparent_55%)]">
              <img
                src={sharedImages.LOGO_MARK}
                alt=""
                className="h-32 w-auto object-contain opacity-90 sm:h-40"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Lore teaser */}
      <section className="home-reveal relative min-h-[70svh] overflow-hidden">
        <img
          src={loreImages.EVRAN}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top opacity-80"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/40"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[70svh] max-w-5xl flex-col justify-center gap-5 px-6 py-16">
          <h2 className="font-glitch max-w-lg text-3xl text-cyan-100 sm:text-5xl">
            {homeCopy.loreHeadline}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-cyan-100/80 sm:text-base">
            {homeCopy.loreBody}
          </p>
          <p className="max-w-lg text-sm leading-relaxed text-cyan-200/70 italic sm:text-base">
            {homeCopy.loreArtTheme}
          </p>
          <div>
            <GlitchFx
              label={homeCopy.ctaEnterLore}
              className={primaryCtaClass}
              onClick={() => navigate(ROUTES.LORE)}
            />
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-cyan-500/25 bg-black px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <img
              src={sharedImages.LOGO_MARK}
              alt=""
              className="mt-0.5 h-10 w-auto object-contain opacity-90"
            />
            <div>
              <p className="font-glitch text-lg text-cyan-300">{homeCopy.brand}</p>
              <p className="mt-1 font-buahs93 text-[10px] tracking-[0.3em] text-cyan-500/70">
                {homeCopy.alphaEyebrow}
              </p>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-cyan-500/65">
                {homeCopy.artProcessNote}
              </p>
            </div>
          </div>
          <nav className="font-buahs93 flex flex-wrap gap-x-5 gap-y-2 text-xs tracking-wide text-cyan-200/80">
            <Link className="hover:text-cyan-100" to={ROUTES.HOW_TO_PLAY}>
              How to play
            </Link>
            <Link className="hover:text-cyan-100" to={ROUTES.CARDS}>
              Cards
            </Link>
            <Link className="hover:text-cyan-100" to={ROUTES.LORE}>
              Lore
            </Link>
            {!isAuthenticated && (
              <>
                <Link className="hover:text-cyan-100" to={ROUTES.REGISTER}>
                  Create account
                </Link>
                <Link className="hover:text-cyan-100" to={ROUTES.LOGIN}>
                  Login
                </Link>
              </>
            )}
            {isAuthenticated && (
              <Link className="hover:text-cyan-100" to={ROUTES.ACCOUNT}>
                Account
              </Link>
            )}
            <span
              className="cursor-default text-cyan-500/50"
              title={homeCopy.feedbackComingSoon}
            >
              Feedback
            </span>
          </nav>
        </div>
      </footer>
    </div>
  )
}

type PathBeatProps = {
  title: string
  body: string
  imageSrc: string
  imageAlt: string
  imageContain?: boolean
  actionLabel: string
  onAction: () => void
  showStripe?: boolean
}

/** One section entrance: fade/rise when paths or lore enter the viewport. */
function useHomeReveal() {
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(".home-reveal")
    )
    if (!nodes.length) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((el) => el.classList.add("is-visible"))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    )

    nodes.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

function PathBeat({
  title,
  body,
  imageSrc,
  imageAlt,
  imageContain,
  actionLabel,
  onAction,
  showStripe = false,
}: PathBeatProps) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="clip-angled relative aspect-[4/3] overflow-hidden border border-cyan-500/25 bg-black/60"
        style={{ "--angle": "36px" } as CSSProperties}
      >
        <img
          src={imageSrc}
          alt={imageAlt}
          className={cn(
            "h-full w-full",
            imageContain ? "object-contain p-8 opacity-80" : "object-cover"
          )}
        />
      </div>
      <h3 className="font-buahs93 text-lg text-cyan-100">{title}</h3>
      <p className="text-sm leading-relaxed text-cyan-100/70">{body}</p>
      <GlitchFx
        label={actionLabel}
        leading={
          showStripe ? (
            <StripeWordmark decorative className="h-3 text-[#635BFF]" />
          ) : undefined
        }
        className={quietCtaClass}
        onClick={onAction}
      />
    </div>
  )
}
