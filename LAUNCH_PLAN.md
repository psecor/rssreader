# Launch Plan — RSSReader on Play Store + App Store

Roadmap for shipping the RSSReader app family (Android + iOS + backend) as a paid, invite-only subscription service on Google Play and the App Store, primarily as a learning exercise in what shipping a paid app actually involves.

**Status:** Planning phase. Zero work started.
**Repos in scope:** `rssreader` (backend), `android-rss-app` (Android client), `rssreader-ios` (iOS client).

## What this is / isn't

**This IS:**
- Real subscriptions with real money on both stores
- Invite-only closed beta (waitlist + invite codes)
- Monolith backend evolution — extend `rssreader` in place, don't split services yet
- Cross-store parity: both Android and iOS ship together (iOS app is already feature-complete)
- End-to-end coverage of "publish, get paid, provision users, respond to lifecycle events" as a learning experience

**This ISN'T (explicit non-goals):**
- Public open-testing launch
- Marketing, press, growth work
- LLC / business entity setup (revisit at ~50+ paying users)
- iOS from scratch — repo already exists at `../rssreader-ios`, feature-complete
- LaunchDarkly-facing product direction (separate initiative)
- Full multi-tenant abuse controls beyond SSRF + basic per-user rate limits

## Legal & business must-haves before ANY store submission

Even for invite-only closed testing, both stores require:

- **Privacy Policy** hosted at a stable URL (see Phase A prereq)
- **Terms of Service** hosted at a stable URL
- **Developer accounts:** Play Console ($25 one-time) and Apple Developer Program ($99/year). Individual accounts are fine for a solo dev; company accounts require D-U-N-S number verification.
- **A support email** the user can reach

**Personal-liability caveat.** Individual accounts mean payouts are in your legal name, user data collection is under your name, and any legal action lands on you personally. For a small closed beta this is livable, but if any user files a data-deletion request or Google/Apple do a compliance sweep, that's on you. Worth revisiting after Phase D.

## Phase A — Backend multi-tenancy (~1–2 weeks)

The backend has to be ready to auto-provision users from purchase events *before* either store integration can be built. Nothing downstream works without this.

### Tasks

- **Subscription model on User.** Add columns / linked table: `status` (active, past_due, cancelled, expired, grace_period), `expires_at`, `source` (google_play | app_store | founder), `external_id` (the Play `purchaseToken` or Apple `originalTransactionId`), `updated_at`.
- **Retire `ALLOWED_EMAILS` as the primary gate.** Keep it as a small "always-allowed" list for the founder + test accounts only. Real access = `status IN ('active', 'grace_period')`.
- **Bearer-auth middleware** (`bearerAuth.ts`) rejects requests from users without an active subscription. Return a machine-readable code (`subscription_required`) so the clients can route to a paywall.
- **Webhook endpoints (stubbed).** `POST /webhooks/play` and `POST /webhooks/apple`. Wire the actual receipt validation in Phase B and Phase C respectively.
- **SSRF / feed URL hardening.** User-submitted feed URLs are already accepted; before real users, block private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, IPv6 equivalents), cap redirects (3), cap response size (5 MB), cap timeout (10 s), whitelist schemes to `http`/`https`.
- **Per-user rate limiting.** Simple in-memory or `express-rate-limit` per authenticated user ID. Not a DoS defense; a "one buggy client isn't hammering us" guardrail.
- **Backups.** `pg_dump` on a cron timer + off-machine copy (S3 / another server / whatever). No fancier than that.
- **Admin CLI.** `npm run admin -- grant-founder <email>`, `revoke <email>`, `list-subscriptions`, `force-refresh <feedId>`. Support-during-beta tool.

### Deferred

- Feed-fetch deduplication across users (many users subscribe to the same feed — fetch once, fan out). Nice-to-have; not needed at beta scale.
- Sentry / error tracking. Add if it's cheap; otherwise defer.

## Phase B — Android release + Play Store submission (~2–3 weeks)

### Play Console setup

- Create Play Console account ($25 one-time)
- Create app entry with package name `net.secorp.rssreader`
- Complete: content rating questionnaire, data safety declarations, target audience declaration, target API level declaration (already 35)
- **Assets:** icon, feature graphic, screenshots (phone + Pixel Fold open + Pixel Fold closed at minimum), short description, full description, privacy policy URL, ToS URL

### Code hardening

- **Release keystore.** Generate, back up securely off-machine AND on secorp.net. Losing this = can never update the app.
- **Play App Signing.** Enroll — Google holds the master key, you sign uploads with an upload key. Standard.
- **R8 / proguard rules.** Keep rules needed for: Hilt, Retrofit, kotlinx.serialization, Compose, Room. Test the release build actually works before submitting.
- **AAB build target.** Play requires Android App Bundle format, not APK.
- **Drop `fallbackToDestructiveMigration()`.** Currently masks migration bugs. Write real `Migration(from, to)` callbacks and integration-test each one against a v(n-1) database with realistic data.
- **Version code + version name strategy.** e.g., version code = `YYYYMMDDNN` monotonic, version name = SemVer.
- **Google Sign-In branding compliance.** Play review will reject if the button doesn't follow Google's brand guidelines — specific colors, logo, minimum size.

