/** Viewport-aware placement for context menus and their flyout submenus. */

export const CONTEXT_MENU_VIEWPORT_PAD = 8
export const CONTEXT_MENU_SUBMENU_GAP = 4

export type RectBox = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

/**
 * Clamp a menu's top-left so its box stays inside the viewport (with padding).
 * If the menu is taller/wider than the viewport, pin to the padded origin.
 */
export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  pad: number = CONTEXT_MENU_VIEWPORT_PAD
): { left: number; top: number } {
  const maxLeft = viewportWidth - width - pad
  const maxTop = viewportHeight - height - pad
  return {
    left: Math.max(pad, Math.min(x, maxLeft)),
    top: Math.max(pad, Math.min(y, maxTop)),
  }
}

export type SubmenuFixedPlacement = {
  /** Open to the right of the parent row, or flip to the left. */
  side: "left" | "right"
  /** Viewport coordinates for `position: fixed`. */
  left: number
  top: number
}

/**
 * Prefer opening a submenu to the right of its parent row; flip left when it
 * would clip. Returns fixed viewport coords so the flyout can portal outside
 * any overflow clipping on the root menu.
 */
export function planSubmenuFixedPosition(
  parent: Pick<RectBox, "left" | "right" | "top">,
  submenu: Pick<RectBox, "width" | "height">,
  viewportWidth: number,
  viewportHeight: number,
  pad: number = CONTEXT_MENU_VIEWPORT_PAD,
  gap: number = CONTEXT_MENU_SUBMENU_GAP
): SubmenuFixedPlacement {
  const fitsRight = parent.right + gap + submenu.width <= viewportWidth - pad
  const fitsLeft = parent.left - gap - submenu.width >= pad
  const spaceRight = viewportWidth - pad - parent.right
  const spaceLeft = parent.left - pad
  const side: "left" | "right" = fitsRight
    ? "right"
    : fitsLeft
      ? "left"
      : spaceRight >= spaceLeft
        ? "right"
        : "left"

  const left =
    side === "right"
      ? parent.right + gap
      : parent.left - gap - submenu.width

  let top = parent.top
  if (top + submenu.height > viewportHeight - pad) {
    top = viewportHeight - pad - submenu.height
  }
  if (top < pad) top = pad

  return { side, left, top }
}
