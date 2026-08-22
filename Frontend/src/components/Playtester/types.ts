/** Playtester session domain — barrel re-export (prefer direct module imports over time). */

export type { PlayerSlot, PlayZone, SelectableActionZone } from "./constants"
export {
  LOCAL_SEAT,
  PLAYER_SLOT,
  PLAY_ZONE,
  SELECTABLE_ACTION_ZONES,
  otherSeat,
} from "./constants"

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
  isSessionTokenInstance,
  isResourceTokenInstance,
  destroySessionTokenIfLeaving,
  destroySessionCardIfLeaving,
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

export {
  mulberry32,
  rngStep,
  rngFromState,
} from "./rng.logic"
export type { RngState, RngNext } from "./rng.logic"

export type {
  PlaySessionState,
  SessionAction,
  SeatRecord,
} from "./sessionActions.logic"
export {
  applyAction,
  applyActions,
  createPlaySessionState,
  seatRecord,
} from "./sessionActions.logic"

export type { FogView, FogCard, FogStub } from "./fogView.logic"
export { viewFor, isFogStub, materializeFog, stubToInstance } from "./fogView.logic"
