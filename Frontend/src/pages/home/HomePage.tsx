/**
 * Public home: full-viewport slides, then logo and copyright.
 *
 * Mission, card row, lore, Discord, newsletter.
 */

import {
  useEffect,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Link } from "react-router-dom"

import { sharedImages } from "@/assets"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { MailingConsent } from "@/components/legal/MailingConsent"
import { subscribeMailingList } from "@/lib/api/mailingList"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

import { homeCopy, homeShowCards } from "./homeContent"

const SLIDES = [
  { id: "home-mission", label: "Mission" },
  { id: "home-play", label: "Play" },
  { id: "home-lore", label: "Lore" },
  { id: "home-discord", label: "Discord" },
  { id: "home-database", label: "Database" },
  { id: "home-news", label: "News" },
] as const

type SlideId = (typeof SLIDES)[number]["id"]

function useHomeSnap() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add("home-snap-root")
    return () => {
      root.classList.remove("home-snap-root")
    }
  }, [])
}

function useActiveSlide() {
  const [active, setActive] = useState<SlideId>(SLIDES[0].id)

  useEffect(() => {
    const nodes = SLIDES.map((slide) => document.getElementById(slide.id))
      .filter((node): node is HTMLElement => node !== null)
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        setActive(visible.target.id as SlideId)
      },
      { threshold: [0.45, 0.65] }
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return active
}

function goToSlide(id: string) {
  const node = document.getElementById(id)
  if (!node) return
  node.scrollIntoView({ behavior: "smooth", block: "start" })
}

function SlideNav({ active }: { active: SlideId }) {
  return (
    <nav
      className="home-slide-nav"
      aria-label="Home sections"
    >
      {SLIDES.map((slide) => {
        const isCurrent = slide.id === active
        return (
          <button
            key={slide.id}
            type="button"
            className={cn(
              "home-slide-nav__dot",
              isCurrent && "is-current"
            )}
            aria-label={slide.label}
            aria-current={isCurrent ? "true" : undefined}
            onClick={() => goToSlide(slide.id)}
          />
        )
      })}
    </nav>
  )
}

const TILT_X_DEGREES = 26
const TILT_Y_DEGREES = 32

type ShowCard = (typeof homeShowCards)[number]
type CardTilt = { x: number, y: number }

function pointerTilt(
  event: ReactPointerEvent<HTMLImageElement>,
): CardTilt | null {
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  )
  if (reduced.matches) return null
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width === 0) return null
  if (rect.height === 0) return null
  const px = (event.clientX - rect.left) / rect.width
  const py = (event.clientY - rect.top) / rect.height
  const x = (py - 0.5) * TILT_X_DEGREES
  const y = (px - 0.5) * TILT_Y_DEGREES
  return { x, y }
}

function tiltTransform(tilt: CardTilt | null): string {
  if (tilt === null) return "none"
  const x = tilt.x.toFixed(2)
  const y = tilt.y.toFixed(2)
  return `rotateX(${x}deg) rotateY(${y}deg) scale(1.04)`
}

function ShowCardView({ card }: { card: ShowCard }) {
  const [tilt, setTilt] = useState<CardTilt | null>(null)

  function onMove(event: ReactPointerEvent<HTMLImageElement>) {
    setTilt(pointerTilt(event))
  }

  function onLeave() {
    setTilt(null)
  }

  return (
    <img
      src={card.src}
      alt=""
      draggable={false}
      className="home-card"
      style={{ transform: tiltTransform(tilt) }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    />
  )
}

function CardRow() {
  const count = homeShowCards.length
  const gaps = count - 1
  return (
    <div
      className="home-card-row"
      style={{
        ["--card-count" as string]: String(count),
        ["--card-gaps" as string]: String(gaps),
      }}
    >
      {homeShowCards.map((card) => (
        <ShowCardView key={card.id} card={card} />
      ))}
    </div>
  )
}

function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.includes("@")) return false
  const parts = trimmed.split("@")
  if (parts.length !== 2) return false
  if (!parts[0] || !parts[1]) return false
  return parts[1].includes(".")
}

