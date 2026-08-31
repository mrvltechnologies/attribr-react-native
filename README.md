# @mrvltechnologies/attribr-react-native

**Tier 1 — JS-only React Native / Expo client for Attribr.** No native module,
no CocoaPods dependency, no Gradle dependency. Not yet published to npm — see
"Status" below.

## What this is (and isn't)

This package standardizes the REST-client pattern that four MRVL RN/Expo apps
(ARK-by-MRVL, KonnectBusiness, KonnectbyMRVL, campus-fellowship-rn) were each
independently hand-rolling — with real, divergent bugs as a result:
`campus-fellowship-rn` posted to a non-existent endpoint, `KonnectBusiness`
omitted a required auth header, `KonnectbyMRVL`'s revenue path called a
native module that was never implemented. See `CHANGELOG.md` for the full
history this package is meant to prevent from recurring.

**This is Tier 1 — it does not yet cover:**

- SKAdNetwork conversion values (`registerSKAN`/`updateConversionValue` on
  the Swift SDK) — no Android equivalent exists either; this is inherently a
  native-platform concern.
- Native push-token registration for uninstall detection.
- Native uninstall detection.
- Automatic StoreKit / Google Play purchase hooks — you call `trackRevenue()`
  yourself, from your own IAP success handler, the same way every existing
  hand-rolled client in this portfolio already does.
- A native module or Expo config plugin.

Those are Tier 2, deliberately out of scope here, and not implemented in
this repo. Do not claim otherwise in any integration doc.

## Status

Not yet published to npm. Used first inside the MRVL portfolio (see
`CHANGELOG.md` for pilot status) before any public/npm release is considered.

## Install (once published)

```bash
npm install @mrvltechnologies/attribr-react-native
```

Peer dependencies (both optional, but required for the default device-hash
strategy — see "Device hash" below):

```bash
npx expo install expo-application expo-crypto
```

## Quick start

```ts
import * as Attribr from '@mrvltechnologies/attribr-react-native';

// Once, at app start:
Attribr.initialize({
  // Use a Client key (sdk_ingest scope) from Settings → API Keys, never a
  // Full key — this string ships inside your JS bundle and is extractable
  // by anyone who unpacks the app. A Client key can only submit events; it
  // cannot read your Attribr dashboard data even if extracted. See SECURITY.md.
  apiKey: 'attr_live_yourkey…',       // from your Attribr dashboard
  appId: 'com.yourcompany.yourapp',   // omit if expo-application is installed — it's read automatically
  supabaseAnonKey: 'eyJ...',          // required only for trackRevenue() — see below
  debug: __DEV__,
});

// After your GDPR/consent banner resolves:
Attribr.setConsent('granted');

// On every cold start / foreground:
await Attribr.trackLaunch();
```

**No network request is made before `setConsent('granted')`.** Every call
before that resolves immediately with `{ ok: false, skipped: true, reason:
'consent_not_granted' }` — never a crash, never a pending network request
firing later.

## API

```ts
initialize(config: AttribrConfig): void;
isConfigured(): boolean;
resetForTesting(): void;

setConsent(state: 'unknown' | 'granted' | 'revoked'): void;

trackLaunch(options?: TrackLaunchOptions): Promise<TrackResult>;
trackEvent(event: TrackEventInput): Promise<TrackResult>;
trackRevenue(event: TrackRevenueInput): Promise<TrackResult>;
attributeInstall(input: AttributeInstallInput): Promise<TrackResult>;
```

Every tracking call returns a `TrackResult` and **never throws** — matching
the "revenue tracking is non-critical, never block the purchase flow"
convention already used everywhere else in this portfolio:

```ts
interface TrackResult {
  ok: boolean;
  skipped?: boolean;   // true = no network request was attempted at all
  reason?: string;      // why it was skipped, e.g. 'consent_not_granted'
  status?: number;      // HTTP status, when a request was actually made
  error?: string;       // network-level error message, when applicable
}
```

Full type definitions are in `src/types.ts`. See `examples/basic-usage.ts`
for a worked example of every method.

### `trackEvent()` — backend-supported as of 2026-08-29

`attribr-track` now persists `name`/`value`/`currency`/`metadata` for
`trackEvent()` calls as a distinct row (`attribr_raw_events.event_type =
'custom'`), separate from install/launch records — confirmed against
production: the resulting row carries the exact `event_name`/`value`/
`currency`/`metadata` sent, and creates zero `attribr_installs` side effect
(a custom event does not require a prior `trackLaunch()` call and does not
consume install quota). Fixed at the backend in
`Attribr-by-MRVL/supabase/functions/attribr-track` — no change was needed
in this package, since the client was already sending the correct payload;
the backend simply wasn't reading it. See that repo's session notes for the
fix if you need the exact detail.

### `trackRevenue()` needs `supabaseAnonKey` — this is not optional

`attribr-revenue` (unlike `attribr-track`/`attribr-attribute`) has
Supabase's platform-level JWT gate enabled. A call with only `X-Attribr-Key`
401s **before Attribr's own validation code ever runs** — this exact bug was
independently found and fixed in both `KonnectBusiness` and `KonnectbyMRVL`
during this portfolio's hygiene work (see `CHANGELOG.md`). This package
requires `Authorization: Bearer <supabaseAnonKey>` on every `trackRevenue()`
call. If `supabaseAnonKey` isn't configured, `trackRevenue()` skips safely
(`reason: 'missing_supabase_anon_key'`) rather than making a call that's
guaranteed to fail.

`supabaseAnonKey` is Supabase's public/publishable anon key for Attribr's
project — safe to embed in client code by design, not a secret. Ask in the
Attribr dashboard or check an existing integration if you don't have it.

## Device hash

Attribr's backend requires a 64-character lowercase-hex SHA-256 string as
`device_hash` on every call — **never** a raw device identifier, and never
IDFA. The default strategy:

1. iOS: `Application.getIosIdForVendorAsync()` (IDFV) → SHA-256.
2. Android: `Application.getAndroidId()` → SHA-256.
3. Hashing via `expo-crypto`.

**Both `expo-application` and `expo-crypto` are optional peer dependencies.**
If they aren't installed (e.g. a bare React Native app with no Expo modules
at all), the default strategy throws `DeviceHashUnavailableError` internally
and every tracking call skips safely (`reason: 'device_hash_unavailable'`) —
it never falls back to sending something else in `device_hash`'s place.

**Known limitation:** there is no dependency-free way to get a stable,
privacy-safe device identifier in bare React Native without either Expo
modules or a real native module (Tier 2, not this package). If your app
can't install `expo-application`/`expo-crypto`, provide your own strategy:

```ts
Attribr.initialize({
  apiKey: '...',
  getDeviceHash: async () => {
    // Must resolve to a 64-char lowercase-hex string, e.g. SHA-256 of a
    // stable, install-scoped identifier your app already manages. Never
    // return a raw device ID, and never IDFA.
    return mySha256Hash;
  },
});
```

## Security

See `SECURITY.md`.

## License

MIT. Copyright 2026 MRVL Technologies.
