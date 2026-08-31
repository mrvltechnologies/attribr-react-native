/**
 * Tier 1 public types for @mrvltechnologies/attribr-react-native.
 *
 * This is a JS-only REST client — see README.md for exactly what it does and
 * does not cover. It intentionally mirrors the real backend contracts already
 * proven in the native Swift SDK (sdk/swift/Sources/Attribr/Attribr.swift)
 * and the hand-rolled REST clients already live in ARK-by-MRVL,
 * KonnectBusiness, KonnectbyMRVL, and campus-fellowship-rn.
 */

export type ConsentState = 'unknown' | 'granted' | 'revoked';

export type Platform = 'ios' | 'android' | 'web';

export type Store = 'apple' | 'google';

export type RevenueEventType = 'initial_purchase' | 'renewal' | 'cancellation' | 'refund';

export type AttributionSource = 'rippl' | 'utm' | 'custom';

/**
 * Configuration passed to `initialize()`.
 *
 * `appId` defaults to `expo-application`'s `Application.applicationId` when
 * that module is available. Bare React Native apps (no Expo modules) MUST
 * supply `appId` explicitly, since there is no dependency-free way to read
 * the bundle ID / package name.
 *
 * `supabaseAnonKey` is required for `trackRevenue()` specifically —
 * `attribr-revenue` (unlike `attribr-track`/`attribr-attribute`) has
 * Supabase's platform-level JWT gate enabled, so calls without a valid
 * `Authorization: Bearer <anon key>` header 401 before Attribr's own code
 * ever runs. This was a real, previously-undetected bug independently
 * discovered and fixed in both KonnectBusiness and KonnectbyMRVL — see
 * CHANGELOG.md. `trackLaunch()`/`trackEvent()`/`attributeInstall()` do not
 * need it.
 */
export interface AttribrConfig {
  apiKey: string;
  appId?: string;
  baseUrl?: string;
  supabaseAnonKey?: string;
  debug?: boolean;
  /**
   * Override the default device-hash strategy. Required for bare React
   * Native apps without `expo-application`/`expo-crypto` — see README.md
   * "Device hash" section for exactly what the default strategy can and
   * cannot do, and why a raw device identifier is never sent.
   */
  getDeviceHash?: () => Promise<string>;
}

export interface TrackLaunchOptions {
  appVersion?: string;
  osVersion?: string;
  platform?: Platform;
  /**
   * Returning-user classification for this launch, if the caller tracks
   * last-seen state itself (e.g. in AsyncStorage) — the package has no
   * opinion on what counts as "returning" vs "re-engagement" (that threshold
   * varies per app), so it never computes this itself. Sent as install_type
   * on attribr-track when provided; omitted entirely otherwise.
   */
  installType?: 'new_install' | 'returning' | 're_engagement';
  /** Sent as re_engagement — set alongside installType: 're_engagement'. */
  reEngagement?: boolean;
  /** Sent as days_since_last_seen — set alongside installType: 're_engagement'. */
  daysSinceLastSeen?: number;
}

/**
 * `attribr-track` persists these fields as a distinct custom-event record
 * (event_type: 'custom') as of 2026-08-29 — see `trackEvent()`'s JSDoc in
 * client.ts.
 */
export interface TrackEventInput {
  name: string;
  value?: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface TrackRevenueInput {
  transactionId: string;
  amount: number;
  currency: string;
  productId?: string;
  eventType?: RevenueEventType;
  store?: Store;
}

export interface AttributeInstallInput {
  code: string;
  source: AttributionSource;
  utmSource?: string;
  utmCampaign?: string;
}

/**
 * Every tracking call resolves to a `TrackResult`, never throws and never
 * blocks the caller — matching the "revenue tracking is non-critical" /
 * "never let a network blip block the purchase flow" convention already
 * established across every native SDK and hand-rolled REST client in this
 * portfolio.
 *
 * `skipped: true` means no network request was attempted at all (e.g. no
 * consent, not configured, missing supabaseAnonKey for a revenue call) —
 * distinct from a real network/HTTP failure, which sets `ok: false` with
 * `status`/`error` populated instead.
 */
export interface TrackResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  error?: string;
}
