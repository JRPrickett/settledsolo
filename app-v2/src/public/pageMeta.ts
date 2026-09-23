import { HOME_FAQS, RESOURCE_FAQS, type Faq } from "./faqs";
import { GUIDE_PATH, PUBLIC_PAGE_PATHS, type PublicPagePath } from "./routes";

export const CANONICAL_ORIGIN = "https://settledsolo.com";

export interface PageMeta {
  title: string;
  description: string;
  /** Path of the 1200x630 share card under /social/. */
  image: string;
  imageAlt: string;
  /** When the page's content was last reviewed (ISO date): sitemap lastmod and structured data. */
  updated?: string;
  /** Article headline (the page's h1) for pages described as articles. */
  headline?: string;
}

const DEFAULT_IMAGE_ALT =
  "SettledSolo: calm, gradual separation training for dogs, with a doorway-glow logo and a relaxed dog at home.";

/**
 * One source for each public page's title, description and share card. The
 * client router sets these for the tab, and the Worker writes them into the
 * served HTML because link-preview crawlers never run JavaScript.
 */
export const PAGE_META: Record<PublicPagePath, PageMeta> = {
  "/": {
    title: "SettledSolo: free dog separation anxiety training app",
    description:
      "Free separation anxiety training app for dogs. Plan gradual alone-time sessions, time departures reliably and log what your dog does. No account needed.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT,
    updated: "2026-09-23"
  },
  [GUIDE_PATH]: {
    title: "Separation anxiety training for dogs, step by step | SettledSolo",
    description:
      "How to train a dog with separation anxiety: signs to watch for, gradual step-by-step alone-time training, how long it takes and when to get professional help.",
    image: "/social/guide.png",
    headline: "How to train a dog with separation anxiety",
    imageAlt: "SettledSolo guide: how to train a dog with separation anxiety, one calm step at a time.",
    updated: "2026-09-23"
  },
  "/help": {
    title: "Help — dog separation anxiety training | SettledSolo",
    description: "Practical help for calm, gradual dog separation anxiety training with SettledSolo.",
    image: "/social/help.png",
    headline: "Keep the next step calm and manageable",
    imageAlt: "SettledSolo help: keep the next step calm and manageable.",
    updated: "2026-09-23"
  },
  "/resources": {
    title: "Dog separation anxiety resources | SettledSolo",
    description:
      "Owned FAQs, printable checklists and observation tools for gradual dog separation anxiety training.",
    image: "/social/resources.png",
    imageAlt: "SettledSolo resources: free printable checklists, an observation log and FAQs.",
    updated: "2026-09-23"
  },
  "/evidence": {
    title: "Evidence-informed dog separation training | SettledSolo",
    description: "The research, safety boundaries and product heuristics behind SettledSolo.",
    image: "/social/evidence.png",
    headline: "Principles first. False precision never.",
    imageAlt: "SettledSolo evidence: principles first, false precision never.",
    updated: "2026-09-23"
  },
  "/contact": {
    title: "Contact and feedback — SettledSolo",
    description: "How to send beta feedback and manage your SettledSolo data yourself.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT,
    updated: "2026-09-23"
  },
  "/privacy": {
    title: "Privacy — SettledSolo",
    description: "How SettledSolo handles local training records, optional accounts and sync.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT,
    updated: "2026-09-23"
  },
  "/terms": {
    title: "Terms — SettledSolo",
    description: "The scope, limits and free-core principles for SettledSolo.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT,
    updated: "2026-09-23"
  }
};

/** The app itself is not indexed but can still be shared, so give it the home card. */
export const APP_META: PageMeta = {
  title: "SettledSolo — training app",
  description: PAGE_META["/"].description,
  image: PAGE_META["/"].image,
  imageAlt: DEFAULT_IMAGE_ALT
};

export const NOT_FOUND_META: PageMeta = {
  title: "Page not found — SettledSolo",
  description: PAGE_META["/"].description,
  image: PAGE_META["/"].image,
  imageAlt: DEFAULT_IMAGE_ALT
};

export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The head tags a crawler needs for one page. `canonicalPath` is null for pages
 * that must not claim a canonical URL (the app shell and not-found pages).
 */
