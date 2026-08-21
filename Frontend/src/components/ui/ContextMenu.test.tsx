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

  it("keeps the count field editable while its row is disabled", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    // A cleared field makes the action invalid, so the row disables itself.
    // The field must stay live or there is no way to type a valid count.
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
            disabled: true,
            onSelect: vi.fn(),
            countInput: {
              value: "",
              onChange,
              ariaLabel: "Degrade count",
              disabled: false,
            },
          },
        ]}
      />
    )

    const field = screen.getByLabelText("Degrade count")
    expect(field).toBeEnabled()
    await user.type(field, "3")
    expect(onChange).toHaveBeenCalledWith("3")
  })

  it("locks the count field when the field itself is disabled", () => {
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
            onSelect: vi.fn(),
            countInput: {
              value: "2",
              onChange: vi.fn(),
              ariaLabel: "Degrade count",
              disabled: true,
            },
          },
        ]}
      />
    )

    expect(screen.getByLabelText("Degrade count")).toBeDisabled()
  })
})
