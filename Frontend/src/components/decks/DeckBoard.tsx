/**
 * Presentational deck board: pilot + augment + category sections + new-section zone.
 * Pages own mutations; this component only renders and forwards events.
 */

import { DeckCategorySection } from "@/components/decks/DeckCategorySection"
import { DeckPilotSlot } from "@/components/decks/DeckPilotSlot"
import { NewSectionDropZone } from "@/components/decks/NewSectionDropZone"
import type { DeckCardSortMode } from "@/components/decks/DeckCardSortControls"
import type { DeckCardViewMode } from "@/components/decks/DeckCardViewControls"
import {
  isLibraryDragPayload,
  type DeckCardDragPayload,
} from "@/components/decks/deckCardDrag"
import {
  augmentCards,
  augmentCategory,
  cardsByCategory,
  pilotCard,
} from "@/components/decks/deck.logic"
import { AUGMENT_SECTION_NAME, type DeckCardEntry, type DeckDetail } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

export type DeckBoardProps = {
  deck: DeckDetail
  sortMode: DeckCardSortMode
  viewMode?: DeckCardViewMode
  canEdit: boolean
  disabled?: boolean
  /** Softens pointer events on the board (e.g. while search menu is open). */
  interactionLocked?: boolean
  selectedKeys: ReadonlySet<string>
  onSelectCard: (card: DeckCardEntry, mode: "toggle" | "range") => void
  onClearSelect: (card?: DeckCardEntry) => void
  onRenameCategory: (categoryId: number, name: string) => Promise<void>
  onDeleteCategory: (categoryId: number) => Promise<void>
  onSetCategoryInDeck?: (categoryId: number, inDeck: boolean) => Promise<void>
  onDropToCategory: (
    payload: DeckCardDragPayload,
    categoryId: number
  ) => void | Promise<void>
  onQuantityDelta?: (card: DeckCardEntry, delta: 1 | -1) => void
  onAssignPilot: (
    cardId: number,
    fromCategoryId: number | null
  ) => void | Promise<void>
  onClearPilot?: () => void
  onAddAugment: (
    cardId: number,
    fromCategoryId: number | null
  ) => void | Promise<void>
  onCreateSectionFromDrop?: (payload: DeckCardDragPayload) => void | Promise<void>
}

export function DeckBoard({
  deck,
  sortMode,
  viewMode = "cards",
  canEdit,
  disabled = false,
  interactionLocked = false,
  selectedKeys,
  onSelectCard,
  onClearSelect,
  onRenameCategory,
  onDeleteCategory,
  onSetCategoryInDeck,
  onDropToCategory,
  onQuantityDelta,
  onAssignPilot,
  onClearPilot,
  onAddAugment,
  onCreateSectionFromDrop,
}: DeckBoardProps) {
  const augment = augmentCategory(deck.categories)

  return (
    <div
      className={cn(
        "deck-board",
        viewMode === "list" && "deck-board--list",
        interactionLocked && "pointer-events-none"
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClearSelect()
      }}
    >
      <div className="deck-board__slot flex flex-col gap-4">
        <DeckPilotSlot
          pilot={pilotCard(deck.cards, deck.categories)}
          canEdit={canEdit}
          disabled={disabled}
          onDropCard={(payload) =>
            void onAssignPilot(
              payload.cardId,
              isLibraryDragPayload(payload) ? null : payload.fromCategoryId
            )
          }
          onClear={canEdit ? onClearPilot : undefined}
        />
        {augment ? (
          <DeckCategorySection
            category={augment}
            cards={augmentCards(deck.cards, deck.categories, sortMode)}
            canEdit={canEdit}
            disabled={disabled}
            viewMode={viewMode}
            reserved
            selectedKeys={selectedKeys}
            onSelectCard={onSelectCard}
            onClearSelect={onClearSelect}
            onRename={async () => undefined}
            onDelete={async () => undefined}
            onCardDrop={(payload) =>
              void onAddAugment(
                payload.cardId,
                isLibraryDragPayload(payload) ? null : payload.fromCategoryId
              )
            }
            onQuantityDelta={onQuantityDelta}
          />
        ) : canEdit ? (
          <DeckCategorySection
            category={{
              id: -1,
              name: AUGMENT_SECTION_NAME,
              sort_order: -2,
              in_deck: false,
            }}
            cards={[]}
            canEdit={canEdit}
            disabled={disabled}
            viewMode={viewMode}
            reserved
            selectedKeys={selectedKeys}
            onSelectCard={onSelectCard}
            onClearSelect={onClearSelect}
            onRename={async () => undefined}
            onDelete={async () => undefined}
            onCardDrop={(payload) =>
              void onAddAugment(
                payload.cardId,
                isLibraryDragPayload(payload) ? null : payload.fromCategoryId
              )
            }
          />
        ) : null}
      </div>

      {cardsByCategory(deck.cards, deck.categories, sortMode).map(
        ({ category, cards }) => (
          <DeckCategorySection
            key={category.id}
            category={category}
            cards={cards}
            canEdit={canEdit}
            disabled={disabled}
            viewMode={viewMode}
            selectedKeys={selectedKeys}
            onSelectCard={onSelectCard}
            onClearSelect={onClearSelect}
            onRename={(name) => onRenameCategory(category.id, name)}
            onDelete={() => onDeleteCategory(category.id)}
            onSetInDeck={
              onSetCategoryInDeck
                ? (inDeck) => onSetCategoryInDeck(category.id, inDeck)
                : undefined
            }
            onCardDrop={(payload) => onDropToCategory(payload, category.id)}
            onQuantityDelta={onQuantityDelta}
          />
        )
      )}

      {canEdit && onCreateSectionFromDrop ? (
        <NewSectionDropZone
          disabled={disabled}
          onDropCard={onCreateSectionFromDrop}
        />
      ) : null}
    </div>
  )
}
