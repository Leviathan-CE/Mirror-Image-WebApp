/**
 * Allowlist markdown renderer for announcement posts.
 * Never injects raw HTML. Tags become GameIcons. YouTube links become embeds.
 */

import type { ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"

import { GameIcon } from "@/components/common/GameIcon"
import {
  parseYoutubeId,
  sanitizeAnnouncementMarkdown,
  splitTaggedText,
  youtubeEmbedUrl,
} from "@/lib/announcement.logic"
import { announcementMediaUrl } from "@/lib/api/announcements"
import { cn } from "@/lib/utils"

const SCHEMA = {
  ...defaultSchema,
  tagNames: [
    "p",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "blockquote",
    "a",
    "img",
    "br",
    "hr",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ["href"],
    img: ["src", "alt"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https"],
    src: ["http", "https"],
  },
}

type AnnouncementBodyProps = {
  markdown: string
  images?: Record<string, string>
  className?: string
}

function TaggedNodes({ text }: { text: string }) {
  return (
    <>
      {splitTaggedText(text).map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.value}</span>
        }
        if (part.icon) {
          return (
            <GameIcon
              key={index}
              name={part.icon}
              className="mx-0.5 h-5 w-auto lg:h-6"
            />
          )
        }
        return (
          <span key={index} className="font-mono text-cyan-300/80">
            [{part.value}]
          </span>
        )
      })}
    </>
  )
}

function wrapChildren(children: ReactNode): ReactNode {
  return flattenText(children).map((node, index) => {
    if (typeof node === "string") {
      return <TaggedNodes key={index} text={node} />
    }
    return <span key={index}>{node}</span>
  })
}

function flattenText(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = []
  function walk(node: ReactNode) {
    if (node == null || typeof node === "boolean") return
    if (typeof node === "string" || typeof node === "number") {
      out.push(String(node))
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    out.push(node)
  }
  walk(children)
  return out
}

function rewriteImages(
  markdown: string,
  images: Record<string, string>
): string {
  return markdown.replace(
    /!\[([^\]]*)\]\((media|card-art|card-thumb):(\d+)\)/g,
    (_all, alt: string, kind: string, id: string) => {
      const path = images[`${kind}:${id}`]
      const url = announcementMediaUrl(path)
      if (!url) return ""
      return `![${alt}](${url})`
    }
  )
}

export function AnnouncementBody({
  markdown,
  images = {},
  className,
}: AnnouncementBodyProps) {
  const source = rewriteImages(
    sanitizeAnnouncementMarkdown(markdown),
    images
  ).trim()
  if (!source) {
    return <p className={cn("text-white/45", className)}>No text.</p>
  }

  return (
    <div
      className={cn(
        "space-y-3 text-base leading-relaxed text-white/80 sm:text-lg",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, SCHEMA]]}
        components={{
          h1: ({ children }) => (
            <h2 className="font-glitch text-2xl text-cyan-200">
              {wrapChildren(children)}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="font-buahs93 text-xl text-cyan-100">
              {wrapChildren(children)}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="font-buahs93 text-lg text-cyan-100">
              {wrapChildren(children)}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-white/80">{wrapChildren(children)}</p>
          ),
          li: ({ children }) => <li>{wrapChildren(children)}</li>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-cyan-500/40 pl-3 italic text-white/60">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {wrapChildren(children)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-white/70">{wrapChildren(children)}</em>
          ),
          a: ({ href, children }) => {
            const id = parseYoutubeId(href ?? "")
            if (id) {
              return (
                <span className="my-3 block aspect-video w-full max-w-xl overflow-hidden border border-cyan-500/25 bg-black">
                  <iframe
                    title="YouTube"
                    src={youtubeEmbedUrl(id)}
                    className="h-full w-full"
                    sandbox="allow-scripts allow-same-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="no-referrer"
                  />
                </span>
              )
            }
            if (!href || !/^https?:\/\//i.test(href)) {
              return <span>{wrapChildren(children)}</span>
            }
            return (
              <a
                href={href}
                className="text-cyan-300 underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                {wrapChildren(children)}
              </a>
            )
          },
          img: ({ src, alt }) => {
            const url = announcementMediaUrl(src ?? null)
            if (!url) return null
            return (
              <img
                src={url}
                alt={alt ?? ""}
                className="my-3 max-h-[28rem] w-auto max-w-full border border-cyan-500/20 object-contain"
              />
            )
          },
          code: ({ children }) => <span>{wrapChildren(children)}</span>,
          pre: ({ children }) => <p>{children}</p>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
