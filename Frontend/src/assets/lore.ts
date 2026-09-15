export const loreImages = {
  DIANA_UGISDKI: "/images/lore/diana-ugiskai.png",
  THUAMATECH_DIAG: "/images/lore/thuamatech-daig.png",
  EVRAN: "/images/lore/Evran.png",
  SCOURGE: "/images/lore/Scourge.png",
  BLIGHT_DRONE: "/images/lore/blight-drone.png",
  HUNTER_KILLER: "/images/lore/hunter-killer.png",
  BANECRAWLER: "/images/lore/banecrawler.png",
  SPEC_OPS: "/images/lore/spec-ops-agent.png",
  PRINCESS_YAGIHIYRI: "/images/lore/princess-yagihiyri.png",
  JACK: "/images/lore/jack-tech-prodigy.png",
} as const

export type LoreImageKey = keyof typeof loreImages
