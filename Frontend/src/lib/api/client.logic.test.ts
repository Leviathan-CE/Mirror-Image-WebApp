import { describe, expect, it } from "vitest"

import { detailFromErrorBody } from "@/lib/api/client.logic"

describe("detailFromErrorBody", () => {
  it("keeps a string FastAPI detail", () => {
    expect(detailFromErrorBody({ detail: "invalid_or_expired_token" }, "x")).toBe(
      "invalid_or_expired_token"
    )
  })

  it("reads the first 422 field message", () => {
    expect(
      detailFromErrorBody(
        {
          detail: [
            {
              type: "string_too_short",
              loc: ["body", "user_name"],
              msg: "String should have at least 3 characters",
            },
          ],
        },
        "email_auth_failed"
      )
    ).toBe("String should have at least 3 characters")
  })

  it("falls back when detail is missing", () => {
    expect(detailFromErrorBody({}, "email_auth_failed")).toBe("email_auth_failed")
  })
})
