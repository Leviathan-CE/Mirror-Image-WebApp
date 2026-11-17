/**
 * Field-level card change rows from a notification payload snapshot.
 */

export type CardSnapshot = Record<string, unknown>

export type CardDiffRow = {
  key: string
  label: string
  before: string
  after: string
  changed: boolean
}

const FIELD_ORDER = [
  "card_name",
  "rarity",
  "card_set_name",
  "types_line",
  "super_types",
  "sub_types",
  "invoke_cost",
  "cost",
  "threat_level",
  "has_tlv",
  "description",
  "keywords",
  "lagality",
  "is_pilot",
  "is_augment",
  "hand_size",
  "ram_capacity",
  "power_capacity",
  "metal_capacity",
  "spirit_capacity",
  "steel_capacity",
  "time_capacity",
  "lif_capacity",
] as const

const FIELD_LABELS: Record<string, string> = {
  card_name: "Name",
  rarity: "Rarity",
  card_set_name: "Set",
  types_line: "Types",
  super_types: "Super type",
  sub_types: "Sub type",
  invoke_cost: "Invoke cost",
  cost: "Cost",
  threat_level: "Threat level",
  has_tlv: "Has TLV",
  description: "Rules text",
  keywords: "Keywords",
  lagality: "Lagality",
  is_pilot: "Pilot",
  is_augment: "Augment",
  hand_size: "Hand size",
  ram_capacity: "RAM",
  power_capacity: "Power",
  metal_capacity: "Metal",
  spirit_capacity: "Spirit",
  steel_capacity: "Steel",
  time_capacity: "Time",
  lif_capacity: "Life",
}

function formatValue(value: unknown): string {
  if (value == null) return "—"
  if (typeof value === "boolean") return value ? "yes" : "no"
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    return value.map((item) => String(item)).join(", ")
  }
  const text = String(value)
  if (text.trim() === "") return "—"
  return text
}

export function asCardSnapshot(raw: unknown): CardSnapshot | null {
  if (raw == null) return null
  if (typeof raw !== "object") return null
  return raw as CardSnapshot
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function cardDiffRows(
  before: CardSnapshot | null,
  after: CardSnapshot | null
): CardDiffRow[] {
  if (before == null && after == null) return []
  const rows: CardDiffRow[] = []
  for (const key of FIELD_ORDER) {
    const left = before ? before[key] : undefined
    const right = after ? after[key] : undefined
    const beforeText = formatValue(left)
    const afterText = formatValue(right)
    const changed = !valuesEqual(left, right)
    if (!changed && before != null && after != null) continue
    rows.push({
      key,
      label: FIELD_LABELS[key] ?? key,
      before: beforeText,
      after: afterText,
      changed,
    })
  }
  return rows
}
