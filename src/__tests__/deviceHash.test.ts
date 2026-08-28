import { isValidDeviceHash, defaultDeviceHash, DeviceHashUnavailableError } from '../deviceHash';

describe('isValidDeviceHash', () => {
  it('accepts a 64-char lowercase hex string', () => {
    expect(isValidDeviceHash('a'.repeat(64))).toBe(true);
    expect(isValidDeviceHash('0123456789abcdef'.repeat(4))).toBe(true);
  });

  it('rejects uppercase hex, wrong length, and non-string values', () => {
    expect(isValidDeviceHash('A'.repeat(64))).toBe(false);
    expect(isValidDeviceHash('a'.repeat(63))).toBe(false);
    expect(isValidDeviceHash('a'.repeat(65))).toBe(false);
    expect(isValidDeviceHash(null)).toBe(false);
    expect(isValidDeviceHash(undefined)).toBe(false);
    expect(isValidDeviceHash(12345)).toBe(false);
  });
});

describe('defaultDeviceHash', () => {
  it('throws DeviceHashUnavailableError when expo-application/expo-crypto cannot resolve a real device id (jest/node env)', async () => {
    // In this test environment expo-application's native module isn't
    // actually linked, so getIosIdForVendorAsync()/getAndroidId() resolve to
    // null/undefined — this locks down that the failure mode is a typed,
    // catchable error, never a raw device identifier or a thrown TypeError.
    await expect(defaultDeviceHash()).rejects.toBeInstanceOf(DeviceHashUnavailableError);
  });
});
