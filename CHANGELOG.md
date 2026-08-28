# @mrvl/attribr-react-native — Changelog

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
