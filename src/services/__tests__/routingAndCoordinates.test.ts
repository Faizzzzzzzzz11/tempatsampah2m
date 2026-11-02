import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Bin, Depot, SystemConfig } from '../../types';
import { DEFAULT_CONFIG, DEFAULT_DEPOT, DEFAULT_BINS_24 } from '../../data/godeanData';
import {
  exactTourOrder,
  findShortestTourForBins,
  calculateTourDistance,
  runFlowchartLogic,
  getFixedTrip,
  conventionalPlan,
  manhattanDist,
} from '../routingEngine';
import {
  buildDistanceMatrix,
  haversineDistance,
  haversineRoadDistance,
  HAVERSINE_ROAD_FACTOR,
  clearMatrixCache,
  DistanceMatrixResult,
} from '../distanceMatrix';
import {
  isValidCoordinate,
  getBinLatLng,
  gridToLatLng,
  calculateBearingRad,
  migrateStorageData,
} from '../coordinateUtils';

describe('MASALAH A: Distance Matrix & Real Road Routing', () => {
  beforeEach(() => {
    clearMatrixCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(a) urutan tur memakai matriks jarak yang diberikan, bukan estimasi spasial', () => {
    const depot: Depot = { id: 'P', name: 'Depot', lat: -7.768, lng: 110.293 };
    const b1: Bin = { id: 1, name: 'B1', lat: -7.767, lng: 110.293, fill: 85, status: 'red' };
    const b2: Bin = { id: 2, name: 'B2', lat: -7.766, lng: 110.293, fill: 85, status: 'red' };
    const b3: Bin = { id: 3, name: 'B3', lat: -7.765, lng: 110.293, fill: 85, status: 'red' };

    // In Euclidean space, order from P is B1 -> B2 -> B3.
    // We now construct a synthetic distance matrix where visiting B3 first is dramatically cheaper:
    // P -> B3 = 1 km, B3 -> B2 = 1 km, B2 -> B1 = 1 km, B1 -> P = 1 km (Loop: P - B3 - B2 - B1 - P = 4 km)
    // While P -> B1 = 20 km!
    const customDistMatrix: DistanceMatrixResult = {
      km: [
        [0, 20, 20, 1],   // P (index 0): to B1=20, to B2=20, to B3=1
        [1, 0, 1, 20],    // B1 (index 1): to P=1, to B2=1, to B3=20
        [20, 1, 0, 1],    // B2 (index 2): to B1=1, to B3=1
        [1, 20, 1, 0],    // B3 (index 3): to P=1, to B2=1
      ],
      min: [
        [0, 40, 40, 2],
        [2, 0, 2, 40],
        [40, 2, 0, 2],
        [2, 40, 2, 0],
      ],
      source: 'osrm',
      pointKeys: [],
      pointKeyIndex: new Map([
        ['P', 0],
        ['1', 1],
        ['2', 2],
        ['3', 3],
      ]),
      timestamp: Date.now(),
      getDist: (p1, p2) => {
        const id1 = 'id' in p1 ? String(p1.id) : 'P';
        const id2 = 'id' in p2 ? String(p2.id) : 'P';
        const idxMap: Record<string, number> = { P: 0, '1': 1, '2': 2, '3': 3 };
        return customDistMatrix.km[idxMap[id1]][idxMap[id2]];
      },
      getTimeMin: () => 1,
    };

    const order = exactTourOrder([b1, b2, b3], depot, DEFAULT_CONFIG, customDistMatrix.getDist);
    const orderIds = order.map(b => b.id);

    // Tour should be [3, 2, 1] or symmetric [1, 2, 3] with total cost 4, NOT visiting B2 or B3 randomly
    const isDirectedOptimally =
      (orderIds[0] === 3 && orderIds[1] === 2 && orderIds[2] === 1) ||
      (orderIds[0] === 1 && orderIds[1] === 2 && orderIds[2] === 3);

    expect(isDirectedOptimally).toBe(true);

    const tourRes = findShortestTourForBins([b1, b2, b3], depot, DEFAULT_CONFIG, 12, customDistMatrix.getDist);
    // Total loop distance: P -> B3 (1) + B3 -> B2 (1) + B2 -> B1 (1) + B1 -> P (1) = 4
    expect(tourRes.distance).toBe(4);
  });

  it('(b) fallback dipakai saat fetch OSRM gagal, menggunakan haversine * 1.3, dan kata Optimal dihapus', async () => {
    // Mock fetch to simulate network error or offline OSRM server
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('OSRM Server Offline')));

    const points = [DEFAULT_DEPOT, DEFAULT_BINS_24[0], DEFAULT_BINS_24[1]];
    const matrix = await buildDistanceMatrix(points, DEFAULT_CONFIG);

    expect(matrix.source).toBe('fallback');
    expect(HAVERSINE_ROAD_FACTOR).toBe(1.3);

    // Verify distance matches Haversine * 1.3
    const p1 = points[0];
    const p2 = points[1];
    const expectedDist = haversineRoadDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    const matrixDist = matrix.getDist(p1, p2);

    expect(matrixDist).toBe(expectedDist);

    // Run flowchart with this fallback matrix
    const result = runFlowchartLogic(
      [DEFAULT_BINS_24[0]], // Red bin
      DEFAULT_DEPOT,
      DEFAULT_CONFIG,
      'auto',
      matrix
    );

    expect(result.distanceSource).toBe('fallback');
    // Requirement 5: Kata "Optimal" HARUS dihapus dari statusMessage bila sumbernya fallback
    expect(result.statusMessage).not.toContain('Optimal');
    expect(result.statusMessage).toContain('Estimasi');
  });

  it('(c) jarak total trip = jumlah sisi pada matriks jarak', async () => {
    const depot = DEFAULT_DEPOT;
    const testBins = [DEFAULT_BINS_24[0], DEFAULT_BINS_24[3], DEFAULT_BINS_24[7]]; // red bins
    const points = [depot, ...testBins];

    const matrix = await buildDistanceMatrix(points, DEFAULT_CONFIG);
    const result = runFlowchartLogic(testBins, depot, DEFAULT_CONFIG, 'auto', matrix);

    expect(result.trips.length).toBeGreaterThan(0);

    for (const trip of result.trips) {
      let manualSum = 0;
      for (let i = 0; i < trip.tour.length - 1; i++) {
        const edgeCost = matrix.getDist(trip.tour[i], trip.tour[i + 1]);
        manualSum += edgeCost;
      }
      manualSum = Math.round(manualSum * 100) / 100;
      expect(trip.distance).toBeCloseTo(manualSum, 1);
    }
  });

  it('benchmark konvensional dan smart route memakai matriks yang sama', () => {
    const depot = DEFAULT_DEPOT;
    const testBins = DEFAULT_BINS_24.slice(0, 4);

    let callsToDist = 0;
    const customDistFn = (p1: any, p2: any) => {
      callsToDist++;
      return haversineRoadDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    };

    const conv = conventionalPlan(testBins, depot, DEFAULT_CONFIG, customDistFn);
    expect(callsToDist).toBeGreaterThan(0);
    expect(conv.dist).toBeGreaterThan(0);

    const smart = runFlowchartLogic(testBins, depot, DEFAULT_CONFIG, 'auto', customDistFn);
    expect(smart.totalDistance).toBeGreaterThan(0);
  });
});

