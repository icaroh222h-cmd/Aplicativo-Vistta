import { getAnalytics, isSupported, logEvent, type Analytics, type AnalyticsCallOptions, type EventParams } from 'firebase/analytics';
import { app } from '../config/firebase';

let analyticsPromise: Promise<Analytics | null> | null = null;

async function getOptionalAnalytics() {
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return null;
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => supported ? getAnalytics(app) : null)
      .catch(() => null);
  }
  return analyticsPromise;
}

export async function trackEvent(name: string, params?: EventParams, options?: AnalyticsCallOptions) {
  const analytics = await getOptionalAnalytics();
  if (!analytics) return;
  logEvent(analytics, name, params, options);
}
