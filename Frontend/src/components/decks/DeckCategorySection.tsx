/**
 * One deck category block: name + ⋯ menu (rename/delete), then card stack.
 * Droppable target for moving cards between sections.
 */

import { useEffect, useId, useRef, useState, type DragEvent } from "react"

import {
  DeckCardStack,
  isDeckCardDrag,
  parseDeckCardDrag,
  type DeckCardDragPayload,
} from "@/components/decks/DeckCardStack"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import type { DeckCardEntry, DeckCategoryOut } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

type DeckCategorySectionProps = {
  category: DeckCategoryOut
  cards: DeckCardEntry[]
  canEdit: boolean
  disabled?: boolean
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
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
  onRename,
  onDelete,
  onCardDrop,
  onQuantityDelta,
  selectedKeys,
  onSelectCard,
  onClearSelect,
  reserved = false,
}: DeckCategorySectionProps) {
  const menuId = useId()
  const menuRootRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
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

  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(event: MouseEvent) {
      if (!menuRootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen])

  async function commitRename() {
    const next = draftName.trim()
    if (!next || next === category.name) {
      setRenaming(false)
      setDraftName(category.name)
      return
    }
    setBusy(true)
    try {
      await onRename(next)
      setRenaming(false)
    } finally {
      setBusy(false)
    }
  }

  async function commitDelete() {
    setMenuOpen(false)
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
        event.dataTransfer.dropEffect = "move"
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
            <EditBox
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
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
              disabled={locked || !draftName.trim()}
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
                setMenuOpen(false)
                setDraftName(category.name)
                setRenaming(true)
              }}
            >
              {category.name}
            </h2>
            <span className="font-mono text-[10px] text-cyan-500/60">
              {cardTotal} cards
            </span>
            {canEdit && !reserved ? (
              <div ref={menuRootRef} className="relative ml-auto">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls={menuId}
                  disabled={locked}
                  className={cn(
                    "font-buahs93 flex h-8 w-8 items-center justify-center rounded-none",
                    "text-lg leading-none text-cyan-200/80 hover:bg-cyan-500/10 hover:text-white",
                    "disabled:opacity-50"
                  )}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div
                    id={menuId}
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] border border-cyan-500/30 bg-black/95 py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="font-buahs93 block w-full px-3 py-2 text-left text-xs text-cyan-100 hover:bg-cyan-500/15"
                      onClick={() => {
                        setMenuOpen(false)
                        setDraftName(category.name)
                        setRenaming(true)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="font-buahs93 block w-full px-3 py-2 text-left text-xs text-red-300/90 hover:bg-red-500/15"
                      onClick={() => void commitDelete()}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className={cn(cards.length === 0 ? "min-h-10 py-1" : "flex justify-start")}>
        {cards.length === 0 ? (
          <p className="font-mono text-xs text-white/35">
            {acceptsDrops
              ? "Drop cards here."
              : "No cards in this section."}
          </p>
        ) : (
          <DeckCardStack
            cards={cards}
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
