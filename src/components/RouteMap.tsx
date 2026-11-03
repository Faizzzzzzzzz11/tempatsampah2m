import React, { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import L from 'leaflet';
import {
  Navigation,
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Building2,
  LayoutGrid,
  Move,
  Maximize2,
  Minimize2,
  Crosshair,
  Sparkles,
  Eye,
  EyeOff,
  Truck,
  FastForward,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { Bin, Depot, ExecutionResult, SystemConfig, Trip, AnimWaypoint } from '../types';
import {
  getBinLatLng,
  getTripRoadCoords,
  toRealKm,
  toTravelMinutes,
  litersOf,
} from '../services/routingEngine';
import {
  roadGeometryStore,
  generateTourKey,
  buildRoadNetworkTour,
} from '../services/roadGeometryStore';

interface RouteMapProps {
  bins: Bin[];
  depot: Depot;
  config: SystemConfig;
  result: ExecutionResult;
  selectedTripFilter: 'all' | 'fixed' | number | string;
  onSelectTripFilter: (filter: 'all' | 'fixed' | number | string) => void;
  onEditBin: (binId: number) => void;
  onDeleteBin: (binId: number) => void;
  onQuickFillChange?: (binId: number, fill: number) => void;
  onTriggerReport?: (binId: number) => void;
  onUpdateBinPosition: (binId: number, lat: number, lng: number) => void;
  onUpdateDepotPosition: (lat: number, lng: number) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  onOpenAddBin: () => void;
  onOpenDepotModal: () => void;
  onOpenTemplatesModal: () => void;
  onResetMap: () => void;
  animRunning: boolean;
  animSpeed: number;
  onToggleAnimation: () => void;
  onResetAnimation: () => void;
  onChangeAnimSpeed: (speed: number) => void;
  currentTruckWaypoint: AnimWaypoint | null;
  currentTruckLoad: number;
  mapPickMode: 'bin' | 'depot' | null;
  onMapClickCoord: (lat: number, lng: number) => void;
  onRefreshRoadGeometries: () => void;
  theme?: 'light' | 'dark';
  onStartPickBinOnMap?: () => void;
  fixedTrip?: Trip;
  showFixedComparison?: boolean;
  onToggleFixedComparison?: () => void;
  onOpenGoogleMapsModal?: () => void;
}

const TRIP_COLORS = [
  { stroke: '#1F5FD6', bg: '#DCE7FB', label: 'Trip 1' },
  { stroke: '#8A3FC4', bg: '#EEE0F8', label: 'Trip 2' },
  { stroke: '#0A8F99', bg: '#D2EEF0', label: 'Trip 3' },
  { stroke: '#C8326B', bg: '#F8DCE7', label: 'Trip 4' },
];

function findClosestCoordIndex(target: [number, number], coords: [number, number][]): number {
  let closestIdx = 0;
  let minD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = Math.hypot(coords[i][0] - target[0], coords[i][1] - target[1]);
    if (d < minD) {
      minD = d;
      closestIdx = i;
    }
  }
  return closestIdx;
}

function getTruckDivIcon(
  load: number,
  capacity: number,
  waypoint: AnimWaypoint | null,
  isAnimRunning: boolean
): L.DivIcon {
  const cap = Math.max(1, capacity || 1000);
  const pct = Math.min(100, Math.round((load / cap) * 100));
  const isOver = load > cap;

  const barColor = pct >= 80 ? '#EF4444' : pct >= 50 ? '#F59E0B' : '#10B981';
  const bearing = waypoint?.bearing ?? 0;

  return L.divIcon({
    className: 'custom-truck-marker',
    html: `
      <div style="position:relative;width:42px;height:50px;display:flex;align-items:center;justify-content:center;pointer-events:auto;">
        <!-- 3D Realistic Compactor Truck Sprite (Scaled to compact dimensions) -->
        <div style="width:26px;height:40px;display:flex;align-items:center;justify-content:center;transform:rotate(${bearing}deg);transition:transform 0.18s cubic-bezier(0.25, 1, 0.5, 1);position:relative;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.45));">
          <svg width="26" height="40" viewBox="0 0 42 66" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <!-- 3D Gradients -->
              <linearGradient id="cabGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#F59E0B" />
                <stop offset="35%" stop-color="#FDE047" />
                <stop offset="70%" stop-color="#F59E0B" />
                <stop offset="100%" stop-color="#D97706" />
              </linearGradient>
              <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#7DD3FC" stop-opacity="0.95" />
                <stop offset="50%" stop-color="#0284C7" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#0369A1" />
              </linearGradient>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#0E5A60" />
                <stop offset="30%" stop-color="#14B8A6" />
                <stop offset="70%" stop-color="#0F766E" />
                <stop offset="100%" stop-color="#042F2E" />
              </linearGradient>
              <linearGradient id="hopperGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#334155" />
                <stop offset="50%" stop-color="#475569" />
                <stop offset="100%" stop-color="#1E293B" />
              </linearGradient>
              <linearGradient id="headlightBeam" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stop-color="#FEF08A" stop-opacity="0.6" />
                <stop offset="100%" stop-color="#FEF08A" stop-opacity="0" />
              </linearGradient>
            </defs>

            <!-- Conical Headlight Projection Beams when moving -->
            ${
              isAnimRunning
                ? `<polygon points="12,12 -4,-22 46,-22 30,12" fill="url(#headlightBeam)" />`
                : ''
            }

            <!-- Dual Heavy-Duty Rubber Tires with Rims -->
            <!-- Front Wheels -->
            <rect x="5" y="15" width="4.5" height="11" rx="2" fill="#0F172A" stroke="#334155" stroke-width="0.8" />
            <rect x="32.5" y="15" width="4.5" height="11" rx="2" fill="#0F172A" stroke="#334155" stroke-width="0.8" />
            <!-- Rear Wheels Dual-Axle -->
            <rect x="4" y="38" width="4.5" height="10" rx="2" fill="#0F172A" stroke="#334155" stroke-width="0.8" />
            <rect x="4" y="49" width="4.5" height="10" rx="2" fill="#0F172A" stroke="#334155" stroke-width="0.8" />
            <rect x="33.5" y="38" width="4.5" height="10" rx="2" fill="#0F172A" stroke="#334155" stroke-width="0.8" />
            <rect x="33.5" y="49" width="4.5" height="10" rx="2" fill="#0F172A" stroke="#334155" stroke-width="0.8" />

            <!-- Side Mirrors -->
            <rect x="3.5" y="17" width="3" height="6" rx="1.2" fill="#D97706" />
            <line x1="6.5" y1="19" x2="9" y2="19" stroke="#94A3B8" stroke-width="1.2" />
            <rect x="35.5" y="17" width="3" height="6" rx="1.2" fill="#D97706" />
            <line x1="35.5" y1="19" x2="33" y2="19" stroke="#94A3B8" stroke-width="1.2" />

            <!-- Front Bumper -->
            <rect x="8" y="9" width="26" height="4.5" rx="2" fill="#1E293B" stroke="#475569" stroke-width="0.8" />
            <!-- Headlights -->
            <rect x="9.5" y="8" width="4" height="2" rx="0.8" fill="#FEF08A" />
            <rect x="28.5" y="8" width="4" height="2" rx="0.8" fill="#FEF08A" />

            <!-- Truck Cab Body (High-Visibility Industrial Orange) -->
            <rect x="8.5" y="12" width="25" height="16" rx="3.5" fill="url(#cabGrad)" stroke="#B45309" stroke-width="0.8" />

            <!-- Curved Windshield with Glass Reflection Highlights -->
            <path d="M 11 15.5 Q 21 13.5 31 15.5 L 30 20 Q 21 19 12 20 Z" fill="url(#glassGrad)" stroke="#0369A1" stroke-width="0.5" />
            <path d="M 13 16 Q 18 15 22 15.5 L 21 17.5 Q 17 17 13.5 17.5 Z" fill="#FFFFFF" opacity="0.6" />

            <!-- Cab Roof Ribs -->
            <line x1="16" y1="22" x2="16" y2="26" stroke="#D97706" stroke-width="1" stroke-linecap="round" />
            <line x1="21" y1="22" x2="21" y2="26" stroke="#D97706" stroke-width="1" stroke-linecap="round" />
            <line x1="26" y1="22" x2="26" y2="26" stroke="#D97706" stroke-width="1" stroke-linecap="round" />

            <!-- Dual Amber Hazard Beacons on Cab Roof -->
            <circle cx="12" cy="23.5" r="2.2" fill="#F59E0B" stroke="#FFFFFF" stroke-width="0.8" />
            <circle cx="30" cy="23.5" r="2.2" fill="#F59E0B" stroke="#FFFFFF" stroke-width="0.8" />

            <!-- Compactor Main Body (Bak Sampah Hidrolik Cerdas IoT) -->
            <rect x="7" y="27" width="28" height="30" rx="3" fill="url(#bodyGrad)" stroke="#042F2E" stroke-width="1" />

            <!-- Structural Reinforced Ribs & Highlights -->
            <rect x="8" y="28" width="26" height="2" fill="#14B8A6" opacity="0.65" />
            <line x1="9" y1="34" x2="33" y2="34" stroke="#042F2E" stroke-width="1.2" opacity="0.75" />
            <line x1="9" y1="40" x2="33" y2="40" stroke="#042F2E" stroke-width="1.2" opacity="0.75" />
            <line x1="9" y1="46" x2="33" y2="46" stroke="#042F2E" stroke-width="1.2" opacity="0.75" />
            <line x1="9" y1="52" x2="33" y2="52" stroke="#042F2E" stroke-width="1.2" opacity="0.75" />

            <!-- Top Roof Hatch of Compactor -->
            <rect x="15" y="32" width="12" height="18" rx="2" fill="#0A3C40" stroke="#14B8A6" stroke-width="0.6" opacity="0.9" />

            <!-- Rear Hopper & Compactor Mechanism -->
            <path d="M 8 57 L 34 57 L 32.5 63 L 9.5 63 Z" fill="url(#hopperGrad)" stroke="#0F172A" stroke-width="0.8" />
            <!-- Hydraulic Cylinders -->
            <rect x="9.5" y="55" width="2" height="5" rx="0.8" fill="#E2E8F0" />
            <rect x="30.5" y="55" width="2" height="5" rx="0.8" fill="#E2E8F0" />
            <!-- Rear Tail/Brake Lights -->
            <rect x="8.5" y="61" width="3.5" height="1.8" rx="0.5" fill="#EF4444" />
            <rect x="30" y="61" width="3.5" height="1.8" rx="0.5" fill="#EF4444" />
          </svg>
        </div>

        <!-- 3D HUD Floating Pill (Always upright, never rotated, high-contrast) -->
        <div style="position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.94);border:1.2px solid rgba(255,255,255,0.85);backdrop-filter:blur(6px);border-radius:12px;padding:1px 5px;font-family:'Public Sans',sans-serif;font-size:8.5px;font-weight:900;color:white;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.5);display:flex;align-items:center;gap:4px;z-index:20;">
          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${isAnimRunning ? '#10B981' : '#F59E0B'};box-shadow:0 0 5px ${isAnimRunning ? '#10B981' : '#F59E0B'};"></span>
          <span style="letter-spacing:-0.02em;color:${isOver ? '#FF7A6B' : 'white'};">${load}<span style="color:#94A3B8;font-weight:600;font-size:7.5px;">/${cap}L</span></span>
          <div style="width:18px;height:4px;background:#1E293B;border-radius:2px;overflow:hidden;border:0.5px solid rgba(255,255,255,0.3);">
            <div style="width:${pct}%;height:100%;background:${barColor};transition:width 0.25s ease;"></div>
          </div>
        </div>
      </div>
    `,
    iconSize: [42, 50],
    iconAnchor: [21, 25],
  });
}

export const RouteMap: React.FC<RouteMapProps> = ({
  bins,
  depot,
  config,
  result,
  selectedTripFilter,
  onSelectTripFilter,
  onEditBin,
  onDeleteBin,
  onQuickFillChange,
  onTriggerReport,
  onUpdateBinPosition,
  onUpdateDepotPosition,
  editMode,
  onToggleEditMode,
  onOpenAddBin,
  onOpenDepotModal,
  onOpenTemplatesModal,
  onResetMap,
  animRunning,
  animSpeed,
  onToggleAnimation,
  onResetAnimation,
  onChangeAnimSpeed,
  currentTruckWaypoint,
  currentTruckLoad,
  mapPickMode,
  onMapClickCoord,
  onRefreshRoadGeometries,
  theme = 'light',
  onStartPickBinOnMap,
  fixedTrip,
  showFixedComparison = false,
  onToggleFixedComparison,
  onOpenGoogleMapsModal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);

  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const polylinesRef = useRef<L.Polyline[]>([]);
  const stopBadgesRef = useRef<L.Marker[]>([]);
  const truckMarkerRef = useRef<L.Marker | null>(null);
  const tracerMarkerRef = useRef<L.Marker | null>(null);
  const tracingAnimRef = useRef<number | null>(null);

  // Subscribe to centralized road geometry store for automatic reactive updates
  const geomVersion = useSyncExternalStore(
    roadGeometryStore.subscribe,
    roadGeometryStore.getSnapshot
  );

  // States
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [showMapTools, setShowMapTools] = useState<boolean>(false);
  const [tracingActive, setTracingActive] = useState<boolean>(false);
  const [tracingMessage, setTracingMessage] = useState<string>('');
  const [viewMode, setViewMode] = useState<'real' | 'satellite'>('real');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(14);
  const [followTruck, setFollowTruck] = useState(false);

  const handleToggleFollowTruck = useCallback(() => {
    setFollowTruck(prev => !prev);
  }, []);

  const onMapClickCoordRef = useRef(onMapClickCoord);
  useEffect(() => {
    onMapClickCoordRef.current = onMapClickCoord;
  }, [onMapClickCoord]);

  // -------------------------------------------------------------
  // INITIALIZE LEAFLET MAP
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-7.7682, 110.2938],
      zoom: 14,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      className: theme === 'dark' ? 'dark-map-tiles' : '',
      attribution: '© OpenStreetMap contributors | Godean, Sleman, DIY',
    }).addTo(map);

    baseLayerRef.current = streetLayer;
    mapInstanceRef.current = map;

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    map.on('click', e => {
      onMapClickCoordRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (tracingAnimRef.current) cancelAnimationFrame(tracingAnimRef.current);
      map.remove();
      mapInstanceRef.current = null;
      truckMarkerRef.current = null;
      tracerMarkerRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------
  // CONTAINER RESIZE OBSERVER & TILE INVALIDATION
  // Fixes blank/empty map tiles on right side during fullscreen/resize
  // -------------------------------------------------------------
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 120);
      }
    });

    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  // When isFullscreen toggles, trigger multiple staggered invalidateSize calls to reload all tiles across full width
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 180);
    const t3 = setTimeout(() => map.invalidateSize(), 350);
    const t4 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isFullscreen]);

  // Support pressing Escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Update cursor when picking coordinates from map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const container = map.getContainer();
    if (mapPickMode) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
  }, [mapPickMode]);

  // Handle Layer Switch (Real Street vs Satellite & Light vs High-Contrast Dark)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current);

    if (viewMode === 'satellite') {
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
      ).addTo(map);

      const labelsLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(map);

      baseLayerRef.current = satLayer;
      labelsLayerRef.current = labelsLayer;
    } else {
      const tileUrl = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

      const streetLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        className: theme === 'dark' ? 'dark-map-tiles' : '',
        attribution: '© OpenStreetMap contributors | Kapanewon Godean, Sleman, DIY',
      }).addTo(map);

      baseLayerRef.current = streetLayer;
      labelsLayerRef.current = null;
    }
  }, [viewMode, theme]);

  // -------------------------------------------------------------
  // COMPUTED DISPLAY TRIPS & GEOMETRY STATUS (OSRM VS FALLBACK)
  // -------------------------------------------------------------
  const tripsToDisplay = useMemo(() => {
    if (selectedTripFilter === 'fixed') {
      if (fixedTrip) {
        if (fixedTrip.subTrips && fixedTrip.subTrips.length > 0) {
          return fixedTrip.subTrips.map((st, idx) => ({
            tripIndex: `Tetap #${st.subIndex || idx + 1}`,
            isFixed: true,
            bins: st.bins,
            loadLiter: st.loadLiter,
            tour: st.tour || [depot, ...st.bins, depot],
            distance: st.distance,
            roadCoords: st.roadCoords,
            realRoadKm: st.realRoadKm,
          }));
        }
        return [fixedTrip];
      }
      return [];
    }

    if (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-')) {
      const subIdx = parseInt(selectedTripFilter.replace('fixed-', ''), 10) - 1;
      if (fixedTrip?.subTrips && fixedTrip.subTrips[subIdx]) {
        const st = fixedTrip.subTrips[subIdx];
        return [
          {
            tripIndex: `Tetap #${st.subIndex || subIdx + 1}`,
            isFixed: true,
            bins: st.bins,
            loadLiter: st.loadLiter,
            tour: st.tour || [depot, ...st.bins, depot],
            distance: st.distance,
            roadCoords: st.roadCoords,
            realRoadKm: st.realRoadKm,
          },
        ];
      }
    }

    if (selectedTripFilter !== 'all') {
      return result.trips.filter(t => t.tripIndex === selectedTripFilter);
    }
    return result.trips;
  }, [result.trips, selectedTripFilter, fixedTrip, depot]);

  const isRefreshing = useMemo(() => {
    return tripsToDisplay.some(t => roadGeometryStore.isTourLoading(t.tour));
  }, [tripsToDisplay, geomVersion]);

  const hasAnyFallback = useMemo(() => {
    return tripsToDisplay.some(t => {
      const geom = roadGeometryStore.getTourGeometry(t.tour, false);
      return geom.status === 'failed' || (geom.status !== 'loading' && geom.source === 'fallback');
    });
  }, [tripsToDisplay, geomVersion]);

  // -------------------------------------------------------------
  // DRAW FULL STATIC ROUTES (READING DIRECTLY FROM STORE)
  // -------------------------------------------------------------
  const drawFullRoutes = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    polylinesRef.current.forEach(pl => map.removeLayer(pl));
    polylinesRef.current = [];
    stopBadgesRef.current.forEach(sb => map.removeLayer(sb));
    stopBadgesRef.current = [];

    if (!showRoutes) return;

    // Draw Fixed Route Comparison Overlay if enabled and not currently focused on fixed route
    const isFocusingFixed =
      selectedTripFilter === 'fixed' ||
      (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-'));

    if (showFixedComparison && !isFocusingFixed && fixedTrip) {
      const fixedTours =
        fixedTrip.subTrips && fixedTrip.subTrips.length > 0
          ? fixedTrip.subTrips.map(st => st.tour || [depot, ...st.bins, depot])
          : [fixedTrip.tour];

      fixedTours.forEach(fTour => {
        if (!fTour || fTour.length < 2) return;
        const fGeom = roadGeometryStore.getTourGeometry(fTour, true);
        const fCoords = fGeom.coords;
        if (!fCoords || fCoords.length < 2) return;

        const outerFixed = L.polyline(fCoords, {
          color: '#ffffff',
          weight: 6,
          opacity: 0.8,
          interactive: false,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        const innerFixed = L.polyline(fCoords, {
          color: '#64748B',
          weight: 3.5,
          opacity: 0.9,
          dashArray: '8, 8',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        innerFixed.bindTooltip(
          `Jalur Rute Tetap (Konvensional): ${fGeom.realDistanceKm || toRealKm(fixedTrip.distance)} km · Garis Putus-Putus Abu-abu`,
          { sticky: true }
        );

        polylinesRef.current.push(outerFixed);
        polylinesRef.current.push(innerFixed);
      });
    }

    tripsToDisplay.forEach((trip, tripOrder) => {
      const isFixed = trip.isFixed;
      const tripColor = isFixed
        ? { stroke: tripOrder === 0 ? '#334155' : tripOrder === 1 ? '#9A3412' : '#581C87' }
        : TRIP_COLORS[((typeof trip.tripIndex === 'number' ? trip.tripIndex : tripOrder + 1) - 1) % TRIP_COLORS.length];
      const tour = trip.tour || [];
      if (tour.length < 2) return;

      const geom = roadGeometryStore.getTourGeometry(tour, true);
      const coords = geom.coords;
      if (!coords || coords.length < 2) return;

      const isFallback = geom.source === 'fallback' || geom.status === 'failed';

      const outer = L.polyline(coords, {
        color: '#ffffff',
        weight: 7,
        opacity: 0.9,
        interactive: false,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Jika memakai jalur cadangan, gambar dengan garis putus-putus
      const inner = L.polyline(coords, {
        color: tripColor.stroke,
        weight: isFixed ? 4 : 4.5,
        opacity: 0.95,
        dashArray: isFixed ? '8, 8' : isFallback ? '6, 6' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      const tripKm = geom.realDistanceKm || trip.realRoadKm || toRealKm(trip.distance);
      const tripDistNum = parseFloat(tripKm) || trip.distance;
      const tripMin = toTravelMinutes(tripDistNum, config);
      const statusLabel =
        geom.status === 'loading'
          ? 'Memuat rute OSRM (Mode Mobil)...'
          : geom.status === 'ok'
          ? 'Sinkron Jalan Nyata Mode Mobil (OSRM/G-Maps)'
          : 'Jaringan Jalan Nyata Godean';

      inner.bindTooltip(
        `${trip.isFixed ? trip.tripIndex : `Trip ${trip.tripIndex}`}: ${tripKm} km (≈ ${tripMin} mnt) · ${statusLabel}`,
        { sticky: true }
      );

      polylinesRef.current.push(outer);
      polylinesRef.current.push(inner);

      tour.forEach((point, pIdx) => {
        if (point.id !== 'P') {
          const ptPos = getBinLatLng(point);
          const badgeIcon = L.divIcon({
            className: 'custom-stop-badge',
            html: `<div style="background:${isFixed ? '#334155' : '#10303A'};color:#F2C14E;border:2px solid white;width:20px;height:20px;border-radius:50%;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);position:absolute;top:-13px;left:11px;">${pIdx}</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          const stopMarker = L.marker(ptPos, { icon: badgeIcon, interactive: false }).addTo(map);
          stopBadgesRef.current.push(stopMarker);
        }
      });
    });
  }, [showRoutes, tripsToDisplay, config, showFixedComparison, selectedTripFilter, fixedTrip, depot]);

  // -------------------------------------------------------------
  // ANIMATED SEQUENTIAL ROUTE TRACING (PANGKALAN -> TONG 1 -> ...)
  // -------------------------------------------------------------
  const startRouteTracingAnimation = useCallback(
    (force = false) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Cancel any ongoing tracing animation
      if (tracingAnimRef.current) {
        cancelAnimationFrame(tracingAnimRef.current);
        tracingAnimRef.current = null;
      }

      // Clear existing drawn polylines, stop badges
      polylinesRef.current.forEach(pl => map.removeLayer(pl));
      polylinesRef.current = [];
      stopBadgesRef.current.forEach(sb => map.removeLayer(sb));
      stopBadgesRef.current = [];

      const tripsToDraw = tripsToDisplay;
      if (tripsToDraw.length === 0) {
        setTracingActive(false);
        return;
      }

      setTracingActive(true);
      setTracingMessage('Memulai dari Pangkalan Armada & TPS 3R (P)...');

      // Sequential Execution State
      let currentTripIdx = 0;
      let coordIdx = 0;
      let activePolyline: L.Polyline | null = null;
      let activeOuterLine: L.Polyline | null = null;
      let stopBadgesRevealed = new Set<string>();
      let lastTimestamp = 0;
      let pauseTicks = 0;

      // Prepare first trip data using centralized store
      let currentTrip = tripsToDraw[currentTripIdx];
      let currentTour = currentTrip.tour || [];
      let currentGeom = roadGeometryStore.getTourGeometry(currentTour, true);
      let currentRoadCoords = currentGeom.coords;
      let stopIndices = currentTour.map(pt => findClosestCoordIndex(getBinLatLng(pt), currentRoadCoords));

      const setupTripLines = (trip: Trip, coords: [number, number][], geomSource: string, geomStatus: string) => {
        const isFixed = trip.isFixed;
        const tripColor = isFixed
          ? { stroke: '#475569' }
          : TRIP_COLORS[((typeof trip.tripIndex === 'number' ? trip.tripIndex : currentTripIdx + 1) - 1) % TRIP_COLORS.length];

        const isFallback = geomSource === 'fallback' || geomStatus === 'failed';

        const outer = L.polyline([coords[0]], {
          color: '#ffffff',
          weight: 7,
          opacity: 0.9,
          interactive: false,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'route-path',
        }).addTo(map);

        const inner = L.polyline([coords[0]], {
          color: tripColor.stroke,
          weight: isFixed ? 3.5 : 4.5,
          opacity: 0.95,
          dashArray: isFixed ? '8, 8' : isFallback ? '6, 6' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'route-path',
        }).addTo(map);

        const tripKm = trip.realRoadKm || toRealKm(trip.distance);
        const tripMin = toTravelMinutes(trip.distance, config);
        inner.bindTooltip(`Trip ${trip.tripIndex}: ${tripKm} km (≈ ${tripMin} mnt) · ${trip.loadLiter} L`, {
          sticky: true,
        });

        polylinesRef.current.push(outer);
        polylinesRef.current.push(inner);
        return { outer, inner };
      };

      const lines = setupTripLines(currentTrip, currentRoadCoords, currentGeom.source, currentGeom.status);
      activeOuterLine = lines.outer;
      activePolyline = lines.inner;

      const stepAnimation = (timestamp: number) => {
        if (!currentRoadCoords || currentRoadCoords.length === 0) return;

        // If pausing at a stop so the viewer clearly notices the badge pop
        if (pauseTicks > 0) {
          pauseTicks--;
          tracingAnimRef.current = requestAnimationFrame(stepAnimation);
          return;
        }

        // Smooth and relaxed speed throttle: 1 coordinate every 55ms
        if (timestamp - lastTimestamp >= 55) {
          lastTimestamp = timestamp;
          coordIdx++;

          if (coordIdx >= currentRoadCoords.length) {
            coordIdx = currentRoadCoords.length - 1;
          }

          const subCoords = currentRoadCoords.slice(0, coordIdx + 1);
          if (activeOuterLine && activePolyline) {
            activeOuterLine.setLatLngs(subCoords);
            activePolyline.setLatLngs(subCoords);
          }

          // Check if any stops in the tour have been reached
          currentTour.forEach((pt, pIdx) => {
            const stopKey = `${currentTrip.tripIndex}-${pt.id}-${pIdx}`;
            if (pIdx > 0 && coordIdx >= stopIndices[pIdx] && !stopBadgesRevealed.has(stopKey)) {
              stopBadgesRevealed.add(stopKey);

              if (pt.id !== 'P') {
                const ptPos = getBinLatLng(pt);
                const badgeIcon = L.divIcon({
                  className: 'custom-stop-badge route-fade-enter',
                  html: `<div style="background:#10303A;color:#F2C14E;border:2px solid white;width:24px;height:24px;border-radius:50%;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.45);position:absolute;top:-14px;left:11px;animation:routePopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">${pIdx}</div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                });
                const stopMarker = L.marker(ptPos, { icon: badgeIcon, interactive: false }).addTo(map);
                stopBadgesRef.current.push(stopMarker);

                setTracingMessage(`Trip ${currentTrip.tripIndex}: Menghubungkan ${pt.name || `Tong ${pt.id}`} (Urutan ${pIdx})`);
                pauseTicks = 6; // pause ~330ms at each stop
              } else if (pIdx === currentTour.length - 1) {
                setTracingMessage(`Trip ${currentTrip.tripIndex}: Selesai — Kembali ke Pangkalan & TPS 3R (P)`);
                pauseTicks = 5;
              }
            }
          });

          // Did current trip finish?
          if (coordIdx >= currentRoadCoords.length - 1) {
            currentTripIdx++;
            if (currentTripIdx < tripsToDraw.length) {
              // Move to next trip
              currentTrip = tripsToDraw[currentTripIdx];
              currentTour = currentTrip.tour || [];
              currentGeom = roadGeometryStore.getTourGeometry(currentTour, true);
              currentRoadCoords = currentGeom.coords;
              stopIndices = currentTour.map(pt => findClosestCoordIndex(getBinLatLng(pt), currentRoadCoords));
              coordIdx = 0;

              const nextLines = setupTripLines(currentTrip, currentRoadCoords, currentGeom.source, currentGeom.status);
              activeOuterLine = nextLines.outer;
              activePolyline = nextLines.inner;

              setTracingMessage(`Mulai Trip ${currentTrip.tripIndex} dari Pangkalan Armada (P)...`);
              pauseTicks = 8; // pause ~440ms before next trip
              tracingAnimRef.current = requestAnimationFrame(stepAnimation);
            } else {
              // All trips finished tracing!
              setTracingMessage(`✓ Seluruh Rute Berhasil Dihubungkan dari Pangkalan`);
              setTimeout(() => {
                setTracingActive(false);
                drawFullRoutes();
              }, 1200);
            }
          } else {
            tracingAnimRef.current = requestAnimationFrame(stepAnimation);
          }
        } else {
          tracingAnimRef.current = requestAnimationFrame(stepAnimation);
        }
      };

      tracingAnimRef.current = requestAnimationFrame(stepAnimation);
    },
    [tripsToDisplay, config, drawFullRoutes]
  );

  // Skip tracing and show full routes immediately
  const handleSkipTracing = () => {
    if (tracingAnimRef.current) {
      cancelAnimationFrame(tracingAnimRef.current);
      tracingAnimRef.current = null;
    }
    const map = mapInstanceRef.current;
    if (map && tracerMarkerRef.current && map.hasLayer(tracerMarkerRef.current)) {
      map.removeLayer(tracerMarkerRef.current);
      tracerMarkerRef.current = null;
    }
    setTracingActive(false);
    drawFullRoutes();
  };

  // Toggle show/hide routes with automatic animated tracing
  const handleToggleShowRoutes = () => {
    if (showRoutes) {
      // Hiding routes
      if (animRunning) onToggleAnimation();
      if (tracingAnimRef.current) {
        cancelAnimationFrame(tracingAnimRef.current);
        tracingAnimRef.current = null;
      }
      setTracingActive(false);
      setShowRoutes(false);
    } else {
      // Revealing routes -> Play animated sequential tracing starting from pangkalan!
      setShowRoutes(true);
      setTimeout(() => {
        startRouteTracingAnimation(true);
      }, 100);
    }
  };

  // -------------------------------------------------------------
  // REQUIREMENT F: TRIGGER ANIMASI TRACING HANYA PADA MOMEN TEPAT
  // Mulai hanya saat: rute pertama kali ditampilkan, filter trip berubah, atau tombol "Tracing Rute" ditekan
  // (JANGAN restart karena perubahan telemetri MQTT atau bins!)
  // -------------------------------------------------------------
  const prevFilterRef = useRef(selectedTripFilter);
  const prevShowRoutesRef = useRef(showRoutes);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (!showRoutes) {
      prevShowRoutesRef.current = false;
      return;
    }

    const justShowedRoutes = !prevShowRoutesRef.current && showRoutes;
    const filterChanged = prevFilterRef.current !== selectedTripFilter;

    prevShowRoutesRef.current = showRoutes;
    prevFilterRef.current = selectedTripFilter;

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      startRouteTracingAnimation();
      return;
    }

    if (justShowedRoutes || filterChanged) {
      startRouteTracingAnimation();
    }
  }, [showRoutes, selectedTripFilter, startRouteTracingAnimation]);

  // -------------------------------------------------------------
  // REQUIREMENT C: ROUTE MAP MEMBACA GEOMETRI DARI STORE SECARA REAKTIF
  // Jika OSRM baru selesai di tengah animasi, hentikan animasi & gambar rute penuh.
  // Jika tidak sedang animasi, gambar rute penuh otomatis saat data store berubah.
  // -------------------------------------------------------------
  useEffect(() => {
    if (!showRoutes) {
      if (tracingAnimRef.current) {
        cancelAnimationFrame(tracingAnimRef.current);
        tracingAnimRef.current = null;
      }
      setTracingActive(false);
      const map = mapInstanceRef.current;
      if (map) {
        polylinesRef.current.forEach(pl => map.removeLayer(pl));
        polylinesRef.current = [];
        stopBadgesRef.current.forEach(sb => map.removeLayer(sb));
        stopBadgesRef.current = [];
      }
      return;
    }

    if (tracingActive) {
      const anyOsrmReady = tripsToDisplay.some(t => {
        const geom = roadGeometryStore.getEntry(generateTourKey(t.tour));
        return geom && geom.status === 'ok';
      });

      if (anyOsrmReady) {
        if (tracingAnimRef.current) {
          cancelAnimationFrame(tracingAnimRef.current);
          tracingAnimRef.current = null;
        }
        setTracingActive(false);
        drawFullRoutes();
      }
    } else {
      drawFullRoutes();
    }
  }, [geomVersion, showRoutes, tracingActive, tripsToDisplay, drawFullRoutes]);

  // -------------------------------------------------------------
  // RENDER BINS, DEPOT & TRUCK MARKERS (ISOLATED DARI ANIMASI RUTE)
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Render Depot & Bins Markers (Always present)
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    // 1. Depot Marker (Pangkalan Armada & TPS 3R)
    const depotPos = getBinLatLng(depot);
    const depotIcon = L.divIcon({
      className: 'custom-depot-marker',
      html: `<div style="background:#1D4ED8;color:white;width:34px;height:34px;border-radius:10px;border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.35);cursor:${
        editMode ? 'move' : 'pointer'
      };">P</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const depotMarker = L.marker(depotPos, {
      icon: depotIcon,
      draggable: editMode,
      zIndexOffset: 100,
    }).addTo(map);

    if (editMode) {
      depotMarker.on('dragend', e => {
        const newPos = (e.target as L.Marker).getLatLng();
        onUpdateDepotPosition(newPos.lat, newPos.lng);
      });
    }

    const depotPopupContent = document.createElement('div');
    depotPopupContent.style.fontFamily = "'Public Sans', sans-serif";
    depotPopupContent.style.minWidth = '210px';
    depotPopupContent.style.padding = '3px';
    depotPopupContent.innerHTML = `
      <div style="font-weight:bold;font-size:13px;color:#1D4ED8;">${depot.name}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">📍 ${depot.location || 'Kapanewon Godean'}</div>
      <div style="font-size:11px;color:#0F6B73;font-weight:bold;margin-top:4px;">Pusat Armada &amp; Penampungan TPS 3R</div>
      <div style="font-size:10px;color:#10b981;font-weight:bold;margin-top:2px;">✅ Akses Jalan Arteri Godean Bebas Hambatan (≥ 5.5m)</div>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${depot.lat},${depot.lng}&travelmode=driving&dirflg=d" target="_blank" rel="noopener noreferrer" style="width:100%;margin-top:6px;padding:6px;font-size:11px;background:#2563EB;color:white;border:none;border-radius:6px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:4px;font-weight:bold;cursor:pointer;">
        <span>🚗 Rute Pangkalan di Google Maps (Mode Mobil)</span>
      </a>
      <button id="btnOpenDepotModalRoute" style="width:100%;margin-top:6px;padding:6px;font-size:11px;background:#1D4ED8;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🏭 Atur / Pindah Pangkalan</button>
    `;
    depotPopupContent.querySelector('#btnOpenDepotModalRoute')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpenDepotModal();
    });

    depotMarker.bindPopup(depotPopupContent);
    markersRef.current['depot'] = depotMarker;

    // 2. Bin Markers
    bins.forEach(b => {
      const pos = getBinLatLng(b);
      const isDimmed =
        showRoutes &&
        selectedTripFilter !== 'all' &&
        selectedTripFilter !== 'fixed' &&
        !result.trips.some(t => t.tripIndex === selectedTripFilter && t.bins.some(tb => tb.id === b.id));

      const colorBg = b.noData
        ? '#4B5A63'
        : b.fill >= config.redLimit
        ? '#DC2626'
        : b.fill >= config.yellowLimit
        ? '#D97706'
        : '#059669';

      const opacity = isDimmed ? 0.35 : 1;

      const pulseHtml = b.hasActiveReport
        ? `<span style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#EF4444;color:white;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px #EF4444;border:2px solid white;animation:bounce 1s infinite;">!</span>`
        : '';

      const binIcon = L.divIcon({
        className: 'custom-bin-marker',
        html: `<div style="background:${colorBg};opacity:${opacity};color:white;width:32px;height:32px;border-radius:50%;border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;box-shadow:0 4px 8px rgba(0,0,0,0.25);position:relative;cursor:${
          editMode ? 'move' : 'pointer'
        };">${b.noData ? '?' : b.fill + '%'}${pulseHtml}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(pos, {
        icon: binIcon,
        draggable: editMode,
      }).addTo(map);

      if (editMode) {
        marker.on('dragend', e => {
          const newPos = (e.target as L.Marker).getLatLng();
          onUpdateBinPosition(b.id, newPos.lat, newPos.lng);
        });
      }

      const popupDiv = document.createElement('div');
      popupDiv.style.fontFamily = "'Public Sans', sans-serif";
      popupDiv.style.minWidth = '210px';
      popupDiv.style.padding = '3px';
      popupDiv.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:bold;font-size:13px;color:#10303A;">${b.name}</span>
          <span style="font-size:10px;font-weight:bold;padding:2px 6px;border-radius:6px;background:${colorBg}20;color:${colorBg};">
            ${b.noData ? '⚪ Tanpa Data' : b.fill >= config.redLimit ? '🔴 Penuh' : b.fill >= config.yellowLimit ? '🟡 Siaga' : '🟢 Aman'}
          </span>
        </div>
        ${b.location ? `<div style="font-size:11px;color:#64748b;margin:3px 0 5px;">${b.location}</div>` : ''}
        
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:6px;margin:6px 0 8px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#334155;">
            <span>Kapasitas Muatan:</span>
            <span style="color:${colorBg}">${b.noData ? '?' : b.fill + '% (' + litersOf(b, config) + ' L)'}</span>
          </div>
          <div style="height:6px;background:#E2E8F0;border-radius:3px;margin-top:4px;overflow:hidden;">
            <div style="width:${b.noData ? 0 : b.fill}%;height:100%;background:${colorBg};"></div>
          </div>
        </div>

        <div style="font-size:10px;font-weight:bold;color:#64748b;margin-bottom:4px;">Ubah Cepat Keterisian:</div>
        <div style="display:flex;gap:4px;margin-bottom:8px;">
          <button id="routeQ25-${b.id}" style="flex:1;padding:5px 0;font-size:10px;background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;border-radius:6px;cursor:pointer;font-weight:bold;">25%</button>
          <button id="routeQ65-${b.id}" style="flex:1;padding:5px 0;font-size:10px;background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;border-radius:6px;cursor:pointer;font-weight:bold;">65%</button>
          <button id="routeQ90-${b.id}" style="flex:1;padding:5px 0;font-size:10px;background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;border-radius:6px;cursor:pointer;font-weight:bold;">90%</button>
        </div>

        <div style="display:flex;gap:4px;margin-bottom:6px;">
          <button id="routeEditBtn-${b.id}" style="flex:1;padding:6px;font-size:11px;background:#0F6B73;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✏️ Edit</button>
          <button id="routeDelBtn-${b.id}" style="flex:1;padding:6px;font-size:11px;background:#FEE2E2;color:#B91C1C;border:1px solid #FECACA;border-radius:6px;cursor:pointer;font-weight:bold;">🗑️ Hapus</button>
        </div>

        <a href="https://www.google.com/maps/dir/?api=1&destination=${pos[0]},${pos[1]}&travelmode=driving&dirflg=d" target="_blank" rel="noopener noreferrer" style="width:100%;margin-bottom:6px;padding:6px;font-size:11px;background:#2563EB;color:white;border:none;border-radius:6px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:4px;font-weight:bold;cursor:pointer;">
          <span>🚗 Navigasi Google Maps (Mode Mobil)</span>
        </a>

        <button id="routeRepBtn-${b.id}" style="width:100%;padding:6px;font-size:11px;background:#DC2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center;gap:4px;">
          <span>🚨 Lapor Darurat / Meluap</span>
        </button>
      `;

      popupDiv.querySelector(`#routeQ25-${b.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        onQuickFillChange?.(b.id, 25);
      });
      popupDiv.querySelector(`#routeQ65-${b.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        onQuickFillChange?.(b.id, 65);
      });
      popupDiv.querySelector(`#routeQ90-${b.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        onQuickFillChange?.(b.id, 90);
      });
      popupDiv.querySelector(`#routeEditBtn-${b.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        onEditBin(b.id);
      });
      popupDiv.querySelector(`#routeDelBtn-${b.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteBin(b.id);
      });
      popupDiv.querySelector(`#routeRepBtn-${b.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        onTriggerReport?.(b.id);
      });

      marker.bindPopup(popupDiv);
      marker.bindTooltip(`${b.name}: ${b.noData ? 'Tanpa Data' : b.fill + '%'} — Klik untuk aksi`, { direction: 'top', offset: [0, -15] });

      marker.on('click', () => {
        if (!editMode) {
          onEditBin(b.id);
        }
      });

      markersRef.current[b.id] = marker;
    });

    // 3. Truck Marker
    if (showRoutes) {
      const currentTruckIcon = getTruckDivIcon(
        currentTruckLoad,
        config.C,
        currentTruckWaypoint,
        animRunning
      );

      if (!truckMarkerRef.current) {
        const truck = L.marker(depotPos, { icon: currentTruckIcon, zIndexOffset: 300 }).addTo(map);
        truck.bindPopup('<b>Armada Truk TrashRoute</b><br>Wilayah Operasional Kapanewon Godean');
        truckMarkerRef.current = truck;
      } else {
        truckMarkerRef.current.setIcon(currentTruckIcon);
        if (!map.hasLayer(truckMarkerRef.current)) {
          truckMarkerRef.current.addTo(map);
        }
      }
    } else {
      if (truckMarkerRef.current && map.hasLayer(truckMarkerRef.current)) {
        map.removeLayer(truckMarkerRef.current);
      }
    }
  }, [
    bins,
    depot,
    editMode,
    config,
    showRoutes,
    selectedTripFilter,
    result.trips,
    currentTruckLoad,
    currentTruckWaypoint,
    animRunning,
    onQuickFillChange,
    onTriggerReport,
    onEditBin,
    onDeleteBin,
    onOpenDepotModal,
    onUpdateBinPosition,
    onUpdateDepotPosition,
  ]);

  // Update truck animation position & dynamic HUD load bar in real time + auto-follow camera
  useEffect(() => {
    if (!truckMarkerRef.current || !showRoutes || tracingActive) return;
    const targetLatLng = currentTruckWaypoint
      ? ([currentTruckWaypoint.lat, currentTruckWaypoint.lng] as [number, number])
      : getBinLatLng(depot);

    truckMarkerRef.current.setLatLng(targetLatLng);
    truckMarkerRef.current.setIcon(
      getTruckDivIcon(currentTruckLoad, config.C, currentTruckWaypoint, animRunning)
    );

    if (followTruck && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(targetLatLng, { animate: true, duration: 0.25 });
    }
  }, [currentTruckWaypoint, currentTruckLoad, animRunning, config.C, depot, followTruck, showRoutes, tracingActive]);

  const handleCenterBins = () => {
    const map = mapInstanceRef.current;
    if (!map || bins.length === 0) return;
    const latlngs = bins.map(b => getBinLatLng(b));
    latlngs.push(getBinLatLng(depot));
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
  };

  return (
    <div
      className={`rounded-2xl border border-[#D9DFD7] bg-white shadow-sm transition-all dark:bg-[#121D22] dark:border-[#243741] ${
        isFullscreen
          ? 'fixed inset-0 z-[1000] m-0 flex flex-col h-screen w-screen rounded-none bg-white p-3 sm:p-4 overflow-hidden dark:bg-[#0B1317]'
          : 'relative isolate z-0 space-y-3 p-4'
      }`}
    >
      {/* Top Toolbar */}
      <div className="shrink-0 flex flex-col gap-2.5 border-b border-[#E5E9E2] pb-2.5 dark:border-[#243741]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Title & Live Status */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-2xs shrink-0">
              <Navigation className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-['Bricolage_Grotesque'] text-sm sm:text-base font-bold text-[#10303A] dark:text-[#F3F7F5] truncate">
                  Peta Rute Armada
                </h3>
                <span className="flex items-center gap-1 text-[11px] text-[#5B6A60] dark:text-[#A3B9B1]">
                  <span className={`h-1.5 w-1.5 rounded-full ${hasAnyFallback ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="hidden sm:inline font-medium">{hasAnyFallback ? 'OSRM Estimasi' : 'OSRM Jalan Nyata'}</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#5B6A60] dark:text-[#A3B9B1] truncate">
                Kapanewon Godean • Held-Karp Multi-Trip
              </p>
            </div>
          </div>

          {/* Controls: Rute Toggle, Satelit/Jalan, Alat, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Rute On/Off */}
            <button
              onClick={handleToggleShowRoutes}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                showRoutes
                  ? 'bg-blue-600 text-white shadow-2xs hover:bg-blue-700'
                  : 'bg-[#F5F7F3] text-[#46554B] border border-[#C4CEC2] hover:bg-slate-200 dark:bg-[#17262D] dark:text-[#A3B9B1] dark:border-[#243741]'
              }`}
              title={showRoutes ? 'Sembunyikan garis rute' : 'Tampilkan garis rute'}
            >
              {showRoutes ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showRoutes ? 'Rute On' : 'Rute Off'}</span>
            </button>

            {/* Google Maps Route Modal */}
            {onOpenGoogleMapsModal && (
              <button
                onClick={onOpenGoogleMapsModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                title="Buka navigasi rute lengkap di Google Maps"
              >
                <Navigation className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">G-Maps</span>
              </button>
            )}

            {/* Satelit / Jalan Switcher */}
            <div className="inline-flex rounded-lg border border-[#D9DFD7] bg-[#F5F7F3] p-0.5 dark:bg-[#17262D] dark:border-[#243741]">
              <button
                onClick={() => setViewMode('real')}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'real'
                    ? 'bg-white font-bold text-[#10303A] shadow-2xs dark:bg-[#121D22] dark:text-white'
                    : 'text-[#5B6A60] hover:text-[#10303A] dark:text-[#A3B9B1]'
                }`}
              >
                Jalan
              </button>
              <button
                onClick={() => setViewMode('satellite')}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'satellite'
                    ? 'bg-white font-bold text-[#10303A] shadow-2xs dark:bg-[#121D22] dark:text-white'
                    : 'text-[#5B6A60] hover:text-[#10303A] dark:text-[#A3B9B1]'
                }`}
              >
                Satelit
              </button>
            </div>

            {/* Alat Peta Toggle (Hides / shows the 6 management buttons) */}
            <button
              onClick={() => setShowMapTools(!showMapTools)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer transition ${
                showMapTools
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-[#D9DFD7] bg-[#F5F7F3] text-[#46554B] dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1] hover:bg-slate-200 dark:hover:bg-[#20333D]'
              }`}
              title="Buka / tutup alat pengelolaan tong, pangkalan, dan template"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>{showMapTools ? 'Tutup Alat' : 'Alat'}</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center rounded-lg border border-[#D9DFD7] bg-[#F5F7F3] p-1.5 text-xs font-semibold text-[#46554B] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1] cursor-pointer"
              title="Layar Penuh"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Map Tools Drawer (Opens on demand) */}
        {showMapTools && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-2 text-xs dark:bg-[#15232A] dark:border-[#243741] transition">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={onOpenAddBin}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>+ Tong</span>
              </button>

              <button
                onClick={onOpenDepotModal}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 cursor-pointer"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>🏭 Pangkalan</span>
              </button>

              <button
                onClick={onOpenTemplatesModal}
                className="inline-flex items-center gap-1 rounded-lg border border-[#C4CEC2] bg-white px-2.5 py-1 text-xs font-semibold text-[#10303A] hover:bg-slate-100 dark:bg-[#17262D] dark:border-[#243741] dark:text-white cursor-pointer"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-purple-600" />
                <span>Template</span>
              </button>

              <button
                onClick={onToggleEditMode}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  editMode
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold dark:bg-amber-950 dark:text-amber-200'
                    : 'border-[#C4CEC2] bg-white text-[#10303A] hover:bg-slate-100 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                }`}
              >
                <Move className="h-3.5 w-3.5" />
                <span>{editMode ? '✓ Geser Aktif' : 'Geser Lokasi'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={onRefreshRoadGeometries}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D9DFD7] bg-white px-2.5 py-1 text-xs font-medium text-[#5B6A60] hover:bg-slate-100 dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1] cursor-pointer disabled:opacity-50"
              >
                {isRefreshing ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                ) : (
                  <Sparkles className="h-3 w-3 text-amber-600" />
                )}
                <span>{isRefreshing ? 'Memuat...' : 'Refresh Jalan'}</span>
              </button>

              <button
                onClick={onResetMap}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Route Operations Row */}
        {showRoutes && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
            {/* Trip Selector Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              <button
                onClick={() => onSelectTripFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                  selectedTripFilter === 'all'
                    ? 'bg-[#10303A] text-white shadow-2xs dark:bg-blue-600'
                    : 'text-[#46554B] hover:bg-slate-100 dark:text-[#A3B9B1] dark:hover:bg-[#20333D]'
                }`}
              >
                Semua ({result.trips.length})
              </button>

              {result.trips.map((t, idx) => {
                const colorObj = TRIP_COLORS[idx % TRIP_COLORS.length];
                const isActive = selectedTripFilter === t.tripIndex;
                return (
                  <button
                    key={t.tripIndex}
                    onClick={() => onSelectTripFilter(t.tripIndex as number)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                      isActive ? 'text-white shadow-2xs' : 'text-[#46554B] hover:bg-slate-100 dark:text-[#A3B9B1] dark:hover:bg-[#20333D]'
                    }`}
                    style={{ backgroundColor: isActive ? colorObj.stroke : undefined }}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : ''}`}
                      style={{ backgroundColor: !isActive ? colorObj.stroke : undefined }}
                    />
                    <span>Trip {t.tripIndex}</span>
                  </button>
                );
              })}

              <button
                onClick={() => onSelectTripFilter(selectedTripFilter === 'fixed' ? 'all' : 'fixed')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                  selectedTripFilter === 'fixed' || (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-'))
                    ? 'bg-slate-700 text-white shadow-2xs dark:bg-slate-600'
                    : 'text-[#46554B] hover:bg-slate-100 dark:text-[#A3B9B1] dark:hover:bg-[#20333D]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <span>Rute Tetap</span>
              </button>

              {onToggleFixedComparison && (
                <button
                  onClick={onToggleFixedComparison}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition cursor-pointer shrink-0 whitespace-nowrap border ${
                    showFixedComparison
                      ? 'bg-slate-800 text-yellow-300 border-slate-700 shadow-2xs'
                      : 'border-[#D9DFD7] bg-white text-[#5B6A60] hover:bg-slate-100 dark:bg-[#121D22] dark:border-[#243741] dark:text-[#A3B9B1]'
                  }`}
                  title="Bandingkan rute tetap konvensional dengan rute cerdas di peta"
                >
                  <span>{showFixedComparison ? 'Bandingkan: ON' : 'Bandingkan'}</span>
                </button>
              )}
            </div>

            {/* Truck Animation Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onToggleAnimation}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold text-white shadow-2xs transition cursor-pointer ${
                  animRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {animRunning ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                <span>{animRunning ? 'Jeda' : 'Simulasi'}</span>
              </button>

              <button
                onClick={onResetAnimation}
                className="rounded-lg border border-[#D9DFD7] bg-[#F5F7F3] p-1 text-[#46554B] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1] cursor-pointer"
                title="Reset Posisi Truk ke Pangkalan"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={handleToggleFollowTruck}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                  followTruck
                    ? 'bg-blue-600 text-white shadow-2xs hover:bg-blue-700'
                    : 'bg-[#F5F7F3] text-[#10303A] border border-[#D9DFD7] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                }`}
                title="Kamera otomatis mengikuti truk"
              >
                <Crosshair className={`h-3 w-3 ${followTruck ? 'animate-pulse text-yellow-300' : 'text-blue-600'}`} />
                <span className="hidden sm:inline">{followTruck ? 'Ikuti' : 'Fokus'}</span>
              </button>

              <button
                onClick={() => {
                  const speeds = [0.5, 1, 2, 4, 8];
                  const nextIdx = (speeds.indexOf(animSpeed) + 1) % speeds.length;
                  onChangeAnimSpeed(speeds[nextIdx]);
                }}
                className="rounded-lg border border-[#D9DFD7] bg-[#F5F7F3] px-2 py-1 text-xs font-bold text-[#10303A] dark:bg-[#17262D] dark:border-[#243741] dark:text-white cursor-pointer"
                title="Ganti Kecepatan"
              >
                ⚡ {animSpeed}x
              </button>
            </div>
          </div>
        )}

        {/* Fallback Warning (Shown only if any fallback exists) */}
        {hasAnyFallback && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>Satu atau lebih trip digambar dengan garis putus-putus perkiraan karena OSRM sibuk.</span>
          </div>
        )}
      </div>

      {/* Map Viewport Container */}
      <div
        className={`relative isolate z-0 w-full overflow-hidden rounded-xl border border-[#D9DFD7] bg-[#e5e7eb] dark:border-[#243741] dark:bg-[#0B1317] ${
          isFullscreen ? 'flex-1 min-h-[300px] my-2' : 'h-[360px] sm:h-[460px] lg:h-[520px]'
        }`}
      >
        <div ref={mapContainerRef} className="h-full w-full" style={{ width: '100%', height: '100%' }} />

        {/* Live Tracing Route Floating HUD Banner */}
        {tracingActive && (
          <aside
            role="status"
            aria-live="polite"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] flex max-w-lg w-[90%] sm:w-auto items-center justify-between gap-3 rounded-2xl border-2 border-blue-500 bg-[#10303A]/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm animate-pulse">
                <Navigation className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-300">
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                  <span>ANIMASI PENELUSURAN RUTE JALAN RAYA</span>
                </div>
                <div className="text-xs font-semibold text-white truncate max-w-[260px] sm:max-w-md">
                  {tracingMessage}
                </div>
              </div>
            </div>

            <button
              onClick={handleSkipTracing}
              className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-white/30 cursor-pointer"
              title="Lewati animasi dan tampilkan rute penuh langsung"
            >
              <FastForward className="h-3 w-3" />
              <span>Lewati</span>
            </button>
          </aside>
        )}
      </div>

      {/* Legend & Camera Navigation Controls */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E9E2] pt-2 text-xs text-[#5B6A60] dark:border-[#243741] dark:text-[#A3B9B1]">
        {/* Tong & Route Status Chips */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5">
            <span className="grid h-4 w-4 place-items-center rounded bg-blue-700 text-[10px] font-extrabold text-white">
              P
            </span>
            <span className="font-semibold text-[#10303A] dark:text-white">Pangkalan</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-red-200 dark:ring-red-900" />
            <span className="hidden sm:inline">Merah (&ge;{config.redLimit}%, wajib)</span>
            <span className="sm:hidden font-medium text-[11px]">Penuh</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900" />
            <span className="hidden sm:inline">Kuning ({config.yellowLimit}–{config.redLimit}%, selektif)</span>
            <span className="sm:hidden font-medium text-[11px]">Sedang</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900" />
            <span className="hidden sm:inline">Hijau (&lt;{config.yellowLimit}%, dilewati)</span>
            <span className="sm:hidden font-medium text-[11px]">Aman</span>
          </span>

          {showRoutes && (
            <span className="hidden md:inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-[#17262D] dark:text-slate-300">
              <span>Nomor ①, ②.. = Urutan Angkut TSP</span>
            </span>
          )}
        </div>

        {/* Zoom & Center Camera Controls */}
        <div className="flex items-center gap-2">
          <div className="zoom-bar inline-flex items-center gap-1 rounded-xl border border-[#D9DFD7] bg-[#F4F6F1] p-1 dark:bg-[#17262D] dark:border-[#243741]">
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="grid h-6 w-6 place-items-center rounded bg-white text-xs font-bold text-[#10303A] shadow-2xs hover:bg-[#E8ECE6] dark:bg-[#121D22] dark:text-white dark:hover:bg-[#20333D] cursor-pointer"
              title="Perkecil"
            >
              −
            </button>
            <span className="min-w-8 text-center text-[11px] font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">
              z{zoomLevel}
            </span>
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="grid h-6 w-6 place-items-center rounded bg-white text-xs font-bold text-[#10303A] shadow-2xs hover:bg-[#E8ECE6] dark:bg-[#121D22] dark:text-white dark:hover:bg-[#20333D] cursor-pointer"
              title="Perbesar"
            >
              +
            </button>
            <button
              onClick={handleCenterBins}
              className="grid h-6 w-6 place-items-center rounded bg-white text-xs text-[#10303A] shadow-2xs hover:bg-[#E8ECE6] dark:bg-[#121D22] dark:text-white dark:hover:bg-[#20333D] cursor-pointer"
              title="Pusatkan Kamera ke Seluruh Tong"
            >
              <Crosshair className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
            </button>
            {showRoutes && (
              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    const targetLatLng = currentTruckWaypoint
                      ? ([currentTruckWaypoint.lat, currentTruckWaypoint.lng] as [number, number])
                      : getBinLatLng(depot);
                    mapInstanceRef.current.panTo(targetLatLng, { animate: true, duration: 0.35 });
                  }
                }}
                className="grid h-6 w-6 place-items-center rounded bg-white text-xs text-[#10303A] shadow-2xs hover:bg-[#E8ECE6] dark:bg-[#121D22] dark:text-white dark:hover:bg-[#20333D] cursor-pointer"
                title="Pusatkan Kamera ke Posisi Truk"
              >
                🚚
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
