import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
          "Plan gradual dog separation training, track what happens, and adapt the next step without pushing through distress.",
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
        navigateFallbackAllowlist: [/^\/$/, /^\/app\/?$/, /^\/privacy\/?$/, /^\/terms\/?$/, /^\/help\/?$/, /^\/evidence\/?$/]
      }
    })
  ],
  test: {
    environment: "node",
    include: ["app-v2/src/**/*.test.ts"]
  },
  build: {
    outDir: "../dist-v2",
    emptyOutDir: true
  }
});
