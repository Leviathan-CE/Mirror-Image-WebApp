import { useEffect, useState } from "react"

/**
 * Observes section anchor elements and returns the id of the topmost section
 * currently in view for table-of-contents highlighting.
 */
export function useActiveSection(ids: string[]) {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    const visible = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio)
          } else {
            visible.delete(entry.target.id)
          }
        }

        let topId: string | null = null
        for (const id of ids) {
          if (visible.has(id)) {
            topId = id
            break
          }
        }
        if (topId) setActiveId(topId)
      },
      {
        rootMargin: "-96px 0px -60% 0px",
        threshold: [0, 0.1, 0.5, 1],
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return activeId
}
