/**
 * Shared header frame: brand link + nav slot + trailing actions slot.
 * Guest and operator headers only supply different links/actions.
 */

import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { sharedImages } from "@/assets"
import {
  headerBrandClassName,
  headerInnerClassName,
  headerNavClassName,
  headerShellClassName,
} from "@/components/common/headerStyles"

type HeaderShellProps = {
  /** Brand link target — marketing home (`/`) for guest and operator chrome. */
  brandTo: string
  brandLabel?: string
  nav: ReactNode
  actions: ReactNode
}

export function HeaderShell({
  brandTo,
  brandLabel = "",
  nav,
  actions,
}: HeaderShellProps) {
  return (
    <header className={headerShellClassName}>
      <div className={headerInnerClassName}>
        <Link to={brandTo} className={headerBrandClassName}>
          <img
            src={sharedImages.LOGO_MARK}
            alt=""
            className="h-7 w-auto object-contain sm:h-8 md:h-9"
          />
          <span>{brandLabel}</span>
        </Link>
        <nav className={headerNavClassName}>{nav}</nav>
        {actions}
      </div>
    </header>
  )
}
