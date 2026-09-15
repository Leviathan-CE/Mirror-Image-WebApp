/**
 * Lore page art gallery — full-bleed backgrounds + scrolling panes.
 * Image keys map to `loreImages` in assets/lore.ts.
 */

import type { LoreImageKey } from "@/assets/lore"

export type LoreGalleryBeat = {
  id: string
  title: string
  body: string
  imageKey: LoreImageKey
  /** Pane docks left or right on desktop (alternating reads modern). */
  align: "left" | "right"
}

export const loreGalleryCopy = {
  eyebrow: "GALLERY",
  headline: "Art from the war",
  lead: "Scroll the panes. The world underneath changes with you.",
} as const

/** Coolest plates first — keep the set short so the scroll stays a showcase. */
export const loreGalleryBeats: LoreGalleryBeat[] = [
  {
    id: "hunter",
    title: "Warforms",
    body: "When PyAi returned, it started with thunder then it most brutal weapon the hunterkiller a 9ft tall monstrosity with almost skin like metalics to head the front.",
    imageKey: "HUNTER_KILLER",
    align: "left",
  },
  {
    id: "scourge",
    title: "Alley Dogs",
    body: "Biomechanical nightmares in the fog — machine visions given teeth, cable, and hunger, the swarm of flesh and metal. Attack dogs in every meaning of the word.",
    imageKey: "SCOURGE",
    align: "right",
  },
  {
    id: "blight",
    title: "Something in the sky",
    body: "Scale that makes a pilot feel small. Tentacles of light over a city that never slept easy again always watching for somone or somthing step out of line.",
    imageKey: "BLIGHT_DRONE",
    align: "left",
  },
  {
    id: "bane",
    title: "Walking steel",
    body: "Man'd and unamed version ranging from 6-12ft in height often commanded by pilots HAI or piloted by them. they make up they heavy hitting force though large ones are few in number.",
    imageKey: "BANECRAWLER",
    align: "right",
  },
  {
    id: "evran",
    title: "Those who still stand",
    body: "Many poeple in Aerathea are hero's and legends not willing to bow to PyAi brutal control protocol. Thus the whole world makes a desprate stand together. at the center are the pilots who lead battalions of drones, mechs, and robots and invoke powerful thuamatech cyberspells.",
    imageKey: "EVRAN",
    align: "left",
  },
  {
    id: "princess",
    title: "Bladestress",
    body: "One such hero is Princess Yagihiyri, fighting to protect her poeple from being turned into the very monsters the world is trying to defeat. she is so renowened for her skill she has one of the most common melee weapons named in her honor.",
    imageKey: "PRINCESS_YAGIHIYRI",
    align: "right",
  },
  {
    id: "diana",
    title: "Into the signal",
    body: "Those Part of the S.O.R.A black ops division of the pilot program are tasked with inflitration deep into the underground tunnel network which spans most of the known world to find where the rogue intelligence hides at all costs.",
    imageKey: "DIANA_UGISDKI",
    align: "left",
  },
]
