/**
 * Admin-only analytics API (`GET /admin/analytics`).
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

export type AnalyticsRange = "week" | "month" | "year"

export type AnalyticsActivityPoint = {
  label: string
  unique_users: number
  requests: number
  logins: number
}

export type AnalyticsHostMetrics = {
  cpu_pct: number | null
  cpu_avg_pct: number | null
  memory_pct: number | null
  memory_avg_pct: number | null
  memory_used_bytes: number | null
  memory_total_bytes: number | null
  net_recv_bps: number | null
  net_sent_bps: number | null
  net_recv_avg_bps: number | null
  net_sent_avg_bps: number | null
  sample_count: number
}

export type AdminAnalytics = {
  logged_in: number
  logged_in_today: number
  total_users: number
  paid_users: number
  new_accounts_7d: number
  public_decks: number
  host: AnalyticsHostMetrics
  activity_range: AnalyticsRange
  activity: AnalyticsActivityPoint[]
}

export async function fetchAdminAnalytics(
  token: string,
  range: AnalyticsRange = "week"
): Promise<AdminAnalytics> {
  const url = new URL(`${apiBaseUrl()}/admin/analytics`)
  url.searchParams.set("range", range)
  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<AdminAnalytics>(response, "admin_analytics_failed")
}
