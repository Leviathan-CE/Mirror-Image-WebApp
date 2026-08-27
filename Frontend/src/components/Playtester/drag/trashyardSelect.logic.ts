/**
 * Trashyard / dismantled fan selection helpers.
 *
 * Groups collapse copies of the same printing (×N). Ctrl/Cmd+click cycles how
 * many copies of that group are selected (0 → 1 → … → N → 0) without clearing
 * other groups. A plain click replaces the selection with one copy.
 */

export type TrashSelectGroup = {
  cardId: number
  /** Oldest → newest (top of pile is last). */
  instances: { instanceId: string }[]
}

/** How many of this group's instances are currently selected. */
export function selectedCountInGroup(
  group: TrashSelectGroup,
  selectedIds: readonly string[]
): number {
  const selected = new Set(selectedIds)
  return group.instances.filter((c) => selected.has(c.instanceId)).length
}

/**
 * Ctrl+click on a ×N tile: bump selected count for this group, wrap at N+1 → 0.
 * Other groups keep their selection. Always takes the newest copies first
 * (top of the pile), matching drag-from-group behaviour.
 */
export function cycleGroupSelection(
  group: TrashSelectGroup,
  selectedIds: readonly string[]
): string[] {
  const groupIds = new Set(group.instances.map((c) => c.instanceId))
  const kept = selectedIds.filter((id) => !groupIds.has(id))
  const n = group.instances.length
  if (n === 0) return kept
  const current = selectedCountInGroup(group, selectedIds)
  const nextCount = (current + 1) % (n + 1)
  if (nextCount === 0) return kept
  // Newest first: last `nextCount` instances in the group array.
  const take = group.instances.slice(n - nextCount).map((c) => c.instanceId)
  return [...kept, ...take]
}

/** Plain click: exactly one copy of this group (the topmost), clearing others. */
export function selectSingleFromGroup(group: TrashSelectGroup): string[] {
  const top = group.instances[group.instances.length - 1]
  return top ? [top.instanceId] : []
}

/**
 * Ids to move when the user drags `dragId`.
 * If `dragId` is in the selection, move the whole selection; otherwise just that card.
 * Caps at one when the selection is empty / drag isn't part of it (drag-box = one).
 */
export function trashDragGroupIds(
  dragId: string,
  selectedIds: readonly string[]
): string[] {
  if (selectedIds.includes(dragId) && selectedIds.length > 0) {
    return [...selectedIds]
  }
  return [dragId]
}
