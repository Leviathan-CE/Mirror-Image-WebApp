/**
 * Site header links: full button row from `md` up, sandwich menu on phones.
 */

import { navButtonClassName } from "@/components/common/headerStyles"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu"

export type HeaderNavItem = {
  id: string
  label: string
  onSelect: () => void
}

type HeaderNavProps = {
  items: HeaderNavItem[]
}

export function HeaderNav({ items }: HeaderNavProps) {
  if (items.length === 0) return null

  const menuItems: DropdownMenuItem[] = items.map((item) => ({
    id: item.id,
    label: item.label,
    onSelect: item.onSelect,
  }))

  return (
    <>
      <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-1 md:flex">
        {items.map((item) => (
          <Button
            key={item.id}
            className={navButtonClassName}
            onClick={item.onSelect}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="shrink-0 md:hidden">
        <DropdownMenu
          label="Site menu"
          trigger="☰"
          items={menuItems}
          triggerClassName="h-8 w-9 border border-cyan-500/40 bg-cyan-700/80 text-sm text-cyan-50 hover:bg-cyan-900"
          menuClassName="z-[80] min-w-[12rem]"
        />
      </div>
    </>
  )
}
