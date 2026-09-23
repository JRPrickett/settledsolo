import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAGE_META, SEO_BLOCK_END, SEO_BLOCK_START, seoTags } from "../app-v2/src/public/pageMeta";
import { PUBLIC_PAGE_PATHS } from "../app-v2/src/public/routes";

// File checks for the metadata the Worker serves; they need Node's filesystem.
const publicDir = new URL("../app-v2/public/", import.meta.url);

describe("committed share cards and default tags", () => {
  it("gives every public page a title, description and a committed 1200x630 card", () => {
    for (const path of PUBLIC_PAGE_PATHS) {
      const meta = PAGE_META[path];
      expect(meta.title, path).toMatch(/SettledSolo/);
      expect(meta.description.length, path).toBeGreaterThan(40);
      const card = new URL(`.${meta.image}`, publicDir);
      expect(existsSync(card), meta.image).toBe(true);
      const png = readFileSync(card);
      // PNG IHDR: width and height are big-endian at bytes 16 and 20.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], meta.image).toEqual([1200, 630]);
    }
  });

  it("keeps index.html's default tags identical to the home page metadata", () => {
    const html = readFileSync(new URL("../app-v2/index.html", import.meta.url), "utf8");
    const block = html.slice(html.indexOf(SEO_BLOCK_START) + SEO_BLOCK_START.length, html.indexOf(SEO_BLOCK_END));
    expect(block.trim()).toBe(seoTags(PAGE_META["/"], "/"));
  });

});

describe("generated sitemap", () => {
  it("lists every public page with its review date and never the app", async () => {
    const { sitemapXml } = await import("../app-v2/prerenderPlugin");
    const xml = sitemapXml();
    for (const path of PUBLIC_PAGE_PATHS) {
      expect(xml).toContain(`<loc>https://settledsolo.com${path}</loc><lastmod>${PAGE_META[path].updated}</lastmod>`);
    }
    expect(xml).not.toContain("/app");
  });
});
