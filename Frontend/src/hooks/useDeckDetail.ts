import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"

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

/**
 * Deck detail loader. `room` is a playtest room code — passing it pools card
 * visibility across the two seated players, so a refetch is triggered when the
 * room changes.
 */
export function useDeckDetail(
  deckId: number,
  token?: string | null,
  room?: string | null
): UseDeckDetailResult {
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [status, setStatus] = useState<DeckLoadStatus>("loading")
  const [errorText, setErrorText] = useState("")
  /** Deck id currently held in state — used to tell a reload from a new deck. */
  const loadedIdRef = useRef<number | null>(null)

  const loadDeck = useCallback(
    async (opts?: { silent?: boolean }): Promise<DeckDetail | null> => {
      if (!Number.isFinite(deckId) || deckId <= 0) {
        loadedIdRef.current = null
        setStatus("loading")
        setErrorText("")
        setDeck(null)
        return null
      }

      if (!opts?.silent) setStatus("loading")
      try {
        const detail = await fetchDeckDetail(deckId, token, room)
        loadedIdRef.current = deckId
        setDeck(detail)
        setStatus("ready")
        return detail
      } catch (error) {
        loadedIdRef.current = null
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
    [deckId, token, room]
  )

  useEffect(() => {
    // Re-resolving the same deck (room pooling turning on, a new token) must
    // not flash "loading": the playtester clears the table whenever its deck
    // stops being ready, which would blank a dealt board mid-session.
    void loadDeck({ silent: loadedIdRef.current === deckId })
  }, [deckId, loadDeck])

  return { deck, setDeck, status, errorText, setErrorText, loadDeck }
}