### Play Billing integration

- Add `com.android.billingclient:billing-ktx` (v6+) to the app
- Define subscription product(s) in Play Console (see Open Decisions below for pricing)
- **Paywall UX.** Post-Google-sign-in, before any content: check `/api/me/subscription` → if `subscription_required`, route to paywall. Show product, "Subscribe" button, "Restore purchases" button.
- Purchase flow: `BillingClient.launchBillingFlow` → on success, ack the purchase → POST purchase token to backend → backend validates against Google's SubscriptionsV2 API and creates the subscription row → client refetches `/api/me/subscription`, unlocks.
- Restore-purchases flow: `queryPurchasesAsync(SUBS)` → for each active purchase, POST to backend to re-link. Handles reinstalls and new-device installs.
- **Real-time Developer Notifications.** Google Cloud project → create Pub/Sub topic → subscribe your backend webhook URL → link topic to app in Play Console. Every subscription lifecycle event (renewal, cancel, refund, grace period, on-hold) posts to your webhook. Backend must handle *every* notification type — see Google's list.

### Testing tracks

Follow the Play testing ladder in order:

1. **Internal testing.** Instant availability, up to 100 testers, your Google account included. Test the paywall + subscribe + restore flows with license testers (no real charges).
2. **Closed testing.** Where the beta lives. Invite by email — up to a few hundred. **This is where invite-code users go.**
3. Skip open testing and production for the learning-launch scope.

## Phase C — iOS release + App Store submission (~2–4 weeks)

The iOS app at `../rssreader-ios` is feature-complete against Android. The three big lifts are Sign in with Apple, StoreKit 2 subscriptions, and App Store Connect setup.

### Add Sign in with Apple (backend + iOS)

Apple's rule: if you offer any third-party sign-in (Google, Facebook, etc.), you must also offer Sign in with Apple. Non-negotiable — App Review will reject otherwise.

