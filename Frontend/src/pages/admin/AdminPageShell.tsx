/**
 * Shared chrome for admin console pages.
 */

import type { ReactNode } from "react"

import { sharedImages } from "@/assets"

type AdminPageShellProps = {
  title: string
  description: string
  children: ReactNode
  /** Wider content column (e.g. cards DB table). */
  wide?: boolean
}

export function AdminPageShell({
  title,
  description,
  children,
  wide = false,
}: AdminPageShellProps) {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div
        className={`relative z-10 mx-auto w-full pt-14 ${wide ? "max-w-6xl" : "max-w-5xl"}`}
      >
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ADMIN
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">{description}</p>
        </header>
        {children}
      </div>
    </section>
  )
}
