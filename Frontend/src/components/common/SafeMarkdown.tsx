/**
 * Render user-authored markdown safely — sanitized HTML, http(s) links only.
 */

import type { ComponentProps } from "react"
import ReactMarkdown from "react-markdown"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import type { Schema } from "hast-util-sanitize"

import { safeHttpHref } from "@/lib/linkifyPlainText"
import { cn } from "@/lib/utils"

const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== "img"),
}

type SafeMarkdownProps = {
  text: string
  className?: string
}

export function markdownProseClassName(): string {
  return cn(
    "text-sm leading-relaxed text-white/60",
    "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
    "[&_h1]:mt-3 [&_h1]:font-glitch [&_h1]:text-lg [&_h1]:text-cyan-200/90",
    "[&_h2]:mt-3 [&_h2]:font-glitch [&_h2]:text-base [&_h2]:text-cyan-200/90",
    "[&_h3]:mt-2 [&_h3]:font-buahs93 [&_h3]:text-sm [&_h3]:text-cyan-200/80",
    "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
    "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
    "[&_li]:my-0.5",
    "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-500/30 [&_blockquote]:pl-3 [&_blockquote]:text-white/50",
    "[&_code]:rounded-sm [&_code]:bg-black/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-cyan-100/90",
    "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-cyan-500/20 [&_pre]:bg-black/60 [&_pre]:p-2",
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
    "[&_a]:text-cyan-400/90 [&_a]:underline [&_a]:decoration-cyan-500/40 [&_a]:underline-offset-2 [&_a]:hover:text-cyan-300",
    "[&_hr]:my-3 [&_hr]:border-cyan-500/20",
    "[&_strong]:font-semibold [&_strong]:text-white/75",
    "[&_em]:italic"
  )
}

export function SafeMarkdown({ text, className }: SafeMarkdownProps) {
  if (!text.trim()) return null

  return (
    <div className={cn(markdownProseClassName(), className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          a: MarkdownLink,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

function MarkdownLink({
  href,
  children,
  ...props
}: ComponentProps<"a">) {
  const safe = href ? safeHttpHref(href) : null
  if (!safe) {
    return <span>{children}</span>
  }

  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  )
}
