import { useEffect, useMemo, useState } from "react"

import { useActiveSection } from "@/hooks/useActiveSection"
import { cn } from "@/lib/utils"

export type TocEntry = { id: string; label: string }

type TableOfContentsProps = {
  sections: TocEntry[]
  title?: string
}

/** Sticky table of contents with scroll-spy highlighting for long doc pages. */
export function TableOfContents({
  sections,
  title = "Contents",
}: TableOfContentsProps) {
  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections])
  const activeId = useActiveSection(sectionIds)

  return (
    <nav
      id="toc"
      aria-label="Table of contents"
      className="scroll-mt-24 rounded-md border border-cyan-500/20 bg-black/60 p-4 lg:sticky lg:top-24"
    >
      <h2 className="font-glitch mb-3 text-lg text-cyan-300 2xl:text-xl">{title}</h2>
      <ol className="space-y-1 text-sm 2xl:text-base">
        {sections.map((section, index) => {
          const isActive = section.id === activeId
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "flex items-center rounded border-l-2 py-0.5 pl-2 transition-colors",
                  isActive
                    ? "border-cyan-300 bg-cyan-400/10 text-cyan-200"
                    : "border-transparent text-gray-400 hover:text-cyan-200"
                )}
              >
                <span
                  className={cn(
                    "mr-2",
                    isActive ? "text-cyan-300" : "text-cyan-500/60"
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.label}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Floating TOC button for smaller screens where the sidebar is not sticky. */
export function BackToTocButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToToc = () => {
    document.getElementById("toc")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <button
      type="button"
      onClick={scrollToToc}
      aria-label="Jump to table of contents"
      className={cn(
        "font-glitch fixed bottom-6 right-6 z-50 flex items-center gap-2 clip-angled border border-cyan-400/60 bg-cyan-700/90 px-3 py-2 text-sm text-cyan-50 shadow-lg shadow-cyan-500/20 backdrop-blur transition-all hover:bg-cyan-600 active:bg-cyan-500 lg:hidden",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      TOC
    </button>
  )
}
