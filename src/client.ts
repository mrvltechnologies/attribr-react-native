import {
  AttribrConfig,
  AttributeInstallInput,
  ConsentState,
  TrackEventInput,
  TrackLaunchOptions,
  TrackResult,
  TrackRevenueInput,
} from './types';
import { AttribrLogger } from './logger';
import { defaultDeviceHash, DeviceHashUnavailableError } from './deviceHash';

/** Attribr's real, deployed Supabase project — same one every native SDK and REST client in this portfolio points at. */
const DEFAULT_BASE_URL = 'https://pblzmoxcwpqywuyubdim.supabase.co/functions/v1';

interface InternalState {
  config: AttribrConfig;
  consent: ConsentState;
  log: AttribrLogger;
}

let _state: InternalState | null = null;

function tryRequireReactNativePlatform(): { OS: string; Version: string | number } | null {
  try {
    return require('react-native').Platform;
  } catch {
    return null;
  }
}

function resolveAppId(config: AttribrConfig): string {
  if (config.appId) return config.appId;
  try {
    const Application = require('expo-application');
    if (Application.applicationId) return Application.applicationId as string;
  } catch {
    // fall through
  }
  throw new Error(
    'Attribr: appId is required — pass it to initialize() explicitly, or install ' +
      'expo-application so it can be resolved automatically.',
  );
}

async function resolveDeviceHash(config: AttribrConfig): Promise<string> {
  if (config.getDeviceHash) return config.getDeviceHash();
  return defaultDeviceHash();
}

function skip(reason: string): TrackResult {
  return { ok: false, skipped: true, reason };
}

/**
 * Resolves appId + device_hash together, with unified safe-skip error
 * handling — every tracking call needs both, and neither may ever throw
 * out of a public API function.
 */
async function resolveContext(
  state: InternalState,
  action: string,
): Promise<{ appId: string; deviceHash: string } | { skip: TrackResult }> {
  let appId: string;
  try {
    appId = resolveAppId(state.config);
  } catch (err) {
    state.log.error(String(err));
    return { skip: skip('missing_app_id') };
  }

  let deviceHash: string;
  try {
    deviceHash = await resolveDeviceHash(state.config);
  } catch (err) {
    const message = err instanceof DeviceHashUnavailableError ? err.message : String(err);
    state.log.error(`${action} skipped — ${message}`);
    return { skip: skip('device_hash_unavailable') };
  }

  return { appId, deviceHash };
}

