/**
 * Wrapper for text that may appear on public surfaces (deck name, tags,
 * usernames, etc.).
 *
 * Pattern: validate as the user types, but still rely on the API —
 * this only improves UX; it is not security.
 */

import type { ComponentProps } from "react"

import { EditBox } from "@/components/ui/EditBox"
import {
  findProfanity,
  PUBLIC_TEXT_BLOCKED_MESSAGE,
} from "@/lib/profanity"
import { cn } from "@/lib/utils"

type EditBoxProps = ComponentProps<typeof EditBox>

type PublicTextFieldProps = Omit<EditBoxProps, "value" | "onChange"> & {
  value: string
  onChange: (value: string) => void
  /** Optional: hide the inline error (parent shows one message for the form). */
  showHint?: boolean
}

export function PublicTextField({
  value,
  onChange,
  showHint = true,
  className,
  ...rest
}: PublicTextFieldProps) {
  const blocked = findProfanity(value) != null

  return (
    <div className="flex w-full flex-col gap-1">
      <EditBox
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          blocked && "border-red-400/80 focus-visible:border-red-300",
          className
        )}
        aria-invalid={blocked || undefined}
      />
      {showHint && blocked ? (
        <p className="font-mono text-xs text-red-300/90" role="alert">
          {PUBLIC_TEXT_BLOCKED_MESSAGE}
        </p>
      ) : null}
    </div>
  )
}

type PublicTextAreaProps = {
  value: string
  onChange: (value: string) => void
  showHint?: boolean
  className?: string
  disabled?: boolean
  placeholder?: string
  rows?: number
}

export function PublicTextArea({
  value,
  onChange,
  showHint = true,
  className,
  disabled,
  placeholder,
  rows = 3,
}: PublicTextAreaProps) {
  const blocked = findProfanity(value) != null

  return (
    <div className="flex w-full flex-col gap-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={blocked || undefined}
        className={cn(
          "w-full border bg-black/80 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-white/40",
          blocked
            ? "border-red-400/80 focus-visible:border-red-300"
            : "border-white/40 focus-visible:border-white",
          className
        )}
      />
      {showHint && blocked ? (
        <p className="font-mono text-xs text-red-300/90" role="alert">
          {PUBLIC_TEXT_BLOCKED_MESSAGE}
        </p>
      ) : null}
    </div>
  )
}
