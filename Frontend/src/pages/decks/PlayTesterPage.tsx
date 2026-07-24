/**
 * Playtester — battlefield + draggable cards only.
 */

import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets/shared"
import { FreeFloatSurface } from "@/components/Playtester/FreeFloatSurface"
import {
  deckEntryToPlayInstance,
  moveCardtoBack,
  moveCardtoFront,
  toggleExpended,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import { useDeckDetail } from "@/hooks/useDeckDetail"

export function PlayTesterPage() {
  const { token } = useAuth()
  const { deckId: deckIdParam } = useParams()
  const deckId = Number(deckIdParam)

  const { deck, status, errorText } = useDeckDetail(deckId, token)
  const [floatCards, setFloatCards] = useState<PlayingCardInstance[]>([])

  useEffect(() => {
    if (status !== "ready" || !deck) {
      setFloatCards([])
      return
    }

    setFloatCards(
      deck.cards.slice(0, 3).map((entry, index) => {
        const instance = deckEntryToPlayInstance(entry, "battlefield")
        return {
          ...instance,
          instanceId: `float-${entry.card_id}-${index}`,
          x: 24 + index * 132,
          y: 48,
        }
      })
    )
  }, [status, deck?.id])

  function onMoveCard(instanceId: string, x: number, y: number) {
    setFloatCards((prev) =>
      prev.map((card) =>
        card.instanceId === instanceId ? { ...card, x, y } : card
      )
    )
  }
  function onBringToFront(instanceId:string){
    setFloatCards((prev)=> moveCardtoFront(prev, instanceId))
  }
  function onSendToBack(instanceId:string){
    setFloatCards((prev)=> moveCardtoBack(prev, instanceId))
  }
  function onToggleExpended(instanceId:string){
    setFloatCards((prev) => toggleExpended(prev,instanceId))
  }


  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col p-3 pt-16">
        {status === "error" ? (
          <p className="font-mono text-sm text-red-400" role="alert">
            {errorText}
          </p>
        ) : null}

        {status === "ready" ? (
          <FreeFloatSurface
            className="min-h-0 flex-1 border-cyan-500/20"
            cards={floatCards}
            onMoveCard={onMoveCard}
            onBringToFront={onBringToFront}
            onSendToBack={onSendToBack}
            onToggleExpended={onToggleExpended}
          />
        ) : null}
      </div>
    </section>
  )
}
