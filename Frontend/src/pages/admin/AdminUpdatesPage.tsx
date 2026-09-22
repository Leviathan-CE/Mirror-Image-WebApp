/**
 * Staff announcement editor: draft, publish, reusable media, delete.
 */

import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { AnnouncementBody } from "@/components/updates/AnnouncementBody"
import {
  AnnouncementMediaPicker,
  pickedToKind,
  type PickedMedia,
} from "@/components/updates/AnnouncementMediaPicker"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { EditBox } from "@/components/ui/EditBox"
import { markdownImageToken, parseYoutubeId } from "@/lib/announcement.logic"
import { ApiError } from "@/lib/api/client"
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAdminAnnouncements,
  patchAnnouncement,
  type AnnouncementPost,
} from "@/lib/api/announcements"
import { cn } from "@/lib/utils"
import { AdminPageShell } from "@/pages/admin/AdminPageShell"

type CoverDraft = {
  kind: "image" | "youtube" | "card" | ""
  youtube: string
  mediaId: number | null
  cardId: number | null
  cardFace: "art" | "thumb" | null
}

const EMPTY_COVER: CoverDraft = {
  kind: "",
  youtube: "",
  mediaId: null,
  cardId: null,
  cardFace: null,
}

const secondaryActionClassName =
  "font-buahs93 h-8 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-xs text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

const primaryActionClassName =
  "font-buahs93 h-8 rounded-none bg-cyan-700 px-4 text-xs text-white hover:bg-cyan-900 disabled:opacity-60"

const dangerActionClassName =
  "font-buahs93 h-7 rounded-none border border-red-500/45 bg-red-950/50 px-2 text-[10px] text-red-100 hover:border-red-400/70 hover:bg-red-950/80 disabled:opacity-60"

function coverFromPost(post: AnnouncementPost | null): CoverDraft {
  if (!post) return EMPTY_COVER
  return {
    kind: (post.cover_kind as CoverDraft["kind"]) || "",
    youtube: post.cover_youtube_id ?? "",
    mediaId: post.cover_media_id ?? null,
    cardId: post.cover_card_id ?? null,
    cardFace: (post.cover_card_face as "art" | "thumb" | null) ?? null,
  }
}

function coverPayload(cover: CoverDraft) {
  if (cover.kind === "youtube" && parseYoutubeId(cover.youtube)) {
    return {
      cover_kind: "youtube" as const,
      cover_youtube: cover.youtube,
      cover_media_id: null,
      cover_card_id: null,
      cover_card_face: null,
    }
  }
  if (cover.kind === "image" && cover.mediaId) {
    return {
      cover_kind: "image" as const,
      cover_media_id: cover.mediaId,
      cover_card_id: null,
      cover_card_face: null,
      cover_youtube: null,
    }
  }
  if (cover.kind === "card" && cover.cardId) {
    return {
      cover_kind: "card" as const,
      cover_card_id: cover.cardId,
      cover_card_face: cover.cardFace ?? "thumb",
      cover_media_id: null,
      cover_youtube: null,
    }
  }
  return {}
}

