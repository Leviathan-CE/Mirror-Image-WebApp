/**
 * Shared card name search input — used by library, deck builder, and admin.
 * Parents own the value + debounce / fetch logic.
 */

import type { ComponentProps } from "react"

import { EditBox } from "@/components/ui/EditBox"
import { cn } from "@/lib/utils"

type EditBoxProps = ComponentProps<typeof EditBox>

type CardSearchBarProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  size?: EditBoxProps["size"]
  autoComplete?: string
  id?: string
  onFocus?: EditBoxProps["onFocus"]
  onKeyDown?: EditBoxProps["onKeyDown"]
  role?: EditBoxProps["role"]
  "aria-expanded"?: EditBoxProps["aria-expanded"]
  "aria-controls"?: EditBoxProps["aria-controls"]
  "aria-autocomplete"?: EditBoxProps["aria-autocomplete"]
}

export function CardSearchBar({
  value,
  onChange,
  label = "SEARCH",
  placeholder = "Search cards…",
  disabled = false,
  className,
  inputClassName,
  size = "sm",
  autoComplete = "off",
  id,
  onFocus,
  onKeyDown,
  role,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-autocomplete": ariaAutocomplete,
}: CardSearchBarProps) {
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <label
          htmlFor={id}
          className="mb-1 block font-buahs93 text-xs text-cyan-200/70"
        >
          {label}
        </label>
      ) : null}
      <EditBox
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        size={size}
        disabled={disabled}
        autoComplete={autoComplete}
        role={role}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-autocomplete={ariaAutocomplete}
        className={inputClassName}
      />
    </div>
  )
}
