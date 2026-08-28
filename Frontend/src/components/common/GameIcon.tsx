import { cn } from "@/lib/utils"

/** Maps a short name to the icon asset under public/images/icons. */
const ICON_SOURCES = {
  // Colored resources (Costs/).
  life: { src: "/images/icons/Costs/LIF.png", label: "Life (LIF)", shape: "token" },
  metal: { src: "/images/icons/Costs/MET.png", label: "MET", shape: "token" },
  power: { src: "/images/icons/Costs/POW.png", label: "Power (POW)", shape: "token" },
  steel: { src: "/images/icons/Costs/STL.png", label: "Steel (STL)", shape: "token" },
  time: { src: "/images/icons/Costs/TIM.png", label: "Time (TIM)", shape: "token" },
  ram: { src: "/images/icons/Costs/RAM.png", label: "RAM", shape: "token" },

  // Hybrid / special costs (Costs/).
  lifMet: { src: "/images/icons/Costs/LIF-MET.png", label: "LIF/MET", shape: "token" },
  lifPow: { src: "/images/icons/Costs/LIF-POW.png", label: "LIF/POW", shape: "token" },
  lifRam: { src: "/images/icons/Costs/LIF-RAM.png", label: "LIF/RAM", shape: "token" },
  lifStl: { src: "/images/icons/Costs/LIF-STL.png", label: "LIF/STL", shape: "token" },
  lifTim: { src: "/images/icons/Costs/LIF-TIM.png", label: "LIF/TIM", shape: "token" },
  metStl: { src: "/images/icons/Costs/MET-STL.png", label: "MET/STL", shape: "token" },
  metTim: { src: "/images/icons/Costs/MET-TIM.png", label: "MET/TIM", shape: "token" },
  powMet: { src: "/images/icons/Costs/POW-MET.png", label: "POW/MET", shape: "token" },
  powRam: { src: "/images/icons/Costs/POW-RAM.png", label: "POW/RAM", shape: "token" },
  powStl: { src: "/images/icons/Costs/POW-STL.png", label: "POW/STL", shape: "token" },
  powTim: { src: "/images/icons/Costs/POW-TIM.png", label: "POW/TIM", shape: "token" },
  ramMet: { src: "/images/icons/Costs/RAM-MET.png", label: "RAM/MET", shape: "token" },
  ramStl: { src: "/images/icons/Costs/RAM-STL.png", label: "RAM/STL", shape: "token" },
  ramTim: { src: "/images/icons/Costs/RAM-TIM.png", label: "RAM/TIM", shape: "token" },
  stlTim: { src: "/images/icons/Costs/STL-TIM.png", label: "STL/TIM", shape: "token" },
  multi: { src: "/images/icons/Costs/MULTI.png", label: "Multi", shape: "token" },

  // Generic / colorless numbered costs (Costs/).
  gen0: { src: "/images/icons/Costs/GEN-0.png", label: "Generic 0", shape: "token" },
  gen1: { src: "/images/icons/Costs/GEN-1.png", label: "Generic 1", shape: "token" },
  gen2: { src: "/images/icons/Costs/GEN-2.png", label: "Generic 2", shape: "token" },
  gen3: { src: "/images/icons/Costs/GEN3.png", label: "Generic 3", shape: "token" },
  gen4: { src: "/images/icons/Costs/GEN4.png", label: "Generic 4", shape: "token" },
  gen5: { src: "/images/icons/Costs/GEN5.png", label: "Generic 5", shape: "token" },
  gen6: { src: "/images/icons/Costs/GEN6.png", label: "Generic 6", shape: "token" },
  gen7: { src: "/images/icons/Costs/GEN7.png", label: "Generic 7", shape: "token" },
  gen8: { src: "/images/icons/Costs/GEN8.png", label: "Generic 8", shape: "token" },
  gen9: { src: "/images/icons/Costs/GEN9.png", label: "Generic 9", shape: "token" },
  gen10: { src: "/images/icons/Costs/GEN-10.png", label: "Generic 10", shape: "token" },
  genX: { src: "/images/icons/Costs/GEN-X.png", label: "Generic X", shape: "token" },

  // Card stats (root icons/).
  threat_lvl: { src: "/images/icons/TLV.png", label: "Threat level", shape: "token" },
  hand_size: { src: "/images/icons/HS.png", label: "Hand size", shape: "token" },
  hp: { src: "/images/icons/HP.png", label: "HP", shape: "token" },

  // Card actions (root icons/).
  recycle: { src: "/images/icons/RE.png", label: "Recycle", shape: "token" },
  expend: { src: "/images/icons/EX.png", label: "Expend", shape: "token" },
  trash: { src: "/images/icons/tr.png", label: "Trash", shape: "token" },
  dismantle: { src: "/images/icons/DIS.png", label: "Dismantle", shape: "token" },

  // Keyword / timing tags (keywords/).
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
    src: "/images/icons/keywords/STOCKPILE.png",
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
    src: "/images/icons/keywords/START.png",
    label: "Start of turn",
    shape: "tag",
  },
  /** Legacy start-of-turn banner art (filename retains old spelling). */
  maintenance: {
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
    src: "/images/icons/keywords/STATIC.png",
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
  conditional: {
    src: "/images/icons/keywords/IF.png",
    label: "If",
    shape: "tag",
  },
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
          "inline-flex h-6 items-center overflow-hidden align-text-bottom lg:h-7 2xl:h-8",
          className
        )}
      >
        <img
          src={icon.src}
          alt={icon.label}
          title={icon.label}
          className="h-20 w-auto max-w-none object-contain lg:h-24 2xl:h-28"
        />
      </span>
    )
  }

  return (
    <img
      src={icon.src}
      alt={icon.label}
      title={icon.label}
      className={cn(
        "inline-block h-5 w-auto shrink-0 object-contain align-text-bottom lg:h-6 2xl:h-7",
        className
      )}
    />
  )
}
