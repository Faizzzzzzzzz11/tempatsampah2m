/**
 * TrashRoute — Coordinate Utilities & Single Source of Truth
 *
 * Enforces GPS Latitude / Longitude as the single source of truth.
 * Rejects silent fallbacks, validates bounds, migrates legacy grid-only data,
 * and calculates true spherical bearings.
 */

import { Bin, Depot } from '../types';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Validates whether latitude and longitude are valid finite numbers within geographical bounds.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Extracts and strictly validates [latitude, longitude] from a Bin or Depot point.
 * Throws a clear error if the coordinates are missing or invalid,
 * NEVER silently falling back to erroneous grid positions.
 */
export function getBinLatLng(
  b: Bin | Depot | { lat?: number; lng?: number; id?: string | number } | null | undefined
): [number, number] {
  if (!b) {
    throw new Error('getBinLatLng: Point is null or undefined.');
  }
  if (!isValidCoordinate(b.lat, b.lng)) {
    const idStr = 'id' in b && b.id !== undefined ? `Point #${b.id}` : 'Point';
    throw new Error(
      `getBinLatLng: ${idStr} has invalid coordinates (lat: ${b.lat}, lng: ${b.lng}). Coordinates must be valid numbers.`
    );
  }
  return [Number(b.lat), Number(b.lng)];
}

/**
 * Converts legacy schematic grid coordinates (gx, gy) to geographic latitude/longitude.
 * Used exclusively for one-time backward-compatibility migration of legacy data.
 */
export function gridToLatLng(gx: number, gy: number): [number, number] {
  const normX = ((gx || 1) - 1) / 13;
  const normY = ((gy || 1) - 1) / 8;
  const lat = -7.7580 - normY * 0.0220; // Utara (Sidomoyo) ke Selatan (Sidoarum)
  const lng = 110.2800 + normX * 0.0500; // Barat (Sidorejo) ke Timur (Demak Ijo)
  return [
    Math.round(lat * 100000) / 100000,
    Math.round(lng * 100000) / 100000,
  ];
}

/**
 * Pure derived projection from GPS lat/lng to discrete grid indices (gx, gy) for UI display.
 * Never stored as application state.
 */
export function latLngToGrid(lat: number, lng: number): { gx: number; gy: number } {
  const normY = (-7.7580 - lat) / 0.0220;
  const normX = (lng - 110.2800) / 0.0500;
  let gx = Math.round(1 + normX * 13);
  let gy = Math.round(1 + normY * 8);
  if (gx < -100) gx = -100;
  if (gx > 200) gx = 200;
  if (gy < -100) gy = -100;
  if (gy > 200) gy = 200;
  return { gx, gy };
}

/**
 * Calculates the spherical bearing / azimuth angle (in radians) from origin to target.
 * Formula: atan2(dLng * cos(originLatRad), dLat)
 */
export function calculateBearingRad(
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number
): number {
  const originLatRad = (originLat * Math.PI) / 180;
  const dLat = targetLat - originLat;
  const dLng = targetLng - originLng;
  return Math.atan2(dLng * Math.cos(originLatRad), dLat);
}

/**
 * Validates and migrates stored JSON data from localStorage.
 * If legacy data has only x,y and no lat,lng (or schemaVersion < 2),
 * it converts x,y via gridToLatLng and stamps schemaVersion: 2.
 */
export function migrateStorageData(
  rawData: unknown,
  fallbackDepot: Depot,
  fallbackBins: Bin[]
): { depot: Depot; bins: Bin[]; schemaVersion: number } {
  if (!rawData || typeof rawData !== 'object') {
    return { depot: fallbackDepot, bins: fallbackBins, schemaVersion: CURRENT_SCHEMA_VERSION };
  }

  const parsed = rawData as Record<string, unknown>;
  let depot: Depot = fallbackDepot;
  let bins: Bin[] = fallbackBins;

  // 1. Migrate / Validate Depot
  if (parsed.depot && typeof parsed.depot === 'object') {
    const rawDepot = parsed.depot as Record<string, unknown>;
    let lat = typeof rawDepot.lat === 'number' ? rawDepot.lat : undefined;
    let lng = typeof rawDepot.lng === 'number' ? rawDepot.lng : undefined;

    if (!isValidCoordinate(lat, lng)) {
      if (typeof rawDepot.x === 'number' && typeof rawDepot.y === 'number') {
        const [migratedLat, migratedLng] = gridToLatLng(rawDepot.x, rawDepot.y);
        lat = migratedLat;
        lng = migratedLng;
      } else {
        lat = fallbackDepot.lat;
        lng = fallbackDepot.lng;
      }
    }

    depot = {
      id: String(rawDepot.id || fallbackDepot.id),
      name: String(rawDepot.name || fallbackDepot.name),
      location: rawDepot.location ? String(rawDepot.location) : fallbackDepot.location,
      lat: lat!,
      lng: lng!,
      tpsCapacity: typeof rawDepot.tpsCapacity === 'number' ? rawDepot.tpsCapacity : fallbackDepot.tpsCapacity,
      tpsBaselineWaste: typeof rawDepot.tpsBaselineWaste === 'number' ? rawDepot.tpsBaselineWaste : fallbackDepot.tpsBaselineWaste,
    };
  }

  // 2. Migrate / Validate Bins
  if (Array.isArray(parsed.bins) && parsed.bins.length > 0) {
    const migratedBins: Bin[] = [];

    parsed.bins.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rawBin = item as Record<string, unknown>;
      let lat = typeof rawBin.lat === 'number' ? rawBin.lat : undefined;
      let lng = typeof rawBin.lng === 'number' ? rawBin.lng : undefined;

      if (!isValidCoordinate(lat, lng)) {
        if (typeof rawBin.x === 'number' && typeof rawBin.y === 'number') {
          const [migratedLat, migratedLng] = gridToLatLng(rawBin.x, rawBin.y);
          lat = migratedLat;
          lng = migratedLng;
        } else {
          // Skip or use fallback
          return;
        }
      }

      migratedBins.push({
        id: typeof rawBin.id === 'number' ? rawBin.id : idx + 1,
        name: typeof rawBin.name === 'string' ? rawBin.name : `Tong ${idx + 1}`,
        location: typeof rawBin.location === 'string' ? rawBin.location : '',
        lat: lat!,
        lng: lng!,
        fill: typeof rawBin.fill === 'number' ? Math.max(0, Math.min(100, rawBin.fill)) : 50,
        noData: !!rawBin.noData,
        hasActiveReport: !!rawBin.hasActiveReport,
        reportType: typeof rawBin.reportType === 'string' ? rawBin.reportType : undefined,
        reportTime: typeof rawBin.reportTime === 'string' ? rawBin.reportTime : undefined,
      });
    });

    if (migratedBins.length > 0) {
      bins = migratedBins;
    }
  }

  return {
    depot,
    bins,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}
