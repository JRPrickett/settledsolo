import { describe, expect, it } from "vitest";
import { NOT_FOUND_KEY, renderPublicPages } from "./prerender";
import { PAGE_META, structuredData, structuredDataTag } from "./pageMeta";
import { HOME_FAQS, RESOURCE_FAQS } from "./faqs";
import { GUIDE_PATH, PUBLIC_PAGE_PATHS } from "./routes";

describe("pre-rendered public pages", () => {
  const pages = renderPublicPages();

  it("renders real content for every public page and the not-found page", () => {
    for (const path of [...PUBLIC_PAGE_PATHS, NOT_FOUND_KEY]) {
      expect(pages[path], path).toMatch(/<h1[^>]*>/);
      expect(pages[path].length, path).toBeGreaterThan(1_000);
    }
  });

  it("puts the guide's questions and every FAQ answer in the static HTML", () => {
    expect(pages[GUIDE_PATH]).toContain("How do you train a dog to be left alone?");
    expect(pages[GUIDE_PATH]).toContain("When should I get professional help?");
    // React escapes apostrophes, so compare a stretch of each answer without one.
    for (const { answer } of HOME_FAQS) expect(pages["/"]).toContain(answer.split("'")[0].slice(0, 60));
    for (const { answer } of RESOURCE_FAQS) expect(pages["/resources"]).toContain(answer.split("'")[0].slice(0, 60));
  });
});

describe("structured data", () => {
  it("describes the free app and FAQs on the home page and FAQs on resources", () => {
    const home = structuredData("/")["@graph"] as Array<Record<string, unknown>>;
    const app = home.find((node) => node["@type"] === "WebApplication");
    expect(app?.offers).toMatchObject({ price: "0" });
    const faq = home.find((node) => node["@type"] === "FAQPage") as { mainEntity: unknown[] };
    expect(faq.mainEntity).toHaveLength(HOME_FAQS.length);

    const resources = structuredData("/resources")["@graph"] as Array<Record<string, unknown>>;
    const resourceFaq = resources.find((node) => node["@type"] === "FAQPage") as { mainEntity: unknown[] };
    expect(resourceFaq.mainEntity).toHaveLength(RESOURCE_FAQS.length);
  });

  it("describes the guide as a dated article and never claims professional review", () => {
    const graph = structuredData(GUIDE_PATH)["@graph"] as Array<Record<string, unknown>>;
    const article = graph.find((node) => node["@type"] === "Article");
    expect(article).toMatchObject({
      headline: "How to train a dog with separation anxiety",
      dateModified: PAGE_META[GUIDE_PATH].updated
    });
    expect(JSON.stringify(graph)).not.toMatch(/reviewedBy|MedicalWebPage|medicalAudience/);
  });

  it("gives every public page a review date and valid JSON-LD that cannot close its script", () => {
    for (const path of PUBLIC_PAGE_PATHS) {
      expect(PAGE_META[path].updated, path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const tag = structuredDataTag(path);
      const json = tag.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "");
      expect(json).not.toContain("<");
      expect(() => JSON.parse(json)).not.toThrow();
    }
  });
});
