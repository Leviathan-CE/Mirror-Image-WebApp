import { BrowserRouter, Route, Routes } from "react-router-dom"

import { RequireAuth } from "@/app/RequireAuth"
import { AppProviders } from "@/app/providers/AppProviders"
import { AppHeader } from "@/components/common/AppHeader"
import { HomePage, HowToPlayPage, MainPage } from "@/pages"
import { LoginPage } from "@/pages/auth/LoginPage"
import { CardLibraryPage } from "@/pages/cards/CardLibraryPage"
import { DeckPage } from "@/pages/decks/DeckPage"
import { LorePage } from "@/pages/lore/LorePage"
import { ROUTES } from "@/lib/route"

export function AppShell() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppHeader />
        <main className="min-h-screen">
          <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route
              path={ROUTES.MAIN}
              element={
                <RequireAuth>
                  <MainPage />
                </RequireAuth>
              }
            />
            <Route path={ROUTES.CARDS} element={<CardLibraryPage />} />
            <Route path={ROUTES.DECK_PATTERN} element={<DeckPage />} />
            <Route path={ROUTES.HOW_TO_PLAY} element={<HowToPlayPage />} />
            <Route path={ROUTES.LORE} element={<LorePage />} />
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AppProviders>
  )
}
