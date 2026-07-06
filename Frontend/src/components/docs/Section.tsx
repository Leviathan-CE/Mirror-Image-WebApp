import type { ReactNode } from "react"

type SectionProps = {
  id: string
  title: string
  children: ReactNode
}

/**
 * Titled rulebook section with consistent heading styling and an anchor `id`
 * used by the table of contents and scroll-spy.
 */
export function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="font-glitch border-b border-cyan-500/30 pb-2 text-3xl text-cyan-300 lg:text-4xl 2xl:text-5xl">
        {title}
      </h2>
      <div className="space-y-4 text-lg leading-relaxed text-gray-300 lg:text-xl 2xl:text-2xl">
        {children}
      </div>
    </section>
  )
}

type SectionLinkProps = {
  href: string
  children: ReactNode
}

/** Anchor link to another section on the page, styled as a cross-reference. */
export function SectionLink({ href, children }: SectionLinkProps) {
  return (
    <a
      href={href}
      className="font-semibold text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 transition-colors hover:text-cyan-200"
    >
      {children}
    </a>
  )
}