function NewsletterForm() {
  const [email, setEmail] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [tone, setTone] = useState<"ok" | "bad" | "idle">("idle")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!looksLikeEmail(email)) {
      setTone("bad")
      setMessage("Enter a valid email address.")
      return
    }
    if (!agreed) {
      setTone("bad")
      setMessage(
        "Agree to the privacy policy and terms of service."
      )
      return
    }

    setBusy(true)
    setMessage("")
    setTone("idle")
    try {
      const result = await subscribeMailingList(email.trim())
      setTone("ok")
      if (result.already_subscribed) {
        setMessage("You are already on the list.")
        return
      }
      setMessage("You are on the list. Watch your inbox.")
      setEmail("")
    } catch {
      setTone("bad")
      setMessage("Could not subscribe right now. Try again soon.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="mt-8 flex w-full max-w-md flex-col gap-3"
      onSubmit={(event) => {
        void onSubmit(event)
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="sr-only">Email address</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          placeholder={homeCopy.newsPlaceholder}
          disabled={busy}
          className={
            "h-12 border border-cyan-500/35 bg-black/50 px-4 "
            + "font-mono text-sm text-cyan-50 outline-none "
            + "transition-colors duration-300 "
            + "placeholder:text-cyan-100/35 "
            + "focus:border-cyan-300/80"
          }
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <MailingConsent
        checked={agreed}
        disabled={busy}
        onChecked={setAgreed}
      />
      <GlitchFx
        type="submit"
        label={busy ? "SENDING…" : homeCopy.newsCta}
        disabled={busy}
        variant="ghost"
        shapeClassName=""
        className={
          "home-solid-link h-12 rounded-none "
          + "hover:bg-cyan-300 hover:text-black "
          + "disabled:opacity-60"
        }
      />
      <p
        className={cn(
          "min-h-5 font-mono text-xs",
          tone === "bad" ? "text-amber-200/90" : "text-cyan-200/80"
        )}
        role="status"
      >
        {message}
      </p>
    </form>
  )
}

export function HomePage() {
  useHomeSnap()
  const active = useActiveSlide()

  return (
    <div className="bg-black text-cyan-50">
      <SlideNav active={active} />

      <section id="home-mission" className="home-slide">
        <div
          className="home-hero-bg absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})`,
          }}
          aria-hidden
        />
        <div className="home-slide__veil" aria-hidden />
        <div className="home-slide__copy home-hero-content">
          <p className="home-kicker">{homeCopy.productLine}</p>
          <h1 className="home-display">{homeCopy.brand}</h1>
          <p className="home-mission">{homeCopy.mission}</p>
          <p className="home-body">{homeCopy.heroBody}</p>
          <GlitchFx
            variant="ghost"
            label={homeCopy.ctaHowToPlay}
            shapeClassName=""
            className={
              "home-text-link h-auto rounded-none "
              + "bg-transparent px-0 shadow-none "
              + "hover:bg-transparent hover:text-white"
            }
            render={<Link to={ROUTES.HOW_TO_PLAY} />}
          />
        </div>
      </section>

      <section id="home-play" className="home-slide">
        <div className="home-slide__copy home-slide__copy--wide">
          <h2 className="home-title">{homeCopy.pillarsTitle}</h2>
          <CardRow />
          <ul className="home-pillars">
            {homeCopy.pillars.map((pillar) => (
              <li key={pillar.id}>
                <p className="home-kicker">{pillar.label}</p>
                <p className="mt-2 text-sm text-cyan-100/75">
                  {pillar.line}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="home-lore" className="home-slide">
        <img
          src="/images/banner_scourge.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="home-slide__veil home-slide__veil--lore" aria-hidden />
        <div className="home-slide__copy">
          <p className="home-kicker">{homeCopy.loreKicker}</p>
          <p className="home-lore">{homeCopy.loreBody}</p>
          <GlitchFx
            variant="ghost"
            label={homeCopy.ctaEnterLore}
            shapeClassName=""
            className={
              "home-text-link h-auto rounded-none "
              + "bg-transparent px-0 shadow-none "
              + "hover:bg-transparent hover:text-white"
            }
            render={<Link to={ROUTES.LORE} />}
          />
        </div>
      </section>

      <section id="home-discord" className="home-slide">
        <img
          src="/images/banner_mech.jpg"
          alt=""
          className={
            "home-discord-bg absolute inset-0 "
            + "h-full w-full object-cover"
          }
        />
        <div
          className="home-slide__veil home-slide__veil--discord"
          aria-hidden
        />
        <div className="home-slide__copy home-slide__copy--center">
          <h2 className="home-title">{homeCopy.discordTitle}</h2>
          <p className="home-body home-body--center">
            {homeCopy.discordBody}
          </p>
          <GlitchFx
            variant="ghost"
            label={homeCopy.discordCta}
            shapeClassName=""
            className={
              "home-solid-link h-auto rounded-none "
              + "hover:bg-cyan-300 hover:text-black"
            }
            render={
              <a
                href={homeCopy.discordInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          />
        </div>
      </section>

      <section id="home-database" className="home-slide">
        <div
          className="home-hero-bg absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})`,
          }}
          aria-hidden
        />
        <div className="home-slide__veil" aria-hidden />
        <div className="home-slide__copy home-slide__copy--center">
          <h2 className="home-title">{homeCopy.databaseTitle}</h2>
          <p className="home-body home-body--center">
            {homeCopy.databaseBody}
          </p>
          <GlitchFx
            variant="ghost"
            label={homeCopy.databaseCta}
            shapeClassName=""
            className={
              "home-solid-link h-auto rounded-none "
              + "hover:bg-cyan-300 hover:text-black"
            }
            render={<Link to={ROUTES.CARDS} />}
          />
        </div>
      </section>

      <section
        id="home-news"
        className="home-slide home-slide--stack"
      >
        <div className="home-slide__copy home-slide__copy--center">
          <p className="home-kicker">{homeCopy.newsKicker}</p>
          <h2 className="home-title">{homeCopy.newsTitle}</h2>
          <p className="home-body home-body--center">
            {homeCopy.newsBody}
          </p>
          <NewsletterForm />
        </div>
        <footer className="home-close">
          <img
            src={sharedImages.LOGO}
            alt={homeCopy.brand}
            className="home-close__logo"
          />
          <p className="home-close__copy">{homeCopy.copyright}</p>
          <p className="home-close__copy">
            <Link to={ROUTES.PRIVACY}>Privacy</Link>
            {" · "}
            <Link to={ROUTES.TERMS}>Terms</Link>
          </p>
        </footer>
      </section>
    </div>
  )
}
