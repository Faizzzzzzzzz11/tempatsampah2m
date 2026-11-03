import { describe, it, expect } from 'vitest';
import { Bin, Depot, SystemConfig, Trip } from '../../types';
import {
  buildGoogleMapsSlashRouteUrl,
  buildGoogleMapsTripRouteUrl,
  getOrderedTourPoints,
  getOrderedTripBins,
  getTripStopsWithGmapsLinks,
  buildTripRouteSegments,
  buildGoogleMapsLegUrl,
  buildGoogleMapsNavUrl,
} from '../googleMapsService';
import { runFlowchartLogic, exactTourOrder } from '../routingEngine';
import { DEFAULT_CONFIG, DEFAULT_DEPOT, DEFAULT_BINS_24 } from '../../data/godeanData';

describe('Google Maps Sequential Route & Waypoint Order Integrity', () => {
  const depot: Depot = { id: 'P', name: 'Pangkalan Armada Godean', lat: -7.7686, lng: 110.2952 };

  const bin1: Bin = { id: 1, name: 'B-01 Pasar Godean', lat: -7.7670, lng: 110.2940, fill: 85, status: 'red' };
  const bin2: Bin = { id: 2, name: 'B-02 Sidoagung', lat: -7.7620, lng: 110.2900, fill: 90, status: 'red' };
  const bin3: Bin = { id: 3, name: 'B-03 Sidomoyo', lat: -7.7550, lng: 110.2980, fill: 80, status: 'red' };
  const bin4: Bin = { id: 4, name: 'B-04 Sidorejo', lat: -7.7500, lng: 110.3020, fill: 95, status: 'red' };

  it('(1) getOrderedTourPoints dan getOrderedTripBins menjaga urutan tour persis tanpa acak', () => {
    // A tour sequence: Depot -> B-03 -> B-01 -> B-04 -> B-02 -> Depot
    const specificTour: (Bin | Depot)[] = [depot, bin3, bin1, bin4, bin2, depot];
    const testTrip: Trip = {
      tripIndex: 1,
      bins: [bin1, bin2, bin3, bin4], // raw bins array has different order
      tour: specificTour,
      loadLiter: 350,
      distance: 12.5,
    };

    const orderedPoints = getOrderedTourPoints(testTrip, depot);
    expect(orderedPoints.map(p => p.id)).toEqual(['P', 3, 1, 4, 2, 'P']);

    const orderedBins = getOrderedTripBins(testTrip, depot);
    expect(orderedBins.map(b => b.id)).toEqual([3, 1, 4, 2]);
  });

  it('(2) buildGoogleMapsTripRouteUrl menghasilkan URL slash-path dengan urutan presisi dan mode mobil', () => {
    const specificTour: (Bin | Depot)[] = [depot, bin2, bin4, bin1, depot];
    const testTrip: Trip = {
      tripIndex: 1,
      bins: [bin1, bin2, bin4],
      tour: specificTour,
      loadLiter: 270,
      distance: 9.8,
    };

    const url = buildGoogleMapsTripRouteUrl(testTrip, depot);

    // Verify it uses the slash-separated format starting at depot, through bin2, bin4, bin1, and finishing back at depot
    expect(url.startsWith('https://www.google.com/maps/dir/')).toBe(true);

    // Verify car / automobile driving parameters are strictly locked (mode mobil bukan motor)
    expect(url).toContain('travelmode=driving');
    expect(url).toContain('dirflg=d');

    const [pathPart] = url.replace('https://www.google.com/maps/dir/', '').split('?');
    const segments = pathPart.split('/');
    expect(segments.length).toBe(5); // Depot -> Bin2 -> Bin4 -> Bin1 -> Depot

    expect(segments[0]).toBe(`${depot.lat.toFixed(6)},${depot.lng.toFixed(6)}`);
    expect(segments[1]).toBe(`${bin2.lat.toFixed(6)},${bin2.lng.toFixed(6)}`);
    expect(segments[2]).toBe(`${bin4.lat.toFixed(6)},${bin4.lng.toFixed(6)}`);
    expect(segments[3]).toBe(`${bin1.lat.toFixed(6)},${bin1.lng.toFixed(6)}`);
    expect(segments[4]).toBe(`${depot.lat.toFixed(6)},${depot.lng.toFixed(6)}`);
  });

  it('(3) getTripStopsWithGmapsLinks menyediakan urutan step 1, 2, 3... dan leg navigation antar titik berurutan', () => {
    const specificTour: (Bin | Depot)[] = [depot, bin1, bin2, depot];
    const testTrip: Trip = {
      tripIndex: 1,
      bins: [bin2, bin1],
      tour: specificTour,
      loadLiter: 175,
      distance: 6.2,
    };

    const stops = getTripStopsWithGmapsLinks(testTrip, depot);

    expect(stops.length).toBe(4); // Start (P) + Bin1 + Bin2 + Finish (TPS/P)
    expect(stops[0].isDepot).toBe(true);
    expect(stops[0].step).toBe(0);

    expect(stops[1].id).toBe(1);
    expect(stops[1].step).toBe(1);
    expect(stops[1].prevName).toBe('Pangkalan Armada Godean (Start)');
    expect(stops[1].legNavUrl).toContain(`${depot.lat.toFixed(6)},${depot.lng.toFixed(6)}/${bin1.lat.toFixed(6)},${bin1.lng.toFixed(6)}`);

    expect(stops[2].id).toBe(2);
    expect(stops[2].step).toBe(2);
    expect(stops[2].prevName).toBe('B-01 Pasar Godean');
    expect(stops[2].legNavUrl).toContain(`${bin1.lat.toFixed(6)},${bin1.lng.toFixed(6)}/${bin2.lat.toFixed(6)},${bin2.lng.toFixed(6)}`);

    expect(stops[3].isDepot).toBe(true);
    expect(stops[3].prevName).toBe('B-02 Sidoagung');
  });

  it('(4) buildTripRouteSegments membagi rute jika titik > 8 tong tanpa membuang titik satupun', () => {
    // Generate 12 test bins
    const twelveBins: Bin[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `Bak Sampah #${i + 1}`,
      lat: -7.7600 - i * 0.002,
      lng: 110.2900 + i * 0.002,
      fill: 85,
      status: 'red',
    }));

    const fullTour: (Bin | Depot)[] = [depot, ...twelveBins, depot];
    const trip: Trip = {
      tripIndex: 1,
      bins: twelveBins,
      tour: fullTour,
      loadLiter: 900,
      distance: 18.0,
    };

    const segments = buildTripRouteSegments(trip, depot, 8);

    expect(segments.length).toBe(2); // 12 bins / 8 = 2 segments (8 in seg 1, 4 in seg 2)
    expect(segments[0].binCount).toBe(8);
    expect(segments[1].binCount).toBe(4);
    expect(segments[0].binCount + segments[1].binCount).toBe(12);

    // Segment 1 should start at depot
    expect(segments[0].startName).toContain('Pangkalan');
    // Segment 2 should end at finish (depot/TPS)
    expect(segments[1].endName).toContain('Finish');
  });

  it('(5) runFlowchartLogic menghasilkan trip.bins yang urutannya 100% konsisten dengan trip.tour', () => {
    // Run real engine with default bins
    const testBins = DEFAULT_BINS_24.map(b => ({ ...b }));
    const result = runFlowchartLogic(testBins, DEFAULT_DEPOT, DEFAULT_CONFIG);

    expect(result.trips.length).toBeGreaterThan(0);

    result.trips.forEach(trip => {
      // In every trip, trip.bins must exactly match trip.tour without the depot 'P'
      const tourBinIds = trip.tour
        .filter((pt): pt is Bin => typeof pt.id === 'number')
        .map(b => b.id);

      const tripBinIds = trip.bins.map(b => b.id);

      expect(tripBinIds).toEqual(tourBinIds);
    });
  });
});
