import { useEffect, useMemo, useState } from "react"

import { useActiveSection } from "@/hooks/useActiveSection"
import { cn } from "@/lib/utils"

export type TocEntry = {
  id: string
  label: string
  children?: TocEntry[]
}

type TableOfContentsProps = {
  sections: TocEntry[]
  title?: string
}

/** Flatten nested TOC entries into scroll-spy ids (leaves only when children exist). */
export function collectTocSpyIds(sections: TocEntry[]): string[] {
  const ids: string[] = []
  for (const section of sections) {
    if (section.children?.length) {
      ids.push(...section.children.map((child) => child.id))
    } else {
      ids.push(section.id)
    }
  }
  return ids
}

type TocLinkStyleProps = {
  entry: TocEntry
  index?: number
  activeId: string | null
  nested?: boolean
  parentActive?: boolean
}

function tocLinkClassName({
  nested = false,
  isActive,
  isHighlighted,
}: {
  nested?: boolean
  isActive: boolean
  isHighlighted: boolean
}) {
  return cn(
    "flex w-full items-center rounded border-l-2 py-0.5 text-left transition-colors",
    nested ? "pl-5 text-xs 2xl:text-sm" : "pl-2 text-sm 2xl:text-base",
    isActive
      ? "border-cyan-300 bg-cyan-400/10 text-cyan-200"
      : isHighlighted
        ? "border-cyan-500/40 text-cyan-300/80"
        : "border-transparent text-gray-400 hover:text-cyan-200"
  )
}

function TocLeafLink({
  entry,
  index,
  activeId,
  nested = false,
  parentActive = false,
}: TocLinkStyleProps) {
  const isActive = entry.id === activeId
  const isHighlighted = isActive || parentActive

  return (
    <a
      href={`#${entry.id}`}
      aria-current={isActive ? "location" : undefined}
      className={tocLinkClassName({ nested, isActive, isHighlighted })}
    >
      {!nested && index !== undefined ? (
        <span
          className={cn(
            "mr-2",
            isHighlighted ? "text-cyan-300" : "text-cyan-500/60"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      ) : (
        <span className="mr-2 text-cyan-500/40" aria-hidden>
          ›
        </span>
      )}
      {entry.label}
    </a>
  )
}

type TocParentLinkProps = TocLinkStyleProps & {
  expanded: boolean
  onToggle: () => void
}

function TocParentLink({
  entry,
  index,
  activeId,
  expanded,
  onToggle,
  parentActive = false,
}: TocParentLinkProps) {
  const isActive = entry.id === activeId
  const childActive = entry.children?.some((child) => child.id === activeId) ?? false
  const isHighlighted = isActive || parentActive || childActive

  const handleClick = () => {
    onToggle()
  }

  return (
    <button
      type="button"
      aria-current={isActive ? "location" : undefined}
      aria-expanded={expanded}
      aria-controls={`toc-children-${entry.id}`}
      onClick={handleClick}
      className={tocLinkClassName({ isActive, isHighlighted })}
    >
      {index !== undefined ? (
        <span
          className={cn(
            "mr-2",
            isHighlighted ? "text-cyan-300" : "text-cyan-500/60"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      ) : null}
      <span
        className={cn(
          "mr-1.5 inline-block text-[10px] transition-transform duration-200",
          expanded ? "rotate-90 text-cyan-300" : "text-cyan-500/50"
        )}
        aria-hidden
      >
        ›
      </span>
      {entry.label}
    </button>
  )
}

/** Sticky table of contents with scroll-spy highlighting for long doc pages. */
export function TableOfContents({
  sections,
  title = "Contents",
}: TableOfContentsProps) {
  const spyIds = useMemo(() => collectTocSpyIds(sections), [sections])
  const activeId = useActiveSection(spyIds)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!activeId) return

    for (const section of sections) {
      if (section.children?.some((child) => child.id === activeId)) {
        setExpandedIds((prev) => {
          if (prev.has(section.id)) return prev
          const next = new Set(prev)
          next.add(section.id)
          return next
        })
        break
      }
    }
  }, [activeId, sections])

  const toggleSection = (sectionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  return (
    <nav
      id="toc"
      aria-label="Table of contents"
      className="scroll-mt-24 rounded-md border border-cyan-500/20 bg-black/60 p-4 lg:sticky lg:top-24"
    >
      <h2 className="font-glitch mb-3 text-lg text-cyan-300 2xl:text-xl">{title}</h2>
      <ol className="space-y-1">
        {sections.map((section, index) => {
          const childActive = section.children?.some((child) => child.id === activeId)
          const expanded = expandedIds.has(section.id)
          const hasChildren = Boolean(section.children?.length)

          return (
            <li key={section.id} className="space-y-0.5">
              {hasChildren ? (
                <TocParentLink
                  entry={section}
                  index={index}
                  activeId={activeId}
                  expanded={expanded}
                  onToggle={() => toggleSection(section.id)}
                  parentActive={childActive && section.id !== activeId}
                />
              ) : (
                <TocLeafLink
                  entry={section}
                  index={index}
                  activeId={activeId}
                />
              )}
              {hasChildren && expanded ? (
                <ol
                  id={`toc-children-${section.id}`}
                  className="space-y-0.5"
                >
                  {section.children!.map((child) => (
                    <li key={child.id}>
                      <TocLeafLink entry={child} activeId={activeId} nested />
                    </li>
                  ))}
                </ol>
              ) : null}
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
