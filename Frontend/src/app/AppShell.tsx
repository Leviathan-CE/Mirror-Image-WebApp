import { BrowserRouter, Route, Routes } from "react-router-dom"

import { RequireAdmin } from "@/app/RequireAdmin"
import { RequireAuth } from "@/app/RequireAuth"
import { AppProviders } from "@/app/providers/AppProviders"
import { AppHeader } from "@/components/common/AppHeader"
import { HomePage, HowToPlayPage, MainPage } from "@/pages"
import { LoginPage } from "@/pages/auth/LoginPage"
import { CreateAccountPage } from "@/pages/auth/CreateAccountPage"
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage"
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage"
import { AcceptInvitePage } from "@/pages/auth/AcceptInvitePage"
import { CardLibraryPage } from "@/pages/cards/CardLibraryPage"
import { DeckPage } from "@/pages/decks/DeckPage"
import { LorePage } from "@/pages/lore/LorePage"
import { AdminAnalyticsPage } from "@/pages/admin/AdminAnalyticsPage"
import { AdminCardsPage } from "@/pages/admin/AdminCardsPage"
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage"
import { SubscribePage } from "@/pages/billing/SubscribePage"
import { ComunityDecksPage } from "@/pages/decks/ComunityDecksPage"
import { ROUTES } from "@/lib/route"
import { PlayTesterPage } from "@/pages/decks/PlayTesterPage"

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
            <Route path={ROUTES.REGISTER} element={<CreateAccountPage />} />
            <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmailPage />} />
            <Route
              path={ROUTES.FORGOT_PASSWORD}
              element={<ForgotPasswordPage />}
            />
            <Route
              path={ROUTES.RESET_PASSWORD}
              element={<ResetPasswordPage />}
            />
            <Route
              path={ROUTES.ACCEPT_INVITE}
              element={<AcceptInvitePage />}
            />
            <Route path={ROUTES.DECK_COMUNITY} element={<ComunityDecksPage />} />
            <Route path={ROUTES.PLAY_TESTER} element={<PlayTesterPage/>}/>
            <Route path={ROUTES.PLAY_TESTER_PATTERN} element={<PlayTesterPage />} />
            <Route path={ROUTES.PLAY_TESTER_VS_PATTERN} element={<PlayTesterPage />} />
            <Route
              path={ROUTES.SUBSCRIBE}
              element={
                <RequireAuth>
                  <SubscribePage />
                </RequireAuth>
              }
            />

            <Route
              path={ROUTES.ADMIN}
              element={
                <RequireAdmin>
                  <AdminAnalyticsPage />
                </RequireAdmin>
              }
            />
            <Route
              path={ROUTES.ADMIN_CARDS}
              element={
                <RequireAdmin>
                  <AdminCardsPage />
                </RequireAdmin>
              }
            />
            <Route
              path={ROUTES.ADMIN_USERS}
              element={
                <RequireAdmin>
                  <AdminUsersPage />
                </RequireAdmin>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </AppProviders>
  )
}
