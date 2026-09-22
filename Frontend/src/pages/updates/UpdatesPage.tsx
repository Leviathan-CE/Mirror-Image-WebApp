/**
 * Public announcement board — expand a card to read the full post.
 */

import { useEffect, useState } from "react"

import { sharedImages } from "@/assets"
import { AnnouncementBody } from "@/components/updates/AnnouncementBody"
import {
  announcementMediaUrl,
  fetchPublishedAnnouncements,
  type AnnouncementPost,
} from "@/lib/api/announcements"
import { youtubeThumbUrl } from "@/lib/announcement.logic"

function coverSrc(post: AnnouncementPost): string | null {
  if (post.cover.youtube_id) return youtubeThumbUrl(post.cover.youtube_id)
  return announcementMediaUrl(post.cover.image_url)
}

function postedLabel(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function UpdatesPage() {
  const [posts, setPosts] = useState<AnnouncementPost[]>([])
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPublishedAnnouncements()
      .then((data) => {
        if (cancelled) return
        setPosts(data)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError("Could not load updates.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-10 sm:px-6"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-4xl pt-6">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            BOARD
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            UPDATES
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Design notes and announcements. Click a post to expand it.
          </p>
        </header>

        {error ? (
          <p className="font-mono text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {posts.length === 0 && !error ? (
          <p className="font-mono text-sm text-white/45">No updates yet.</p>
        ) : null}

        <ul className="space-y-4">
          {posts.map((post) => {
            const open = openSlug === post.slug
            const cover = coverSrc(post)
            return (
              <li key={post.id}>
                <button
                  type="button"
                  className="flex w-full items-stretch gap-4 border border-cyan-500/25 bg-black/55 p-3 text-left hover:border-cyan-400/50"
                  onClick={() =>
                    setOpenSlug(open ? null : post.slug)
                  }
                  aria-expanded={open}
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="h-24 w-32 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-32 shrink-0 items-center justify-center border border-dashed border-cyan-500/20 font-mono text-[10px] text-cyan-500/40">
                      NO COVER
                    </div>
                  )}
                  <div className="min-w-0 py-1">
                    <h2 className="font-glitch text-xl text-cyan-200 sm:text-2xl">
                      {post.title}
                    </h2>
                    <p className="mt-1 font-mono text-xs text-cyan-100/50">
                      {postedLabel(post.published_at)}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="border border-t-0 border-cyan-500/25 bg-black/70 p-4 sm:p-5">
                    <AnnouncementBody
                      markdown={post.body_markdown}
                      images={post.images}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
