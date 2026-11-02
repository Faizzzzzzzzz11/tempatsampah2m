import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  roadGeometryStore,
  generateTourKey,
  RoadGeometryEntry,
} from '../roadGeometryStore';
import { Bin, Depot, Trip } from '../../types';

describe('RoadGeometryStore — Optimasi & Perbaikan Rute Jalan Nyata', () => {
  const mockDepot: Depot = { id: 'P', name: 'Pangkalan Godean', lat: -7.7682, lng: 110.2938 };
  const mockBin1: Bin = { id: 1, name: 'Tong 1', lat: -7.765, lng: 110.295, fill: 85 };
  const mockBin2: Bin = { id: 2, name: 'Tong 2', lat: -7.762, lng: 110.298, fill: 90 };

  const testTour = [mockDepot, mockBin1, mockBin2, mockDepot];

  beforeEach(() => {
    roadGeometryStore.resetForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(1) Refresh tidak mengubah geometri lama saat fetch gagal', async () => {
    // 1. Inisialisasi geometri awal (misal geometri OSRM yang sudah ada sebelumnya)
    const initialCoords: [number, number][] = [
      [-7.7682, 110.2938],
      [-7.767, 110.294],
      [-7.765, 110.295],
      [-7.7682, 110.2938],
    ];
    const key = generateTourKey(testTour);
    roadGeometryStore.setEntry(key, {
      coords: initialCoords,
      source: 'osrm',
      fetchedAt: Date.now() - 10000,
      status: 'ok',
      realDistanceKm: '3.4',
    });

    // 2. Mock fetch gagal (misal 500 error atau timeout)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('OSRM Server 500 Internal Error'))
    );

    // 3. Panggil refresh (forceRefresh = true)
    const result = await roadGeometryStore.fetchTourGeometry(testTour, true);

    // Geometri lama TIDAK boleh hilang atau diubah menjadi garis lurus cadangan
    expect(result.coords).toEqual(initialCoords);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('OSRM');

    // Verifikasi entri di store tetap menyimpan koordinat lama
    const storedEntry = roadGeometryStore.getEntry(key);
    expect(storedEntry?.coords).toEqual(initialCoords);
    expect(storedEntry?.status).toBe('failed');
  });

  it('(2) setelah fetch berhasil store memberi tahu subscriber dan geometri berubah', async () => {
    const key = generateTourKey(testTour);

    // Initial state dengan fallback / koordinat lama
    const oldCoords: [number, number][] = [
      [-7.7682, 110.2938],
      [-7.762, 110.298],
    ];
    roadGeometryStore.setEntry(key, {
      coords: oldCoords,
      source: 'fallback',
      fetchedAt: Date.now() - 5000,
      status: 'idle',
    });

    // Pasang subscriber listener
    let subscriberNotificationCount = 0;
    const unsubscribe = roadGeometryStore.subscribe(() => {
      subscriberNotificationCount++;
    });

    // Mock fetch OSRM yang berhasil
    const osrmGeoJsonCoords: [number, number][] = [
      [110.2938, -7.7682],
      [110.2945, -7.7675],
      [110.296, -7.764],
      [110.298, -7.762],
      [110.2938, -7.7682],
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              geometry: {
                coordinates: osrmGeoJsonCoords,
              },
              distance: 4200,
            },
          ],
        }),
      })
    );

    // Jalankan refresh / fetch
    const result = await roadGeometryStore.fetchTourGeometry(testTour, true);

    // Verifikasi subscriber diberi tahu
    expect(subscriberNotificationCount).toBeGreaterThan(0);

    // Verifikasi geometri berubah menjadi koordinat baru OSRM (format [lat, lng])
    const expectedNewCoords = osrmGeoJsonCoords.map(([lng, lat]) => [lat, lng]);
    expect(result.coords).toEqual(expectedNewCoords);
    expect(result.source).toBe('osrm');
    expect(result.status).toBe('ok');
    expect(result.realDistanceKm).toBe('4.2');

    // Store snapshot update
    const updated = roadGeometryStore.getEntry(key);
    expect(updated?.coords).toEqual(expectedNewCoords);
    expect(updated?.status).toBe('ok');

    unsubscribe();
  });

  it('(3) kegagalan tidak dicache sebagai sukses', async () => {
    const key = generateTourKey(testTour);

    // Mock fetch gagal (misal HTTP 429 Too Many Requests)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Too Many Requests' }),
      })
    );

    const result = await roadGeometryStore.fetchTourGeometry(testTour, true);

    // Status HARUS 'failed', TIDAK BOLEH 'ok'
    expect(result.status).toBe('failed');
    expect(result.source).not.toBe('osrm');

    const entryInStore = roadGeometryStore.getEntry(key);
    expect(entryInStore).toBeDefined();
    expect(entryInStore?.status).toBe('failed');
    expect(entryInStore?.status).not.toBe('ok');

    // Ketika getTourGeometry dipanggil kembali tanpa forceRefresh, ia tidak mengklaim sukses
    const rechecked = roadGeometryStore.getTourGeometry(testTour, false);
    expect(rechecked.status).toBe('failed');
  });

  it('(4) kunci cache sama untuk tour yang sama walau tripIndex berbeda', () => {
    const tripA: Trip = {
      tripIndex: 1,
      bins: [mockBin1, mockBin2],
      loadLiter: 175,
      tour: testTour,
      distance: 5.2,
    };

    const tripB: Trip = {
      tripIndex: 2, // tripIndex berbeda!
      bins: [mockBin1, mockBin2],
      loadLiter: 175,
      tour: testTour,
      distance: 5.2,
    };

    const tripFixed: Trip = {
      tripIndex: 'fixed', // string tripIndex!
      bins: [mockBin1, mockBin2],
      loadLiter: 175,
      tour: testTour,
      distance: 5.2,
    };

    const keyA = generateTourKey(tripA.tour);
    const keyB = generateTourKey(tripB.tour);
    const keyFixed = generateTourKey(tripFixed.tour);

    // Kunci cache harus identik karena hanya bergantung pada urutan koordinat tour
    expect(keyA).toBe(keyB);
    expect(keyA).toBe(keyFixed);
    expect(keyA).not.toContain('trip_1');
    expect(keyA).not.toContain('trip_2');
    expect(keyA).not.toContain('fixed');
  });
});
