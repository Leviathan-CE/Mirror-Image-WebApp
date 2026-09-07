export const sharedImages = {
  ZONE_BACKGROUND: "/images/Zone-32B.png",
  HOME_BANNER: "/images/banner.jpg",
  // Bump ?v= when replacing public/images/card_back.png so Docker/browser
  // caches (same path) pick up the new file.
  CARD_BACK: "/images/card_back.png?v=20260903",
} as const
