import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DropdownMenu } from "./DropdownMenu"

describe("DropdownMenu", () => {
  it("opens on trigger click and calls onSelect", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <DropdownMenu
        label="Options"
        items={[{ id: "edit", label: "Edit details", onSelect }]}
      />
    )

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Options" }))
    expect(screen.getByRole("menu")).toBeInTheDocument()

    await user.click(screen.getByRole("menuitem", { name: "Edit details" }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu
        label="Options"
        items={[{ id: "a", label: "Action", onSelect: vi.fn() }]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Options" }))
    expect(screen.getByRole("menu")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
})
