import { Bin, Depot, ExecutionResult, SystemConfig, Trip, YellowEvaluation, AnimWaypoint } from '../types';
import { GODEAN_ROAD_NODES, RoadNode } from '../data/godeanData';
import {
  isValidCoordinate,
  getBinLatLng,
  gridToLatLng,
  latLngToGrid,
  calculateBearingRad,
} from './coordinateUtils';
import {
  DistanceMatrixResult,
  DistanceFn,
  haversineDistance,
  haversineRoadDistance,
  HAVERSINE_ROAD_FACTOR,
} from './distanceMatrix';
import {
  roadGeometryStore,
  RoadGeometryEntry,
  GeometrySource,
  GeometryStatus,
  generateTourKey,
  buildRoadNetworkTour,
  getRoadAwareStreetPath,
} from './roadGeometryStore';

// Re-export coordinate utilities & road geometry store for seamless project-wide compatibility
export {
  isValidCoordinate,
  getBinLatLng,
  gridToLatLng,
  latLngToGrid,
  calculateBearingRad,
  HAVERSINE_ROAD_FACTOR,
  roadGeometryStore,
  generateTourKey,
  buildRoadNetworkTour,
  getRoadAwareStreetPath,
};
export type { RoadGeometryEntry, GeometrySource, GeometryStatus };

// Cache for TSP tours
const tourCache = new Map<string, { tour: (Bin | Depot)[]; distance: number }>();

// Backwards-compatible tripRouteCache bridge backed by roadGeometryStore
export const tripRouteCache = {
  get(key: string): [number, number][] | undefined {
    return roadGeometryStore.getEntry(key)?.coords;
  },
  has(key: string): boolean {
    return roadGeometryStore.hasEntry(key);
  },
  set(key: string, coords: [number, number][]): void {
    roadGeometryStore.setEntry(key, {
      coords,
      source: 'osrm',
      fetchedAt: Date.now(),
      status: 'ok',
    });
  },
  clear(): void {
    roadGeometryStore.clear();
  },
};
const tripRoutePending = new Set<string>();

export function litersOf(b: Bin | { fill?: number }, cfg: SystemConfig): number {
  return Math.round(((b.fill || 0) * (cfg.binCap || 100)) / 100);
}

/**
 * Synchronous legacy Manhattan fallback distance between two points.
 * Used only as emergency fallback when no precomputed matrix or GPS is available.
 */
export function manhattanDist(
  p1: Bin | Depot | { lat?: number; lng?: number; x?: number; y?: number },
  p2: Bin | Depot | { lat?: number; lng?: number; x?: number; y?: number },
  cfg?: SystemConfig
): number {
  try {
    const [lat1, lng1] = getBinLatLng(p1);
    const [lat2, lng2] = getBinLatLng(p2);
    const dLat = Math.abs(lat1 - lat2) * 111.0; // km
    const dLng = Math.abs(lng1 - lng2) * 110.0; // km
    return Math.round((dLat + dLng) * 1.25 * 100) / 100;
  } catch {
    // If invalid coordinates, fallback to grid if present
    const gx1 = 'x' in p1 && typeof p1.x === 'number' ? p1.x : 1;
    const gy1 = 'y' in p1 && typeof p1.y === 'number' ? p1.y : 1;
    const gx2 = 'x' in p2 && typeof p2.x === 'number' ? p2.x : 1;
    const gy2 = 'y' in p2 && typeof p2.y === 'number' ? p2.y : 1;
    const gridDist = Math.abs(gx1 - gx2) + Math.abs(gy1 - gy2);
    const kmPerGrid = cfg?.kmPerGridUnit || 0.45;
    return Math.round(gridDist * kmPerGrid * 100) / 100;
  }
}

/**
 * Resolves a unified DistanceFn from either a DistanceMatrixResult, an existing DistanceFn,
 * or defaults to Haversine * 1.3 road distance.
 */
export function resolveDistanceFn(
  distMatrixOrFn?: DistanceMatrixResult | DistanceFn | null,
  cfg?: SystemConfig
): DistanceFn {
  if (typeof distMatrixOrFn === 'function') {
    return distMatrixOrFn;
  }
  if (distMatrixOrFn && typeof distMatrixOrFn === 'object' && typeof distMatrixOrFn.getDist === 'function') {
    return distMatrixOrFn.getDist;
  }
  return (a, b) => {
    try {
      const [lat1, lng1] = getBinLatLng(a);
      const [lat2, lng2] = getBinLatLng(b);
      return haversineRoadDistance(lat1, lng1, lat2, lng2);
    } catch {
      return manhattanDist(a, b, cfg);
    }
  };
}

export function toRealKm(units: number): string {
  const val = typeof units === 'number' ? units : Number(units) || 0;
  return val.toFixed(1);
}

export function toTravelMinutes(units: number, cfg: SystemConfig): number {
  const km = typeof units === 'number' ? units : Number(units) || 0;
  const speed = cfg.truckSpeedKmh || 30;
  return Math.max(1, Math.round((km / speed) * 60));
}

export function toFuelLiters(units: number, cfg: SystemConfig): string {
  const km = typeof units === 'number' ? units : Number(units) || 0;
  return (km * (cfg.fuelPerKm || 0.22)).toFixed(1);
}

export function calculateTourDistance(
  tour: (Bin | Depot)[],
  cfg?: SystemConfig,
  distFn?: DistanceFn
): number {
  const D = distFn || resolveDistanceFn(null, cfg);
  let dist = 0;
  for (let i = 0; i < tour.length - 1; i++) {
    dist += D(tour[i], tour[i + 1]);
  }
  return Math.round(dist * 100) / 100;
}

