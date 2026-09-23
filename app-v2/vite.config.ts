import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { PUBLIC_PAGE_PATHS } from "./src/public/routes.ts";
import { contentSecurityPolicy } from "../worker/csp.ts";

// Offline navigations resolve only for real pages; anything else reaches the
// network, where the Worker returns a proper 404.
const offlineNavigationRoutes = [
  /^\/app\/?$/,
  ...PUBLIC_PAGE_PATHS.map((path) =>
    path === "/" ? /^\/$/ : new RegExp(`^${path}\\/?$`)
  )
];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "push-sw.js"],
      manifest: {
        id: "/",
        name: "SettledSolo — dog separation training",
        short_name: "SettledSolo",
        description:
          "Free dog separation anxiety training tool for gradual, observable alone-time practice.",
        start_url: "/app/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#15242C",
        theme_color: "#F1E7D6",
        categories: ["lifestyle"],
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        importScripts: ["push-sw.js"],
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: offlineNavigationRoutes
      }
    })
  ],
  test: {
    environment: "node",
    include: ["app-v2/src/**/*.test.ts"]
  },
  preview: {
    // Serve the production bundle under the Worker's real policy so the PWA
    // gate fails on any CSP violation.
    headers: {
      "Content-Security-Policy": contentSecurityPolicy({ upgradeInsecureRequests: false })
    }
  },
  build: {
    outDir: "../dist-v2",
    emptyOutDir: true
  }
});
