import { BrowserRouter, Route, Routes } from "react-router-dom"

import { AppProviders } from "@/app/providers/AppProviders"
import { BaseHeader } from "@/components/common/BaseHeader"
import { HomePage, HowToPlayPage } from "@/pages"
import { LorePage } from "@/pages/lore/LorePage"

export function AppShell() {
  return (
    <AppProviders>
      <BrowserRouter>
        <BaseHeader />
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/how-to-play" element={<HowToPlayPage />} />
            <Route path="/lore" element={<LorePage/>}/>
          </Routes>
        </main>
      </BrowserRouter>
    </AppProviders>
  )
}
