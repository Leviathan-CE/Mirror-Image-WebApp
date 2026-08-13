/** Playtester session domain — barrel re-export (prefer direct module imports over time). */

export type { PlayZone, SelectableActionZone } from "./playtesterConstants"
export { PLAY_ZONE, SELECTABLE_ACTION_ZONES } from "./playtesterConstants"

export type {
  PlayingCardInstance,
  CardCounterKind,
  CardCounterField,
} from "./playCard.logic"
export {
  CARD_COUNTER_FIELD,
  deckEntryToPlayInstance,
  expandDeckToPlayInstances,
  shuffleInPlace,
  moveCardtoFront,
  moveCardtoBack,
  toggleExpended,
  toggleFaceDown,
  setCardsFaceDown,
  selectableActionTargets,
  readyBattlefieldAndStockpile,
  extractStockpileTimeCompletions,
  cardsInZone,
  removeCard,
  adjustCardCounter,
  duplicatePlayingCard,
  duplicatePlayingCards,
} from "./playCard.logic"

export {
  isResourceTokenInstance,
  destroyResourceTokenIfLeaving,
  destroyResourceCardIfLeaving,
} from "./sessionResources.logic"

export type {
  MoveAllSourceZone,
  MoveAllDestinationZone,
} from "./zoneMoves.logic"
export {
  moveToBattlefield,
  moveToHand,
  takeTopLibraryCard,
  putCardInHand,
  putCardOnLibraryTop,
  putCardOnLibraryBottom,
  putCardsOnLibraryBottom,
  moveAllFromZone,
  moveToTrashyard,
  putCardInTrashyard,
  moveToDismantled,
  putCardInDismantled,
  putCardOnBattlefield,
  moveToStockpile,
  putCardOnStockpile,
  moveToPilot,
  putCardOnPilot,
} from "./zoneMoves.logic"
