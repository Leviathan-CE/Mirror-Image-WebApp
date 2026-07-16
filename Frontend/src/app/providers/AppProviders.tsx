import type { PropsWithChildren } from "react"

import { AuthProvider } from "@/app/providers/AuthProvider"

export function AppProviders({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>
}
