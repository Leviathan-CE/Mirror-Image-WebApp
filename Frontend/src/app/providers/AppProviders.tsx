import type { PropsWithChildren } from "react"

import { AuthProvider } from "@/app/providers/AuthProvider"
import { PreferencesProvider } from "@/app/providers/PreferencesProvider"

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </AuthProvider>
  )
}
