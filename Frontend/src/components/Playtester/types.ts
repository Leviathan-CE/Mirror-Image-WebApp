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
} from "./session/playCard.logic"
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
} from "./session/playCard.logic"

export {
  isSessionTokenInstance,
  destroySessionTokenIfLeaving,
  destroySessionCardIfLeaving,
} from "./session/sessionResources.logic"

export type {
  MoveAllSourceZone,
  MoveAllDestinationZone,
} from "./drag/zoneMoves.logic"
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
} from "./drag/zoneMoves.logic"

export {
  mulberry32,
  rngStep,
  rngFromState,
} from "./session/rng.logic"
export type { RngState, RngNext } from "./session/rng.logic"

export type {
  PlaySessionState,
  SessionAction,
  SeatRecord,
} from "./session/sessionActions.logic"
export {
  applyAction,
  applyActions,
  createPlaySessionState,
  seatRecord,
} from "./session/sessionActions.logic"

export type { FogView, FogCard, FogStub } from "./session/fogView.logic"
export { viewFor, isFogStub, materializeFog, stubToInstance, withPreservedSelection, withPeerSelectionChrome } from "./session/fogView.logic"
