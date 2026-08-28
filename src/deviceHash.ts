/**
 * Device hash strategy.
 *
 * Attribr's backend requires a 64-character lowercase-hex SHA-256 string as
 * `device_hash` on every call. This module never sends a raw device
 * identifier — only its hash — matching every native SDK and REST client
 * already proven in this portfolio.
 *
 * Default strategy (Expo-only): hash `Application.getIosIdForVendorAsync()`
 * (iOS) or `Application.getAndroidId()` (Android) via `expo-crypto`'s
 * SHA-256. Both `expo-application` and `expo-crypto` are optional peer
 * dependencies, loaded lazily via `require()` so this package has zero hard
 * native dependencies and can be installed in a plain JS/TS project (e.g.
 * for unit testing the rest of an app's integration) without either being
 * present.
 *
 * Known limitation: there is no dependency-free way to get a stable,
 * privacy-safe device identifier in bare React Native without Expo modules
 * (or a native module, which is explicitly Tier 2, not this package). Apps
 * without `expo-application`/`expo-crypto` installed MUST pass
 * `getDeviceHash` to `initialize()` — see README.md.
 */

export class DeviceHashUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      'Attribr: no device hash strategy available. Install expo-application ' +
        'and expo-crypto, or pass getDeviceHash to initialize().',
    );
    this.name = 'DeviceHashUnavailableError';
    if (cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = cause;
    }
  }
}

const HEX64_RE = /^[a-f0-9]{64}$/;

export function isValidDeviceHash(value: unknown): value is string {
  return typeof value === 'string' && HEX64_RE.test(value);
}

/**
 * Attempts the default Expo-based strategy. Throws DeviceHashUnavailableError
 * if expo-application/expo-crypto aren't installed, the platform module
 * can't resolve a raw ID, or the result doesn't look like a real SHA-256 hex
 * digest — callers must treat this as "skip the tracking call", never as
 * license to fall back to sending something else in device_hash's place.
 */
export async function defaultDeviceHash(): Promise<string> {
  let Application: typeof import('expo-application');
  let Crypto: typeof import('expo-crypto');
  let ReactNative: typeof import('react-native');
  try {
    Application = require('expo-application');
    Crypto = require('expo-crypto');
    ReactNative = require('react-native');
  } catch (err) {
    throw new DeviceHashUnavailableError(err);
  }

  try {
    const rawId =
      ReactNative.Platform.OS === 'ios'
        ? await Application.getIosIdForVendorAsync()
        : Application.getAndroidId?.();

    if (!rawId) {
      throw new Error('expo-application returned no device identifier');
    }

    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawId);
    if (!isValidDeviceHash(hash)) {
      throw new Error('expo-crypto did not return a valid 64-char hex SHA-256 digest');
    }
    return hash;
  } catch (err) {
    if (err instanceof DeviceHashUnavailableError) throw err;
    throw new DeviceHashUnavailableError(err);
  }
}
