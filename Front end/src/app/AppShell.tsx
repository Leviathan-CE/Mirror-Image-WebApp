import { AppProviders } from "@/app/providers/AppProviders"
import { HomePage } from "@/pages"

export function AppShell() {
  return (
    <AppProviders>
      <main className="min-h-screen bg-muted/30">
        <HomePage />
      </main>
    </AppProviders>
  )
}
