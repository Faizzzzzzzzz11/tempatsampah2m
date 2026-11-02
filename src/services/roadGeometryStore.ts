import { Bin, Depot } from '../types';
import { GODEAN_ROAD_NODES, RoadNode } from '../data/godeanData';
import { getBinLatLng } from './coordinateUtils';

export type GeometrySource = 'osrm' | 'fallback';
export type GeometryStatus = 'idle' | 'loading' | 'ok' | 'failed';

export interface RoadGeometryEntry {
  coords: [number, number][];
  source: GeometrySource;
  fetchedAt: number;
  status: GeometryStatus;
  error?: string;
  realDistanceKm?: string;
}

const MAX_CONCURRENT_REQUESTS = 2;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES_PER_ENDPOINT = 2;

const ENDPOINTS = [
  'https://router.project-osrm.org/route/v1/driving',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
];

/**
 * Generate a cache key strictly based on the sequence of coordinates in the tour.
 * Rounds to 5 decimal places (~1.1m precision). Completely independent of tripIndex.
 */
export function generateTourKey(tour: (Bin | Depot | { lat?: number; lng?: number })[]): string {
  if (!tour || tour.length < 2) return '';
  return tour
    .map(pt => {
      const [lat, lng] = getBinLatLng(pt);
      return `${lng.toFixed(5)},${lat.toFixed(5)}`;
    })
    .join(';');
}

// -------------------------------------------------------------
// LOCAL GODEAN ROAD NETWORK PATHFINDER (FALLBACK GEOMETRY)
// -------------------------------------------------------------

function findNearestRoadNode(lat: number, lng: number): RoadNode {
  let bestNode: RoadNode = Object.values(GODEAN_ROAD_NODES)[0];
  let minD = Infinity;

  for (const node of Object.values(GODEAN_ROAD_NODES)) {
    const d = Math.hypot(node.lat - lat, (node.lng - lng) * Math.cos((lat * Math.PI) / 180));
    if (d < minD) {
      minD = d;
      bestNode = node;
    }
  }
  return bestNode;
}

function findRoadGraphPath(startNodeId: string, endNodeId: string): [number, number][] {
  if (startNodeId === endNodeId) {
    const node = GODEAN_ROAD_NODES[startNodeId];
    return [[node.lat, node.lng]];
  }

  const queue: string[] = [startNodeId];
  const visited = new Set<string>([startNodeId]);
  const parent = new Map<string, string>();

  let found = false;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === endNodeId) {
      found = true;
      break;
    }

    const neighbors = GODEAN_ROAD_NODES[curr]?.neighbors || [];
    for (const n of neighbors) {
      if (!visited.has(n) && GODEAN_ROAD_NODES[n]) {
        visited.add(n);
        parent.set(n, curr);
        queue.push(n);
      }
    }
  }

  if (!found) {
    const n1 = GODEAN_ROAD_NODES[startNodeId];
    const n2 = GODEAN_ROAD_NODES[endNodeId];
    return [[n1.lat, n1.lng], [n2.lat, n2.lng]];
  }

  const path: [number, number][] = [];
  let curr = endNodeId;
  while (curr) {
    const node = GODEAN_ROAD_NODES[curr];
    path.push([node.lat, node.lng]);
    curr = parent.get(curr)!;
  }
  return path.reverse();
}

