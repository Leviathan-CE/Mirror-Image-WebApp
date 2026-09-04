/**
 * Admin-only usage overview: logged-in users, paid subscribers, host load,
 * and an activity chart (week / month / year).
 */

import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { ApiError } from "@/lib/api/client"
import {
  fetchAdminAnalytics,
  type AdminAnalytics,
  type AnalyticsActivityPoint,
  type AnalyticsRange,
} from "@/lib/api/analytics_admin"
import { cn } from "@/lib/utils"
import { AdminPageShell } from "@/pages/admin/AdminPageShell"

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "week", label: "WEEK" },
  { id: "month", label: "MONTH" },
  { id: "year", label: "YEAR" },
]

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value.toFixed(1)}%`
}

function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—"
  if (value < 1024) return `${Math.round(value)} B`
  const units = ["KB", "MB", "GB", "TB"]
  let n = value / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`
}

function formatBps(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—"
  return `${formatBytes(value)}/s`
}

function ActivityChart({
  points,
  metric,
}: {
  points: AnalyticsActivityPoint[]
  metric: "unique_users" | "requests"
}) {
  const values = points.map((p) => p[metric])
  const max = Math.max(1, ...values)
  const barW = points.length > 0 ? 100 / points.length : 100

  return (
    <div className="mt-4">
      <div
        className="flex h-40 items-end gap-px border border-cyan-500/20 bg-black/40 px-1 pb-1 pt-2"
        role="img"
        aria-label="Activity chart"
      >
        {points.map((point) => {
          const value = point[metric]
          const h = (value / max) * 100
          return (
            <div
              key={point.label}
              className="flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${point.label}: ${value}`}
              style={{ width: `${barW}%` }}
            >
              <div
                className="w-full max-w-6 bg-cyan-400/80"
                style={{ height: `${Math.max(value > 0 ? 4 : 1, h)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-cyan-100/40">
        <span>{points[0]?.label ?? ""}</span>
        <span>{points[points.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  )
}

export function AdminAnalyticsPage() {
  const { token } = useAuth()
  const [range, setRange] = useState<AnalyticsRange>("week")
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metric, setMetric] = useState<"unique_users" | "requests">(
    "unique_users"
  )

  const load = useCallback(async () => {
    if (!token) return
    try {
      const next = await fetchAdminAnalytics(token, range)
      setData(next)
      setError(null)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 403
            ? "Admin only."
            : err.detail
          : "Could not load analytics."
      )
    }
  }, [token, range])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 20_000)
    return () => window.clearInterval(id)
  }, [load])

  const kpis = [
    { label: "LOGGED IN NOW (15 MIN)", value: data ? String(data.logged_in) : "—" },
    { label: "LOGGED IN TODAY", value: data ? String(data.logged_in_today) : "—" },
    { label: "PAID USERS", value: data ? String(data.paid_users) : "—" },
    { label: "TOTAL ACCOUNTS", value: data ? String(data.total_users) : "—" },
    { label: "NEW ACCOUNTS (7D)", value: data ? String(data.new_accounts_7d) : "—" },
    { label: "PUBLIC DECKS", value: data ? String(data.public_decks) : "—" },
  ]

  const host = data?.host

  return (
    <AdminPageShell
      title="ANALYTICS"
      description="Admin-only usage snapshot. Logged-in counts use last API activity; paid users are Stripe active/trialing."
    >
      {error ? (
        <p className="mb-4 font-mono text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((metricCard) => (
          <li
            key={metricCard.label}
            className="border border-cyan-500/25 bg-black/50 p-5"
          >
            <p className="font-buahs93 text-[10px] tracking-wide text-cyan-400/70">
              {metricCard.label}
            </p>
            <p className="font-glitch mt-3 text-3xl text-cyan-100">
              {metricCard.value}
            </p>
          </li>
        ))}
      </ul>

      <section className="mt-8 border border-cyan-500/25 bg-black/50 p-5">
        <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
          API HOST (AVERAGES)
        </h2>
        <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
          Samples this API process sees (CPU / RAM / NIC). Averages cover the
          last ~hour of samples.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          <li>
            <p className="font-buahs93 text-[10px] text-cyan-400/70">CPU</p>
            <p className="font-glitch mt-1 text-xl text-cyan-100">
              {formatPct(host?.cpu_pct ?? null)}
            </p>
            <p className="font-mono text-[10px] text-cyan-100/45">
              avg {formatPct(host?.cpu_avg_pct ?? null)}
            </p>
          </li>
          <li>
            <p className="font-buahs93 text-[10px] text-cyan-400/70">MEMORY</p>
            <p className="font-glitch mt-1 text-xl text-cyan-100">
              {formatPct(host?.memory_pct ?? null)}
            </p>
            <p className="font-mono text-[10px] text-cyan-100/45">
              {formatBytes(host?.memory_used_bytes ?? null)} /{" "}
              {formatBytes(host?.memory_total_bytes ?? null)} · avg{" "}
              {formatPct(host?.memory_avg_pct ?? null)}
            </p>
          </li>
          <li>
            <p className="font-buahs93 text-[10px] text-cyan-400/70">NETWORK</p>
            <p className="font-glitch mt-1 text-xl text-cyan-100">
              ↓ {formatBps(host?.net_recv_bps ?? null)}
            </p>
            <p className="font-mono text-[10px] text-cyan-100/45">
              ↑ {formatBps(host?.net_sent_bps ?? null)} · avg ↓{" "}
              {formatBps(host?.net_recv_avg_bps ?? null)} ↑{" "}
              {formatBps(host?.net_sent_avg_bps ?? null)}
            </p>
          </li>
        </ul>
      </section>

      <section className="mt-8 border border-cyan-500/25 bg-black/50 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
              APP ACTIVITY
            </h2>
            <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
              {metric === "unique_users"
                ? "Daily logged-in users (year = sum of daily uniques per month)."
                : "HTTP requests counted by the API."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                "font-buahs93 border px-2 py-1 text-[10px]",
                metric === "unique_users"
                  ? "border-cyan-300 bg-cyan-500/20 text-cyan-50"
                  : "border-cyan-500/30 text-cyan-100/70"
              )}
              onClick={() => setMetric("unique_users")}
            >
              USERS
            </button>
            <button
              type="button"
              className={cn(
                "font-buahs93 border px-2 py-1 text-[10px]",
                metric === "requests"
                  ? "border-cyan-300 bg-cyan-500/20 text-cyan-50"
                  : "border-cyan-500/30 text-cyan-100/70"
              )}
              onClick={() => setMetric("requests")}
            >
              REQUESTS
            </button>
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "font-buahs93 border px-2 py-1 text-[10px]",
                  range === item.id
                    ? "border-cyan-300 bg-cyan-500/20 text-cyan-50"
                    : "border-cyan-500/30 text-cyan-100/70"
                )}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <ActivityChart points={data?.activity ?? []} metric={metric} />
      </section>
    </AdminPageShell>
  )
}
