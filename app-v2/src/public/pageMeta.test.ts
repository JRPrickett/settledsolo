import { describe, expect, it } from "vitest";
import { SEO_BLOCK_END, SEO_BLOCK_START, replaceSeoBlock, seoTags } from "./pageMeta";

describe("share metadata tags", () => {
  it("escapes values and omits the canonical link when asked", () => {
    const tags = seoTags({ title: 'A "quoted" <title> & more', description: "d".repeat(50), image: "/social/home.png", imageAlt: "alt" }, null);
    expect(tags).toContain("<title>A &quot;quoted&quot; &lt;title&gt; &amp; more</title>");
    expect(tags).not.toContain('rel="canonical"');
  });

  it("replaces only the marked block and leaves unmarked HTML untouched", () => {
    const html = `<head><meta charset="utf-8">${SEO_BLOCK_START}<title>old</title>${SEO_BLOCK_END}<link rel="icon"></head>`;
    const replaced = replaceSeoBlock(html, "<title>new</title>");
    expect(replaced).toContain("<title>new</title>");
    expect(replaced).not.toContain("<title>old</title>");
    expect(replaced).toContain('<meta charset="utf-8">');
    expect(replaced).toContain('<link rel="icon">');
    expect(replaceSeoBlock("<head></head>", "<title>x</title>")).toBe("<head></head>");
  });
});
