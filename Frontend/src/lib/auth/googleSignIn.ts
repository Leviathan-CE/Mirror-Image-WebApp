/**
 * Google Identity Services (GSI) loader — Sign in with Google ID tokens.
 *
 * Client id comes from `GET /auth/google/config` (API `GOOGLE_CLIENT_ID`),
 * so Docker does not need a Vite rebuild to enable the button.
 *
 * Docs: https://developers.google.com/identity/gsi/web
 */

export type GoogleCredentialResponse = {
  credential: string
  select_by?: string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black"
      size?: "large" | "medium" | "small"
      text?: "signin_with" | "continue_with" | "signup_with"
      width?: number
      shape?: "rectangular" | "pill" | "circle" | "square"
    }
  ) => void
  prompt: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client"

let loadPromise: Promise<void> | null = null

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no_window"))
  }
  if (window.google?.accounts?.id) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`
    )
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () =>
        reject(new Error("gsi_script_failed"))
      )
      if (window.google?.accounts?.id) resolve()
      return
    }

    const script = document.createElement("script")
    script.src = GSI_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("gsi_script_failed"))
    document.head.appendChild(script)
  })

  return loadPromise
}

export async function mountGoogleSignInButton(
  parent: HTMLElement,
  clientId: string,
  onCredential: (idToken: string) => void
): Promise<() => void> {
  const id = clientId.trim()
  if (!id) throw new Error("google_not_configured")

  await loadGoogleIdentityScript()
  const gsi = window.google?.accounts?.id
  if (!gsi) throw new Error("gsi_unavailable")

  gsi.initialize({
    client_id: id,
    callback: (response) => {
      if (response.credential) onCredential(response.credential)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  })

  parent.replaceChildren()
  gsi.renderButton(parent, {
    theme: "outline",
    size: "large",
    text: "continue_with",
    width: parent.clientWidth || 320,
    shape: "rectangular",
  })

  return () => {
    parent.replaceChildren()
  }
}