- **Backend:** `POST /auth/mobile/apple` parallel to `/auth/mobile/google`. Accepts Apple's identity token (JWT), verifies the signature against Apple's JWKs, extracts `sub` (Apple's stable user ID) and `email` if provided (may be a private relay address; treat it as canonical).
- New `User.appleUserId` column (nullable). Match by `appleUserId` first, `email` second, upsert if new.
- **iOS:** `AuthenticationServices` framework, `SignInWithAppleButton`, obtain identity token, POST to backend. Add to existing sign-in screen alongside Google button.

### Code hardening

- **Release signing.** App ID, provisioning profile, distribution certificate — easiest via automatic signing in Xcode; fastlane if you get sick of the manual UI dance.
- **App Store Connect entry.** Bundle ID, app name, primary language, category (News), age rating.
- **Assets.** Icon, screenshots for required device sizes (6.7" iPhone, 6.5" iPhone, 12.9" iPad Pro at minimum; the actual list changes yearly — check current requirements), description, keywords, support URL, marketing URL (optional), privacy policy URL, EULA (Apple's standard is fine).
- **Privacy nutrition labels.** Declare what data you collect and how it's used. Categories: Contact Info (email), User Content (RSS feeds), Identifiers (user ID), Usage Data if you add analytics.

### StoreKit 2 subscriptions

- Define subscription products in App Store Connect. Same product tier structure as Play if you can.
- StoreKit configuration file (`.storekit`) for local testing without real charges.
- **Paywall UX.** Same shape as Android: check subscription status → paywall if required → `Product.purchase()` → on success POST the JWS transaction to backend → backend validates.
- Backend `/webhooks/apple` receives App Store Server Notifications V2 (JWS-signed). Validate signature against Apple's root certs, decode payload, act on notification type.
- Backend also uses App Store Server API for on-demand receipt validation (immediately after purchase, and periodically to catch missed webhooks).

### Testing

1. **TestFlight internal.** Up to 100 internal testers (people on your team). No Apple review.
2. **TestFlight external.** Up to 10,000 testers, requires a lightweight Apple review (~24 hr). **This is where invite-code users go for the iOS side.**
3. Skip App Store production for now.

## Phase D — Invite gate + beta launch (~1 week)

The waitlist → invite → subscribe → real user flow.

- **Invite codes table** on backend: `code` (random string), `granted_to_email` (nullable — set when redeemed), `redeemed_at`, `expires_at`, `granted_by` (admin user).
- **Sign-up flow** on both clients: after sign-in, before paywall, require an invite code. `POST /api/invite/redeem` validates + associates code with the user. Only then does the app show the paywall.
- **Waitlist form.** Google Form is fine. Fields: email, why interested, current RSS reader. Notifications land in your inbox; you manually generate invite codes and email them back. Formalize later if it works.
- **First invites:** 10–20 people you know. Ask for direct feedback via the support email.
- **Support email + template responses.** Even a shared inbox with 3 canned responses (welcome, sorry-not-working, refund-issued) covers 90% of beta support.

## Cross-cutting concerns

### Privacy policy + ToS pages

Add two React routes on the `rssreader` web app at `/privacy` and `/terms`. Content: DIY template from Termly or similar is fine at this scale; a lawyer is better long-term. **Must be reachable before any store submission** (Play and Apple both auto-check the URLs at review time).

### Support email

Suggested: `rssreader-support@` your domain. Set up now — used in privacy policy, ToS, both store listings, and the support-request flow.

### Monitoring / error tracking

Consider Sentry (free tier is fine at beta scale) across all three components. Not strictly required for beta but each bug users hit that you *don't* know about is a chance to lose a paying user.

### Backend uptime

Personal-use side project → paying users' 99.9% expectation. Even at 10 paying users, downtime = refund requests + churn. If secorp.net's uptime is anything less than "consistently reliable," think about a monitoring alert to your phone (UptimeRobot free tier).

## Open decisions

These need answers before the corresponding phase can complete. Not blockers to *starting*.

- **Subscription pricing.** $/month? $/year with discount? Single tier or multiple? For a learning launch, single-tier $5/month or $50/year mirrors most competitors. Decide before Phase B.
- **Free trial.** 7-day / 14-day / none? Both stores support trials natively; trial-then-charge is standard. Reduces friction; increases support burden of "why was I charged."
- **Refund policy.** Google and Apple both handle refund mechanics; you decide the *stance* (generous first-time, none after 30 days, etc.).
- **Grace period on lapsed subscriptions.** How long after `expires_at` before hard lockout? Both stores default to ~3 days of "billing grace period" during retry; add ~7 more of your own read-only mode?
- **What lapsed users see.** Full lockout / read-only cache access / paywall-with-restore-purchase button? Read-only + prompt is friendliest, most complex.

## Known issues

Diagnosed bugs that aren't blocking phase progress but must land before Phase D beta invites go out.

- **Android write queue silently fails to drain** _(diagnosed 2026-07-27, android-rssreader)_. `WriteSyncWorker` runs (WorkManager records `state=SUCCEEDED, run_attempt_count=1`) but the `pending_actions` table doesn't shrink — 42 rows queued at `02:38:05Z` were still present 16+ min later after multiple worker executions. Verified via device DB pull. Only three code paths return `Result.success()` from `doWork()`: (1) `tokenStore.getToken() == null` — early exit, queue untouched; (2) `pendingActionDao.all().isEmpty()` — early exit, queue untouched; (3) full loop with no transient errors — every action drained via `deleteIfUnchanged`. Since queue has rows and rows are unchanged, the worker must be taking path 1 or 2 every time. Auth token file exists (`auth_prefs.xml` unchanged since 2026-07-12, 90-day JWT still valid), so at rest `getToken()` should succeed. Leading hypothesis: `EncryptedSharedPreferences` returning null when accessed in a background-revived process where the master key isn't yet unlocked from Android Keystore. Needs live logcat during a fresh mark-read → worker cycle to confirm. **Hidden by the read-side sync** — as long as web activity mirrors what Android tries to push, incoming server state (paginated `refreshReadStatuses`, fixed 2026-07-27) papers over the missing write. **Breaks the moment there's a third client** (or any Android-only user), which is exactly what Phase D beta creates. Not urgent for Phase B, hard blocker for Phase D.

## Suggested execution order

Phase A first (nothing else can start without it). B and C can be worked in parallel once A is stable, or serially if context-switching is expensive for a solo dev. D last.

```
week   1  2  3  4  5  6  7  8  9  10
A      ████
B          ████████
C              ████████████
D                          ██
```

If done fully serial (A → B → C → D), figure ~8–10 weeks. Parallel B/C shaves ~2 weeks. Learning goal supports either — parallel is faster, serial is calmer.

## Reading order for a new agent picking this up

1. This doc, top to bottom
2. `rssreader/AGENTS.md` — backend architecture + mobile API surface
3. `android-rss-app/AGENTS.md` — Android client state
4. `rssreader-ios/AGENTS.md` — iOS client state
5. `android-rss-app/ANDROID_TEMPLATE.md` — portable Android patterns
6. Whichever phase's tasks they're picking up

When in doubt, each phase's tasks are self-contained enough to be worked in isolation once Phase A is done.
