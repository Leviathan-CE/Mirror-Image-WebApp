import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * `JSON.parse` that never throws. Returns `null` for empty input, invalid JSON,
 * or non-object/array roots when you only wanted a value (callers still validate shape).
 */
export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
