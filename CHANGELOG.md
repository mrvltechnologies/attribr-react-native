# @mrvl/attribr-react-native — Changelog

## 0.2.0 — 2026-08-29 — Full API surface proven; trackEvent backend gap documented

Still git-dependency only, not published to npm.

Three changes on top of the initial 0.1.0 build:

- `trackLaunch()`'s `TrackLaunchOptions` gained optional `installType` /
  `reEngagement` / `daysSinceLastSeen` fields, surfaced while migrating
  ARK-by-MRVL — the package has no opinion on what counts as "returning"
  vs "re-engagement" (that threshold is app-specific), so these are purely
  passthrough onto `attribr-track`'s `install_type`/`re_engagement`/
  `days_since_last_seen` fields when supplied, and omitted entirely
  otherwise. Additive, backward-compatible.
- Added `"prepare": "npm run build"` to `package.json` — without it, a
  `git+https://...#commit` dependency install left `dist/` (gitignored)
  missing entirely, since npm only auto-runs `prepare` (not a plain
  `build` script) for git dependencies. Verified end-to-end: a real
  `npm install git+https://...#<commit>` into a scratch project now
  builds and requires correctly.
- **`trackEvent()` and `attributeInstall()` proven against production for
  the first time** (previously implemented and unit-tested only). Both
  called through the real installed package with a real MRVL app's
  `sdk_ingest` key:
  - `attributeInstall()` works correctly end-to-end — the resulting row
    landed in `attribr_attributions` with the exact `source`/`utmSource`/
    `utmCampaign` supplied, `rippl_promoter_id` correctly null (verified
    the Rippl-specific lookup path only triggers for `source: 'rippl'`,
    never touched here). Synthetic row deleted after verification.
  - **`trackEvent()` surfaced a real backend gap**: `attribr-track` does
    not currently read or persist `event_name`/`value`/`currency`/
    `metadata` at all. The call succeeds (200) and updates the launch/
    install record exactly as a plain `trackLaunch()` would, but no
    distinct "custom event" record is created anywhere — confirmed by
    inspecting the resulting `attribr_installs` and `attribr_raw_events`
    rows directly (`event_type: 'install'`, `source: 'organic'`, zero
    trace of the custom fields sent). This is a backend limitation, not a
    package bug, and out of this package's scope to fix (Tier 1: JS REST
    client only, no backend routes touched here). Documented prominently
    in `client.ts`, `types.ts`, `README.md`, and `examples/basic-usage.ts`
    so nobody builds a feature assuming named custom events are currently
    distinguishable in Attribr's data. Synthetic rows deleted after
    verification.

### Pilot status

All four apps named in the "Why this package exists" section below have
migrated onto this package, all pinned to commit `68ad205...`, all
production-verified for `trackLaunch`/`trackRevenue` (real calls against
the live backend, not just unit tests):

| App | Migration commit | attribr-revenue used? |
|---|---|---|
| ARK-by-MRVL | `8a946cf` | no (attribr-track only) |
| campus-fellowship-rn | `6b6c658` | no (attribr-track only) |
| KonnectBusiness | `d410e12` | yes |
| KonnectbyMRVL | `e88d059` | yes |

`trackEvent()` and `attributeInstall()` are now proven against production
(see above) but **not yet wired into any of the four pilot apps' actual
product code** — the proof above was a direct package-level call, not an
app integration. `attributeInstall()` is ready to adopt as-is.
`trackEvent()` is client-side correct and safe to call, but don't wire it
into a product feature that depends on named custom events being
queryable until the backend gap above is closed.

## 0.1.0 — 2026-08-28 — Initial Tier 1 build

First version of this package. Not published to npm — used internally
first, per the portfolio's release-hardening convention established for the
Swift SDK (see `Attribr-by-MRVL/sdk/swift/CHANGELOG.md`).

### Why this package exists

A portfolio audit found four MRVL RN/Expo apps each independently
hand-rolling the same REST client against Attribr's backend, with real,
divergent bugs as a direct result of that duplication:

- **campus-fellowship-rn** posted to a non-existent `/track-launch`
  endpoint (the real function is `attribr-track`) and never sent
  `device_hash` — every launch-tracking call silently failed since the
  integration was added.
- **KonnectBusiness** omitted the `Authorization: Bearer <anon key>` header
  `attribr-revenue` requires (unlike `attribr-track`) — every revenue call
  401'd before Attribr's own validation ever ran, silently, for the
  lifetime of the integration.
- **KonnectbyMRVL**'s revenue-tracking path called
  `NativeModules.AttribrModule`, which was never implemented in either iOS
  or Android native source — every revenue call was a silent no-op since
  inception.

Each was found and fixed independently, app by app, and each is exactly the
class of bug a single maintained client prevents. This package standardizes
the REST-client pattern instead of leaving four (and counting) apps to
maintain divergent copies.

### What's included (Tier 1)

- `initialize`, `isConfigured`, `resetForTesting`
- `setConsent` — no network request before `.granted`
- `trackLaunch` → `attribr-track`, includes `device_hash`
- `trackEvent` → `attribr-track` with `event_name`/`value`/`currency`/`metadata`
- `trackRevenue` → `attribr-revenue`, requires and sends
  `Authorization: Bearer <supabaseAnonKey>` — the exact header two of the
  four apps above were missing
- `attributeInstall` → `attribr-attribute`
- Safe-skip behavior throughout: missing `apiKey`, missing consent, missing
  `supabaseAnonKey` (revenue only), or an unavailable device-hash strategy
  all resolve to `{ ok: false, skipped: true, reason: '...' }` — never a
  throw, never a crash
- Debug logging gated behind `initialize({ debug: true })`
- JS-only device-hash strategy via optional `expo-application`/`expo-crypto`
  peer deps, with a `getDeviceHash` override for bare RN apps

### What's explicitly NOT included (Tier 2)

- SKAdNetwork conversion values
- Native push-token registration / uninstall detection
- Automatic StoreKit/Google Play purchase hooks
- A native module or Expo config plugin

### Pilot status

No MRVL app has been migrated onto this package yet as of this release —
see the accompanying session report for the recommended pilot (ARK-by-MRVL)
and why migration wasn't performed in this same change.
