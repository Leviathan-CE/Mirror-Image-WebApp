/**
 * Full-bleed lore art theater: sticky backgrounds fade as scrolling panes cross
 * the mid-viewport. Built to show off key art — not a card grid.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react"

import { loreImages } from "@/assets"
import { cn } from "@/lib/utils"

import {
  loreGalleryBeats,
  loreGalleryCopy,
} from "@/pages/lore/loreGalleryContent"

export function LoreArtScroll() {
  const [active, setActive] = useState(0)
  const paneRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const nodes = paneRefs.current.filter(Boolean) as HTMLElement[]
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (!top) return
        const index = nodes.indexOf(top.target as HTMLElement)
        if (index >= 0) setActive(index)
      },
      {
        root: null,
        rootMargin: "-40% 0px -40% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )

    nodes.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="lore-art-scroll relative" aria-label="Lore art gallery">
      {/* Sticky full-viewport stage — images live underneath the panes */}
      <div className="sticky top-0 z-0 h-[100svh] w-full overflow-hidden bg-black">
        {loreGalleryBeats.map((beat, i) => (
          <img
            key={beat.id}
            src={loreImages[beat.imageKey]}
            alt=""
            className={cn(
              "lore-scroll-frame absolute inset-0 h-full w-full object-cover object-center",
              i === active && "is-active"
            )}
          />
        ))}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/50"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-20 sm:pt-24">
          <p className="lore-art-text-outline font-buahs93 text-xs tracking-[0.35em] text-cyan-400/90">
            {loreGalleryCopy.eyebrow}
          </p>
          <h2 className="lore-art-text-outline font-glitch mt-2 text-3xl text-cyan-100 sm:text-4xl">
            {loreGalleryCopy.headline}
          </h2>
          <p className="lore-art-text-outline mt-2 max-w-md text-sm text-cyan-100/90">
            {loreGalleryCopy.lead}
          </p>
        </div>
      </div>

      {/* Panes overlay the sticky stage, then continue the scroll */}
      <div className="relative z-10 -mt-[100svh]">
        {loreGalleryBeats.map((beat, i) => (
          <article
            key={beat.id}
            ref={(el) => {
              paneRefs.current[i] = el
            }}
            className={cn(
              "flex min-h-[100svh] items-end px-6 pb-16 pt-32 sm:items-center sm:pb-24 sm:pt-28",
              beat.align === "right" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "lore-art-pane clip-angled w-full max-w-md border border-cyan-500/40 bg-black/75 p-6 backdrop-blur-md transition-opacity duration-500 sm:p-8",
                "shadow-[0_0_40px_rgba(0,0,0,0.55)]",
                i === active ? "opacity-100" : "opacity-65"
              )}
              style={{ "--angle": "28px" } as CSSProperties}
            >
              <p className="font-buahs93 text-[10px] tracking-[0.3em] text-cyan-500/80">
                {String(i + 1).padStart(2, "0")} /{" "}
                {String(loreGalleryBeats.length).padStart(2, "0")}
              </p>
              <h3 className="font-glitch mt-3 text-2xl text-cyan-100 sm:text-3xl">
                {beat.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-cyan-100/90 sm:text-base">
                {beat.body}
              </p>
            </div>
          </article>
        ))}

        <div className="flex min-h-[50vh] items-end justify-center px-6 pb-20">
          <a
            href="#lore-codex"
            className="font-buahs93 border border-cyan-500/40 bg-black/70 px-6 py-3 text-xs tracking-wide text-cyan-100 backdrop-blur-md transition-colors hover:border-cyan-400 hover:bg-cyan-500/10"
          >
            CONTINUE TO THE CODEX
          </a>
        </div>
      </div>
    </section>
  )
}
