/**
 * Peer view of Accumulate: reveal the spent card (back → face), hold so they
 * can read it, then tuck to the library bottom while flipping face-down again.
 *
 * Face layout matches PlayingCard: art at rotateY(0), back at rotateY(180).
 * Start face-down (180), reveal to 0, tuck back to 180 while sliding.
 */

import { useEffect, useRef, useState, type TransitionEvent } from "react";

import { sharedImages } from "@/assets/shared";
import { cardArtUrl } from "@/lib/api/decks";
import { useLatestRef } from "@/hooks/useLatestRef";
import { cn } from "@/lib/utils";

import type { PlayingCardInstance } from "../types";

export type CardAccumulatePeerAnimationProps = {
  card: PlayingCardInstance;
  from: { x: number; y: number; w: number; h: number };
  /** Opp library pile top-left. */
  to: { x: number; y: number };
  onComplete: () => void;
};

type Phase = "idle" | "reveal" | "hold" | "tuck";

const REVEAL_MS = 480;
const HOLD_MS = 2500;
const TUCK_MS = 640;

const faceShell =
  "absolute inset-0 overflow-hidden border bg-black/80 clip-angled [backface-visibility:hidden]";

export function CardAccumulatePeerAnimation({
  card,
  from,
  to,
  onComplete,
}: CardAccumulatePeerAnimationProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const doneRef = useRef(false);
  const onCompleteRef = useLatestRef(onComplete);
  const faceSrc = cardArtUrl(card.artPath, card.artVersion);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onCompleteRef.current();
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("reveal"));
    const holdAt = window.setTimeout(() => setPhase("hold"), REVEAL_MS + 40);
    const tuckAt = window.setTimeout(
      () => setPhase("tuck"),
      REVEAL_MS + HOLD_MS + 40,
    );
    const doneAt = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onCompleteRef.current();
    }, REVEAL_MS + HOLD_MS + TUCK_MS + 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(holdAt);
      window.clearTimeout(tuckAt);
      window.clearTimeout(doneAt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot per mount
  }, []);

  function onTuckEnd(event: TransitionEvent<HTMLDivElement>) {
    if (phase !== "tuck") return;
    if (event.propertyName !== "transform") return;
    if (event.target !== event.currentTarget) return;
    finish();
  }

  const tucking = phase === "tuck";
  // Match PlayingCard: 180 = face-down (back), 0 = face-up (art).
  const spinY = phase === "reveal" || phase === "hold" ? 0 : 180;

  const dx = to.x - from.x + 10;
  const dy = to.y - from.y + from.h * 0.45;

  const frontFace = (
    <div className={cn(faceShell, "border-cyan-400/50")}>
      {faceSrc ? (
        <img
          src={faceSrc}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center px-2 text-center font-mono text-[10px] text-cyan-100/80">
          {card.name || "No art"}
        </span>
      )}
    </div>
  );

  const backFace = (
    <div
      className={cn(faceShell, "border-cyan-500/40")}
      style={{ transform: "rotateY(180deg)" }}
    >
      <img
        src={sharedImages.CARD_BACK}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
    </div>
  );

  return (
    <div
      className="pointer-events-none fixed z-[90]"
      style={{
        left: from.x,
        top: from.y,
        width: from.w,
        height: from.h,
        perspective: 900,
        transformStyle: "preserve-3d",
        transform: tucking
          ? `translate(${dx}px, ${dy}px) scale(0.72)`
          : "translate(0px, 0px) scale(1)",
        opacity: tucking ? 0.4 : 1,
        transition: tucking
          ? `transform ${TUCK_MS}ms cubic-bezier(0.4, 0.05, 0.2, 1), opacity ${TUCK_MS}ms ease-out`
          : undefined,
        zIndex: tucking ? 5 : 90,
      }}
      onTransitionEnd={onTuckEnd}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${spinY}deg)`,
          transition: `transform ${tucking ? TUCK_MS : REVEAL_MS}ms ease-in-out`,
        }}
      >
        {frontFace}
        {backFace}
      </div>
    </div>
  );
}
