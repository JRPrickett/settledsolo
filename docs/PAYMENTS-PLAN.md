# SettledSolo payments plan

**Written:** 23 September 2026 · **Status:** Phase 1 live: the Ko-fi support link and its
privacy-notice section; nothing paid is implemented · **Assumes:** the seller is a UK-based sole trader or small company. If
that is wrong, the tax section changes and this plan should be revisited.

Fees and rules below were checked on the date above against provider pages and current guides
(sources at the end). They change often: re-check before signing up. This is product planning, not
tax or legal advice; confirm the VAT position with an accountant before taking money.

## Principles (from the beta roadmap and AGENTS.md)

- The core plan, timer, history, export and basic progress stay free, with no signup wall.
- Nothing safety-critical is ever paywalled: support/referral guidance, stopping, export and
  deletion stay free.
- Explicit opt-in, clear price and renewal terms, easy cancellation, no silent trial conversion, no
  dark patterns, no payment data in the training database.
- SettledSolo is a web PWA, not an app-store app, so Apple/Google in-app purchase rules and their
  15–30% commission do not apply.

## Recommendation in one line

**Ko-fi now for optional one-off support; Paddle later, as merchant of record, if and when paid
add-ons are justified by beta usage. Re-evaluate Stripe Managed Payments at that point.**

## Why a merchant of record matters here

A UK business selling digital services to consumers:

- **EU consumers:** there is no threshold for non-EU sellers. From the first EU consumer sale you
  must charge that country's VAT and register for the EU Non-Union OSS scheme (one registration,
  quarterly returns).
- **UK consumers:** UK VAT registration is compulsory once taxable turnover exceeds **£90,000** in any
  rolling 12 months (unchanged for 2026/27).

A merchant of record (MoR) is the legal seller to the customer. It calculates, collects and remits
VAT/sales tax worldwide, handles most chargebacks and fraud, and issues invoices. You receive a
payout and invoice the MoR, not thousands of consumers. For a solo product selling small
subscriptions internationally, that removes the heaviest compliance work.

## Provider comparison

| Provider | Model | Headline cost | Fits | Watch-outs |
| --- | --- | --- | --- | --- |
| **Ko-fi** | Tips/support page, paid out via your own Stripe or PayPal | **0%** platform fee on tips; card processing only (UK card via Stripe ~1.5% + 20p) | Optional one-off support now | Shop/membership items carry a 5% fee on the free plan. Keep support perk-free so it stays a voluntary gift rather than a sale |
| **Buy Me a Coffee** | Tips/support | 5% + processing | Same as Ko-fi | Costs more than Ko-fi for the same job |
| **Paddle** | Merchant of record | **5% + $0.50** per transaction, no monthly fee | Paid subscriptions/add-ons | **Does not allow donations or tips.** Expects clear terms, refund policy and support contact on the site. The flat fee hurts small monthly prices |
| **Stripe Managed Payments** | Stripe's own merchant of record | **3.5%** on top of standard Stripe processing (and Billing for subscriptions) | Paid subscriptions/add-ons | Still rolling out in 2026; UK-seller eligibility is not clearly documented. Confirm before planning on it |
| **Lemon Squeezy** | Merchant of record (Stripe-owned) | 5% + 50¢ | — | Being folded into Stripe Managed Payments. Avoid starting a new integration on it |
| **Stripe (standard)** | You are the seller | UK cards **1.5% + 20p**, EEA 2.5% + 20p, international 3.25% + 20p; Billing 0.7%; £20 per dispute | Only with VAT handled yourself | You own UK VAT and EU OSS from the first EU consumer sale, plus disputes and invoices |

## What the fees look like (approximate, card payments)

| Example | Ko-fi | Paddle | Stripe Managed Payments |
| --- | --- | --- | --- |
| £3 one-off tip (UK card) | ~25p (processing only) | not allowed | not suited |
| £4/month subscription | — | ~60p (~15%) | ~40p (~10%) + Billing |
| £30/year subscription | — | ~£1.90 (~6%) | ~£1.90 (~6.4%, incl. Billing) |

Two points follow:

- **Prefer annual (or one-off) pricing to small monthly fees.** Flat per-transaction fees make low
  monthly prices disproportionately expensive, and an annual plan also fits a training journey that
  runs for months.
