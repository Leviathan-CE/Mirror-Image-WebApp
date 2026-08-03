import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ContextMenu } from "./ContextMenu"

describe("ContextMenu", () => {
  it("renders at open and calls onSelect then onClose", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <ContextMenu
        open
        x={40}
        y={60}
        onClose={onClose}
        items={[{ id: "front", label: "Bring to front", onSelect }]}
      />
    )

    expect(screen.getByRole("menu")).toBeInTheDocument()
    await user.click(screen.getByRole("menuitem", { name: "Bring to front" }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <ContextMenu
        open
        x={10}
        y={10}
        onClose={onClose}
        items={[{ id: "a", label: "Action", onSelect: vi.fn() }]}
      />
    )

    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("renders nothing when closed", () => {
    render(
      <ContextMenu
        open={false}
        x={0}
        y={0}
        onClose={vi.fn()}
        items={[{ id: "a", label: "Action", onSelect: vi.fn() }]}
      />
    )
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("shows count input beside action and uses it on select", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onChange = vi.fn()

    render(
      <ContextMenu
        open
        x={20}
        y={20}
        onClose={vi.fn()}
        items={[
          {
            id: "degrade",
            label: "Degrade",
            onSelect,
            countInput: {
              value: "2",
              onChange,
              ariaLabel: "Degrade count",
            },
          },
        ]}
      />
    )

    expect(screen.getByLabelText("Degrade count")).toHaveValue(2)
    await user.clear(screen.getByLabelText("Degrade count"))
    await user.type(screen.getByLabelText("Degrade count"), "4")
    expect(onChange).toHaveBeenCalled()
    await user.click(screen.getByRole("menuitem", { name: "Degrade" }))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
