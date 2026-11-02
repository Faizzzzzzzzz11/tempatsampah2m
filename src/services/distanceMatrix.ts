/**
 * TrashRoute — Distance Matrix Service
 *
 * Provides real road distances and travel times using OSRM Table Service (/table/v1/driving)
 * with robust chunking, timeouts, backup mirrors, LRU caching (max 50),
 * and calibrated Haversine fallback (HAVERSINE_ROAD_FACTOR = 1.3).
 */

import { Bin, Depot, SystemConfig } from '../types';
import { isValidCoordinate, getBinLatLng } from './coordinateUtils';

export const EARTH_RADIUS_KM = 6371;
export const HAVERSINE_ROAD_FACTOR = 1.3;
export const DEFAULT_SPEED_KMH = 30;

export interface DistanceMatrixResult {
  km: number[][];
  min: number[][];
  source: 'osrm' | 'fallback';
  pointKeys: string[];
  pointKeyIndex: Map<string, number>;
  timestamp: number;
  getDist: (p1: Bin | Depot | { lat?: number; lng?: number }, p2: Bin | Depot | { lat?: number; lng?: number }) => number;
  getTimeMin: (p1: Bin | Depot | { lat?: number; lng?: number }, p2: Bin | Depot | { lat?: number; lng?: number }) => number;
}

export type DistanceFn = (
  p1: Bin | Depot | { lat?: number; lng?: number },
  p2: Bin | Depot | { lat?: number; lng?: number }
) => number;

/**
 * Calculates straight-line spherical distance between two points using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calibrated Haversine distance with road network detour factor (1.3x).
 */
export function haversineRoadDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const straight = haversineDistance(lat1, lng1, lat2, lng2);
  return Math.round(straight * HAVERSINE_ROAD_FACTOR * 100) / 100;
}

/**
 * Normalizes a point into a coordinate key formatted to 5 decimal places (~1.1 meter precision).
 */
export function getCoordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/**
 * Generates a unique cache key for a list of points.
 */
export function getPointsHash(points: [number, number][]): string {
  return points.map(pt => `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`).join(';');
}

// -------------------------------------------------------------
// LRU CACHE (MAX 50 ENTRIES)
// -------------------------------------------------------------
interface CachedMatrix {
  km: number[][];
  min: number[][];
  source: 'osrm' | 'fallback';
}

const LRU_MAX_ENTRIES = 50;
const matrixLruCache = new Map<string, CachedMatrix>();

export function getCachedMatrix(hash: string): CachedMatrix | null {
  if (!matrixLruCache.has(hash)) return null;
  // Move to end (most recently used)
  const val = matrixLruCache.get(hash)!;
  matrixLruCache.delete(hash);
  matrixLruCache.set(hash, val);
  return val;
}

export function setCachedMatrix(hash: string, data: CachedMatrix): void {
  if (matrixLruCache.has(hash)) {
    matrixLruCache.delete(hash);
  } else if (matrixLruCache.size >= LRU_MAX_ENTRIES) {
    const oldestKey = matrixLruCache.keys().next().value;
    if (oldestKey !== undefined) {
      matrixLruCache.delete(oldestKey);
    }
  }
  matrixLruCache.set(hash, data);
}

export function clearMatrixCache(): void {
  matrixLruCache.clear();
}

/**
 * Builds the fallback distance & duration matrix using haversine * 1.3.
 */
export function buildFallbackMatrix(
  coords: [number, number][],
  speedKmh = DEFAULT_SPEED_KMH
): { km: number[][]; min: number[][] } {
  const n = coords.length;
  const km: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const min: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        km[i][j] = 0;
        min[i][j] = 0;
      } else {
        const d = haversineRoadDistance(coords[i][0], coords[i][1], coords[j][0], coords[j][1]);
        km[i][j] = d;
        min[i][j] = Math.max(1, Math.round((d / speedKmh) * 60));
      }
    }
  }

  return { km, min };
}

/**
 * Fetch a single OSRM /table/v1/driving chunk with timeout and endpoint fallback.
 */
