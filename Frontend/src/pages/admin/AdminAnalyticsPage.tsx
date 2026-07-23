/**
 * Admin home — high-level usage analytics placeholders.
 * Wire real metrics when backend admin analytics endpoints exist.
 */

import { AdminPageShell } from "@/pages/admin/AdminPageShell"

const PLACEHOLDER_METRICS = [
  { label: "ACTIVE SESSIONS (24H)", value: "—" },
  { label: "NEW ACCOUNTS (7D)", value: "—" },
  { label: "DECKS CREATED (7D)", value: "—" },
  { label: "PUBLIC DECKS", value: "—" },
  { label: "CARD LIBRARY SIZE", value: "—" },
  { label: "API ERRORS (24H)", value: "—" },
] as const

export function AdminAnalyticsPage() {
  return (
    <AdminPageShell
      title="ANALYTICS"
      description="App usage overview. Metrics will populate once admin analytics APIs are connected."
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_METRICS.map((metric) => (
          <li
            key={metric.label}
            className="border border-cyan-500/25 bg-black/50 p-5"
          >
            <p className="font-buahs93 text-[10px] tracking-wide text-cyan-400/70">
              {metric.label}
            </p>
            <p className="font-glitch mt-3 text-3xl text-cyan-100">
              {metric.value}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-8 font-mono text-xs text-white/40">
        Placeholder panel — no live data yet.
      </p>
    </AdminPageShell>
  )
}
