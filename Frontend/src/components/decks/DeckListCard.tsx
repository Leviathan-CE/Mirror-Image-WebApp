/**
 * One deck on the operator archive list — open, edit meta, or delete.
 * Community mode is read-only (open only) and can show the author.
 */

import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { GlitchFx } from "@/components/effects/GlitchFx"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { DropdownMenu } from "@/components/ui/DropdownMenu"
import {
  PublicTextArea,
  PublicTextField,
} from "@/components/ui/PublicTextField"
import { ApiError } from "@/lib/api/client"
import {
  deleteDeck,
  updateDeck,
  type DeckSummary,
} from "@/lib/api/decks"
import {
  isPublicTextClean,
  PROFANITY_REJECTED,
  PUBLIC_TEXT_BLOCKED_MESSAGE,
} from "@/lib/profanity"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

type DeckListCardProps = {
  deck: DeckSummary
  locked?: boolean
  /** Owner tools: edit / delete. Off for community browse. */
  canManage?: boolean
  /** Show author line (community tab). */
  showAuthor?: boolean
  token?: string
  onUpdated?: (deck: DeckSummary) => void
  onDeleted?: (deckId: number) => void
  onBusyChange?: (busy: boolean) => void
  onError?: (message: string) => void
}

export function DeckListCard({
  deck,
  locked = false,
  canManage = false,
  showAuthor = false,
  token,
  onUpdated,
  onDeleted,
  onBusyChange,
  onError,
}: DeckListCardProps) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(deck.name ?? "")
  const [description, setDescription] = useState(deck.description ?? "")
  const [isPublic, setIsPublic] = useState(deck.is_public)
  const label = deck.name ?? `Deck #${deck.id}`

  function beginEdit() {
    setName(deck.name ?? "")
    setDescription(deck.description ?? "")
    setIsPublic(deck.is_public)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setName(deck.name ?? "")
    setDescription(deck.description ?? "")
    setIsPublic(deck.is_public)
  }

  async function saveEdit() {
    if (!token || !onUpdated) return
    if (!isPublicTextClean(name, description)) {
      onError?.(PUBLIC_TEXT_BLOCKED_MESSAGE)
      return
    }
    setSaving(true)
    onBusyChange?.(true)
    onError?.("")
    try {
      const updated = await updateDeck(deck.id, token, {
        name: name.trim() || "Untitled Deck",
        description: description.trim() || null,
        is_public: isPublic,
      })
      onUpdated(updated)
      setEditing(false)
    } catch (error) {
      onError?.(
        error instanceof ApiError && error.detail === PROFANITY_REJECTED
          ? PUBLIC_TEXT_BLOCKED_MESSAGE
          : error instanceof ApiError
            ? "Could not save deck details."
            : "Save failed."
      )
    } finally {
      setSaving(false)
      onBusyChange?.(false)
    }
  }

  async function performDelete() {
    if (!token || !onDeleted) return
    setSaving(true)
    onBusyChange?.(true)
    onError?.("")
    try {
      await deleteDeck(deck.id, token)
      setDeleteOpen(false)
      onDeleted(deck.id)
    } catch (error) {
      onError?.(
        error instanceof ApiError
          ? "Could not delete this deck."
          : "Delete failed."
      )
    } finally {
      setSaving(false)
      onBusyChange?.(false)
    }
  }

  if (editing && canManage) {
    return (
      <div className="border border-cyan-500/40 bg-black/60 p-5">
        <div className="flex flex-col gap-3">
          <PublicTextField
            value={name}
            onChange={setName}
            placeholder="deck name"
            disabled={saving || locked}
            autoFocus
          />
          <PublicTextArea
            value={description}
            onChange={setDescription}
            placeholder="description"
            disabled={saving || locked}
            rows={3}
          />
          <label className="flex items-center gap-2 font-buahs93 text-sm text-cyan-200/80">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={saving || locked}
              className="accent-cyan-400"
            />
            PUBLIC
          </label>
          <div className="flex flex-wrap gap-2">
            <GlitchFx
              type="button"
              label={saving ? "SAVING…" : "SAVE"}
              disabled={
                saving ||
                locked ||
                !name.trim() ||
                !isPublicTextClean(name, description)
              }
              className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
              onClick={() => void saveEdit()}
            />
            <GlitchFx
              type="button"
              label="CANCEL"
              disabled={saving || locked}
              className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-5 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
              onClick={cancelEdit}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative border border-cyan-500/25 bg-black/50 transition-colors hover:border-cyan-400/50">
      <button
        type="button"
        className={cn(
          "h-full w-full p-5 text-left",
          canManage && "pr-12"
        )}
        disabled={locked || saving}
        onClick={() => navigate(ROUTES.deck(deck.id))}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-buahs93 text-lg text-cyan-100">
            {deck.name ?? `Deck #${deck.id}`}
          </h3>
          <span
            className={cn(
              "shrink-0 text-[10px] tracking-wide",
              deck.is_public ? "text-emerald-400/90" : "text-white/40"
            )}
          >
            {deck.is_public ? "PUBLIC" : "PRIVATE"}
          </span>
        </div>
        {showAuthor ? (
          <p className="mt-1 font-buahs93 text-xs text-cyan-200/60">
            by {deck.author_name}
          </p>
        ) : null}
        {deck.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-snug text-white/55">
            {deck.description}
          </p>
        ) : null}
        {(deck.tags?.length ?? 0) > 0 ? (
          <p className="mt-2 flex flex-wrap gap-1">
            {deck.tags!.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-100/80"
              >
                {tag}
              </span>
            ))}
          </p>
        ) : null}
        <p className="mt-4 font-mono text-xs text-cyan-300/60">
          {deck.card_count} cards
          {typeof deck.like_count === "number" ? ` · ${deck.like_count} likes` : ""}
          {typeof deck.view_count === "number" ? ` · ${deck.view_count} views` : ""}
        </p>
      </button>

      {canManage ? (
        <div className="absolute top-3 right-3">
          <DropdownMenu
            label={`Options for ${deck.name ?? `deck ${deck.id}`}`}
            disabled={locked || saving}
            align="right"
            items={[
              {
                id: "edit",
                label: "Edit details",
                onSelect: beginEdit,
              },
              {
                id: "delete",
                label: "Delete",
                tone: "danger",
                onSelect: () => {
                  setDeleteOpen(true)
                },
              },
            ]}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete deck?"
        description={`Delete “${label}”? This cannot be undone.`}
        confirmLabel="Delete deck"
        cancelLabel="Keep deck"
        tone="danger"
        busy={saving}
        onCancel={() => {
          if (!saving) setDeleteOpen(false)
        }}
        onConfirm={() => {
          void performDelete()
        }}
      />
    </div>
  )
}
