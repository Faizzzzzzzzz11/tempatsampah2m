import { Bin, Depot, Trip } from '../types';
import { getBinLatLng } from './coordinateUtils';
import { haversineRoadDistance } from './distanceMatrix';

/**
 * Builds a universal Google Maps Turn-by-Turn Driving Navigation URL to a single destination point.
 * This URL format directly launches the native Google Maps app on Android / iOS or web browser in CAR / DRIVING mode.
 * Parameter dirflg=d and travelmode=driving explicitly force 4-wheel automobile mode (bukan motor/roda dua).
 */
/**
 * Builds a universal Google Maps Turn-by-Turn Driving Navigation URL to a single destination point.
 * Explicitly forces 4-wheel automobile / car mode (bukan motor/roda dua) via travelmode=driving, dirflg=d, and !3e0.
 */
export function buildGoogleMapsNavUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}&travelmode=driving&dirflg=d`;
}

/**
 * Builds a universal Google Maps Search / Pin Location URL for viewing a place.
 */
export function buildGoogleMapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Builds a point-to-point driving direction URL from a specific start coordinate to target coordinate.
 * Strictly forces Automobile / Car Mode (travelmode=driving, dirflg=d, data=!4m2!4m1!3e0) avoiding motorcycle alleys.
 */
export function buildGoogleMapsLegUrl(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): string {
  return `https://www.google.com/maps/dir/${startLat.toFixed(6)},${startLng.toFixed(6)}/${destLat.toFixed(6)},${destLng.toFixed(6)}?data=!4m2!4m1!3e0&dirflg=d&travelmode=driving`;
}

/**
 * Extracts the exact ordered sequence of tour points (Depot -> Bin1 -> Bin2 -> ... -> Depot/TPS).
 * Prioritizes trip.tour to guarantee strict mathematical TSP sequence without any unordered drift.
 */
export function getOrderedTourPoints(trip: Trip, depot: Depot): (Bin | Depot)[] {
  if (trip.tour && trip.tour.length >= 2) {
    // If the tour is populated, it contains [depot, stop1, stop2, ..., depot]
    return trip.tour;
  }

  // Fallback if tour is not explicitly set: depot -> bins -> depot
  const validBins = (trip.bins || []).filter(b => {
    try {
      const [lat, lng] = getBinLatLng(b);
      return !isNaN(lat) && !isNaN(lng);
    } catch {
      return false;
    }
  });

  return [depot, ...validBins, depot];
}

/**
 * Extracts ordered bins only (excluding the starting/ending Depot) from the tour.
 */
export function getOrderedTripBins(trip: Trip, depot: Depot): Bin[] {
  const points = getOrderedTourPoints(trip, depot);
  const bins: Bin[] = [];

  points.forEach((pt, idx) => {
    // Exclude the first point (depot start) and last point (depot end) if they are depot
    if (idx === 0 || idx === points.length - 1) {
      if (pt.id === 'P' || pt.id === depot.id) return;
    }
    if ((pt as Bin).id !== undefined && pt.id !== 'P' && pt.id !== depot.id) {
      bins.push(pt as Bin);
    }
  });

  if (bins.length === 0 && trip.bins && trip.bins.length > 0) {
    return trip.bins;
  }

  return bins;
}

/**
 * Builds a strict, ordered Google Maps Slash-Path Directions URL.
 * URL format: https://www.google.com/maps/dir/lat0,lng0/lat1,lng1/.../latN,lngN?data=!4m2!4m1!3e0&entry=ttu&travelmode=driving&dirflg=d
 *
 * This format is guaranteed to preserve the exact sequence of waypoints without re-sorting,
 * does not collapse when origin and destination are both the Depot,
 * and forces Google Maps into Automobile / Car mode (dirflg=d, data=!4m2!4m1!3e0) avoiding motorcycle paths.
 */
