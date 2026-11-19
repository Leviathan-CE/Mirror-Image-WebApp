import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * BrowserRouter keeps the previous scroll offset.
 * A new path should open at the top of that page.
 * Hash-only jumps stay put, so in-page links still work.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}
