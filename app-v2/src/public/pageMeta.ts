import type { PublicPagePath } from "./routes";

export const CANONICAL_ORIGIN = "https://settledsolo.com";

export interface PageMeta {
  title: string;
  description: string;
  /** Path of the 1200x630 share card under /social/. */
  image: string;
  imageAlt: string;
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
    title: "Free dog separation anxiety training tool | SettledSolo",
    description:
      "Free dog separation anxiety training tool for gradual, observable alone-time practice, with a reliable timer, private history and evidence-informed guidance.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT
  },
  "/help": {
    title: "Help — dog separation anxiety training | SettledSolo",
    description: "Practical help for calm, gradual dog separation anxiety training with SettledSolo.",
    image: "/social/help.png",
    imageAlt: "SettledSolo help: keep the next step calm and manageable."
  },
  "/resources": {
    title: "Dog separation anxiety resources | SettledSolo",
    description:
      "Owned FAQs, printable checklists and observation tools for gradual dog separation anxiety training.",
    image: "/social/resources.png",
    imageAlt: "SettledSolo resources: free printable checklists, an observation log and FAQs."
  },
  "/evidence": {
    title: "Evidence-informed dog separation training | SettledSolo",
    description: "The research, safety boundaries and product heuristics behind SettledSolo.",
    image: "/social/evidence.png",
    imageAlt: "SettledSolo evidence: principles first, false precision never."
  },
  "/contact": {
    title: "Contact and feedback — SettledSolo",
    description: "How to send beta feedback and manage your SettledSolo data yourself.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT
  },
  "/privacy": {
    title: "Privacy — SettledSolo",
    description: "How SettledSolo handles local training records, optional accounts and sync.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT
  },
  "/terms": {
    title: "Terms — SettledSolo",
    description: "The scope, limits and free-core principles for SettledSolo.",
    image: "/social/home.png",
    imageAlt: DEFAULT_IMAGE_ALT
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