export function buildGoogleMapsSlashRouteUrl(
  points: { lat: number; lng: number }[]
): string {
  if (!points || points.length === 0) {
    return 'https://www.google.com/maps';
  }
  if (points.length === 1) {
    return buildGoogleMapsNavUrl(points[0].lat, points[0].lng);
  }

  // Deduplicate consecutive identical coordinates
  const cleanPoints: { lat: number; lng: number }[] = [];
  points.forEach((p, idx) => {
    if (idx === 0) {
      cleanPoints.push(p);
    } else {
      const prev = cleanPoints[cleanPoints.length - 1];
      if (Math.abs(p.lat - prev.lat) > 0.00001 || Math.abs(p.lng - prev.lng) > 0.00001) {
        cleanPoints.push(p);
      }
    }
  });

  const pathSegments = cleanPoints
    .map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join('/');

  return `https://www.google.com/maps/dir/${pathSegments}?data=!4m2!4m1!3e0&dirflg=d&travelmode=driving`;
}

/**
 * Builds an alternative Google Maps Universal Web / App API Directions URL.
 * Guarantees travelmode=driving and dirflg=d for 4-wheel vehicles (cars & trucks).
 */
export function buildGoogleMapsUniversalApiUrl(
  points: { lat: number; lng: number }[]
): string {
  if (!points || points.length === 0) {
    return 'https://www.google.com/maps';
  }
  if (points.length === 1) {
    return buildGoogleMapsNavUrl(points[0].lat, points[0].lng);
  }

  // Deduplicate consecutive identical coordinates
  const cleanPoints: { lat: number; lng: number }[] = [];
  points.forEach((p, idx) => {
    if (idx === 0) {
      cleanPoints.push(p);
    } else {
      const prev = cleanPoints[cleanPoints.length - 1];
      if (Math.abs(p.lat - prev.lat) > 0.00001 || Math.abs(p.lng - prev.lng) > 0.00001) {
        cleanPoints.push(p);
      }
    }
  });

  const origin = `${cleanPoints[0].lat.toFixed(6)},${cleanPoints[0].lng.toFixed(6)}`;
  const destination = `${cleanPoints[cleanPoints.length - 1].lat.toFixed(6)},${cleanPoints[cleanPoints.length - 1].lng.toFixed(6)}`;

  if (cleanPoints.length === 2) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving&dirflg=d`;
  }

  const intermediateWaypoints = cleanPoints
    .slice(1, cleanPoints.length - 1)
    .map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(intermediateWaypoints)}&travelmode=driving&dirflg=d`;
}

/**
 * Maximum number of intermediate stops supported reliably by Google Maps in one route
 * before mobile apps truncate or throw directions limits.
 */
export const MAX_GMAPS_WAYPOINTS_PER_ROUTE = 8;

export interface TripRouteSegment {
  segmentIndex: number;
  totalSegments: number;
  label: string;
  startName: string;
  endName: string;
  binCount: number;
  url: string;
  universalUrl?: string;
  stops: TripStopNavigationItem[];
}

/**
 * Builds the primary Google Maps directions URL for an entire Trip.
 * Preserves the exact sequential order calculated by the algorithm.
 */
export function buildGoogleMapsTripRouteUrl(trip: Trip, depot: Depot): string {
  const tourPoints = getOrderedTourPoints(trip, depot);

  if (tourPoints.length <= 1) {
    const [depotLat, depotLng] = getBinLatLng(depot);
    return buildGoogleMapsNavUrl(depotLat, depotLng);
  }

  // Convert points to coordinates in strict order
  const coordsList: { lat: number; lng: number }[] = [];
  tourPoints.forEach(pt => {
    try {
      const [lat, lng] = getBinLatLng(pt);
      coordsList.push({ lat, lng });
    } catch {
      // ignore invalid point
    }
  });

  if (coordsList.length === 0) {
    const [depotLat, depotLng] = getBinLatLng(depot);
    return buildGoogleMapsNavUrl(depotLat, depotLng);
  }

  // Google Maps slash-format strictly enforces the sequential order
  return buildGoogleMapsSlashRouteUrl(coordsList);
}

/**
 * Builds segmented routes if a trip has more stops than Google Maps can comfortably display
 * without truncation (recommended for trips with > 8 bins).
 */
