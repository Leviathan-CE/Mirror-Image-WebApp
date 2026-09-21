import { describe, expect, it } from "vitest"

import { detailFromErrorBody } from "./client.logic"

describe("detailFromErrorBody", () => {
  it("keeps a string detail", () => {
    expect(detailFromErrorBody({ detail: "email_send_failed" }, "x")).toBe(
      "email_send_failed"
    )
  })

  it("reads FastAPI 422 list msg", () => {
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
        "admin_invite_user_failed"
      )
    ).toBe("String should have at least 3 characters")
  })

  it("falls back when detail is missing", () => {
    expect(detailFromErrorBody({}, "admin_invite_user_failed")).toBe(
      "admin_invite_user_failed"
    )
  })
})
