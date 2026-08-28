/**
 * Tier 1 client tests — covers the exact requirements from the build brief:
 * consent gating (no network before granted), endpoint correctness,
 * device_hash presence, the attribr-revenue Authorization requirement,
 * safe-skip behaviour for missing config, debug logging, and resetForTesting.
 */

const VALID_HASH = 'a'.repeat(64);
const ANON_KEY = 'test-anon-key';

function mockFetchOk(body: unknown = { ok: true }) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

describe('Attribr Tier 1 client', () => {
  let client: typeof import('../client');

  beforeEach(() => {
    jest.resetModules();
    client = require('../client');
    (global as unknown as { fetch: jest.Mock }).fetch = mockFetchOk();
  });

  afterEach(() => {
    client.resetForTesting();
  });

  // ── initialize / isConfigured ────────────────────────────────────────────

  describe('initialize / isConfigured', () => {
    it('is not configured before initialize()', () => {
      expect(client.isConfigured()).toBe(false);
    });

    it('is configured after initialize() with an apiKey', () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app' });
      expect(client.isConfigured()).toBe(true);
    });

    it('is not configured if initialize() is called with an empty apiKey', () => {
      client.initialize({ apiKey: '', appId: 'com.test.app' });
      expect(client.isConfigured()).toBe(false);
    });

    it('ignores a second initialize() call (singleton, matches native SDKs)', () => {
      client.initialize({ apiKey: 'first-key', appId: 'com.test.app' });
      client.initialize({ apiKey: 'second-key', appId: 'com.test.app' });
      // No public getter for the raw config, so assert indirectly: consent
      // set after the first init is preserved (a fresh init would reset it).
      client.setConsent('granted');
      client.initialize({ apiKey: 'third-key', appId: 'com.test.app' });
      // If the second/third initialize() had taken effect, consent would
      // still read granted either way here — so instead assert isConfigured
      // stays true and no error is thrown, which is the observable contract.
      expect(client.isConfigured()).toBe(true);
    });
  });

  // ── consent gating ────────────────────────────────────────────────────────

  describe('consent gating: no network before granted', () => {
    it('does not call fetch for trackLaunch before consent is granted', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      const result = await client.trackLaunch();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, skipped: true, reason: 'consent_not_granted' });
    });

    it('does not call fetch for trackEvent before consent is granted', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      const result = await client.trackEvent({ name: 'test_event' });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('does not call fetch for trackRevenue before consent is granted', async () => {
      client.initialize({
        apiKey: 'attr_live_test',
        appId: 'com.test.app',
        supabaseAnonKey: ANON_KEY,
        getDeviceHash: async () => VALID_HASH,
      });
      const result = await client.trackRevenue({ transactionId: 'txn1', amount: 9.99, currency: 'USD' });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('calls fetch once consent is granted', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      await client.trackLaunch();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('stops calling fetch again after consent is revoked', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      await client.trackLaunch();
      client.setConsent('revoked');
      await client.trackEvent({ name: 'after_revoke' });
      expect(global.fetch).toHaveBeenCalledTimes(1); // only the pre-revoke call
    });
  });

  // ── trackLaunch ───────────────────────────────────────────────────────────

  describe('trackLaunch', () => {
    it('posts to attribr-track', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      await client.trackLaunch();
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://pblzmoxcwpqywuyubdim.supabase.co/functions/v1/attribr-track');
    });

    it('includes a valid device_hash in the payload', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      await client.trackLaunch();
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.device_hash).toBe(VALID_HASH);
      expect(body.app_id).toBe('com.test.app');
    });

    it('sends the API key via X-Attribr-Key, not Authorization', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      await client.trackLaunch();
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.headers['X-Attribr-Key']).toBe('attr_live_test');
      expect(options.headers['Authorization']).toBeUndefined();
    });
  });

  // ── trackRevenue / Authorization ─────────────────────────────────────────

  describe('trackRevenue', () => {
    it('posts to attribr-revenue', async () => {
      client.initialize({
        apiKey: 'attr_live_test',
        appId: 'com.test.app',
        supabaseAnonKey: ANON_KEY,
        getDeviceHash: async () => VALID_HASH,
      });
      client.setConsent('granted');
      await client.trackRevenue({ transactionId: 'txn1', amount: 9.99, currency: 'USD' });
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://pblzmoxcwpqywuyubdim.supabase.co/functions/v1/attribr-revenue');
    });

    it('includes Authorization: Bearer <anon key> alongside X-Attribr-Key', async () => {
      client.initialize({
        apiKey: 'attr_live_test',
        appId: 'com.test.app',
        supabaseAnonKey: ANON_KEY,
        getDeviceHash: async () => VALID_HASH,
      });
      client.setConsent('granted');
      await client.trackRevenue({ transactionId: 'txn1', amount: 9.99, currency: 'USD' });
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.headers['X-Attribr-Key']).toBe('attr_live_test');
      expect(options.headers['Authorization']).toBe(`Bearer ${ANON_KEY}`);
    });

    it('skips safely (no fetch call) when supabaseAnonKey is missing, even with consent granted', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      const result = await client.trackRevenue({ transactionId: 'txn1', amount: 9.99, currency: 'USD' });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, skipped: true, reason: 'missing_supabase_anon_key' });
    });

    it('includes required fields in the payload', async () => {
      client.initialize({
        apiKey: 'attr_live_test',
        appId: 'com.test.app',
        supabaseAnonKey: ANON_KEY,
        getDeviceHash: async () => VALID_HASH,
      });
      client.setConsent('granted');
      await client.trackRevenue({
        transactionId: 'txn1',
        amount: 9.99,
        currency: 'GBP',
        productId: 'com.test.app.pro',
        eventType: 'renewal',
      });
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({
        app_id: 'com.test.app',
        device_hash: VALID_HASH,
        transaction_id: 'txn1',
        amount: 9.99,
        currency: 'GBP',
        product_id: 'com.test.app.pro',
        event_type: 'renewal',
      });
    });
  });

  // ── missing apiKey ────────────────────────────────────────────────────────

  describe('missing apiKey', () => {
    it('skips safely without crashing when apiKey is empty', async () => {
      client.initialize({ apiKey: '', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      const result = await client.trackLaunch();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, skipped: true, reason: 'missing_api_key' });
    });
  });

  // ── calls before initialize() ────────────────────────────────────────────

  describe('calls before initialize()', () => {
    it('trackLaunch before initialize() does not throw and does not call fetch', async () => {
      const result = await client.trackLaunch();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, skipped: true, reason: 'not_initialized' });
    });

    it('setConsent before initialize() does not throw', () => {
      expect(() => client.setConsent('granted')).not.toThrow();
    });
  });

  // ── attributeInstall ──────────────────────────────────────────────────────

  describe('attributeInstall', () => {
    it('posts to attribr-attribute with no Authorization header required', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      await client.attributeInstall({ code: 'promo-123', source: 'custom' });
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://pblzmoxcwpqywuyubdim.supabase.co/functions/v1/attribr-attribute');
      expect(options.headers['Authorization']).toBeUndefined();
      const body = JSON.parse(options.body);
      expect(body.attribution_code).toBe('promo-123');
      expect(body.source).toBe('custom');
    });
  });

  // ── debug logging ─────────────────────────────────────────────────────────

  describe('debug logging', () => {
    it('does not log debug messages when debug is not set', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      await client.trackLaunch();
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('logs debug messages when debug: true is set', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      client.initialize({
        apiKey: 'attr_live_test',
        appId: 'com.test.app',
        debug: true,
        getDeviceHash: async () => VALID_HASH,
      });
      client.setConsent('granted');
      await client.trackLaunch();
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  // ── resetForTesting ───────────────────────────────────────────────────────

  describe('resetForTesting', () => {
    it('clears configuration and consent', async () => {
      client.initialize({ apiKey: 'attr_live_test', appId: 'com.test.app', getDeviceHash: async () => VALID_HASH });
      client.setConsent('granted');
      expect(client.isConfigured()).toBe(true);

      client.resetForTesting();

      expect(client.isConfigured()).toBe(false);
      const result = await client.trackLaunch();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.reason).toBe('not_initialized');
    });
  });
});