export function AdminUpdatesPage() {
  const { token } = useAuth()
  const [posts, setPosts] = useState<AnnouncementPost[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [cover, setCover] = useState<CoverDraft>(EMPTY_COVER)
  const [pickerFor, setPickerFor] = useState<"body" | "cover" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    try {
      setPosts(await fetchAdminAnnouncements(token))
      setError(null)
    } catch {
      setError("Could not load announcements. Run migrate 35 if the table is missing.")
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  function startNew() {
    setEditingId(null)
    setTitle("")
    setBody("")
    setCover(EMPTY_COVER)
  }

  function openPost(post: AnnouncementPost) {
    setEditingId(post.id)
    setTitle(post.title)
    setBody(post.body_markdown)
    setCover(coverFromPost(post))
  }

  function onPick(picked: PickedMedia) {
    if (pickerFor === "cover") {
      if (picked.source === "media") {
        setCover({
          kind: "image",
          youtube: "",
          mediaId: picked.id,
          cardId: null,
          cardFace: null,
        })
      } else {
        setCover({
          kind: "card",
          youtube: "",
          mediaId: null,
          cardId: picked.id,
          cardFace: picked.face,
        })
      }
      setPickerFor(null)
      return
    }
    const tokenMd = markdownImageToken(
      pickedToKind(picked),
      picked.id,
      picked.label
    )
    setBody((prev) => (prev ? `${prev}\n\n${tokenMd}` : tokenMd))
    setPickerFor(null)
  }

  async function save(status: "draft" | "published") {
    if (!token || busy) return
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError("Title is required.")
      return
    }
    setBusy(true)
    setError(null)
    const payload = {
      title: cleanTitle,
      body_markdown: body,
      status,
      ...coverPayload(cover),
    }
    try {
      const saved = editingId
        ? await patchAnnouncement(token, editingId, payload)
        : await createAnnouncement(token, payload)
      setEditingId(saved.id)
      await load()
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Could not save announcement."
      )
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: number) {
    if (!token || busy) return
    if (!window.confirm("Delete this announcement? Uploaded images stay in the library.")) {
      return
    }
    setBusy(true)
    try {
      await deleteAnnouncement(token, id)
      if (editingId === id) startNew()
      await load()
    } catch {
      setError("Could not delete.")
    } finally {
      setBusy(false)
    }
  }

  const previewImages =
    posts.find((p) => p.id === editingId)?.images ?? {}

  return (
    <AdminPageShell
      wide
      title="UPDATES"
      description="Draft and publish announcements. Markdown only — no HTML or code. Images come from the reusable library or card art."
    >
      {error ? (
        <p className="mb-4 font-mono text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border border-cyan-500/25 bg-black/50 p-3">
          <div className="flex items-center justify-between">
            <h2 className="font-buahs93 text-xs text-cyan-200">POSTS</h2>
            <GlitchFx
              type="button"
              label="NEW"
              className={secondaryActionClassName}
              onClick={startNew}
            />
          </div>
          <ul className="mt-3 space-y-2">
            {posts.map((post) => (
              <li key={post.id} className="flex items-start gap-2">
                <button
                  type="button"
                  className={cn(
                    "min-w-0 flex-1 text-left font-mono text-xs",
                    editingId === post.id ? "text-cyan-100" : "text-cyan-100/60"
                  )}
                  onClick={() => openPost(post)}
                >
                  <span className="block truncate">{post.title}</span>
                  <span className="text-[10px] uppercase text-cyan-400/50">
                    {post.status}
                  </span>
                </button>
                <GlitchFx
                  type="button"
                  label="DEL"
                  className={dangerActionClassName}
                  onClick={() => void onDelete(post.id)}
                />
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4 border border-cyan-500/25 bg-black/50 p-4">
          <label className="block">
            <span className="font-buahs93 text-[10px] text-cyan-300/70">
              TITLE
            </span>
            <EditBox
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </label>
          <div>
            <div className="flex flex-wrap gap-2">
              <GlitchFx
                type="button"
                label="INSERT IMAGE"
                className={secondaryActionClassName}
                onClick={() => setPickerFor("body")}
              />
              <GlitchFx
                type="button"
                label="COVER FROM LIBRARY"
                className={secondaryActionClassName}
                onClick={() => setPickerFor("cover")}
              />
            </div>
            <label className="mt-2 block">
              <span className="font-buahs93 text-[10px] text-cyan-300/70">
                BODY (MARKDOWN)
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-1 w-full border border-cyan-500/25 bg-black/70 p-2 font-mono text-sm text-cyan-50"
              />
            </label>
          </div>
          <label className="block">
            <span className="font-buahs93 text-[10px] text-cyan-300/70">
              COVER YOUTUBE URL
            </span>
            <EditBox
              value={cover.youtube}
              onChange={(e) =>
                setCover({
                  ...EMPTY_COVER,
                  kind: e.target.value.trim() ? "youtube" : "",
                  youtube: e.target.value,
                })
              }
              className="mt-1"
              placeholder="https://youtu.be/…"
            />
          </label>
          <p className="font-mono text-[10px] text-cyan-100/45">
            Cover:{" "}
            {cover.kind === "youtube"
              ? `youtube ${cover.youtube}`
              : cover.kind === "image"
                ? `library #${cover.mediaId}`
                : cover.kind === "card"
                  ? `card #${cover.cardId} ${cover.cardFace}`
                  : "none"}
          </p>
          <div className="flex flex-wrap gap-2">
            <GlitchFx
              type="button"
              label="SAVE DRAFT"
              disabled={busy}
              className={secondaryActionClassName}
              onClick={() => void save("draft")}
            />
            <GlitchFx
              type="button"
              label="PUBLISH"
              disabled={busy}
              className={primaryActionClassName}
              onClick={() => void save("published")}
            />
          </div>
          <div className="border-t border-cyan-500/20 pt-4">
            <p className="font-buahs93 text-[10px] text-cyan-300/70">PREVIEW</p>
            <h3 className="font-glitch mt-2 text-2xl text-cyan-200">
              {title || "Untitled"}
            </h3>
            <AnnouncementBody markdown={body} images={previewImages} />
          </div>
        </div>
      </div>

      {token ? (
        <AnnouncementMediaPicker
          token={token}
          open={pickerFor !== null}
          initialTab={pickerFor === "cover" ? "cards" : "uploads"}
          onClose={() => setPickerFor(null)}
          onPick={onPick}
        />
      ) : null}
    </AdminPageShell>
  )
}
