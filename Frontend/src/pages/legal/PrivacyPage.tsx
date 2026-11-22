/**
 * Public privacy notice for Mirror Image.
 */

import { Link } from "react-router-dom"

import { sharedImages } from "@/assets"
import { PRIVACY_CONTACT_EMAIL } from "@/lib/privacy"
import { ROUTES } from "@/lib/route"

export function PrivacyPage() {
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
          PRIVACY POLICY
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cyan-100/80">
          Mirror Image is a commercial game site operated from British
          Columbia. This notice explains what we collect, why, and how to
          reach us. Questions and access requests go to{" "}
          <a
            className="text-cyan-200 underline underline-offset-2"
            href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
          >
            {PRIVACY_CONTACT_EMAIL}
          </a>
          . You can also complain to the Office of the Information and
          Privacy Commissioner for British Columbia.
        </p>

        <h2 className="mt-8 font-buahs93 text-sm text-cyan-200">
          WHAT WE COLLECT
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-cyan-100/80">
          <li>
            Account details: username, email, password hash, and whether
            the email is verified.
          </li>
          <li>
            Google sign-in: the provider subject and the email Google
            confirms. Google is a separate service.
          </li>
          <li>
            Decks you build, library and deck display preferences, and
            in-app notification choices.
          </li>
          <li>
            Optional blog email if you join the mailing list or turn on
            email updates.
          </li>
          <li>
            Billing status from Stripe (plan, status, period end). We do
            not store card numbers.
          </li>
          <li>
            A first-party session cookie named mi_session. It is httpOnly
            so page scripts cannot read the login token.
          </li>
        </ul>

        <h2 className="mt-8 font-buahs93 text-sm text-cyan-200">
          WHY
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-cyan-100/80">
          We use this information to create and secure your account, run
          play and deck tools, send optional updates, take payments, and
          answer support. Marketing email is off until you opt in. In-app
          update notices start on, and you can turn them off in settings.
        </p>

        <h2 className="mt-8 font-buahs93 text-sm text-cyan-200">
          PROCESSORS OUTSIDE CANADA
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-cyan-100/80">
          Stripe processes payments. Google handles Google sign-in. Resend,
          in the United States, sends account email and optional mailing-list
          email. That includes the recipient address and the message. The
          site and database may be hosted outside Canada, including the
          United States. Those providers handle the data needed for that job.
        </p>

        <h2 className="mt-8 font-buahs93 text-sm text-cyan-200">
          YOUR CHOICES
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-cyan-100/80">
          <li>
            Unsubscribe links delete that mailing-list email. They do not
            keep a leftover row.
          </li>
          <li>
            Deleting your account cancels Stripe, removes decks you own,
            removes the account, and deletes a mailing-list row that uses
            the same email.
          </li>
          <li>
            Account settings can download a JSON copy of the profile,
            preferences, linked sign-in providers, and subscription status.
          </li>
          <li>
            Email {PRIVACY_CONTACT_EMAIL} to access, correct, or ask about
            your information.
          </li>
        </ul>

        <h2 className="mt-8 font-buahs93 text-sm text-cyan-200">
          HOW LONG WE KEEP IT
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-cyan-100/80">
          Account data stays while the account is open. After delete, the
          account and matching mailing-list email are removed. Paid print
          unlocks expire and are then deleted. Admin activity charts keep
          counts, not the contents of your decks.
        </p>

        <p className="mt-8 text-sm text-cyan-100/70">
          See also the{" "}
          <Link
            to={ROUTES.TERMS}
            className="text-cyan-200 underline underline-offset-2"
          >
            Terms
          </Link>
          .
        </p>
      </article>
    </section>
  )
}
