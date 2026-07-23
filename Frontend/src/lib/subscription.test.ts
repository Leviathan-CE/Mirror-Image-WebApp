import { describe, expect, it } from "vitest"

import {
  formatSubscriptionDate,
  isUserSubscribed,
  subscriptionPeriodLabel,
} from "./subscription"

describe("isUserSubscribed", () => {
  it("uses is_subscribed when present", () => {
    expect(
      isUserSubscribed({
        id: 1,
        user_name: "a",
        email: "a@x",
        role: "user",
        is_subscribed: true,
        subscription_status: "none",
      })
    ).toBe(true)
  })

  it("treats admins as entitled", () => {
    expect(
      isUserSubscribed({
        id: 1,
        user_name: "a",
        email: "a@x",
        role: "admin",
        subscription_status: "none",
      })
    ).toBe(true)
  })

  it("entitles active and trialing users", () => {
    expect(
      isUserSubscribed({
        id: 1,
        user_name: "a",
        email: "a@x",
        role: "user",
        subscription_status: "active",
      })
    ).toBe(true)
    expect(
      isUserSubscribed({
        id: 1,
        user_name: "a",
        email: "a@x",
        role: "user",
        subscription_status: "trialing",
      })
    ).toBe(true)
  })

  it("rejects canceled / none", () => {
    expect(
      isUserSubscribed({
        id: 1,
        user_name: "a",
        email: "a@x",
        role: "user",
        subscription_status: "canceled",
      })
    ).toBe(false)
    expect(isUserSubscribed(null)).toBe(false)
  })
})

describe("subscriptionPeriodLabel", () => {
  it("shows next billing period while renewing", () => {
    expect(
      subscriptionPeriodLabel({
        subscription_status: "active",
        cancel_at_period_end: false,
      })
    ).toBe("Next billing period")
    expect(
      subscriptionPeriodLabel({
        subscription_status: "trialing",
        cancel_at_period_end: false,
      })
    ).toBe("Next billing period")
  })

  it("shows period end when cancel is scheduled (status still active)", () => {
    expect(
      subscriptionPeriodLabel({
        subscription_status: "active",
        cancel_at_period_end: true,
      })
    ).toBe("Period end")
  })

  it("shows period end when canceled", () => {
    expect(
      subscriptionPeriodLabel({
        subscription_status: "canceled",
        cancel_at_period_end: false,
      })
    ).toBe("Period end")
  })
})

describe("formatSubscriptionDate", () => {
  it("formats without a clock time", () => {
    const text = formatSubscriptionDate("2026-08-23T22:04:43+00:00")
    expect(text).not.toMatch(/\d{1,2}:\d{2}/)
    expect(text).toMatch(/2026/)
    expect(text).toMatch(/23|Aug/i)
  })
})
