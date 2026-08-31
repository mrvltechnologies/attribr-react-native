/**
 * Worked example of every Tier 1 method. Not executable as-is (it references
 * a hypothetical IAP purchase object) — copy the relevant parts into your
 * app's own App.tsx / purchase-success handler.
 */
import * as Attribr from '@mrvltechnologies/attribr-react-native';

// ── 1. Initialize once, at app start (e.g. top of App.tsx) ────────────────

Attribr.initialize({
  apiKey: process.env.EXPO_PUBLIC_ATTRIBR_API_KEY ?? '',
  // appId is optional if expo-application is installed — it reads
  // Application.applicationId automatically. Set it explicitly for a bare
  // RN app, or to override.
  appId: 'com.yourcompany.yourapp',
  // Required only for trackRevenue() — Supabase's public anon/publishable
  // key for Attribr's project, not a secret. See README "trackRevenue()".
  supabaseAnonKey: process.env.EXPO_PUBLIC_ATTRIBR_SUPABASE_ANON_KEY ?? '',
  debug: __DEV__,
});

// ── 2. Consent — call this after your GDPR/consent banner resolves ────────
// No network request happens before this. If your app doesn't use ATT/IDFA
// and has no separate consent flow, it's safe to grant immediately.

Attribr.setConsent('granted');

// ── 3. Launch tracking — call on every cold start / foreground ────────────

async function onAppLaunch() {
  const result = await Attribr.trackLaunch({
    appVersion: '1.2.3',
  });
  if (!result.ok && !result.skipped) {
    // Non-fatal — Attribr tracking should never block your app's own logic.
    console.warn('Attribr trackLaunch failed:', result.error ?? result.status);
  }
}

// ── 4. Custom events ────────────────────────────────────────────────────
// attribr-track persists name/value/currency/metadata as a distinct
// queryable custom-event record as of 2026-08-29. See README
// "trackEvent() — backend-supported as of 2026-08-29".

async function onLevelComplete(level: number) {
  await Attribr.trackEvent({
    name: 'level_complete',
    value: level,
    metadata: { level: String(level) },
  });
}

// ── 5. Revenue — call from your IAP purchase-success handler ──────────────
// This example assumes a StoreKit-2-style purchase object; adapt field
// names to whatever your IAP library (e.g. react-native-iap) provides.

interface ExamplePurchase {
  productId: string;
  transactionId?: string;
  localizedPrice?: string;
  currency?: string;
}

async function onPurchaseSuccess(purchase: ExamplePurchase) {
  await Attribr.trackRevenue({
    transactionId: purchase.transactionId ?? '',
    amount: parseFloat(purchase.localizedPrice ?? '0'),
    currency: purchase.currency ?? 'USD',
    productId: purchase.productId,
    eventType: 'initial_purchase',
  });
}

// ── 6. Referral / promoter attribution ─────────────────────────────────────

async function onReferralCodeReceived(code: string) {
  await Attribr.attributeInstall({
    code,
    source: 'custom',
  });
}

// ── 7. Testing — reset between test cases ──────────────────────────────────

function resetAttribrBetweenTests() {
  Attribr.resetForTesting();
}

export {
  onAppLaunch,
  onLevelComplete,
  onPurchaseSuccess,
  onReferralCodeReceived,
  resetAttribrBetweenTests,
};
