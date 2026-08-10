/**
 * Shared minimal auth helper page chrome for verify / reset / invite.
 */

import type { ReactNode } from "react"

import { sharedImages } from "@/assets"

export function AuthUtilityShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6 pt-16">
        <h1 className="font-glitch text-center text-3xl text-cyan-300 lg:text-4xl">
          {title}
        </h1>
        <div className="border border-cyan-500/20 bg-black/50 p-6">{children}</div>
      </div>
    </section>
  )
}
