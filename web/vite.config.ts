import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Everything is bundled locally (fonts, chart code). No runtime CDN, so the
// built app runs on the station server with no internet (requirement M9).
// /api goes to the FastAPI backend (role B) on :8000 when VITE_API_MODE=http.
const proxy = {
  "/api": {
    target: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.API_TARGET ?? "http://localhost:8000",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy },
  preview: { port: 4173, host: true, proxy },
});