async function post(
  state: InternalState,
  path: string,
  body: Record<string, unknown>,
  opts?: { withAuth?: boolean },
): Promise<TrackResult> {
  const baseUrl = state.config.baseUrl ?? DEFAULT_BASE_URL;
  const headers: Record<string, string> = {
    'X-Attribr-Key': state.config.apiKey,
    'Content-Type': 'application/json',
  };
  if (opts?.withAuth) {
    headers['Authorization'] = `Bearer ${state.config.supabaseAnonKey}`;
  }

  try {
    const res = await fetch(`${baseUrl}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const ok = res.ok;
    if (ok) {
      state.log.debug(`${path}: success (${res.status})`);
    } else {
      state.log.error(`${path}: HTTP ${res.status}`);
    }
    return { ok, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.log.error(`${path}: network error — ${message}`);
    return { ok: false, error: message };
  }
}

/**
 * Initialise the SDK. Call once at app start, before any other Attribr call.
 * Subsequent calls are ignored (singleton) — matching the native SDKs.
 */
export function initialize(config: AttribrConfig): void {
  if (_state) return;
  // Set up state even with a missing/empty apiKey — isConfigured()/logging
  // still work, and every tracking call below checks for a real apiKey and
  // skips safely (rather than throwing) without one.
  _state = {
    config,
    consent: 'unknown',
    log: new AttribrLogger(config.debug ?? false),
  };
  _state.log.debug('initialized');
}

export function isConfigured(): boolean {
  return _state !== null && !!_state.config.apiKey;
}

/** Test-only reset — not part of the conceptual public API surface for app code, but exported since this is a JS package with no access-control seam like `internal`. */
export function resetForTesting(): void {
  _state = null;
}

/** Inform the SDK of the user's GDPR consent decision. No network request happens before this is `.granted`. */
export function setConsent(state: ConsentState): void {
  if (!_state) {
    console.error('[Attribr] setConsent() called before initialize() — ignored');
    return;
  }
  _state.consent = state;
  _state.log.debug(`consent set to: ${state}`);
}

function guard(action: string): { state: InternalState } | { skip: TrackResult } {
  if (!_state) {
    console.error(`[Attribr] ${action}() called before initialize() — ignored`);
    return { skip: skip('not_initialized') };
  }
  if (!_state.config.apiKey) {
    _state.log.warn(`${action}() skipped — no apiKey configured`);
    return { skip: skip('missing_api_key') };
  }
  if (_state.consent !== 'granted') {
    _state.log.debug(`${action}() skipped — consent not granted`);
    return { skip: skip('consent_not_granted') };
  }
  return { state: _state };
}

export async function trackLaunch(options?: TrackLaunchOptions): Promise<TrackResult> {
  const g = guard('trackLaunch');
  if ('skip' in g) return g.skip;
  const { state } = g;

  const ctx = await resolveContext(state, 'trackLaunch');
  if ('skip' in ctx) return ctx.skip;
  const { appId, deviceHash } = ctx;

  const platformModule = tryRequireReactNativePlatform();
  return post(state, 'attribr-track', {
    app_id: appId,
    device_hash: deviceHash,
    app_version: options?.appVersion,
    os_version: options?.osVersion ?? (platformModule ? String(platformModule.Version) : undefined),
    platform: options?.platform ?? (platformModule ? (platformModule.OS as string) : undefined),
    install_type: options?.installType,
    re_engagement: options?.reEngagement,
    days_since_last_seen: options?.daysSinceLastSeen,
  });
}

/**
 * Backend-supported as of 2026-08-29: `attribr-track` persists `event_name`/
 * `value`/`currency`/`metadata` as a distinct `attribr_raw_events` row
 * (event_type: 'custom'), separate from install/launch records — verified
 * against production. See CHANGELOG.md.
 */
export async function trackEvent(event: TrackEventInput): Promise<TrackResult> {
  const g = guard('trackEvent');
  if ('skip' in g) return g.skip;
  const { state } = g;

  const ctx = await resolveContext(state, 'trackEvent');
  if ('skip' in ctx) return ctx.skip;
  const { appId, deviceHash } = ctx;

  return post(state, 'attribr-track', {
    app_id: appId,
    device_hash: deviceHash,
    event_name: event.name,
    value: event.value,
    currency: event.currency,
    metadata: event.metadata ?? {},
  });
}

/**
 * Reports an in-app purchase/subscription revenue event to Attribr.
 * Requires `supabaseAnonKey` in config — attribr-revenue has Supabase's
 * platform-level JWT gate enabled (unlike attribr-track/attribr-attribute),
 * so a call without a valid Authorization bearer token 401s before Attribr's
 * own validation ever runs. Rather than make that doomed network call, this
 * skips safely with a clear reason when supabaseAnonKey is missing.
 */
export async function trackRevenue(event: TrackRevenueInput): Promise<TrackResult> {
  const g = guard('trackRevenue');
  if ('skip' in g) return g.skip;
  const { state } = g;

  if (!state.config.supabaseAnonKey) {
    state.log.error(
      'trackRevenue skipped — supabaseAnonKey is required (attribr-revenue requires ' +
        'Authorization: Bearer <anon key> on top of X-Attribr-Key, or every call 401s)',
    );
    return skip('missing_supabase_anon_key');
  }

  const ctx = await resolveContext(state, 'trackRevenue');
  if ('skip' in ctx) return ctx.skip;
  const { appId, deviceHash } = ctx;

  const platformModule = tryRequireReactNativePlatform();
  const defaultStore = platformModule?.OS === 'ios' ? 'apple' : 'google';

  return post(
    state,
    'attribr-revenue',
    {
      app_id: appId,
      device_hash: deviceHash,
      transaction_id: event.transactionId,
      amount: event.amount,
      currency: event.currency,
      product_id: event.productId,
      event_type: event.eventType ?? 'initial_purchase',
      store: event.store ?? defaultStore,
    },
    { withAuth: true },
  );
}

/** Records referral/UTM/promoter attribution for an install. Posts to attribr-attribute. */
export async function attributeInstall(input: AttributeInstallInput): Promise<TrackResult> {
  const g = guard('attributeInstall');
  if ('skip' in g) return g.skip;
  const { state } = g;

  const ctx = await resolveContext(state, 'attributeInstall');
  if ('skip' in ctx) return ctx.skip;
  const { appId, deviceHash } = ctx;

  return post(state, 'attribr-attribute', {
    app_id: appId,
    device_hash: deviceHash,
    attribution_code: input.code,
    source: input.source,
    utm_source: input.utmSource,
    utm_campaign: input.utmCampaign,
  });
}
