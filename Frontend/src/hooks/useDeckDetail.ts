import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"

import { ApiError } from "@/lib/api/client"
import { fetchDeckDetail, type DeckDetail } from "@/lib/api/decks"

export type DeckLoadStatus = "loading" | "ready" | "error"

export type UseDeckDetailResult = {
  deck: DeckDetail | null
  setDeck: Dispatch<SetStateAction<DeckDetail | null>>
  status: DeckLoadStatus
  errorText: string
  setErrorText: Dispatch<SetStateAction<string>>
  loadDeck: (opts?: { silent?: boolean }) => Promise<DeckDetail | null>
}

export function useDeckDetail(
  deckId: number,
  token?: string | null
): UseDeckDetailResult {
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [status, setStatus] = useState<DeckLoadStatus>("loading")
  const [errorText, setErrorText] = useState("")

  const loadDeck = useCallback(
    async (opts?: { silent?: boolean }): Promise<DeckDetail | null> => {
      if (!Number.isFinite(deckId) || deckId <= 0) {
        setStatus("error")
        setErrorText("Invalid deck id.")
        setDeck(null)
        return null
      }

      if (!opts?.silent) setStatus("loading")
      try {
        const detail = await fetchDeckDetail(deckId, token)
        setDeck(detail)
        setStatus("ready")
        return detail
      } catch (error) {
        setDeck(null)
        setStatus("error")
        if (error instanceof ApiError) {
          setErrorText(
            error.status === 404
              ? "Deck not found or you do not have access."
              : "Could not load this deck."
          )
        } else {
          setErrorText("Could not reach the server.")
        }
        return null
      }
    },
    [deckId, token]
  )

  useEffect(() => {
    void loadDeck()
  }, [loadDeck])

  return { deck, setDeck, status, errorText, setErrorText, loadDeck }
}