- **Prices shown to consumers must include VAT.** Of a £30 UK sale, £5 is VAT that the MoR remits,
  before fees.

## Phased plan

### Phase 0 — beta (now)
No payments. Measure usefulness and reliability; do not use training outcomes as efficacy claims.

### Phase 1 — optional support (can start any time)
1. Create a Ko-fi page with a plain description and no perks or reward tiers.
2. ~~Wire the link.~~ Done: `https://ko-fi.com/settledsolo` is the built-in default in
   `app-v2/src/public/support.ts` (a `VITE_SUPPORT_URL` GitHub environment variable overrides
   it; `.env.example` is only a template and is never read by builds).
3. ~~Add the privacy-notice line.~~ Done: `/privacy` has an
   "Optional support payments" section and the support card says who handles payment. The
   provider name comes from the link's host (`supportProviderName` in `public/support.ts`:
   Ko-fi, Buy Me a Coffee, otherwise "our support provider"), so the notice cannot name the
   wrong provider.
4. Keep the card out of the training flow (it only shows on the public site today).

### Phase 2 — paid add-ons (only after beta evidence)
Candidates from the roadmap: richer reports, multi-dog workspaces, trainer sharing, advanced
reminders. Decide on evidence, not by default.
1. **Provider:** Paddle, unless Stripe Managed Payments is confirmed available to UK sellers and
   works out cheaper for the chosen price. Both are MoRs; both are behind an account.
2. **Pricing shape:** one annual plan (optionally lifetime), VAT-inclusive display, no auto-converting
   trial; cancellation from the customer portal without contacting support.
3. **Architecture:** paid features require an account, since entitlements live with the account.
   - The Worker adds a signed-webhook endpoint (e.g. `/api/billing/webhook`) that verifies the
     provider signature and stores only `plan`, `status`, `renews_at` and the provider's customer
     ID in the accounts D1 database.
   - No card or payment data is stored, and nothing billing-related goes near training records or
     metrics.
   - Checkout opens the provider's hosted or overlay page; the CSP gains only the provider's domains.
4. **Legal:** add pricing, renewal, cancellation and refund terms. Record UK consumer consent for
   immediate digital access, which affects the 14-day cancellation right. Update the privacy notice
   with the MoR as a processor.
5. **Safety:** expiry of a paid plan must never lock history, export, deletion or the core plan.
   Downgrade removes only the add-on.

## Decisions needed from the owner

1. Confirm the seller's country and legal form (sole trader vs limited company).
2. ~~Phase 1: create the Ko-fi page and wire the link.~~ Done.
3. Phase 2 later: which add-on, which price, and whether to apply to Paddle or wait for Stripe
   Managed Payments availability.

## Sources

- Stripe UK fees (1.5% + 20p UK cards, Billing 0.7%, £20 disputes): [MerchantHQ](https://merchanthq.co.uk/fees/stripe/), [We Are Founders](https://www.wearefounders.uk/stripe-fees-uk-2026/), [stripe.com/pricing](https://stripe.com/pricing)
- Stripe Managed Payments (3.5% + processing, rollout status): [Stripe](https://stripe.com/managed-payments), [Stripe support: pricing](https://support.stripe.com/questions/managed-payments-pricing), [Fungies](https://fungies.io/stripe-managed-payments-vs-merchant-of-record-2026/)
- Paddle (5% + 50¢; donations not allowed): [Paddle AUP](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle), [StackScored](https://www.stackscored.com/pricing/saas-billing/paddle/)
- Lemon Squeezy and Stripe Managed Payments: [Lemon Squeezy 2026 update](https://www.lemonsqueezy.com/blog/2026-update)
- Ko-fi and Buy Me a Coffee fees: [Ko-fi help](https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee), [Buy Me a Coffee help](https://help.buymeacoffee.com/en/articles/8105744-how-to-calculate-charges-on-your-payment)
- VAT: [AVASK: digital services VAT 2026](https://avask.com/blog/vat-for-digital-services/), [Taxually: EU VAT on digital services](https://www.taxually.com/blog/when-and-where-to-charge-eu-vat-on-digital-services), [Xero: UK VAT threshold](https://www.xero.com/uk/guides/vat-registration-thresholds/)
