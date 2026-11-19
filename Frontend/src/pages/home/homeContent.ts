/**
 * Home slide copy. Keep the voice plain and the pitch short.
 */

export const homeCopy = {
  brand: "MIRRORIMAGE",
  productLine: "CREATIVE TRADING CARD GAME",
  mission:
    "Choose your mission. Build your RIG. Earn your title as a pilot.",
  heroBody:
    "In the Mirror Image Creative Trading Card Game, you have a "
    + "creative print-to-play path: cheap, easy access to the cards "
    + "you want, so you can play, get creative, and help sculpt the "
    + "set's balance and effects before they go to print. When you "
    + "are ready, the final printed product will be available as a "
    + "classic trading card, with a bonus: each final card is printed "
    + "borderless. Gear up for an intense fight for Aerathea. Manage "
    + "your resources carefully, thwart your opponents with timely "
    + "Quick Hacks, and set up devastating counterattacks with Units. "
    + "Mirror Image is for trading card players, creative "
    + "expressionists, collectors, and anyone itching for something "
    + "new and wildly interesting, with a flavour of familiarity.",

  pillarsTitle:
    "Designed for play, creative expression, and collecting",
  pillars: [
    {
      id: "play",
      label: "Play",
      line: "Sit down and fight for Aerathea.",
    },
    {
      id: "create",
      label: "Create",
      line: "Print the cards you want and shape the set.",
    },
    {
      id: "collect",
      label: "Collect",
      line: "Borderless finals, made to keep.",
    },
  ],

  loreKicker: "AERATHEA",
  loreBody:
    "Aerathea is under a cataclysmic threat of its own making — "
    + "not the first, but the third. A rogue AI, once thought long "
    + "dead, has returned for revenge. It is up to the free people "
    + "still standing to take up the banner of liberty and fight: "
    + "win, or die trying to end this calamity once and for all.",

  discordTitle: "Join the community",
  discordBody:
    "Playtest, talk cards, and help shape the set before it prints.",
  discordCta: "JOIN DISCORD",
  discordInviteUrl: "https://discord.gg/Gv9pyNWffg",

  databaseTitle: "Exploring the database",
  databaseBody:
    "Search the card library by name, cost, type, and rules text.",
  databaseCta: "OPEN THE LIBRARY",

  newsKicker: "NEWSLETTER",
  newsTitle: "Sign up for email news",
  newsBody: "Set news, print drops, and playtest calls.",
  newsCta: "SIGN UP",
  newsPlaceholder: "you@email.com",

  ctaHowToPlay: "HOW TO PLAY",
  ctaEnterLore: "ENTER THE LORE",
  copyright: "© 2026 Mirror Image. All rights reserved.",
} as const

export const homeShowCards = [
  {
    id: "evran",
    src: "/images/home/evran_alt.png",
  },
  {
    id: "zombie",
    src: "/images/home/zombie_drone.png",
  },
  {
    id: "snipe",
    src: "/images/home/snipe.png",
  },
] as const
