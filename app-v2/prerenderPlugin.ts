import { createServer, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

export const PRERENDER_FILE = "__prerender.json";

const PWA_STUB_ID = "\0settledsolo-pwa-register-stub";

/**
 * Renders the public pages to static HTML as part of every production build, so
 * any build path (npm scripts, CI or Cloudflare's own Git build) ships them.
 * The output is an asset the Worker reads; it is never served directly.
 */
export function prerenderPublicPages(): Plugin {
  let appRoot = "";
  return {
    name: "settledsolo-prerender-public-pages",
    apply: "build",
    configResolved(config) {
      appRoot = config.root;
    },
    async generateBundle() {
      const server = await createServer({
        configFile: false,
        root: appRoot,
        logLevel: "error",
        appType: "custom",
        server: { middlewareMode: true, hmr: false, ws: false },
        plugins: [
          react(),
          {
            // The install button's service-worker hook only runs in the browser.
            name: "settledsolo-pwa-register-stub",
            resolveId: (id) => (id === "virtual:pwa-register/react" ? PWA_STUB_ID : undefined),
            load: (id) =>
              id === PWA_STUB_ID
                ? "export function useRegisterSW() { return { needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} }; }"
                : undefined
          }
        ]
      });
      try {
        const { renderPublicPages } = await server.ssrLoadModule("/src/public/prerender.tsx");
        const { sitemapXml } = await server.ssrLoadModule("/src/public/pageMeta.ts");
        const pages = renderPublicPages() as Record<string, string>;
        for (const [path, html] of Object.entries(pages)) {
          if (html.length < 200) throw new Error(`Pre-rendered ${path} is unexpectedly empty.`);
        }
        this.emitFile({ type: "asset", fileName: PRERENDER_FILE, source: JSON.stringify(pages) });
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: (sitemapXml as () => string)() });
      } finally {
        await server.close();
      }
    }
  };
}
