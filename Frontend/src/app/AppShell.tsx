import { BrowserRouter, Route, Routes } from "react-router-dom"

import { AppProviders } from "@/app/providers/AppProviders"
import { AppHeader } from "@/components/common/AppHeader"
import { HomePage, HowToPlayPage, MainPage } from "@/pages"
import { LorePage } from "@/pages/lore/LorePage"
import { LoginPage } from "@/pages/auth/LoginPage"


export function AppShell() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppHeader />
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/main" element={<MainPage />} />
            <Route path="/how-to-play" element={<HowToPlayPage />} />
            <Route path="/lore" element={<LorePage/>}/>
            <Route path="/login" element={<LoginPage/>}/>
          </Routes>
        </main>
      </BrowserRouter>
    </AppProviders>
  )
}