export function buildTripRouteSegments(
  trip: Trip,
  depot: Depot,
  maxBinsPerSegment = MAX_GMAPS_WAYPOINTS_PER_ROUTE,
  distFn?: (p1: any, p2: any) => number
): TripRouteSegment[] {
  const orderedBins = getOrderedTripBins(trip, depot);
  const [depotLat, depotLng] = getBinLatLng(depot);

  if (orderedBins.length <= maxBinsPerSegment) {
    // Fits into a single segment
    const allStops = getTripStopsWithGmapsLinks(trip, depot, distFn);
    return [
      {
        segmentIndex: 1,
        totalSegments: 1,
        label: `Rute Lengkap (${orderedBins.length} Tong)`,
        startName: `${depot.name} (Start)`,
        endName: `${depot.name} / TPS 3R (Finish)`,
        binCount: orderedBins.length,
        url: buildGoogleMapsTripRouteUrl(trip, depot),
        stops: allStops,
      },
    ];
  }

  // Multi-segment division
  const segments: TripRouteSegment[] = [];
  const totalSegments = Math.ceil(orderedBins.length / maxBinsPerSegment);

  for (let s = 0; s < totalSegments; s++) {
    const startBinIdx = s * maxBinsPerSegment;
    const endBinIdx = Math.min((s + 1) * maxBinsPerSegment, orderedBins.length);
    const segmentBins = orderedBins.slice(startBinIdx, endBinIdx);

    const isFirstSegment = s === 0;
    const isLastSegment = s === totalSegments - 1;

    const segPoints: { lat: number; lng: number }[] = [];

    let startName = '';
    let endName = '';

    if (isFirstSegment) {
      // Starts from Depot
      segPoints.push({ lat: depotLat, lng: depotLng });
      startName = `${depot.name} (Start)`;
    } else {
      // Starts from the last bin of previous segment
      const prevBin = orderedBins[startBinIdx - 1];
      const [pLat, pLng] = getBinLatLng(prevBin);
      segPoints.push({ lat: pLat, lng: pLng });
      startName = `${prevBin.name} (Lanjutan)`;
    }

    // Add this segment's bins
    segmentBins.forEach(b => {
      const [bLat, bLng] = getBinLatLng(b);
      segPoints.push({ lat: bLat, lng: bLng });
    });

    if (isLastSegment) {
      // Ends at Depot / TPS 3R
      segPoints.push({ lat: depotLat, lng: depotLng });
      endName = `${depot.name} / TPS 3R (Finish)`;
    } else {
      // Ends at the last bin of this segment
      const lastBin = segmentBins[segmentBins.length - 1];
      endName = lastBin.name;
    }

    const segUrl = buildGoogleMapsSlashRouteUrl(segPoints);
    const segUniversalUrl = buildGoogleMapsUniversalApiUrl(segPoints);
    const segStops = segmentBins.map((b, idx) => {
      const [lat, lng] = getBinLatLng(b);
      const prevCoord = idx === 0 ? segPoints[0] : segPoints[idx];
      const distFromPrev = distFn
        ? distFn({ lat: prevCoord.lat, lng: prevCoord.lng }, { lat, lng })
        : haversineRoadDistance(prevCoord.lat, prevCoord.lng, lat, lng);
      return {
        step: startBinIdx + idx + 1,
        id: b.id,
        name: b.name,
        location: b.location,
        fill: b.fill,
        lat,
        lng,
        isDepot: false,
        navUrl: buildGoogleMapsNavUrl(lat, lng),
        legNavUrl: buildGoogleMapsLegUrl(prevCoord.lat, prevCoord.lng, lat, lng),
        searchUrl: buildGoogleMapsSearchUrl(lat, lng),
        prevName: idx === 0 ? startName : segmentBins[idx - 1].name,
        distanceFromPrevKm: distFromPrev.toFixed(1),
      };
    });

    segments.push({
      segmentIndex: s + 1,
      totalSegments,
      label: `Bagian ${s + 1}: Tong ${startBinIdx + 1} s/d ${endBinIdx}`,
      startName,
      endName,
      binCount: segmentBins.length,
      url: segUrl,
      universalUrl: segUniversalUrl,
      stops: segStops,
    });
  }

  return segments;
}

