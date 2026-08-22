/**
 * One deck category block: name + ⋯ menu (rename/delete), then card stack.
 * Droppable target for moving cards between sections.
 */

import { useEffect, useState, type DragEvent } from "react"

import {
  deckCardDropEffect,
  isDeckCardDrag,
  parseDeckCardDrag,
  type DeckCardDragPayload,
} from "@/components/decks/deckCardDrag"
import {
  DeckCardStack,
} from "@/components/decks/DeckCardStack"
import type { DeckCardViewMode } from "@/components/decks/DeckCardViewControls"
import { Button } from "@/components/ui/button"
import { DropdownMenu } from "@/components/ui/DropdownMenu"
import { PublicTextField } from "@/components/ui/PublicTextField"
import type { DeckCardEntry, DeckCategoryOut } from "@/lib/api/decks"
import { isPublicTextClean } from "@/lib/profanity"
import { cn } from "@/lib/utils"

type DeckCategorySectionProps = {
  category: DeckCategoryOut
  cards: DeckCardEntry[]
  canEdit: boolean
  disabled?: boolean
  viewMode?: DeckCardViewMode
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onSetInDeck?: (inDeck: boolean) => Promise<void>
  onCardDrop?: (payload: DeckCardDragPayload) => void | Promise<void>
  onQuantityDelta?: (card: DeckCardEntry, delta: 1 | -1) => void
  selectedKeys?: ReadonlySet<string>
  onSelectCard?: (
    card: DeckCardEntry,
    mode: "toggle" | "range"
  ) => void
  onClearSelect?: (card?: DeckCardEntry) => void
  /** Hide rename/delete — used for reserved slots like Augments. */
  reserved?: boolean
}

