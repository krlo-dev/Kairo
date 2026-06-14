/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_URL: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_PLAUSIBLE_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
