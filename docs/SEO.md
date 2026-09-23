# SettledSolo search and AI-answer visibility

**Last updated:** 23 September 2026

## What the site now does

- **Pre-rendered pages.** Every public page used to be an empty `<div id="root">` until
  JavaScript ran. Google renders JavaScript, but later and less reliably; most other crawlers,
  including AI search crawlers, saw nothing. `app-v2/prerenderPlugin.ts` now renders each public
  page (and the not-found page) with `react-dom/server` as part of every `vite build`, including
  Cloudflare's own Git build. The output, `__prerender.json`, is read by the Worker, which puts
  the page's HTML inside `#root`. The browser then renders the same page over it (no hydration,
  so no mismatch risk). The app at `/app/` stays an empty shell and noindexed. The JSON is never
  served directly (404), and a missing file falls back to the old empty shell.
- **Per-page metadata** (PR #64): title, description, canonical URL and share card are written
  into the served HTML.
- **Structured data (JSON-LD)**, from `structuredData()` in `app-v2/src/public/pageMeta.ts`:
  - every public page: `Organization` and `WebSite`;
  - home: `WebApplication` (free, `price: 0`) and `FAQPage` for the homepage FAQs;
  - resources: `FAQPage`;
  - guide, help and evidence: `Article` with author and `dateModified`.
  The FAQ text comes from `app-v2/src/public/faqs.ts`, which also renders the visible FAQs, so
  the markup always matches the page. JSON-LD is a data block, not a script, so the CSP is
  unchanged (the production CSP gate covers every public page).
- **Answer-first guide.** `/separation-anxiety-training` answers the main questions people search
  for with question headings and a short answer first: what separation anxiety is, the signs,
  step-by-step training, how much to increase, how long it takes, how long a dog can be left,
  crates, punishment and when to get help. It has cited sources, an author line and a review
  date. See `EVIDENCE-BASE.md` for its evidence boundaries.
- **Sitemap** is generated at build time from `PUBLIC_PAGE_PATHS`, with each page's `updated`
  date as `lastmod`, so a new public page cannot be left out.
- **`llms.txt`** gives a plain-text summary of the site for tools that read it. It is low-cost and
  unproven; it is not a Google ranking signal.

## About Google AI Overviews

No site can opt in to, or be guaranteed a place in, AI Overviews. Google says they draw on its
normal index and ranking systems, and there is no special markup for them. What helps is what
helps ordinary search: pages that are indexed, fast, clearly structured, answer the question
directly, show who wrote them and why they can be trusted, and are linked from elsewhere.
AI Overviews use Googlebot. The `Google-Extended` robots token only controls Gemini training
and grounding, so blocking it would not remove the site from AI Overviews; SettledSolo does not
block any crawler on public pages.

The biggest remaining factors are off-site and need the owner (below).

## Owner checklist

1. **Google Search Console.** Add `settledsolo.com` as a Domain property. Verify it with the DNS
   TXT record in Cloudflare DNS. Submit `https://settledsolo.com/sitemap.xml`. Use URL
   Inspection → *Request indexing* on the home page and `/separation-anxiety-training` after
   this change deploys, and check that *View crawled page* shows the page text.
2. **Bing Webmaster Tools.** Import the site from Search Console. Bing's index feeds Copilot and
   is used by several other AI search tools.
3. **Rich results check.** Run the home, resources and guide URLs through Google's Rich Results
   Test and the Schema.org validator after deploying.
4. **Earn links and mentions.** Most of the remaining ranking work is here: rescue and rehoming
   organisations, trainers' resource pages, local dog groups, and genuine answers in
   communities where owners ask about separation anxiety (linking the guide, not spamming the
   app).
5. **Keep it fresh.** When the guide or a page changes meaningfully, update that page's `updated`
   date in `pageMeta.ts` (it drives the sitemap and structured data). Do not bump dates without a
   real change.
6. **Watch Search Console** after 2–4 weeks: queries, indexed pages, and any *Crawled – currently
   not indexed* pages.

## Possible next steps

- More answer-first guides for distinct questions (puppies and new rescues, departure cues,
  using a camera), each with real substance rather than keyword variations.
- A short "about the maker" page for trust, stating plainly that there is no professional review.
- Core Web Vitals check in Search Console once field data exists.
