import { BrowserRouter, Route, Routes } from "react-router-dom"

import { AppProviders } from "@/app/providers/AppProviders"
import { BaseHeader } from "@/components/common/BaseHeader"
import { HomePage } from "@/pages"

export function AppShell() {
  return (
    <AppProviders>
      <BrowserRouter>
        <BaseHeader />
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AppProviders>
  )
}
