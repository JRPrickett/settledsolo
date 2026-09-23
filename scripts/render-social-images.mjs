// Renders SettledSolo's link-preview cards (1200x630) and the iOS home-screen
// icon (180x180) from HTML using the brand fonts, colours and doorway mark.
// The PNGs are committed, so CI never needs a browser for them.
//
//   npm run social:images
//
// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a pre-installed Chromium.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "app-v2", "public");
// Inline assets as data URIs: a page set from a string cannot load file:// URLs.
const dataUrl = (path, type) => `data:${type};base64,${readFileSync(path).toString("base64")}`;
const fontUrl = (family, file) =>
  dataUrl(join(root, "node_modules", "@fontsource", family, "files", file), "font/woff2");
const photoUrl = dataUrl(join(publicDir, "photos", "hero-settled-at-home-v2.webp"), "image/webp");

// Brand tokens from docs/BRAND-DECISION.md.
const INK = "#15242C";
const GLOW = "#F2A65A";
const PARCHMENT = "#F1E7D6";
const PAPER = "#FBF7EF";
const SAGE_DARK = "#4F6B56";
const MUTED = "#4A5A5F";

const CARDS = [
  {
    file: "home.png",
    kicker: "Free dog separation training",
    headline: "Calm starts with small steps.",
    body: "Gradual alone-time practice with a reliable timer, a private record and evidence-informed guidance."
  },
  {
    file: "help.png",
    kicker: "Help",
    headline: "Keep the next step calm and manageable.",
    body: "Practical guidance for gradual, observable separation training."
  },
  {
    file: "resources.png",
    kicker: "Free resources",
    headline: "Checklists, an observation log and honest FAQs.",
    body: "Printable pages for planning calm, manageable alone-time practice."
  },
  {
    file: "evidence.png",
    kicker: "Evidence",
    headline: "Principles first. False precision never.",
    body: "The research, safety boundaries and product heuristics behind SettledSolo."
  }
];

const fontFaces = `
  @font-face { font-family: Fraunces; font-weight: 600; src: url(${fontUrl("fraunces", "fraunces-latin-600-normal.woff2")}); }
  @font-face { font-family: Karla; font-weight: 400; src: url(${fontUrl("karla", "karla-latin-400-normal.woff2")}); }
  @font-face { font-family: Karla; font-weight: 700; src: url(${fontUrl("karla", "karla-latin-700-normal.woff2")}); }
`;

// The horizontal-lockup mark from BrandMark.tsx: arch outline with the glow inside.
const mark = (size, stroke) => `
  <svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <radialGradient id="g" cx="50%" cy="100%" r="70%">
        <stop offset="0%" stop-color="#F6C989" />
        <stop offset="55%" stop-color="${GLOW}" stop-opacity=".65" />
        <stop offset="100%" stop-color="${GLOW}" stop-opacity="0" />
      </radialGradient>
      <clipPath id="c"><path d="M22 108 L22 56 A38 38 0 0 1 98 56 L98 108 Z" /></clipPath>
    </defs>
    <rect x="34" y="70" width="52" height="38" fill="url(#g)" clip-path="url(#c)" />
    <path d="M22 108 L22 56 A38 38 0 0 1 98 56 L98 108" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" />
  </svg>`;

function cardHtml({ kicker, headline, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${fontFaces}
    * { box-sizing: border-box; margin: 0; }
    html, body { width: 1200px; height: 630px; }
    body {
      display: grid; grid-template-columns: 1fr 430px; background: ${PARCHMENT};
      font-family: Karla, system-ui, sans-serif; color: ${INK}; overflow: hidden;
    }
    .copy { display: flex; flex-direction: column; padding: 64px 56px 56px 72px; }
    .lockup { display: flex; align-items: center; gap: 14px; }
    .lockup strong { font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 38px; letter-spacing: -.01em; }
    .kicker { margin-top: auto; font-weight: 700; font-size: 20px; letter-spacing: .14em; text-transform: uppercase; color: ${SAGE_DARK}; }
    h1 { margin-top: 16px; font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 64px; line-height: 1.04; letter-spacing: -.02em; max-width: 13ch; }
    p { margin-top: 22px; font-size: 25px; line-height: 1.4; color: ${MUTED}; max-width: 30ch; }
    .site { margin-top: auto; padding-top: 28px; font-weight: 700; font-size: 20px; color: ${INK}; }
    .site span { color: ${GLOW}; }
    .photo { position: relative; margin: 28px 28px 28px 0; border-radius: 32px; overflow: hidden; background: ${PAPER}; }
    .photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 45%; display: block; }
    .photo::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 1px rgba(21,36,44,.08); border-radius: 32px; }
  </style></head><body>
    <main class="copy">
      <div class="lockup">${mark(60, INK)}<strong>SettledSolo</strong></div>
      <div class="kicker">${kicker}</div>
      <h1>${headline}</h1>
      <p>${body}</p>
      <div class="site">settledsolo.com <span>·</span> free core, no signup wall</div>
    </main>
    <div class="photo"><img src="${photoUrl}" alt=""></div>
  </body></html>`;
}

// iOS applies its own rounded mask, so the icon is a full-bleed square without transparency.
function iconHtml() {
  return `<!doctype html><html><head><style>
    * { margin: 0; } html, body { width: 180px; height: 180px; background: ${INK}; }
    svg { display: block; }
  </style></head><body>
    <svg width="180" height="180" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="g" cx="50%" cy="100%" r="70%">
          <stop offset="0%" stop-color="#F6C989" />
          <stop offset="55%" stop-color="${GLOW}" stop-opacity=".7" />
          <stop offset="100%" stop-color="${GLOW}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="${INK}" />
      <path d="M34 96 L34 56 A26 26 0 0 1 86 56 L86 96 Z" fill="url(#g)" />
      <path d="M34 96 L34 56 A26 26 0 0 1 86 56 L86 96" fill="none" stroke="${PARCHMENT}" stroke-width="3.5" stroke-linecap="round" />
    </svg>
  </body></html>`;
}

async function render(page, html, width, height, path) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const missing = await page.evaluate(() =>
    ["600 20px Fraunces", "400 20px Karla", "700 20px Karla"].filter((font) => !document.fonts.check(font))
  );
  if (missing.length) throw new Error(`Brand fonts failed to load: ${missing.join(", ")}`);
  await page.screenshot({ path, type: "png", clip: { x: 0, y: 0, width, height } });
  console.log(`Rendered ${path.replace(`${root}/`, "")}`);
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  mkdirSync(join(publicDir, "social"), { recursive: true });
  for (const card of CARDS) {
    await render(page, cardHtml(card), 1200, 630, join(publicDir, "social", card.file));
  }
  await render(page, iconHtml(), 180, 180, join(publicDir, "apple-touch-icon.png"));
} finally {
  await browser.close();
}
