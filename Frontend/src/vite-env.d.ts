/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_PLAY_RELAY_ONLY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
