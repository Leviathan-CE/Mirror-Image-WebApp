/**
 * Field list for a card.created / updated / removed inbox payload.
 */

import {
  asCardSnapshot,
  cardDiffRows,
} from "@/lib/inboxCardDiff.logic"

type CardChangeDiffProps = {
  payload: Record<string, unknown>
}

export function CardChangeDiff({ payload }: CardChangeDiffProps) {
  const before = asCardSnapshot(payload.before)
  const after = asCardSnapshot(payload.after)
  const rows = cardDiffRows(before, after)
  if (rows.length === 0) {
    return (
      <p className="font-mono text-xs text-white/45">
        No field-level changes were stored for this card.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-cyan-500/25 font-buahs93 text-[11px] tracking-wide text-cyan-300/80">
            <th className="px-2 py-2">FIELD</th>
            <th className="px-2 py-2">BEFORE</th>
            <th className="px-2 py-2">AFTER</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={
                row.changed
                  ? "border-b border-cyan-500/10 bg-cyan-500/10"
                  : "border-b border-cyan-500/10"
              }
            >
              <td className="px-2 py-2 font-mono text-[11px] text-cyan-200/80">
                {row.label}
              </td>
              <td className="px-2 py-2 font-mono text-[11px] text-white/55">
                {row.before}
              </td>
              <td className="px-2 py-2 font-mono text-[11px] text-white/85">
                {row.after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
