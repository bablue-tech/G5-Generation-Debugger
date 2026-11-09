/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to the diagnostics service URL (for example http://localhost:8000) to use live data instead of samples. */
  readonly VITE_DIAGNOSTICS_API_URL?: string;
}