export function seoTags(meta: PageMeta, canonicalPath: string | null): string {
  const url = `${CANONICAL_ORIGIN}${canonicalPath ?? "/"}`;
  const image = `${CANONICAL_ORIGIN}${meta.image}`;
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="SettledSolo" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="${SOCIAL_IMAGE_WIDTH}" />`,
    `<meta property="og:image:height" content="${SOCIAL_IMAGE_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
  ];
  if (canonicalPath !== null) {
    tags.push(`<link rel="canonical" href="${escapeHtml(url)}" />`);
  }
  return tags.join("\n    ");
}

export const SEO_BLOCK_START = "<!--seo-->";
export const SEO_BLOCK_END = "<!--/seo-->";

/** Replace the marked block in the served index.html; untouched if the markers are missing. */
export function replaceSeoBlock(html: string, tags: string): string {
  const start = html.indexOf(SEO_BLOCK_START);
  const end = html.indexOf(SEO_BLOCK_END);
  if (start === -1 || end === -1 || end < start) return html;
  return `${html.slice(0, start + SEO_BLOCK_START.length)}\n    ${tags}\n    ${html.slice(end)}`;
}

export const AUTHOR_NAME = "Jason Prickett";

function faqPage(url: string, faqs: Faq[]) {
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    url,
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer }
    }))
  };
}

/**
 * schema.org data describing a public page, so search engines and AI answers can
 * tell what the site, app and articles are. Only facts that are true today.
 */
export function structuredData(path: PublicPagePath): Record<string, unknown> {
  const meta = PAGE_META[path];
  const url = `${CANONICAL_ORIGIN}${path}`;
  const organization = {
    "@type": "Organization",
    "@id": `${CANONICAL_ORIGIN}/#organization`,
    name: "SettledSolo",
    url: `${CANONICAL_ORIGIN}/`,
    logo: `${CANONICAL_ORIGIN}/apple-touch-icon.png`,
    founder: { "@type": "Person", name: AUTHOR_NAME }
  };
  const website = {
    "@type": "WebSite",
    "@id": `${CANONICAL_ORIGIN}/#website`,
    name: "SettledSolo",
    url: `${CANONICAL_ORIGIN}/`,
    inLanguage: "en-GB",
    publisher: { "@id": organization["@id"] }
  };
  const graph: Record<string, unknown>[] = [organization, website];

  if (path === "/") {
    graph.push(
      {
        "@type": "WebApplication",
        "@id": `${CANONICAL_ORIGIN}/#app`,
        name: "SettledSolo",
        url: `${CANONICAL_ORIGIN}/app/`,
        description: meta.description,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Any (web browser; installable as an app)",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
        featureList: [
          "Adaptive gradual alone-time training plan",
          "Reliable departure timer with head-back reminders",
          "Warm-up departures and departure-cue practice",
          "Observation log of outcomes, stress signs and notes",
          "Progress charts and milestones",
          "Works offline; backup, CSV export and optional account sync"
        ],
        publisher: { "@id": organization["@id"] }
      },
      faqPage(url, HOME_FAQS)
    );
  } else if (path === "/resources") {
    graph.push(faqPage(url, RESOURCE_FAQS));
  } else if (meta.headline) {
    graph.push({
      "@type": "Article",
      "@id": `${url}#article`,
      headline: meta.headline,
      description: meta.description,
      url,
      mainEntityOfPage: url,
      image: `${CANONICAL_ORIGIN}${meta.image}`,
      inLanguage: "en-GB",
      dateModified: meta.updated,
      author: { "@type": "Person", name: AUTHOR_NAME },
      publisher: { "@id": organization["@id"] },
      isAccessibleForFree: true
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** A JSON-LD block safe to place in HTML (no `</script>` break-outs). */
export function structuredDataTag(path: PublicPagePath): string {
  const json = JSON.stringify(structuredData(path)).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

/** "2026-09-23" → "23 September 2026", independent of the viewer's locale. */
export function formatReviewDate(iso: string | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months[month - 1]} ${year}`;
}

/** The sitemap comes from the route list, so a new public page can never be left out. */
export function sitemapXml(): string {
  const urls = PUBLIC_PAGE_PATHS.map((path) => {
    const updated = PAGE_META[path].updated;
    const lastmod = updated ? `<lastmod>${updated}</lastmod>` : "";
    return `  <url><loc>${CANONICAL_ORIGIN}${path}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
