/** Playtester session domain — barrel re-export (prefer direct module imports over time). */

export type { PlayZone, SelectableActionZone } from "./playtesterConstants"
export { PLAY_ZONE, SELECTABLE_ACTION_ZONES } from "./playtesterConstants"

export type { PlayingCardInstance, CardCounterKind } from "./playCard.logic"
export {
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
  cardsInZone,
  removeCard,
  adjustCardCounter,
  duplicatePlayingCard,
} from "./playCard.logic"

export {
  isResourceTokenInstance,
  destroyResourceTokenIfLeaving,
  destroyResourceCardIfLeaving,
} from "./sessionResources.logic"

export {
  moveToBattlefield,
  moveToHand,
  takeTopLibraryCard,
  putCardInHand,
  putCardOnLibraryTop,
  putCardOnLibraryBottom,
  putCardsOnLibraryBottom,
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