/**
 * Calculates exact real road distance along a polyline coordinate array using Haversine formula.
 * Synchronized with true GIS road centerlines (same as Google Maps & OSRM driving distances).
 */
export function calculatePolylineDistanceKm(coords: [number, number][]): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return Math.round(total * 10) / 10;
}

export function getMinDistToTourPath(
  point: Bin,
  tour: (Bin | Depot)[],
  depot: Depot,
  cfg?: SystemConfig,
  distFn?: DistanceFn
): number {
  const D = distFn || resolveDistanceFn(null, cfg);
  if (!tour || tour.length < 2) return D(point, depot);
  const pLL = getBinLatLng(point);
  let minDist = Infinity;

  for (let i = 0; i < tour.length - 1; i++) {
    const ll1 = getBinLatLng(tour[i]);
    const ll2 = getBinLatLng(tour[i + 1]);
    const dy = ll2[0] - ll1[0];
    const dx = ll2[1] - ll1[1];
    const lenSq = dy * dy + dx * dx;

    let closestLat = ll1[0];
    let closestLng = ll1[1];
    if (lenSq > 0) {
      const t = Math.max(0, Math.min(1, ((pLL[0] - ll1[0]) * dy + (pLL[1] - ll1[1]) * dx) / lenSq));
      closestLat = ll1[0] + dy * t;
      closestLng = ll1[1] + dx * t;
    }
    const d = D(point, { lat: closestLat, lng: closestLng });
    if (d < minDist) minDist = d;
  }
  return Math.round(minDist * 100) / 100;
}

// -------------------------------------------------------------
// CENTRALIZED ROAD GEOMETRY DELEGATES
// -------------------------------------------------------------

export function getTripRoadCoords(
  trip: Trip,
  onRouteReady?: (coords: [number, number][], distanceKm: string) => void
): [number, number][] {
  const tour = trip.tour || [];
  if (tour.length < 2) return [];

  const entry = roadGeometryStore.getTourGeometry(tour, true);
  if (entry.status === 'ok' && onRouteReady) {
    onRouteReady(entry.coords, entry.realDistanceKm || toRealKm(trip.distance));
  }
  return entry.coords;
}

export async function fetchTripRouteWithRetry(
  trip: Trip,
  onRouteReady?: (coords: [number, number][], distanceKm: string) => void
): Promise<[number, number][]> {
  const tour = trip.tour || [];
  if (tour.length < 2) return [];

  const entry = await roadGeometryStore.fetchTourGeometry(tour, false);
  if (entry.status === 'ok' && onRouteReady) {
    onRouteReady(entry.coords, entry.realDistanceKm || toRealKm(trip.distance));
  }
  return entry.coords;
}


export function interpolateRoadPoints(coords: [number, number][], maxStep = 0.00025): [number, number][] {
  if (!coords || coords.length === 0) return [];
  const result: [number, number][] = [coords[0]];

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const dLat = p2[0] - p1[0];
    const dLng = p2[1] - p1[1];
    const dist = Math.hypot(dLat, dLng);
    const steps = Math.max(1, Math.ceil(dist / maxStep));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      result.push([p1[0] + dLat * t, p1[1] + dLng * t]);
    }
  }
  return result;
}

export function buildAnimationPath(trips: Trip[]): AnimWaypoint[] {
  if (!trips || trips.length === 0) return [];

  const animPath: AnimWaypoint[] = [];

  trips.forEach(trip => {
    const tour = trip.tour || [];
    if (tour.length < 2) return;

    const roadCoords = getTripRoadCoords(trip);
    if (!roadCoords || roadCoords.length === 0) return;

    const smoothCoords = interpolateRoadPoints(roadCoords, 0.00018);

    const stopPoints: { bin: Bin | Depot; idx: number }[] = [];
    tour.forEach(bin => {
      const bLL = getBinLatLng(bin);
      let closestIdx = 0;
      let minDist = Infinity;
      smoothCoords.forEach((pt, pIdx) => {
        const d = Math.hypot(pt[0] - bLL[0], pt[1] - bLL[1]);
        if (d < minDist) {
          minDist = d;
          closestIdx = pIdx;
        }
      });
      stopPoints.push({ bin, idx: closestIdx });
    });

    smoothCoords.forEach((pt, pIdx) => {
      const matchedStop = stopPoints.find(sp => sp.idx === pIdx);
      const nextStop = stopPoints.find(sp => sp.idx >= pIdx) || stopPoints[stopPoints.length - 1];

      let bearing = animPath.length > 0 ? animPath[animPath.length - 1].bearing || 0 : 0;
      const lookAheadIdx = Math.min(smoothCoords.length - 1, pIdx + 2);
      const nextPt = smoothCoords[lookAheadIdx];
      const dLat = nextPt[0] - pt[0];
      const dLng = nextPt[1] - pt[1];
      if (Math.hypot(dLat, dLng) > 0.000005) {
        bearing = Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI);
        if (bearing < 0) bearing += 360;
      }

      animPath.push({
        lat: pt[0],
        lng: pt[1],
        tripIndex: trip.tripIndex,
        targetBin: nextStop ? nextStop.bin : tour[tour.length - 1],
        isStop: !!matchedStop,
        stopBin: matchedStop ? matchedStop.bin : null,
        bearing,
      });
    });
  });

  return animPath;
}

// -------------------------------------------------------------
// TSP SOLVER (HELD-KARP EXACT DP & 2-OPT / OR-OPT HEURISTICS)
// -------------------------------------------------------------

const EXACT_TSP_LIMIT = 12;
const EXACT_TSP_FINAL_LIMIT = 12;
const EXACT_TSP_SELECT_LIMIT = 12;

