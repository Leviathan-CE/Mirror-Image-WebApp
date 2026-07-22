/**
 * One deck on the operator archive list — open, edit meta, or delete.
 * Community mode is read-only (open only) and can show the author.
 */

import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { DropdownMenu } from "@/components/ui/DropdownMenu"
import { EditBox } from "@/components/ui/EditBox"
import { ApiError } from "@/lib/api/client"
import {
  deleteDeck,
  updateDeck,
  type DeckSummary,
} from "@/lib/api/decks"
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
  const [name, setName] = useState(deck.name ?? "")
  const [description, setDescription] = useState(deck.description ?? "")
  const [isPublic, setIsPublic] = useState(deck.is_public)

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
        error instanceof ApiError
          ? "Could not save deck details."
          : "Save failed."
      )
    } finally {
      setSaving(false)
      onBusyChange?.(false)
    }
  }

  async function confirmDelete() {
    if (!token || !onDeleted) return
    const label = deck.name ?? `Deck #${deck.id}`
    if (
      !window.confirm(
        `Delete “${label}”? This cannot be undone.`
      )
    ) {
      return
    }

    setSaving(true)
    onBusyChange?.(true)
    onError?.("")
    try {
      await deleteDeck(deck.id, token)
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
          <EditBox
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="deck name"
            disabled={saving || locked}
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="description"
            disabled={saving || locked}
            rows={3}
            className="w-full border border-white/40 bg-black/80 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-white/40 focus-visible:border-white"
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
              disabled={saving || locked || !name.trim()}
              className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
              onClick={() => void saveEdit()}
            />
            <Button
              className="font-buahs93 h-9 rounded-none bg-card px-4 text-sm text-white"
              disabled={saving || locked}
              onClick={cancelEdit}
            >
              CANCEL
            </Button>
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
        <p className="mt-4 font-mono text-xs text-cyan-300/60">
          {deck.card_count} cards
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
                  void confirmDelete()
                },
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  )
}