/**
 * Builds Google Maps Universal API URL for an entire Trip in Car / Driving Mode.
 */
export function buildGoogleMapsUniversalTripUrl(trip: Trip, depot: Depot): string {
  const tourPoints = getOrderedTourPoints(trip, depot);
  const coordsList: { lat: number; lng: number }[] = [];
  tourPoints.forEach(pt => {
    try {
      const [lat, lng] = getBinLatLng(pt);
      coordsList.push({ lat, lng });
    } catch {
      // ignore
    }
  });
  return buildGoogleMapsUniversalApiUrl(coordsList);
}

export interface TripStopNavigationItem {
  step: number;
  id: number | string;
  name: string;
  location?: string;
  fill?: number;
  lat: number;
  lng: number;
  isDepot?: boolean;
  navUrl: string;
  legNavUrl?: string;
  searchUrl: string;
  prevName?: string;
  distanceFromPrevKm?: string;
}

/**
 * Generates an ordered list of navigation stops for a Trip with turn-by-turn Google Maps links.
 * Extracts stops strictly in the chronological order of the TSP tour!
 */
export function getTripStopsWithGmapsLinks(
  trip: Trip,
  depot: Depot,
  distFn?: (p1: any, p2: any) => number
): TripStopNavigationItem[] {
  const items: TripStopNavigationItem[] = [];
  const [depotLat, depotLng] = getBinLatLng(depot);
  const orderedBins = getOrderedTripBins(trip, depot);

  // 1. Start at Depot
  items.push({
    step: 0,
    id: 'P_START',
    name: `${depot.name} (Start)`,
    location: depot.location || 'Kapanewon Godean',
    lat: depotLat,
    lng: depotLng,
    isDepot: true,
    navUrl: buildGoogleMapsNavUrl(depotLat, depotLng),
    searchUrl: buildGoogleMapsSearchUrl(depotLat, depotLng),
    prevName: undefined,
  });

  let prevLat = depotLat;
  let prevLng = depotLng;
  let prevName = `${depot.name} (Start)`;

  // 2. Intermediate Bin Stops in strictly preserved TSP tour sequence
  orderedBins.forEach((b, idx) => {
    try {
      const [lat, lng] = getBinLatLng(b);
      const distFromPrev = distFn
        ? distFn({ lat: prevLat, lng: prevLng }, { lat, lng })
        : haversineRoadDistance(prevLat, prevLng, lat, lng);

      items.push({
        step: idx + 1,
        id: b.id,
        name: b.name,
        location: b.location,
        fill: b.fill,
        lat,
        lng,
        isDepot: false,
        navUrl: buildGoogleMapsNavUrl(lat, lng),
        legNavUrl: buildGoogleMapsLegUrl(prevLat, prevLng, lat, lng),
        searchUrl: buildGoogleMapsSearchUrl(lat, lng),
        prevName,
        distanceFromPrevKm: distFromPrev.toFixed(1),
      });

      prevLat = lat;
      prevLng = lng;
      prevName = b.name;
    } catch {
      // ignore invalid point
    }
  });

  // 3. Return to Depot / TPS 3R
  const finalDist = distFn
    ? distFn({ lat: prevLat, lng: prevLng }, { lat: depotLat, lng: depotLng })
    : haversineRoadDistance(prevLat, prevLng, depotLat, depotLng);

  items.push({
    step: items.length,
    id: 'P_END',
    name: `${depot.name} / TPS 3R (Bongkar Muatan)`,
    location: depot.location || 'Kapanewon Godean',
    lat: depotLat,
    lng: depotLng,
    isDepot: true,
    navUrl: buildGoogleMapsNavUrl(depotLat, depotLng),
    legNavUrl: buildGoogleMapsLegUrl(prevLat, prevLng, depotLat, depotLng),
    searchUrl: buildGoogleMapsSearchUrl(depotLat, depotLng),
    prevName,
    distanceFromPrevKm: finalDist.toFixed(1),
  });

  return items;
}

/**
 * Helper to copy Google Maps URL to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}
