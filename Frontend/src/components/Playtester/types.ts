/** Playtester session types (zones + one physical card copy). */

export type PlayZone =
  | "RIG"
  | "hand"
  | "battlefield"
  | "stockpile"
  | "trashyard"
  | "dismantled"

export type PlayingCardInstance = {
  /** Unique even when the deck has multiple copies of the same card. */
  instanceId: string
  cardId: number
  name: string
  artPath: string | null
  artVersion?: number | null
  zone: PlayZone
  x?: number
  y?: number
  /** Mirror Image “tapped” / used this turn. */
  expended: boolean
  selected?: boolean
}

/** Expand one deck list row into a single play instance (first copy). */
export function deckEntryToPlayInstance(
  entry: {
    card_id: number
    card_name: string
    card_art_path: string | null
    card_art_version?: number | null
  },
  zone: PlayZone = "hand"
): PlayingCardInstance {
  return {
    instanceId: `preview-${entry.card_id}`,
    cardId: entry.card_id,
    name: entry.card_name,
    artPath: entry.card_art_path,
    artVersion: entry.card_art_version ?? null,
    zone,
    expended: false,
  }
}

/**
 *  moves current selected card instance to the front of the 
 * list making it display ontop of everything else
 * @param cards 
 * @param instanceId 
 * @returns list of cards instances
 */
export function moveCardtoFront(
  cards: PlayingCardInstance[],
  instanceId: string 
): PlayingCardInstance[] {
  const i = cards.findIndex((c) => c.instanceId ===instanceId)
  if (i < 0) return cards
  const next = [...cards]
  const [card] = next.splice(i, 1)
  next.push(card)
  return next

}
/**
 * move curretn selest insantce of card to the back
 * of the this making it dsiplay below all other cards
 * @param cards 
 * @param instanceId  
 * @returns list of cards instances 
*/
export function moveCardtoBack(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {

  const i = cards.findIndex((c) => c.instanceId === instanceId)
  if (i < 0) return cards
  const next = [...cards]
  const [card] = next.splice(i,1)
  next.unshift(card)
  return next
}