export function getRoadAwareStreetPath(
  p1: Bin | Depot | { lat?: number; lng?: number },
  p2: Bin | Depot | { lat?: number; lng?: number }
): [number, number][] {
  const pt1 = getBinLatLng(p1);
  const pt2 = getBinLatLng(p2);

  const n1 = findNearestRoadNode(pt1[0], pt1[1]);
  const n2 = findNearestRoadNode(pt2[0], pt2[1]);

  const path: [number, number][] = [pt1];

  if (n1.id === n2.id) {
    const JALAN_GODEAN_LAT = -7.768;
    if (Math.abs(pt1[0] - pt2[0]) > 0.002 && Math.abs(pt1[1] - pt2[1]) > 0.002) {
      path.push([JALAN_GODEAN_LAT, pt1[1]]);
      path.push([JALAN_GODEAN_LAT, pt2[1]]);
    } else {
      path.push([pt1[0], pt2[1]]);
    }
    path.push(pt2);
    return path;
  }

  const graphNodes = findRoadGraphPath(n1.id, n2.id);

  if (Math.hypot(pt1[0] - n1.lat, pt1[1] - n1.lng) > 0.0003) {
    path.push([pt1[0], n1.lng]);
    path.push([n1.lat, n1.lng]);
  } else {
    path.push([n1.lat, n1.lng]);
  }

  for (let i = 1; i < graphNodes.length - 1; i++) {
    path.push(graphNodes[i]);
  }

  if (Math.hypot(pt2[0] - n2.lat, pt2[1] - n2.lng) > 0.0003) {
    path.push([n2.lat, n2.lng]);
    path.push([n2.lat, pt2[1]]);
  } else {
    path.push([n2.lat, n2.lng]);
  }

  path.push(pt2);
  return path;
}

export function buildRoadNetworkTour(tour: (Bin | Depot | { lat?: number; lng?: number })[]): [number, number][] {
  if (!tour || tour.length < 2) return [];

  const fullCoords: [number, number][] = [];
  for (let i = 0; i < tour.length - 1; i++) {
    const legCoords = getRoadAwareStreetPath(tour[i], tour[i + 1]);
    for (let j = 0; j < legCoords.length; j++) {
      if (
        fullCoords.length === 0 ||
        fullCoords[fullCoords.length - 1][0] !== legCoords[j][0] ||
        fullCoords[fullCoords.length - 1][1] !== legCoords[j][1]
      ) {
        fullCoords.push(legCoords[j]);
      }
    }
  }
  return fullCoords;
}

// -------------------------------------------------------------
// OSRM NETWORK FETCHER WITH CONCURRENCY, TIMEOUT & RETRY
// -------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RequestQueue {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= MAX_CONCURRENT_REQUESTS) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }

  get active(): number {
    return this.activeCount;
  }

  get waiting(): number {
    return this.queue.length;
  }
}

