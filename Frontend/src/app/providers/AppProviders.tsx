import type { PropsWithChildren } from "react"

import { AuthProvider } from "@/app/providers/AuthProvider"
import { CardBackProvider } from "@/app/providers/CardBackProvider"
import { ComingSoonProvider } from "@/app/providers/ComingSoonProvider"
import { InboxProvider } from "@/app/providers/InboxProvider"
import { PreferencesProvider } from "@/app/providers/PreferencesProvider"

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <ComingSoonProvider>
        <CardBackProvider>
          <InboxProvider>
            <PreferencesProvider>{children}</PreferencesProvider>
          </InboxProvider>
        </CardBackProvider>
      </ComingSoonProvider>
    </AuthProvider>
  )
}
