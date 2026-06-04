/**
 * audioVolume.ts
 * Shared utility for kitchen / waiter alert volume settings.
 * Persisted in localStorage so settings survive page refreshes.
 *
 * Three independent volume knobs (0 – 1.5 scale):
 *   - kitchenOrderBell  : bell in Kitchen Backend when an order is placed
 *   - helpCallAlarm     : alarm in Kitchen Backend & Waiter when customer calls for help
 *   - waiterDeliverBell : bell in Waiter Tab when Kitchen marks an order "Advance to Deliver"
 */

export type VolumeKey = 'kitchenOrderBell' | 'helpCallAlarm' | 'waiterDeliverBell';

const STORAGE_PREFIX = 'snyf_vol_';
const DEFAULT_VOLUME = 1.0;
const MAX_VOLUME     = 1.5;
const MIN_VOLUME     = 0.0;
const STEP           = 0.1;

export function getVolume(key: VolumeKey): number {
  const raw = localStorage.getItem(STORAGE_PREFIX + key);
  if (raw === null) return DEFAULT_VOLUME;
  const v = parseFloat(raw);
  return isNaN(v) ? DEFAULT_VOLUME : Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, v));
}

export function setVolume(key: VolumeKey, value: number): void {
  const clamped = Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, Math.round(value * 10) / 10));
  localStorage.setItem(STORAGE_PREFIX + key, String(clamped));
}

export function incrementVolume(key: VolumeKey): number {
  const next = Math.min(MAX_VOLUME, Math.round((getVolume(key) + STEP) * 10) / 10);
  setVolume(key, next);
  return next;
}

export function decrementVolume(key: VolumeKey): number {
  const next = Math.max(MIN_VOLUME, Math.round((getVolume(key) - STEP) * 10) / 10);
  setVolume(key, next);
  return next;
}

export { MAX_VOLUME, MIN_VOLUME, STEP, DEFAULT_VOLUME };
