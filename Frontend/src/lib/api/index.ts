/**
 * Public API barrel — prefer importing from `@/lib/api/auth` or `@/lib/api/decks`
 * when you only need one domain; this re-export keeps existing `@/lib/api` imports working.
 */

export { ApiError, apiBaseUrl } from "@/lib/api/client"
export {
  loginRequest,
  isAuthUser,
  type AuthUser,
  type LoginResponse,
} from "@/lib/api/auth"
export {
  fetchBillingStatus,
  fetchBillingPlan,
  fetchBillingPlans,
  fetchBillingConfig,
  createCheckoutSession,
  createPortalSession,
  createSubscriptionIntent,
  fetchPrintQuote,
  createPrintIntent,
  confirmPrintPayment,
  fetchPrintAccess,
  redeemPrintDownload,
  type BillingStatus,
  type BillingPlan,
  type BillingPlans,
  type BillingConfig,
  type SubscriptionIntent,
  type PrintQuote,
  type PrintIntent,
  type PrintAccess,
} from "@/lib/api/billing"
export {
  searchCards,
  fetchCardById,
  fetchCardLibrary,
  fetchCardFacets,
  type CardSearchHit,
  type CardDetail,
  type CardSummary,
  type CardLibraryItem,
  type CardLibraryResponse,
  type CardLibraryFacets,
  type CardLibraryQuery,
} from "@/lib/api/cards"
export {
  fetchAdminCardLibrary,
  bulkUpdateAdminCards,
  PUBLISH_STATUSES,
  LAGALITY_OPTIONS,
  type AdminCardItem,
  type AdminCardLibraryResponse,
  type AdminCardBulkUpdate,
  type PublishStatus,
} from "@/lib/api/cards_admin"
export {
  DEFAULT_DECK_CATEGORY_NAMES,
  PILOT_SECTION_NAME,
  OBJECTIVE_SECTION_NAME,
  AUGMENT_SECTION_NAME,
  addDeckCard,
  createDeck,
  createDeckCategory,
  deleteDeck,
  deleteDeckCategory,
  deckCoverUrl,
  fetchDeckDetail,
  fetchMyDecks,
  fetchPublicDecks,
  removeDeckCard,
  updateDeck,
  updateDeckCard,
  updateDeckCategory,
  cardArtUrl,
  cardFaceUrl,
  type AddDeckCardPayload,
  type DeckCardEntry,
  type DeckCategoryOut,
  type DeckCreatePayload,
  type DeckDetail,
  type DeckSummary,
  type DeckUpdatePayload,
  type UpdateDeckCardPayload,
} from "@/lib/api/decks"
export {
  fetchPublishedAnnouncements,
  fetchAdminAnnouncements,
  type AnnouncementPost,
} from "@/lib/api/announcements"
export {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
  type NotificationListResponse,
} from "@/lib/api/notifications"
export {
  createPlayRoom,
  playWsUrl,
  type PlayRoomCreated,
} from "@/lib/api/playRooms"
