export {
  initialize,
  isConfigured,
  resetForTesting,
  setConsent,
  trackLaunch,
  trackEvent,
  trackRevenue,
  attributeInstall,
} from './client';

export type {
  AttribrConfig,
  AttributeInstallInput,
  AttributionSource,
  ConsentState,
  Platform,
  RevenueEventType,
  Store,
  TrackEventInput,
  TrackLaunchOptions,
  TrackResult,
  TrackRevenueInput,
} from './types';

export { DeviceHashUnavailableError, isValidDeviceHash } from './deviceHash';