export function DeckCategorySection({
  category,
  cards,
  canEdit,
  disabled = false,
  viewMode = "cards",
  onRename,
  onDelete,
  onSetInDeck,
  onCardDrop,
  onQuantityDelta,
  selectedKeys,
  onSelectCard,
  onClearSelect,
  reserved = false,
}: DeckCategorySectionProps) {
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(category.name)
  const [busy, setBusy] = useState(false)
  const [dropActive, setDropActive] = useState(false)

  const cardTotal = cards.reduce((sum, c) => sum + c.quantity, 0)
  const locked = disabled || busy
  const acceptsDrops = canEdit && Boolean(onCardDrop) && !locked

  useEffect(() => {
    setDraftName(category.name)
  }, [category.name])

  async function commitRename() {
    const next = draftName.trim()
    if (!next || next === category.name) {
      setRenaming(false)
      setDraftName(category.name)
      return
    }
    if (!isPublicTextClean(next)) return
    setBusy(true)
    try {
      await onRename(next)
      setRenaming(false)
    } finally {
      setBusy(false)
    }
  }

  async function commitDelete() {
    setBusy(true)
    try {
      await onDelete()
    } finally {
      setBusy(false)
    }
  }

  function parseDragPayload(event: DragEvent): DeckCardDragPayload | null {
    return parseDeckCardDrag(event)
  }

  function isCardDrag(event: DragEvent): boolean {
    return isDeckCardDrag(event)
  }

  return (
    <section
      className={cn(
        "deck-board__slot rounded-none border border-transparent p-1 transition-[border-color,background-color] duration-150",
        dropActive && "border-cyan-400/50 bg-cyan-500/10"
      )}
      onDragEnter={(event) => {
        if (!acceptsDrops || !isCardDrag(event)) return
        event.preventDefault()
        setDropActive(true)
      }}
      onDragOver={(event) => {
        if (!acceptsDrops || !isCardDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = deckCardDropEffect()
        setDropActive(true)
      }}
      onDragLeave={(event) => {
        if (!acceptsDrops) return
        const related = event.relatedTarget as Node | null
        if (related && event.currentTarget.contains(related)) return
        setDropActive(false)
      }}
      onDrop={(event) => {
        if (!acceptsDrops || !onCardDrop) return
        event.preventDefault()
        setDropActive(false)
        const payload = parseDragPayload(event)
        if (!payload) return
        const items = payload.cards?.length
          ? payload.cards
          : [
              {
                cardId: payload.cardId,
                fromCategoryId: payload.fromCategoryId,
              },
            ]
        if (items.every((item) => item.fromCategoryId === category.id)) return
        void onCardDrop(payload)
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-cyan-500/15 pb-2">
        {renaming && canEdit && !reserved ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <PublicTextField
              value={draftName}
              onChange={setDraftName}
              size="sm"
              autoWidth
              disabled={locked}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void commitRename()
                }
                if (e.key === "Escape") {
                  setRenaming(false)
                  setDraftName(category.name)
                }
              }}
            />
            <Button
              type="button"
              className="font-buahs93 h-8 rounded-none bg-cyan-800 px-3 text-xs text-white hover:bg-cyan-900"
              disabled={
                locked || !draftName.trim() || !isPublicTextClean(draftName)
              }
              onClick={() => void commitRename()}
            >
              SAVE
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="font-buahs93 h-8 rounded-none px-3 text-xs text-cyan-200/80"
              disabled={locked}
              onClick={() => {
                setRenaming(false)
                setDraftName(category.name)
              }}
            >
              CANCEL
            </Button>
          </div>
        ) : (
          <>
            <h2
              className={cn(
                "font-buahs93 text-lg text-white",
                canEdit && !reserved && !locked && "cursor-text select-none"
              )}
              title={
                canEdit && !reserved ? "Double-click to rename" : undefined
              }
              onDoubleClick={() => {
                if (!canEdit || reserved || locked) return
                setDraftName(category.name)
                setRenaming(true)
              }}
            >
              {category.name}
            </h2>
            {reserved ? null : canEdit && onSetInDeck && !locked ? (
              <button
                type="button"
                aria-pressed={category.in_deck !== false}
                aria-label={
                  category.in_deck === false
                    ? "Not listed in deck"
                    : "Listed in deck"
                }
                className="font-mono text-[10px] text-cyan-200/80 hover:text-white"
                onClick={() => {
                  void onSetInDeck(category.in_deck === false)
                }}
              >
                {category.in_deck === false ? "✕" : "✓"}
              </button>
            ) : (
              <span
                className="font-mono text-[10px] text-cyan-200/70"
                title={
                  category.in_deck === false
                    ? "Not listed in deck"
                    : "Listed in deck"
                }
              >
                {category.in_deck === false ? "✕" : "✓"}
              </span>
            )}
            <span className="font-mono text-[10px] text-cyan-500/60">
              {cardTotal} cards
            </span>
            {canEdit && !reserved ? (
              <DropdownMenu
                label={`${category.name} options`}
                disabled={locked}
                align="right"
                className="ml-auto"
                items={[
                  {
                    id: "rename",
                    label: "Rename",
                    onSelect: () => {
                      setDraftName(category.name)
                      setRenaming(true)
                    },
                  },
                  {
                    id: "in-deck",
                    label: (
                      <span className="flex w-full items-center justify-between gap-3">
                        In deck
                        <span className="font-mono">
                          {category.in_deck === false ? "✕" : "✓"}
                        </span>
                      </span>
                    ),
                    onSelect: () => {
                      void onSetInDeck?.(category.in_deck === false)
                    },
                  },
                  {
                    id: "delete",
                    label: "Delete",
                    tone: "danger",
                    onSelect: () => {
                      void commitDelete()
                    },
                  },
                ]}
              />
            ) : null}
          </>
        )}
      </div>

      <div
        className={cn(
          cards.length === 0
            ? "min-h-10 py-1"
            : viewMode === "list"
              ? "w-full"
              : "flex justify-start"
        )}
      >
        {cards.length === 0 ? (
          <p className="font-mono text-xs text-white/35">
            {acceptsDrops
              ? "Drop cards here."
              : "No cards in this section."}
          </p>
        ) : (
          <DeckCardStack
            cards={cards}
            viewMode={viewMode}
            draggable={canEdit}
            disabled={locked}
            selectedKeys={selectedKeys}
            onSelectCard={canEdit ? onSelectCard : undefined}
            onClearSelect={canEdit ? onClearSelect : undefined}
            onQuantityDelta={canEdit ? onQuantityDelta : undefined}
          />
        )}
      </div>
    </section>
  )
}