function tourCacheKey(list: Bin[], depot: Depot, tag = ''): string {
  const dptKey = `${depot.lat.toFixed(5)},${depot.lng.toFixed(5)}`;
  return (
    dptKey +
    '|' +
    tag +
    '|' +
    list
      .map(b => `${b.id}:${b.lat.toFixed(5)},${b.lng.toFixed(5)}`)
      .sort()
      .join(';')
  );
}

export function exactTourOrder(
  nodes: Bin[],
  depot: Depot,
  cfg?: SystemConfig,
  distFn?: DistanceFn
): Bin[] {
  const D = distFn || resolveDistanceFn(null, cfg);
  const n = nodes.length;
  const FULL = 1 << n;
  const INF = 1e9;
  const dDepot = nodes.map(b => D(depot, b));
  const d = nodes.map(a => nodes.map(b => D(a, b)));

  const dp = new Float64Array(FULL * n).fill(INF);
  const par = new Int8Array(FULL * n).fill(-1);

  for (let i = 0; i < n; i++) dp[(1 << i) * n + i] = dDepot[i];

  for (let mask = 1; mask < FULL; mask++) {
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last))) continue;
      const cur = dp[mask * n + last];
      if (cur >= INF) continue;
      for (let nxt = 0; nxt < n; nxt++) {
        if (mask & (1 << nxt)) continue;
        const nm = mask | (1 << nxt);
        const v = cur + d[last][nxt];
        if (v < dp[nm * n + nxt]) {
          dp[nm * n + nxt] = v;
          par[nm * n + nxt] = last;
        }
      }
    }
  }

  let bestLast = 0;
  let best = INF;
  for (let last = 0; last < n; last++) {
    const v = dp[(FULL - 1) * n + last] + dDepot[last];
    if (v < best) {
      best = v;
      bestLast = last;
    }
  }

  const order: Bin[] = [];
  let mask = FULL - 1;
  let last = bestLast;
  while (last !== -1) {
    order.push(nodes[last]);
    const p = par[mask * n + last];
    mask ^= 1 << last;
    last = p;
  }
  const res = order.reverse();

  // Normalize direction: closed-loop TSP is symmetric
  if (res.length >= 2) {
    const dFirst = D(depot, res[0]);
    const dLast = D(depot, res[res.length - 1]);
    if (dLast < dFirst) {
      res.reverse();
    }
  }
  return res;
}

