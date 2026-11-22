/**
 * Public terms of use for Mirror Image.
 */

import { Link } from "react-router-dom"

import { sharedImages } from "@/assets"
import { PRIVACY_CONTACT_EMAIL } from "@/lib/privacy"
import { ROUTES } from "@/lib/route"

export function TermsPage() {
  return (
    <section
      className={
        "relative min-h-screen bg-cover bg-center bg-no-repeat "
        + "px-4 py-12 sm:px-6 lg:px-8"
      }
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/75" aria-hidden />
      <article className="relative z-10 mx-auto w-full max-w-3xl pt-16 text-cyan-50">
        <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
          MIRROR IMAGE
        </p>
        <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
          TERMS
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cyan-100/80">
          Mirror Image is a fantasy-punk card game site. By creating an
          account or using the site you agree to these terms. The{" "}
          <Link
            to={ROUTES.PRIVACY}
            className="text-cyan-200 underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          {" "}describes personal information. Contact{" "}
          <a
            className="text-cyan-200 underline underline-offset-2"
            href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
          >
            {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </p>
        <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-relaxed text-cyan-100/80">
          <li>
            You need an account for decks, play, and paid plans. Keep your
            password to yourself. You are responsible for activity on your
            account.
          </li>
          <li>
            Do not break the site, scrape unreleased cards, or use another
            person’s account.
          </li>
          <li>
            Paid plans and one-time print downloads are charged by Stripe.
            Plan access follows the subscription status Stripe reports.
          </li>
          <li>
            Account email, such as verification and password reset, and
            optional mailing-list email are sent by Resend in the United
            States.
          </li>
          <li>
            You can delete your account in settings. That cancels an active
            subscription, removes decks you alone own, and removes the
            mailing-list email that matches the account.
          </li>
          <li>
            The game, card text, and site are provided as available. We may
            change cards, features, or these terms. Continued use after a
            change means you accept the update.
          </li>
        </ul>
      </article>
    </section>
  )
}