async function fetchOsrmGeometry(coordsStr: string): Promise<{ coords: [number, number][]; distanceKm: string }> {
  let lastError: Error | null = null;

  for (const baseEndpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_ENDPOINT; attempt++) {
      const url = `${baseEndpoint}/${coordsStr}?overview=full&geometries=geojson&continue_straight=false`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}`);
          if (attempt < MAX_RETRIES_PER_ENDPOINT) {
            await sleep(attempt * 500);
          }
          continue;
        }

        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          const distanceKm = route.distance ? (route.distance / 1000).toFixed(1) : '';
          return { coords, distanceKm };
        } else {
          lastError = new Error(data.message || 'No valid route returned by OSRM');
        }
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        if (attempt < MAX_RETRIES_PER_ENDPOINT) {
          await sleep(attempt * 500);
        }
      }
    }
  }

  throw lastError || new Error('Failed to fetch from all OSRM endpoints');
}

// -------------------------------------------------------------
// CENTRALIZED ROAD GEOMETRY STORE
// -------------------------------------------------------------

export class RoadGeometryStore {
  private entries = new Map<string, RoadGeometryEntry>();
  private listeners = new Set<() => void>();
  private queue = new RequestQueue();
  private inFlight = new Map<string, Promise<RoadGeometryEntry>>();
  private version = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  notify = (): void => {
    this.version++;
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error('RoadGeometryStore listener error:', e);
      }
    });
  };

  getSnapshot = (): number => {
    return this.version;
  };

  getEntry(key: string): RoadGeometryEntry | undefined {
    return this.entries.get(key);
  }

  setEntry(key: string, entry: RoadGeometryEntry): void {
    this.entries.set(key, entry);
    this.notify();
  }

  hasEntry(key: string): boolean {
    return this.entries.has(key);
  }

  clear(): void {
    this.entries.clear();
    this.notify();
  }

  /**
   * Retrieves geometry entry synchronously. If not yet cached, initializes with
   * local synthetic road graph and initiates asynchronous OSRM fetch if autoFetch is true.
   */
  getTourGeometry(tour: (Bin | Depot | { lat?: number; lng?: number })[], autoFetch = true): RoadGeometryEntry {
    if (!tour || tour.length < 2) {
      return {
        coords: [],
        source: 'fallback',
        fetchedAt: 0,
        status: 'idle',
      };
    }

    const key = generateTourKey(tour);
    const existing = this.entries.get(key);
    if (existing) {
      return existing;
    }

    const fallbackCoords = buildRoadNetworkTour(tour);
    const initialEntry: RoadGeometryEntry = {
      coords: fallbackCoords,
      source: 'fallback',
      fetchedAt: 0,
      status: 'idle',
    };
    this.entries.set(key, initialEntry);

    if (autoFetch) {
      this.fetchTourGeometry(tour, false).catch(() => {});
    }

    return initialEntry;
  }

  /**
   * Fetches OSRM real road coordinates.
   * If forceRefresh is true, marks entry as 'loading' without destroying previous valid coordinates.
   */
  async fetchTourGeometry(
    tour: (Bin | Depot | { lat?: number; lng?: number })[],
    forceRefresh = false
  ): Promise<RoadGeometryEntry> {
    if (!tour || tour.length < 2) {
      return {
        coords: [],
        source: 'fallback',
        fetchedAt: 0,
        status: 'idle',
      };
    }

    const key = generateTourKey(tour);
    const existing = this.entries.get(key);

    if (!forceRefresh && existing) {
      if (existing.status === 'ok' || existing.status === 'failed') {
        return existing;
      }
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    // Preserve previous coordinates during loading to avoid straight-line flicker
    const oldCoords =
      existing?.coords && existing.coords.length > 0 ? existing.coords : buildRoadNetworkTour(tour);
    const oldSource = existing?.source || 'fallback';

    this.entries.set(key, {
      coords: oldCoords,
      source: oldSource,
      fetchedAt: Date.now(),
      status: 'loading',
      realDistanceKm: existing?.realDistanceKm,
    });
    this.notify();

    const fetchPromise = this.queue.run(async () => {
      try {
        const result = await fetchOsrmGeometry(key);
        const newEntry: RoadGeometryEntry = {
          coords: result.coords,
          source: 'osrm',
          fetchedAt: Date.now(),
          status: 'ok',
          realDistanceKm: result.distanceKm,
        };
        this.entries.set(key, newEntry);
        this.notify();
        return newEntry;
      } catch (err: any) {
        // Crucial: keep old coordinates, DO NOT save failure as success!
        const failedEntry: RoadGeometryEntry = {
          coords: oldCoords,
          source: oldSource,
          fetchedAt: Date.now(),
          status: 'failed',
          error: err?.message || 'OSRM request failed',
          realDistanceKm: existing?.realDistanceKm,
        };
        this.entries.set(key, failedEntry);
        this.notify();
        return failedEntry;
      } finally {
        this.inFlight.delete(key);
      }
    });

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Refreshes real road geometry for an array of tours.
   */
  async refreshTourGeometries(
    tours: (Bin | Depot | { lat?: number; lng?: number })[][]
  ): Promise<RoadGeometryEntry[]> {
    return Promise.all(tours.map(t => this.fetchTourGeometry(t, true)));
  }

  isLoading(): boolean {
    for (const entry of this.entries.values()) {
      if (entry.status === 'loading') return true;
    }
    return false;
  }

  isTourLoading(tour: (Bin | Depot | { lat?: number; lng?: number })[]): boolean {
    const key = generateTourKey(tour);
    return this.entries.get(key)?.status === 'loading';
  }

  resetForTesting(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.version = 0;
    this.notify();
  }
}

export const roadGeometryStore = new RoadGeometryStore();