export function improveOrder(
  order: Bin[],
  depot: Depot,
  cfg?: SystemConfig,
  distFn?: DistanceFn
): Bin[] {
  const D = distFn || resolveDistanceFn(null, cfg);
  const n = order.length;

  function applyOneMove(): boolean {
    // 2-opt
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const a = i === 0 ? depot : order[i - 1];
        const e = k === n - 1 ? depot : order[k + 1];
        if (D(a, order[k]) + D(order[i], e) < D(a, order[i]) + D(order[k], e)) {
          order = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
          return true;
        }
      }
    }
    // Or-opt
    for (let len = 1; len <= 3 && len < n; len++) {
      for (let i = 0; i + len <= n; i++) {
        const seg = order.slice(i, i + len);
        const rest = [...order.slice(0, i), ...order.slice(i + len)];
        const prev = i === 0 ? depot : order[i - 1];
        const next = i + len === n ? depot : order[i + len];
        const gain = D(prev, seg[0]) + D(seg[len - 1], next) - D(prev, next);
        for (let j = 0; j <= rest.length; j++) {
          if (j === i) continue;
          const p = j === 0 ? depot : rest[j - 1];
          const q = j === rest.length ? depot : rest[j];
          for (let rev = 0; rev < 2; rev++) {
            const s0 = rev ? seg[len - 1] : seg[0];
            const s1 = rev ? seg[0] : seg[len - 1];
            if (D(p, s0) + D(s1, q) - D(p, q) < gain) {
              const ins = rev ? [...seg].reverse() : seg;
              order = [...rest.slice(0, j), ...ins, ...rest.slice(j)];
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  let guard = 0;
  while (guard++ < 30 && applyOneMove()) {
    // iterate until stable
  }
  return order;
}

export function heuristicTourOrder(
  binList: Bin[],
  depot: Depot,
  cfg?: SystemConfig,
  distFn?: DistanceFn
): Bin[] {
  const D = distFn || resolveDistanceFn(null, cfg);
  let best: Bin[] | null = null;
  let bestDist = Infinity;
  const byNear = [...binList].sort((a, b) => D(depot, a) - D(depot, b));
  const byFar = [...binList].sort((a, b) => D(depot, b) - D(depot, a));
  const seeds = [null, ...byNear.slice(0, 4), ...byFar.slice(0, 3)];

  seeds.forEach(seed => {
    let unvisited = [...binList];
    const ordered: Bin[] = [];
    let current: Bin | Depot = depot;
    if (seed) {
      ordered.push(seed);
      unvisited = unvisited.filter(b => b.id !== seed.id);
      current = seed;
    }
    while (unvisited.length > 0) {
      let idx = 0;
      let md = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const dd = D(current, unvisited[i]);
        if (dd < md) {
          md = dd;
          idx = i;
        }
      }
      current = unvisited[idx];
      ordered.push(current);
      unvisited.splice(idx, 1);
    }
    const improved = improveOrder(ordered, depot, cfg, D);
    const dist = calculateTourDistance([depot, ...improved, depot], cfg, D);
    if (dist < bestDist) {
      bestDist = dist;
      best = improved;
    }
  });

  if (best) {
    const bestArr: Bin[] = best;
    if (bestArr.length >= 2) {
      const dFirst = D(depot, bestArr[0]);
      const dLast = D(depot, bestArr[bestArr.length - 1]);
      if (dLast < dFirst) {
        best = [...bestArr].reverse();
      }
    }
  }
  return best || binList;
}

export function findShortestTourForBins(
  binList: Bin[],
  depot: Depot,
  cfg: SystemConfig,
  exactLimit = EXACT_TSP_LIMIT,
  distFn?: DistanceFn
): { tour: (Bin | Depot)[]; distance: number } {
  const D = distFn || resolveDistanceFn(null, cfg);
  if (!binList || binList.length === 0) return { tour: [depot], distance: 0 };
  if (binList.length === 1) {
    return {
      tour: [depot, binList[0], depot],
      distance: Math.round(D(depot, binList[0]) * 2 * 100) / 100,
    };
  }

  const useExact = binList.length <= exactLimit;
  const key = tourCacheKey(binList, depot, useExact ? 'E' : 'H');
  const hit = tourCache.get(key);
  if (hit) return hit;

  let order = useExact
    ? exactTourOrder(binList, depot, cfg, D)
    : heuristicTourOrder(binList, depot, cfg, D);

  if (order && order.length >= 2) {
    const dFirst = D(depot, order[0]);
    const dLast = D(depot, order[order.length - 1]);
    if (dLast < dFirst) {
      order = order.reverse();
    }
  }

  const tour = [depot, ...order, depot];
  const res = { tour, distance: calculateTourDistance(tour, cfg, D) };
  if (tourCache.size > 5000) tourCache.clear();
  tourCache.set(key, res);
  return res;
}

export function optimizePartition(
  groups: Bin[][],
  depot: Depot,
  cfg: SystemConfig,
  keepCount = false,
  distFn?: DistanceFn
): Bin[][] {
  const D = distFn || resolveDistanceFn(null, cfg);
  let gList = groups.map(g => [...g]);
  const C = cfg.C || 1000;

  function groupsDistance(gs: Bin[][]) {
    return gs.reduce(
      (s, g) => (g.length ? s + findShortestTourForBins(g, depot, cfg, EXACT_TSP_LIMIT, D).distance : s),
      0
    );
  }

  function groupLoad(g: Bin[]) {
    return g.reduce((s, b) => s + litersOf(b, cfg), 0);
  }

  function tryImprove(): boolean {
    for (let gi = 0; gi < gList.length; gi++) {
      for (let bi = 0; bi < gList[gi].length; bi++) {
        const b = gList[gi][bi];
        const withoutB = gList[gi].filter(x => x !== b);
        for (let gj = 0; gj < gList.length; gj++) {
          if (gj === gi) continue;
          if (groupLoad(gList[gj]) + litersOf(b, cfg) <= C && !(keepCount && withoutB.length === 0)) {
            const before = groupsDistance([gList[gi], gList[gj]]);
            const after = groupsDistance([withoutB, [...gList[gj], b]]);
            if (after < before) {
              gList[gi] = withoutB;
              gList[gj] = [...gList[gj], b];
              return true;
            }
          }
          if (gj > gi) {
            for (let bj = 0; bj < gList[gj].length; bj++) {
              const o = gList[gj][bj];
              const newI = [...withoutB, o];
              const newJ = [...gList[gj].filter(x => x !== o), b];
              if (groupLoad(newI) > C || groupLoad(newJ) > C) continue;
              const before = groupsDistance([gList[gi], gList[gj]]);
              const after = groupsDistance([newI, newJ]);
              if (after < before) {
                gList[gi] = newI;
                gList[gj] = newJ;
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  let guard = 0;
  while (guard++ < 15 && tryImprove()) {
    // optimize iteratively
  }
  return gList.filter(g => g.length > 0);
}

export function buildTripsFromGroups(
  groups: Bin[][],
  depot: Depot,
  cfg: SystemConfig,
  distFn?: DistanceFn
): Trip[] {
  const D = distFn || resolveDistanceFn(null, cfg);
  return groups
    .map(g => {
      let t = findShortestTourForBins(g, depot, cfg, EXACT_TSP_LIMIT, D);
      if (g.length > EXACT_TSP_LIMIT && g.length <= EXACT_TSP_FINAL_LIMIT) {
        const tour = [depot, ...exactTourOrder(g, depot, cfg, D), depot];
        const distance = calculateTourDistance(tour, cfg, D);
        if (distance < t.distance) t = { tour, distance };
      }
      const orderedBins = t.tour.filter(pt => typeof pt.id === 'number') as Bin[];
      return {
        bins: orderedBins.length === g.length ? orderedBins : g,
        loadLiter: g.reduce((s, b) => s + litersOf(b, cfg), 0),
        tour: t.tour,
        distance: t.distance,
      };
    })
    .sort((a, b) => b.loadLiter - a.loadLiter || a.distance - b.distance)
    .map((t, i) => ({ tripIndex: i + 1, ...t }));
}

// -------------------------------------------------------------
// STEP-BY-STEP FLOWCHART EXECUTION ENGINE
// -------------------------------------------------------------

export function runFlowchartLogic(
  bins: Bin[],
  depot: Depot,
  cfg: SystemConfig,
  manualSplitMode: 'auto' | number = 'auto',
  distMatrixOrFn?: DistanceMatrixResult | DistanceFn | null
): ExecutionResult {
  const D = resolveDistanceFn(distMatrixOrFn, cfg);
  const distanceSource: 'osrm' | 'fallback' =
    distMatrixOrFn && typeof distMatrixOrFn === 'object' && 'source' in distMatrixOrFn
      ? distMatrixOrFn.source
      : 'fallback';

  const allBins = bins.map(b => ({ ...b }));

  // Step 1 & 2: Status classification
  allBins.forEach(b => {
    if (b.noData) b.status = 'gray';
    else if (b.fill >= cfg.redLimit) b.status = 'red';
    else if (b.fill >= cfg.yellowLimit) b.status = 'yellow';
    else b.status = 'green';
    b.detour = 0;
    b.isAccepted = false;
    b.pickedGreen = false;
    b.evalReason = '';
  });

  const redBins = allBins.filter(b => b.status === 'red');
  const yellowBins = allBins.filter(b => b.status === 'yellow');
  const greenBins = allBins.filter(b => b.status === 'green');

  // Case 1: No red bins, truck stays parked
  if (redBins.length === 0) {
    yellowBins.forEach(yb => {
      yb.isAccepted = false;
      yb.evalReason = 'Tidak ada tong merah sama sekali, truk parkir.';
    });
    return {
      redBins,
      yellowBins,
      greenBins,
      pickedGreenBins: [],
      acceptedYellowBins: [],
      rejectedYellowBins: yellowBins,
      yellowEvaluations: [],
      selectedBins: [],
      totalLiter: 0,
      tripCount: 0,
      trips: [],
      totalDistance: 0,
      baseRedDist: 0,
      distanceSource,
      statusMessage: 'Truk belum perlu berangkat (tidak ada tong merah).'
    };
  }

  // Base tour of red bins (RUTE ASLI)
  const baseRedTourResult = findShortestTourForBins(redBins, depot, cfg, EXACT_TSP_SELECT_LIMIT, D);
  const originalRedDist = baseRedTourResult.distance;
  const originalRedTour = baseRedTourResult.tour;

  // Step 3: Yellow bin detour evaluation
  const yellowEvaluations: YellowEvaluation[] = [];
  const eligibleYellowCandidates: YellowEvaluation[] = [];
  const maxDetour = cfg.maxYellowDetourKm || cfg.maxYellowDetour * (cfg.kmPerGridUnit || 0.45);

  yellowBins.forEach(yBin => {
    const tourWithY = findShortestTourForBins([...redBins, yBin], depot, cfg, EXACT_TSP_SELECT_LIMIT, D);
    const extraDistance = Math.max(0, tourWithY.distance - originalRedDist);
    const distToPath = getMinDistToTourPath(yBin, originalRedTour, depot, cfg, D);

    const evalItem: YellowEvaluation = {
      bin: yBin,
      extraDistance: Math.round(extraDistance * 100) / 100,
      distToPath: Math.round(distToPath * 100) / 100,
      isAccepted: false,
      reason: '',
    };

    yBin.detour = evalItem.extraDistance;

    if (extraDistance > maxDetour) {
      evalItem.isAccepted = false;
      evalItem.rejectType = 'detour';
      evalItem.reason = `Jarak tambahan rute (+${extraDistance.toFixed(2)} km) > batas ${maxDetour.toFixed(2)} km.`;
      yBin.isAccepted = false;
      yBin.rejectType = 'detour';
      yBin.evalReason = evalItem.reason;
    } else if (distToPath > maxDetour) {
      evalItem.isAccepted = false;
      evalItem.rejectType = 'detour';
      evalItem.reason = `Terlalu jauh dari koridor rute asli (${distToPath.toFixed(2)} km > ${maxDetour.toFixed(2)} km).`;
      yBin.isAccepted = false;
      yBin.rejectType = 'detour';
      yBin.evalReason = evalItem.reason;
    } else {
      evalItem.isAccepted = true;
      evalItem.reason = `Searah (Jarak tambahan +${extraDistance.toFixed(2)} km ≤ ${maxDetour.toFixed(2)} km).`;
      yBin.evalReason = evalItem.reason;
      eligibleYellowCandidates.push(evalItem);
    }

    yellowEvaluations.push(evalItem);
  });

  eligibleYellowCandidates.sort((a, b) => a.extraDistance - b.extraDistance);

  // Cumulative verification
  const currentSelected: Bin[] = [...redBins];
  let currentTourDist = originalRedDist;
  const acceptedYellow: Bin[] = [];
  const rejectedYellow: Bin[] = [];

  eligibleYellowCandidates.forEach(cand => {
    const testTour = findShortestTourForBins([...currentSelected, cand.bin], depot, cfg, EXACT_TSP_SELECT_LIMIT, D);
    const incrementalExtra = Math.max(0, testTour.distance - currentTourDist);

    if (incrementalExtra <= maxDetour) {
      acceptedYellow.push(cand.bin);
      currentSelected.push(cand.bin);
      currentTourDist = testTour.distance;
      cand.bin.isAccepted = true;
      cand.bin.detour = cand.extraDistance;
    } else {
      cand.isAccepted = false;
      cand.reason = `Penambahan kumulatif (+${incrementalExtra.toFixed(2)} km) melebihi batas ${maxDetour.toFixed(2)} km.`;
      cand.bin.isAccepted = false;
      cand.bin.rejectType = 'detour_cumulative';
      cand.bin.evalReason = cand.reason;
    }
  });

  yellowEvaluations.forEach(evalItem => {
    if (!acceptedYellow.some(ab => ab.id === evalItem.bin.id)) {
      evalItem.bin.isAccepted = false;
      rejectedYellow.push(evalItem.bin);
    }
  });

  const totalLiter = currentSelected.reduce((sum, b) => sum + litersOf(b, cfg), 0);

  // Step 4: Multi-trip capacity split
  let N = 1;
  if (manualSplitMode === 'auto') {
    N = totalLiter <= cfg.C ? 1 : Math.ceil(totalLiter / cfg.C);
  } else {
    N = typeof manualSplitMode === 'number' ? manualSplitMode : parseInt(manualSplitMode) || 1;
  }

  // Step 5: Route planning
  let finalTrips: Trip[] = [];
  let relaxedTargetPercent = cfg.targetInitialPercent || 90;
  let targetMet = false;
  let attempts = 0;
  let currentN = N;

  while (!targetMet && attempts < 10) {
    attempts++;
    const targetLiterInitial = (relaxedTargetPercent / 100) * cfg.C;
    let success = true;

    if (currentN === 1) {
      const trip1Bins = [...redBins];
      let trip1Load = redBins.reduce((sum, b) => sum + litersOf(b, cfg), 0);

      acceptedYellow.forEach(yb => {
        if (manualSplitMode !== 'auto' || trip1Load + litersOf(yb, cfg) <= cfg.C) {
          trip1Bins.push(yb);
          trip1Load += litersOf(yb, cfg);
          yb.isAccepted = true;
        } else {
          yb.isAccepted = false;
          yb.rejectType = 'capacity';
          yb.evalReason = `Ditunda karena kapasitas truk penuh (${trip1Load}L + ${litersOf(yb, cfg)}L > ${cfg.C}L).`;
        }
      });

      const tourRes = findShortestTourForBins(trip1Bins, depot, cfg, EXACT_TSP_LIMIT, D);
      finalTrips = [
        {
          tripIndex: 1,
          bins: trip1Bins,
          loadLiter: trip1Load,
          tour: tourRes.tour,
          distance: tourRes.distance,
        },
      ];
      targetMet = true;
      break;
    }

    const sortedReds = [...redBins].sort((a, b) => D(depot, b) - D(depot, a));
    const tripBinsArray: Bin[][] = Array.from({ length: currentN }, () => []);
    const tripLoads = Array(currentN).fill(0);

    const redPool = [...sortedReds];
    for (let t = 0; t < currentN; t++) {
      let i = 0;
      while (i < redPool.length) {
        const b = redPool[i];
        if (manualSplitMode !== 'auto' || tripLoads[t] + litersOf(b, cfg) <= cfg.C) {
          tripBinsArray[t].push(b);
          tripLoads[t] += litersOf(b, cfg);
          redPool.splice(i, 1);
          if (manualSplitMode !== 'auto' && tripLoads[t] >= Math.ceil(totalLiter / currentN)) {
            break;
          }
        } else {
          i++;
        }
      }
    }

    redPool.forEach(b => {
      tripBinsArray[currentN - 1].push(b);
      tripLoads[currentN - 1] += litersOf(b, cfg);
    });

    const unassignedYellow = [...acceptedYellow];
    unassignedYellow.forEach(yBin => {
      let bestTripIdx = -1;
      let minExtra = Infinity;

      for (let t = 0; t < currentN; t++) {
        if (manualSplitMode !== 'auto' || tripLoads[t] + litersOf(yBin, cfg) <= cfg.C) {
          const currentTripTourDist = findShortestTourForBins(tripBinsArray[t], depot, cfg, EXACT_TSP_LIMIT, D).distance;
          const testTripTourDist = findShortestTourForBins([...tripBinsArray[t], yBin], depot, cfg, EXACT_TSP_LIMIT, D).distance;
          const extraInTrip = testTripTourDist - currentTripTourDist;

          if (extraInTrip <= maxDetour && extraInTrip < minExtra) {
            minExtra = extraInTrip;
            bestTripIdx = t;
          }
        }
      }

      if (bestTripIdx !== -1) {
        tripBinsArray[bestTripIdx].push(yBin);
        tripLoads[bestTripIdx] += litersOf(yBin, cfg);
        yBin.isAccepted = true;
      } else {
        yBin.isAccepted = false;
        let hasNearbyTrip = false;
        for (let t = 0; t < currentN; t++) {
          const currentTripTourDist = findShortestTourForBins(tripBinsArray[t], depot, cfg, EXACT_TSP_LIMIT, D).distance;
          const testTripTourDist = findShortestTourForBins([...tripBinsArray[t], yBin], depot, cfg, EXACT_TSP_LIMIT, D).distance;
          const extraInTrip = testTripTourDist - currentTripTourDist;
          if (extraInTrip <= maxDetour) {
            hasNearbyTrip = true;
            break;
          }
        }

        if (hasNearbyTrip) {
          yBin.rejectType = 'capacity';
          yBin.evalReason = 'Ditunda karena kapasitas truk penuh (tidak muat di trip yang searah).';
        } else {
          yBin.rejectType = 'detour';
          yBin.evalReason = `Ditunda karena jarak tambahan rute (+${(yBin.detour || 0).toFixed(2)} km) > batas ${maxDetour.toFixed(2)} km.`;
        }
      }
    });

    if (manualSplitMode !== 'auto') {
      success = true;
    } else {
      for (let t = 0; t < currentN - 1; t++) {
        if (tripLoads[t] < targetLiterInitial) success = false;
      }
      if (tripLoads[currentN - 1] > cfg.C) success = false;
    }

    if (success) {
      targetMet = true;
      finalTrips = tripBinsArray
        .filter(tb => tb.length > 0)
        .map((tb, idx) => {
          const tourRes = findShortestTourForBins(tb, depot, cfg, EXACT_TSP_LIMIT, D);
          const loadSum = tb.reduce((sum, b) => sum + litersOf(b, cfg), 0);
          const orderedBins = tourRes.tour.filter(pt => typeof pt.id === 'number') as Bin[];
          return {
            tripIndex: idx + 1,
            bins: orderedBins.length === tb.length ? orderedBins : tb,
            loadLiter: loadSum,
            tour: tourRes.tour,
            distance: tourRes.distance,
          };
        });
    } else {
      relaxedTargetPercent -= 4;
      if (relaxedTargetPercent < 75) {
        currentN += 1;
        relaxedTargetPercent = cfg.targetInitialPercent;
      }
    }
  }

  // Step 6: Sweep partitioning for minimal global distance
  // Computed using true spherical bearing from depot GPS: atan2(dLng * cos(depotLatRad), dLat)
  if (finalTrips.length > 1 && finalTrips.every(t => t.loadLiter <= cfg.C)) {
    const nTrips = finalTrips.length;
    const candidates = [finalTrips.map(t => t.bins)];

    if (manualSplitMode === 'auto') {
      const depotLat = depot.lat;
      const depotLng = depot.lng;
      const depotLatRad = (depotLat * Math.PI) / 180;
      const ang = (b: Bin) => {
        const dLat = b.lat - depotLat;
        const dLng = b.lng - depotLng;
        return Math.atan2(dLng * Math.cos(depotLatRad), dLat);
      };

      const ring = finalTrips
        .flatMap(t => t.bins)
        .sort((p, q) => ang(p) - ang(q) || D(depot, p) - D(depot, q));
      const sweeps: { groups: Bin[][]; dist: number }[] = [];

      for (let dir = 0; dir < 2; dir++) {
        const base = dir ? [...ring].reverse() : ring;
        for (let start = 0; start < base.length; start++) {
          const order = [...base.slice(start), ...base.slice(0, start)];
          const groups: Bin[][] = [];
          let cur: Bin[] = [];
          let ld = 0;

          order.forEach(b => {
            if (cur.length && ld + litersOf(b, cfg) > cfg.C) {
              groups.push(cur);
              cur = [];
              ld = 0;
            }
            cur.push(b);
            ld += litersOf(b, cfg);
          });
          if (cur.length) groups.push(cur);
          if (groups.length <= nTrips) {
            const dist = groups.reduce(
              (s, g) => (g.length ? s + findShortestTourForBins(g, depot, cfg, EXACT_TSP_LIMIT, D).distance : s),
              0
            );
            sweeps.push({ groups, dist });
          }
        }
      }
      sweeps.sort((a, b) => a.dist - b.dist);
      sweeps.slice(0, 3).forEach(s => candidates.push(s.groups));
    }

    let best: { trips: Trip[]; dist: number } | null = null;
    for (const groups of candidates) {
      const trips = buildTripsFromGroups(
        optimizePartition(groups, depot, cfg, manualSplitMode !== 'auto', D),
        depot,
        cfg,
        D
      );
      const dist = trips.reduce((s, t) => s + t.distance, 0);
      if (!best || dist < best.dist || (dist === best.dist && trips[0].loadLiter > best.trips[0].loadLiter)) {
        best = { trips, dist };
      }
    }

    const dNow = finalTrips.reduce((s, t) => s + t.distance, 0);
    if (best && (best as { trips: Trip[]; dist: number }).dist <= dNow) {
      finalTrips = (best as { trips: Trip[]; dist: number }).trips;
    }
  }

  // Link authentic road coordinates and synchronize exact road distances from the central road geometry store
  finalTrips.forEach(trip => {
    // Strictly synchronize trip.bins order with trip.tour sequence
    if (trip.tour && trip.tour.length > 2) {
      const tourBins = trip.tour.filter(pt => typeof pt.id === 'number') as Bin[];
      if (tourBins.length === trip.bins.length) {
        trip.bins = tourBins;
      }
    }
    const geom = roadGeometryStore.getTourGeometry(trip.tour, true);
    trip.roadCoords = geom.coords;
    const osrmDist = geom.status === 'ok' && geom.realDistanceKm ? parseFloat(geom.realDistanceKm) : null;
    if (osrmDist && osrmDist > 0 && osrmDist <= trip.distance * 1.15) {
      trip.realRoadKm = osrmDist.toFixed(1);
    } else {
      trip.realRoadKm = toRealKm(trip.distance);
    }
  });

  const trulyAcceptedYellow = acceptedYellow.filter(yb => yb.isAccepted);
  const trulyRejectedYellow = yellowBins.filter(yb => !yb.isAccepted);
  const finalSelectedBins = finalTrips.flatMap(t => t.bins);
  const totalDist = finalTrips.reduce((acc, t) => acc + t.distance, 0);
  const totalRealKm = finalTrips.reduce((acc, t) => acc + (parseFloat(t.realRoadKm || '0') || t.distance), 0);
  const formattedRealKm = (Math.round(totalRealKm * 10) / 10).toFixed(1);

  // Synchronize base red tour with actual road geometry
  const baseRedGeom = roadGeometryStore.getTourGeometry(originalRedTour, true);
  const baseOsrmDist =
    baseRedGeom.status === 'ok' && baseRedGeom.realDistanceKm
      ? parseFloat(baseRedGeom.realDistanceKm)
      : null;
  const resolvedBaseRedDist =
    baseOsrmDist && baseOsrmDist > 0 && baseOsrmDist <= originalRedDist * 1.15
      ? baseOsrmDist
      : originalRedDist;

  yellowEvaluations.forEach(ev => {
    const binObj = yellowBins.find(yb => yb.id === ev.bin.id);
    if (binObj) {
      ev.isAccepted = binObj.isAccepted || false;
      ev.rejectType = binObj.rejectType || (binObj.detour && binObj.detour > maxDetour ? 'detour' : 'capacity');
      ev.reason = binObj.evalReason || (binObj.isAccepted ? `Searah (+${ev.extraDistance} km)` : 'Ditunda');
    }
  });

  // Requirement: Remove "Optimal" from statusMessage when distance source is fallback
  const isOptimal = distanceSource === 'osrm';
  const statusPrefix = isOptimal ? 'Optimal: ' : 'Hasil: ';
  const sourceLabel = isOptimal ? 'Jalan Raya OSRM (Mode Mobil)' : 'Estimasi (Fallback Haversine 1.3x)';
  const displayTotalKm = formattedRealKm || totalDist.toFixed(1);
  const statusMessage = `${statusPrefix}${finalTrips.length} trip berhasil disusun dengan total jarak ${displayTotalKm} km (${sourceLabel}).`;

  return {
    redBins,
    yellowBins,
    greenBins,
    pickedGreenBins: [],
    acceptedYellowBins: trulyAcceptedYellow,
    rejectedYellowBins: trulyRejectedYellow,
    yellowEvaluations,
    selectedBins: finalSelectedBins,
    totalLiter: finalTrips.reduce((acc, t) => acc + t.loadLiter, 0),
    tripCount: finalTrips.length,
    trips: finalTrips,
    totalDistance: Math.round(totalDist * 100) / 100,
    totalRealRoadKm: formattedRealKm,
    baseRedDist: Math.round(originalRedDist * 100) / 100,
    distanceSource,
    statusMessage,
  };
}

// -------------------------------------------------------------
// CONVENTIONAL FIXED ROUTE BENCHMARK
// -------------------------------------------------------------

export function fixedSplit(bins: Bin[], cfg: SystemConfig): Bin[][] {
  const order = [...bins].sort((a, b) => a.id - b.id);
  const groups: Bin[][] = [];
  let cur: Bin[] = [];
  let load = 0;

  order.forEach(b => {
    if (cur.length && load + litersOf(b, cfg) > cfg.C) {
      groups.push(cur);
      cur = [];
      load = 0;
    }
    cur.push(b);
    load += litersOf(b, cfg);
  });
  if (cur.length) groups.push(cur);
  return groups;
}

export function getFixedTrip(
  bins: Bin[],
  depot: Depot,
  cfg: SystemConfig,
  distMatrixOrFn?: DistanceMatrixResult | DistanceFn | null
): Trip {
  const D = resolveDistanceFn(distMatrixOrFn, cfg);
  const groups = fixedSplit(bins, cfg);
  const tour: (Bin | Depot)[] = [depot];
  groups.forEach(g => {
    tour.push(...g, depot);
  });
  if (!groups.length) tour.push(depot);

  const subTrips = groups.map((g, idx) => {
    const subTour: (Bin | Depot)[] = [depot, ...g, depot];
    const subGeom = roadGeometryStore.getTourGeometry(subTour, true);
    // Matrix distance using D (critical so custom distance functions/matrices are evaluated)
    const subDist = calculateTourDistance(subTour, cfg, D);
    const subOsrmDist =
      subGeom.status === 'ok' && subGeom.realDistanceKm
        ? parseFloat(subGeom.realDistanceKm)
        : null;
    const realKm =
      subOsrmDist && subOsrmDist > 0 && subOsrmDist <= subDist * 1.15
        ? subOsrmDist.toFixed(1)
        : toRealKm(subDist);

    const finalSubDist = parseFloat(realKm) || subDist;

    return {
      subIndex: idx + 1,
      bins: g,
      tour: subTour,
      loadLiter: g.reduce((sum, b) => sum + litersOf(b, cfg), 0),
      distance: Math.round(finalSubDist * 10) / 10,
      roadCoords: subGeom.coords,
      realRoadKm: realKm,
    };
  });

  const tourGeom = roadGeometryStore.getTourGeometry(tour, true);
  const combinedSubCoords: [number, number][] = [];
  subTrips.forEach(st => {
    if (st.roadCoords && st.roadCoords.length > 0) {
      combinedSubCoords.push(...st.roadCoords);
    }
  });

  const resolvedRoadCoords =
    combinedSubCoords.length > 1
      ? combinedSubCoords
      : tourGeom.coords && tourGeom.coords.length > 1
      ? tourGeom.coords
      : tourGeom.coords;

  // Total distance for fixed route is the exact sum of its sub-trips returning to the depot
  const totalRealKm = subTrips.reduce((sum, st) => sum + (parseFloat(st.realRoadKm || '0') || st.distance), 0);
  const resolvedTotalDist = Math.round(totalRealKm * 10) / 10;

  const trip: Trip = {
    tripIndex: 'fixed',
    isFixed: true,
    bins: groups.flat(),
    loadLiter: subTrips.reduce((sum, t) => sum + t.loadLiter, 0),
    tour,
    distance: resolvedTotalDist,
    subTrips,
    subTripCount: groups.length,
    roadCoords: resolvedRoadCoords,
    realRoadKm: resolvedTotalDist.toFixed(1),
  };
  return trip;
}

export function getFixedSubTrips(
  bins: Bin[],
  depot: Depot,
  cfg: SystemConfig,
  distMatrixOrFn?: DistanceMatrixResult | DistanceFn | null
): Trip[] {
  const fixed = getFixedTrip(bins, depot, cfg, distMatrixOrFn);
  if (!fixed.subTrips || fixed.subTrips.length === 0) return [fixed];

  return fixed.subTrips.map(st => ({
    tripIndex: `fixed-${st.subIndex}`,
    isFixed: true,
    bins: st.bins,
    loadLiter: st.loadLiter,
    tour: st.tour || [depot, ...st.bins, depot],
    distance: st.distance,
    roadCoords: st.roadCoords,
    realRoadKm: st.realRoadKm,
  }));
}

export function conventionalPlan(
  bins: Bin[],
  depot: Depot,
  cfg: SystemConfig,
  distMatrixOrFn?: DistanceMatrixResult | DistanceFn | null
): { trips: number; dist: number; liter: number } {
  const t = getFixedTrip(bins, depot, cfg, distMatrixOrFn);
  return { trips: t.subTripCount || 1, dist: t.distance, liter: t.loadLiter };
}
