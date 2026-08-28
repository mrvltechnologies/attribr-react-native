# Security

## What this package does with your keys

- `apiKey` (`attr_live_...`) is sent as the `X-Attribr-Key` header on every
  request. It is never logged, even with `debug: true` — only the endpoint
  path and response status are logged.
- **Always generate a Client key (`sdk_ingest` scope) in Settings → API Keys
  for `apiKey` — never a Full key.** This package ships the key inside your
  JS bundle, and an RN/Expo bundle is extractable from the shipped app
  without much effort (it is not compiled to native code the way Swift/Kotlin
  is). A Client key can only submit ingest events (track/click/web-visit/
  push-token) — it cannot read install, revenue, cohort, retention, or
  source data from your Attribr dashboard even if extracted. A Full key
  embedded here would let anyone who extracts it read your entire dashboard.
- `supabaseAnonKey` is Supabase's public/publishable anon key for Attribr's
  project. It is designed to be embedded in client apps and is not a secret
  by Supabase's own model — but it's still specific to Attribr's backend
  project and shouldn't be swapped for an arbitrary anon key from elsewhere.
- Neither key is ever committed by this package itself. How you store them
  in your own app (`.env`, EAS secrets, etc.) is your app's responsibility —
  see the portfolio's established pattern: gitignored `.env` locally, EAS
  secrets for cloud builds, never hardcoded in source.

## What this package sends about the device

- A SHA-256 hash of the device's vendor identifier (iOS) or Android ID —
  never the raw identifier, never IDFA. See README.md "Device hash".
- No IP address, email, name, location, contacts, or photos are collected or
  sent by this package at any point.

## Reporting a vulnerability

Report to the MRVL Technologies team via the same channel as other Attribr
SDK issues — this package is currently used only internally within the MRVL
portfolio and is not yet published externally.
