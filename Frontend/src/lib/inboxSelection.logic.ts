/**
 * Inbox multi-select. Shift selects a range. Ctrl toggles one row.
 */

export type SelectionClick = {
  orderedIds: number[]
  selectedIds: number[]
  anchorId: number | null
  targetId: number
  shift: boolean
  ctrl: boolean
}

export type SelectionResult = {
  selectedIds: number[]
  anchorId: number
}

function rangeIds(
  orderedIds: number[],
  anchorId: number,
  targetId: number
): number[] | null {
  const start = orderedIds.indexOf(anchorId)
  const end = orderedIds.indexOf(targetId)
  if (start < 0) return null
  if (end < 0) return null
  const low = Math.min(start, end)
  const high = Math.max(start, end)
  return orderedIds.slice(low, high + 1)
}

export function selectionAfterClick(
  click: SelectionClick
): SelectionResult {
  const targetId = click.targetId
  if (!click.shift) {
    const already = click.selectedIds.includes(targetId)
    const selectedIds = already
      ? click.selectedIds.filter((id) => id !== targetId)
      : [...click.selectedIds, targetId]
    return { selectedIds, anchorId: targetId }
  }

  const anchorId = click.anchorId ?? targetId
  const range = rangeIds(click.orderedIds, anchorId, targetId)
  if (range == null) {
    return { selectedIds: [targetId], anchorId: targetId }
  }
  if (!click.ctrl) {
    return { selectedIds: range, anchorId }
  }

  const selectedIds = [...click.selectedIds]
  for (const id of range) {
    if (selectedIds.includes(id)) continue
    selectedIds.push(id)
  }
  return { selectedIds, anchorId }
}
