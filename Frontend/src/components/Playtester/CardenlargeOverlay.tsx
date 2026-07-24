import "@/components/decks/DeckCardStack.css"

export type CardEnlargeOverlayProps = {
    open: boolean
    name: string
    artSrc: string | null
    caption?: string
}

export function CardEnlargeOverlay({
    open,
    name,
    artSrc,
    //caption
}: CardEnlargeOverlayProps) {
    if (!open) return null
    return (
        <div className="deck-card-enlarge"
            role="dialog"
            aria-label={name}
        >
            {artSrc ? (
                <img
                    src={artSrc}
                    className="deck-card-enlarge__art
                               clip-angled"
                    draggable={false} alt="" />
            ) : (
                <div className="deck-card-enlarge__fallback
                                clip-angled">
                    {name}
                </div>
            )}
        </div>
    )
}