import { cn } from "@/lib/utils"

type GlitchTextProps = {
  children: string
  className?: string
  hoverOnly?: boolean
  as?: "span" | "h1" | "p"
}

export function GlitchText({
  children,
  className,
  hoverOnly = true,
  as: Tag = "span",
}: GlitchTextProps) {
  return (
    <Tag
      className={cn(hoverOnly ? "glitch glitch-hover" : "glitch", className)}
      data-text={children}
    >
      {children}
    </Tag>
  )
}
