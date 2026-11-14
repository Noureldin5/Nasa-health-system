/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" (default) runs on in-browser mock data. "http" calls the FastAPI backend. */
  readonly VITE_API_MODE?: "mock" | "http";
  /** Base URL of the API when VITE_API_MODE=http, for example http://localhost:8000 */
  readonly VITE_API_URL?: string;
}
