# Account and sync behaviour review

Reviewed implementation: account/sync baseline through production activation, updated 21 September
2026. The code/test review is now supplemented by live preview/production activation and real OTP
delivery. It is still not a substitute for the remaining two-device and installed-PWA release evidence.

## Intended journeys and safeguards

| Journey | Expected behaviour | Evidence |
| --- | --- | --- |
| First use | Complete onboarding and train without an account | Existing mobile journeys retained |
| Returning user on a new device | Sign in from onboarding, explicitly restore cloud log | New two-device browser journey |
| Guest signs in | Nothing uploads merely because sign-in succeeds | New consent browser journey |
| Connect existing log | Show dog/track/session/cue counts, require explicit upload action | New consent browser journey |
| Offline training | Save locally; durable outbox retries after reconnect | Sync model + new offline-save browser journey |
| Network retry | Same mutation acknowledged once; no duplicate record | Real local D1 integration |
| Concurrent edits | Retain local and cloud versions; user chooses; archive both | Sync model regression |
| Edit during sync | Older response cannot acknowledge/drop the later local edit | Sync model regression |
| Delete versus edit | Retain an explicit conflict instead of silently dropping the edit | Sync model regression |
| Remote track deletion | Ask before hiding local history; last track requires keeping it or explicit reset | Sync model regression |
| Different account on same device | Existing owner binding blocks accidental cross-account upload | Model + browser journey |
| Sign-out | Pause sync before the network request; keep local pending changes and cloud history | Model + browser/D1 checks |
| Session expired | Present sign-in again; keep local log/outbox | 401 handling and D1 auth checks |
| Account deletion | Fresh OTP session + typed DELETE; cascade cloud data; retain usable local log | D1 integration + deleted-owner model regression |
| Local reset | Remove local log/sync binding; do not delete cloud account | Existing reset journey; updated copy |
| Backup restore | Ignore imported auth/sync metadata; reconcile local changes under the existing owner | Repository implementation; backup parser/unit coverage |
| Preview/production | Refuse shared D1 IDs, invalid origins and missing activation secrets | Deployment configuration tests |

## Findings addressed during implementation

- Replaced dead `Soon` account controls with a navigable account panel.
- Added returning-user sign-in before onboarding without imposing a login wall.
- Paused remote merges while a timed session or cue practice is active, with a local-write
  handover before training starts and a browser regression for a delayed sync response.
- Serialized local mutations and sync application, using Web Locks where available across tabs.
- Preserved later edits when a response acknowledges an earlier outbox version.
- Added expected-account checks on sync, export and deletion to reject stale-tab actions
  after another tab changes the authenticated account. The server still derives ownership
  exclusively from the authenticated session.
- Re-check authentication on reconnect after an offline launch before retrying queued sync.
- Preserved conflicts rather than accepting last-write-wins silently.
- Distinguished local reset, sign-out and permanent cloud-account deletion.
- Allowed explicit reconnection of a retained local log after its former cloud account is deleted.
- Removed the installation-as-backup claim and retained standalone JSON/CSV export.
- Kept mobile inputs at 16px, wrapping long email addresses and providing explicit error text.


## Validation status

Local/code validation covers type/build/Worker dry-run, legacy regressions, sync model and actual
local D1 integration. GitHub CI supplies Chromium/WebKit journeys and production-PWA checks.

Live activation is also complete:
- separate preview and production D1 databases are migrated and bound;
- Better Auth/Resend secrets and account variables are configured per environment;
- real OTP email delivery has succeeded;
- `/api/account/status` reports accounts available on preview and production;
- post-deploy verification checks the intended enabled state correctly.

## Remaining release evidence

- Sender reputation/junk placement plus wrong/expired-code, resend and live rate-limit behaviour.
- Two physical devices syncing real data, including offline/reconnect and conflict recovery.
- Installed iOS/Android offline lifecycle, safe updates, alerts and device-copy deletion behaviour.
- **Do not merge or deploy the legal-copy change or enable checkout until the public legal details below are completed and verified.**
- The operator is Jason Prickett, an individual trading as Southwest Websites. The approved public email is set as the app fallback; confirm no deployment override changes it and choose a publishable postal contact address before checkout.
- Decide and document the lawful basis for each processing purpose; complete the retention periods or criteria for account, authentication, email-provider, security-log and backup data; and document provider roles, locations and any international-transfer safeguards. The current public notice still lacks these required facts.
- Identify the payment/support provider and the transaction information it returns. Check that the checkout shows the seller identity and contact/address, service description, total price including applicable taxes, currency, payment method, one-off or recurring status, renewal and cancellation terms, and a saveable order confirmation before taking payment.
- If immediate digital content is sold, confirm that the checkout obtains the consumer's express consent and acknowledgement about any loss of the cancellation right before supply. Do not assume this applies to a voluntary one-off contribution without checking the actual offer.
- Complete the ICO data-protection-fee self-assessment and record the result before launch.
- The current app already includes behaviour-safety wording and privacy/account links. The remaining behaviour-quality evidence is real-device validation, not a professional-review claim.

References: [ICO privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/), [ICO fee self-assessment](https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee-self-assessment/), [GOV.UK online and distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses), and [Consumer Contracts Regulations 2013, regulation 37](https://www.legislation.gov.uk/uksi/2013/3134/regulation/37).
