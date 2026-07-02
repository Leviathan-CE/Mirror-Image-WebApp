import { cn } from "@/lib/utils"

/** Maps a short name to the icon asset added under public/images/icons. */
const ICON_SOURCES = {
  // Resources used to play cards.
  life: { src: "/images/icons/LIF.png", label: "Life (LIF)", shape: "token" },
  met: { src: "/images/icons/MET.png", label: "MET", shape: "token" },
  power: { src: "/images/icons/POW.png", label: "Power (POW)", shape: "token" },
  steel: { src: "/images/icons/STL.png", label: "Steel (STL)", shape: "token" },
  time: { src: "/images/icons/TIM.png", label: "Time (TIM)", shape: "token" },
  ram: { src: "/images/icons/RAM.png", label: "RAM", shape: "token" },
  // Card stat: power rating.
  rating: { src: "/images/icons/TLV.png", label: "Power rating", shape: "token" },
  // Card actions.
  recycle: { src: "/images/icons/RE.png", label: "Recycle", shape: "token" },
  expend: { src: "/images/icons/EX.png", label: "Expend", shape: "token" },
  trash: { src: "/images/icons/tr.png", label: "Trash", shape: "token" },
  dismantle: { src: "/images/icons/DIS.png", label: "Dismantle", shape: "token" },
  atomic: {
    src: "/images/icons/keywords/ATOMIC.png",
    label: "Atomic",
    shape: "tag",
  },
  entersPlay: {
    src: "/images/icons/keywords/enters play.png",
    label: "Enters play",
    shape: "tag",
  },
  battlefield: {
    src: "/images/icons/keywords/battlefield.png",
    label: "Enters battlefield",
    shape: "tag",
  },
  stockpile: {
    src: "/images/icons/keywords/stockpile.png",
    label: "Enters stockpile",
    shape: "tag",
  },
  attack: {
    src: "/images/icons/keywords/attack trigger.png",
    label: "Attack",
    shape: "tag",
  },
  endTurn: {
    src: "/images/icons/keywords/end of turn.png",
    label: "End of turn",
    shape: "tag",
  },
  start: {
    src: "/images/icons/keywords/miantinace phase.png",
    label: "Start of turn",
    shape: "tag",
  },
  defeated: {
    src: "/images/icons/keywords/defeated.png",
    label: "Defeated",
    shape: "tag",
  },
  static: {
    src: "/images/icons/keywords/static.png",
    label: "Static",
    shape: "tag",
  },
  effect: {
    src: "/images/icons/keywords/Effect.png",
    label: "Effect",
    shape: "tag",
  },
  invoke: {
    src: "/images/icons/keywords/invoke.png",
    label: "Invoke",
    shape: "tag",
  },
  conditional: { src: "/images/icons/IF.png", label: "If", shape: "tag" },
} as const

export type GameIconName = keyof typeof ICON_SOURCES

type GameIconProps = {
  name: GameIconName
  className?: string
}

export function GameIcon({ name, className }: GameIconProps) {
  const icon = ICON_SOURCES[name]

  // Tag banners ship with large transparent padding around the text. Crop that
  // padding by oversizing the image inside a short, clipped box so the label
  // reads at a size comparable to the surrounding body text.
  if (icon.shape === "tag") {
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center overflow-hidden align-text-bottom",
          className
        )}
      >
        <img
          src={icon.src}
          alt={icon.label}
          title={icon.label}
          className="h-20 w-auto max-w-none object-contain"
        />
      </span>
    )
  }

  return (
    <img
      src={icon.src}
      alt={icon.label}
      title={icon.label}
      className={cn("inline-block h-5 w-auto align-text-bottom", className)}
    />
  )
}