async function fetchOsrmTableChunk(
  coords: [number, number][],
  sourceIndices?: number[],
  destIndices?: number[],
  timeoutMs = 6000
): Promise<{ distances: number[][]; durations: number[][] } | null> {
  const coordsStr = coords.map(c => `${c[1].toFixed(5)},${c[0].toFixed(5)}`).join(';');
  let queryParams = 'annotations=distance,duration';
  if (sourceIndices && sourceIndices.length > 0) {
    queryParams += `&sources=${sourceIndices.join(';')}`;
  }
  if (destIndices && destIndices.length > 0) {
    queryParams += `&destinations=${destIndices.join(';')}`;
  }

  const endpoints = [
    `https://router.project-osrm.org/table/v1/driving/${coordsStr}?${queryParams}`,
    `https://routing.openstreetmap.de/routed-car/table/v1/driving/${coordsStr}?${queryParams}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && Array.isArray(data.distances) && Array.isArray(data.durations)) {
          return {
            distances: data.distances,
            durations: data.durations,
          };
        }
      }
    } catch {
      // Try next endpoint mirror
    }
  }

  return null;
}

/**
 * Builds the complete distance matrix for an array of points (Bin | Depot).
 *
 * Automatically splits requests into chunks of max 25 points if needed,
 * attempts OSRM table endpoints with timeout and backup mirrors,
 * checks/updates the LRU cache (max 50),
 * and falls back to haversine * 1.3 on any network/parsing failure.
 */
export async function buildDistanceMatrix(
  points: (Bin | Depot)[],
  cfg?: SystemConfig
): Promise<DistanceMatrixResult> {
  const cleanCoords: [number, number][] = [];
  const pointKeys: string[] = [];
  const pointKeyIndex = new Map<string, number>();

  points.forEach((p, idx) => {
    const [lat, lng] = getBinLatLng(p);
    cleanCoords.push([lat, lng]);
    const key = getCoordKey(lat, lng);
    pointKeys.push(key);
    pointKeyIndex.set(key, idx);
    if ('id' in p) {
      pointKeyIndex.set(String(p.id), idx);
    }
  });

  const n = cleanCoords.length;
  const hash = getPointsHash(cleanCoords);

  // 1. Check LRU Cache
  const cached = getCachedMatrix(hash);
  if (cached && cached.km.length === n) {
    return wrapMatrixResult(cached.km, cached.min, cached.source, pointKeys, pointKeyIndex, cfg);
  }

  // If fewer than 2 points
  if (n <= 1) {
    const km = [[0]];
    const min = [[0]];
    return wrapMatrixResult(km, min, 'osrm', pointKeys, pointKeyIndex, cfg);
  }

  // 2. Fetch OSRM table (chunked if n > 25)
  const CHUNK_LIMIT = 25;
  let osrmKm: number[][] | null = null;
  let osrmMin: number[][] | null = null;

  try {
    if (n <= CHUNK_LIMIT) {
      const data = await fetchOsrmTableChunk(cleanCoords);
      if (data) {
        osrmKm = data.distances.map(row => row.map(d => Math.round((d / 1000) * 100) / 100));
        osrmMin = data.durations.map(row => row.map(s => Math.max(1, Math.round(s / 60))));
      }
    } else {
      // Chunked approach: partition points into chunks of size CHUNK_LIMIT
      osrmKm = Array.from({ length: n }, () => new Array(n).fill(0));
      osrmMin = Array.from({ length: n }, () => new Array(n).fill(0));
      let allChunksSuccess = true;

      for (let i = 0; i < n && allChunksSuccess; i += CHUNK_LIMIT) {
        const iEnd = Math.min(n, i + CHUNK_LIMIT);
        for (let j = 0; j < n && allChunksSuccess; j += CHUNK_LIMIT) {
          const jEnd = Math.min(n, j + CHUNK_LIMIT);

          // Get unique coordinates in these two chunks
          const chunkIndices = Array.from(new Set([
            ...Array.from({ length: iEnd - i }, (_, k) => i + k),
            ...Array.from({ length: jEnd - j }, (_, k) => j + k),
          ]));
          const subCoords = chunkIndices.map(idx => cleanCoords[idx]);
          const srcSubIndices = Array.from({ length: iEnd - i }, (_, k) => chunkIndices.indexOf(i + k));
          const dstSubIndices = Array.from({ length: jEnd - j }, (_, k) => chunkIndices.indexOf(j + k));

          const chunkData = await fetchOsrmTableChunk(subCoords, srcSubIndices, dstSubIndices);
          if (chunkData) {
            for (let r = 0; r < srcSubIndices.length; r++) {
              for (let c = 0; c < dstSubIndices.length; c++) {
                const origR = i + r;
                const origC = j + c;
                osrmKm[origR][origC] = Math.round((chunkData.distances[r][c] / 1000) * 100) / 100;
                osrmMin[origR][origC] = Math.max(1, Math.round(chunkData.durations[r][c] / 60));
              }
            }
          } else {
            allChunksSuccess = false;
          }
        }
      }

      if (!allChunksSuccess) {
        osrmKm = null;
        osrmMin = null;
      }
    }
  } catch {
    osrmKm = null;
    osrmMin = null;
  }

  // 3. Fallback if OSRM failed
  if (!osrmKm || !osrmMin) {
    const fallback = buildFallbackMatrix(cleanCoords, cfg?.truckSpeedKmh || DEFAULT_SPEED_KMH);
    setCachedMatrix(hash, { km: fallback.km, min: fallback.min, source: 'fallback' });
    return wrapMatrixResult(fallback.km, fallback.min, 'fallback', pointKeys, pointKeyIndex, cfg);
  }

  // Cache OSRM result
  setCachedMatrix(hash, { km: osrmKm, min: osrmMin, source: 'osrm' });
  return wrapMatrixResult(osrmKm, osrmMin, 'osrm', pointKeys, pointKeyIndex, cfg);
}

/**
 * Creates the accessor functions and metadata for DistanceMatrixResult.
 */
function wrapMatrixResult(
  km: number[][],
  min: number[][],
  source: 'osrm' | 'fallback',
  pointKeys: string[],
  pointKeyIndex: Map<string, number>,
  cfg?: SystemConfig
): DistanceMatrixResult {
  const getDist = (
    p1: Bin | Depot | { lat?: number; lng?: number; id?: string | number },
    p2: Bin | Depot | { lat?: number; lng?: number; id?: string | number }
  ): number => {
    if (!p1 || !p2) return 0;
    if (p1 === p2) return 0;
    if ('id' in p1 && 'id' in p2 && p1.id === p2.id) return 0;

    let idx1: number | undefined;
    let idx2: number | undefined;

    if ('id' in p1 && p1.id !== undefined && pointKeyIndex.has(String(p1.id))) {
      idx1 = pointKeyIndex.get(String(p1.id));
    }
    if ('id' in p2 && p2.id !== undefined && pointKeyIndex.has(String(p2.id))) {
      idx2 = pointKeyIndex.get(String(p2.id));
    }

    if (idx1 === undefined && isValidCoordinate(p1.lat, p1.lng)) {
      idx1 = pointKeyIndex.get(getCoordKey(p1.lat as number, p1.lng as number));
    }
    if (idx2 === undefined && isValidCoordinate(p2.lat, p2.lng)) {
      idx2 = pointKeyIndex.get(getCoordKey(p2.lat as number, p2.lng as number));
    }

    if (idx1 !== undefined && idx2 !== undefined && km[idx1] && km[idx1][idx2] !== undefined) {
      return km[idx1][idx2];
    }

    // Dynamic point not in precomputed matrix: fallback to haversine road distance
    if (isValidCoordinate(p1.lat, p1.lng) && isValidCoordinate(p2.lat, p2.lng)) {
      return haversineRoadDistance(p1.lat as number, p1.lng as number, p2.lat as number, p2.lng as number);
    }

    return 0;
  };

  const getTimeMin = (
    p1: Bin | Depot | { lat?: number; lng?: number; id?: string | number },
    p2: Bin | Depot | { lat?: number; lng?: number; id?: string | number }
  ): number => {
    const dist = getDist(p1, p2);
    const speed = cfg?.truckSpeedKmh || DEFAULT_SPEED_KMH;
    return Math.max(1, Math.round((dist / speed) * 60));
  };

  return {
    km,
    min,
    source,
    pointKeys,
    pointKeyIndex,
    timestamp: Date.now(),
    getDist,
    getTimeMin,
  };
}
