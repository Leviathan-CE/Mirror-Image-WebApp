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

  it("runs onSelect from a coarse pointerup so a phone tap is not only an outside close", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <DropdownMenu
        label="Options"
        items={[{ id: "back", label: "Back to deck", onSelect }]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Options" }))
    const item = screen.getByRole("menuitem", { name: "Back to deck" })
    item.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerType: "touch",
      })
    )

    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledOnce())
  })

  it("runs onSelect only once for a full touch tap gesture (pointerdown + pointerup + compat click)", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <DropdownMenu
        label="Options"
        items={[{ id: "back", label: "Back to deck", onSelect }]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Options" }))
    const item = screen.getByRole("menuitem", { name: "Back to deck" })

    // Mirrors what a real touchscreen browser dispatches for a single tap:
    // pointerdown, pointerup, and then a synthesized "compatibility" click —
    // unless pointerdown's default is prevented, the browser still fires
    // that trailing click after the pointerup handler already ran onSelect.
    item.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerType: "touch",
      })
    )
    item.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerType: "touch",
      })
    )
    item.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )

    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledOnce())
  })

  it("keeps the menu open while typing in a textInput item, submits on Enter", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onChange = vi.fn()

    render(
      <DropdownMenu
        label="Options"
        items={[
          {
            id: "join",
            label: "Join room",
            onSelect,
            textInput: {
              value: "",
              onChange,
              ariaLabel: "Room code",
              uppercase: true,
            },
          },
        ]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Options" }))
    const field = screen.getByLabelText("Room code")

    await user.type(field, "a")
    expect(onChange).toHaveBeenLastCalledWith("A")
    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()

    await user.keyboard("{Enter}")
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
