import type { PropsWithChildren } from "react"

import { AuthProvider } from "@/app/providers/AuthProvider"
import { CardBackProvider } from "@/app/providers/CardBackProvider"
import { PreferencesProvider } from "@/app/providers/PreferencesProvider"

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <CardBackProvider>
        <PreferencesProvider>{children}</PreferencesProvider>
      </CardBackProvider>
    </AuthProvider>
  )
}
