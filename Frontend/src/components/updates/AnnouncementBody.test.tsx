import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AnnouncementBody } from "@/components/updates/AnnouncementBody"

describe("AnnouncementBody", () => {
  it("renders underscore hybrid tags as icons, not HTML", () => {
    render(<AnnouncementBody markdown="Pay [LIF_POW] to heal." />)
    expect(screen.getByTitle("LIF/POW")).toBeInTheDocument()
    expect(screen.queryByText("[LIF_POW]")).not.toBeInTheDocument()
  })

  it("does not render raw script tags", () => {
    render(
      <AnnouncementBody markdown={'Hello <script>alert("x")</script> world'} />
    )
    expect(document.querySelector("script")).toBeNull()
    expect(document.body.innerHTML).not.toMatch(/<script/i)
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
    expect(screen.getByText(/world/)).toBeInTheDocument()
  })
})
