import type { ReactNode } from "react"


type PageHeaderProps = {
  title: string
  description: ReactNode
  glitchTitle?: boolean
}

export function PageHeader({
  title,
  description,
}: PageHeaderProps) {
  return (
    <header className="space-y-2">
      <h1 className="text-5xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </header>
  )
}