describe('MASALAH B: Sistem Koordinat Tunggal GPS & Validasi', () => {
  it('(a) pengelompokan sweep Step 6 tidak berubah bila x,y diubah secara drastis', () => {
    const depot: Depot = { ...DEFAULT_DEPOT, x: 8, y: 5 };
    // Clone bins with original x, y
    const binsOriginal: Bin[] = DEFAULT_BINS_24.map(b => ({ ...b }));

    // Run logic on original
    const resultOriginal = runFlowchartLogic(binsOriginal, depot, DEFAULT_CONFIG, 'auto');

    // Clone bins with completely randomized x, y, while GPS lat/lng stays strictly identical
    const binsScrambledGrid: Bin[] = DEFAULT_BINS_24.map((b, idx) => ({
      ...b,
      x: (idx * 37) % 100 - 50,
      y: (idx * 53) % 100 - 50,
    }));
    const depotScrambledGrid: Depot = { ...depot, x: 999, y: -888 };

    const resultScrambled = runFlowchartLogic(binsScrambledGrid, depotScrambledGrid, DEFAULT_CONFIG, 'auto');

    // Sweep and trip composition must be 100% IDENTICAL because calculation uses GPS bearing
    expect(resultScrambled.tripCount).toBe(resultOriginal.tripCount);
    expect(resultScrambled.totalDistance).toBeCloseTo(resultOriginal.totalDistance, 2);

    for (let t = 0; t < resultOriginal.trips.length; t++) {
      const origIds = resultOriginal.trips[t].bins.map(b => b.id).sort();
      const scramIds = resultScrambled.trips[t].bins.map(b => b.id).sort();
      expect(scramIds).toEqual(origIds);
    }
  });

  it('(b) tong dengan lat/lng berbeda tidak pernah dianggap sama posisinya (kasus Tong 4 & 17, 11 & 14)', () => {
    const b4 = DEFAULT_BINS_24.find(b => b.id === 4)!;
    const b17 = DEFAULT_BINS_24.find(b => b.id === 17)!;
    const b11 = DEFAULT_BINS_24.find(b => b.id === 11)!;
    const b14 = DEFAULT_BINS_24.find(b => b.id === 14)!;

    // Both pairs had identical (x, y) in legacy grid system:
    // b4 and b17 both had x=10, y=5. But their GPS coordinates differ by > 700 meters!
    const coords4 = getBinLatLng(b4);
    const coords17 = getBinLatLng(b17);
    expect(coords4).not.toEqual(coords17);

    const dist4to17 = haversineDistance(coords4[0], coords4[1], coords17[0], coords17[1]);
    expect(dist4to17).toBeGreaterThan(0.5); // At least 500 meters apart

    // b11 and b14 both had x=13, y=7. But their GPS coordinates differ!
    const coords11 = getBinLatLng(b11);
    const coords14 = getBinLatLng(b14);
    expect(coords11).not.toEqual(coords14);

    const dist11to14 = haversineDistance(coords11[0], coords11[1], coords14[0], coords14[1]);
    expect(dist11to14).toBeGreaterThan(0.1);
  });

  it('(c) data tanpa lat/lng ditolak oleh getBinLatLng dan data legacy dimigrasikan oleh migrateStorageData', () => {
    // 1. getBinLatLng throws explicit error on invalid coordinates
    expect(() => getBinLatLng(null)).toThrowError(/null or undefined/);
    expect(() => getBinLatLng({ id: 10, lat: undefined as any, lng: undefined as any })).toThrowError(/invalid coordinates/);
    expect(() => getBinLatLng({ id: 10, lat: NaN, lng: 110.29 })).toThrowError(/invalid coordinates/);
    expect(() => getBinLatLng({ id: 10, lat: -105, lng: 110.29 })).toThrowError(/invalid coordinates/); // out of lat bounds

    // 2. migrateStorageData: migrates legacy localStorage data having only x, y
    const legacyStorageJson = {
      depot: { id: 'P', name: 'Legacy Depot', x: 8, y: 5 },
      bins: [
        { id: 1, name: 'Legacy Bin 1', x: 7, y: 5, fill: 85 },
        { id: 2, name: 'Legacy Bin 2', x: 10, y: 5, fill: 65 },
      ],
    };

    const migrated = migrateStorageData(legacyStorageJson, DEFAULT_DEPOT, DEFAULT_BINS_24);

    expect(migrated.schemaVersion).toBe(2);
    expect(isValidCoordinate(migrated.depot.lat, migrated.depot.lng)).toBe(true);
    expect(migrated.bins.length).toBe(2);
    expect(isValidCoordinate(migrated.bins[0].lat, migrated.bins[0].lng)).toBe(true);
    expect(isValidCoordinate(migrated.bins[1].lat, migrated.bins[1].lng)).toBe(true);

    // Verify coordinates match gridToLatLng
    const [expectedLat, expectedLng] = gridToLatLng(7, 5);
    expect(migrated.bins[0].lat).toBe(expectedLat);
    expect(migrated.bins[0].lng).toBe(expectedLng);
  });

  it('(d) getFixedTrip menghasilkan rute untuk trip tetap dengan sub-trips dan koordinat jalan', () => {
    const fixed = getFixedTrip(DEFAULT_BINS_24, DEFAULT_DEPOT, DEFAULT_CONFIG);

    expect(fixed.isFixed).toBe(true);
    expect(fixed.tripIndex).toBe('fixed');
    expect(fixed.bins.length).toBe(DEFAULT_BINS_24.length);
    expect(fixed.subTripCount).toBeGreaterThanOrEqual(1);
    expect(fixed.subTrips).toBeDefined();

    // Pastikan setiap sub-trip memiliki tour dari depot kembali ke depot
    fixed.subTrips?.forEach((st, idx) => {
      expect(st.subIndex).toBe(idx + 1);
      expect(st.tour).toBeDefined();
      expect(st.tour![0].id).toBe('P');
      expect(st.tour![st.tour!.length - 1].id).toBe('P');
      expect(st.loadLiter).toBeLessThanOrEqual(DEFAULT_CONFIG.C);
      expect(st.roadCoords).toBeDefined();
      expect(st.roadCoords!.length).toBeGreaterThan(0);
    });

    // Pastikan koordinat rute tetap tersedia untuk visualisasi peta
    expect(fixed.roadCoords).toBeDefined();
    expect(fixed.roadCoords!.length).toBeGreaterThan(1);
  });
});

