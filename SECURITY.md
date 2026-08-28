# Security

## What this package does with your keys

- `apiKey` (`attr_live_...`) is sent as the `X-Attribr-Key` header on every
  request. It is never logged, even with `debug: true` — only the endpoint
  path and response status are logged.
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
