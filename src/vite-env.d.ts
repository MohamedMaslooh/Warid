/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" to enable the Warid Cloud (paid, hosted) tier in this build.
   *  Unset/anything-else keeps the app BYOK-only (the public/MIT default). */
  readonly VITE_CLOUD_ENABLED?: string;
  /** Base URL of the Warid Cloud gateway, e.g. https://api.warid.app */
  readonly VITE_CLOUD_GATEWAY_URL?: string;
  /** Supabase project URL, e.g. https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key — safe to ship in the client. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
