# SettledSolo beta roadmap

Last updated: 22 September 2026

The goal of the first beta is a small, reliable public product: the core training loop is
free, local-first and understandable; users can keep and delete their records; the public
site explains the evidence and limits; and release risks are tested on real devices before
the audience widens.

## Tranche 1 — beta-readiness UX and trust

Current pass:

- reflow the previous-session editor inside narrow mobile viewports;
- keep form controls at a usable mobile touch size;
- make previous-session deletion explicit, confirmed and available from the history row as
  well as the editor, with sync deletion markers preserved;
- keep the desktop warm-up “I'm back” control visible after the target is reached;
- remove named external commercial links and build SettledSolo-owned help, FAQ, cheatsheet
  and resource content;
- document the boundary between published evidence and SettledSolo product heuristics;
- remove any claim or gate implying that the product has received professional review.

## Tranche 2 — discoverability

- publish canonical titles/descriptions for the home, help, resources and evidence pages;
- ship the canonical link, Open Graph/Twitter metadata, `robots.txt` and sitemap;
- add real product screenshots and an accessible feedback/contact route;
- verify the production domain, Search Console coverage and social previews after deployment;
- keep `/app/` out of search indexing while making the public guidance pages crawlable.

## Tranche 3 — release evidence

- complete the installed iOS and Android lifecycle matrix;
- record real two-device sync, offline, conflict, export and account-deletion checks;
- complete targeted browser checks for the changed history, warm-up and content routes;
- run a small invited beta and log reliability/friction findings before widening access;
- keep training outcomes out of efficacy claims.

## Monetisation decision

The core plan, timer, history, export and basic progress view should remain useful for free.
Monetisation is deliberately staged:

1. **Beta:** no payment wall. Measure whether the product is useful and reliable.
2. **Optional support:** if users ask for it, add a clearly labelled “Support SettledSolo”
   or “Buy me a coffee” link only after choosing a provider and confirming the account,
   fees, region and privacy terms. It must be optional and must not interrupt training.
3. **Paid additions:** consider only after usage evidence. Candidate features are richer
   reports, multiple-dog workspaces, trainer sharing or advanced reminders/integrations —
   never safety-critical access to the core record.

Guardrails for any future payment flow: explicit opt-in, clear price and renewal terms,
easy cancellation, no silent conversion, no payment data in the training database and no
dark-pattern prompts. The provider, price and timing remain an open product decision.
