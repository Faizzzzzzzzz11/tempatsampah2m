import React, { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from 'react';
import { Crosshair } from 'lucide-react';
import { Header } from './components/Header';
import { KpiStrip } from './components/KpiStrip';
import { RouteMap } from './components/RouteMap';
import { TruckTelemetryBar } from './components/TruckTelemetryBar';
import { TripBreakdownCard } from './components/TripBreakdownCard';
import { TpsCapacityCard } from './components/TpsCapacityCard';
import { EfficiencyCard } from './components/EfficiencyCard';
import { BinsQuickGrid } from './components/BinsQuickGrid';
import { IncidentDesk } from './components/IncidentDesk';
import {
  EditBinModal,
  AddBinModal,
  DepotModal,
  ConfigModal,
} from './components/Modals';
import { GoogleMapsNavModal } from './components/GoogleMapsNavModal';
import {
  Bin,
  Depot,
  SystemConfig,
  ExecutionResult,
  CitizenReport,
  AnimWaypoint,
} from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_DEPOT,
  DEFAULT_BINS_24,
  GODEAN_DEPOT_PRESETS,
} from './data/godeanData';
import {
  runFlowchartLogic,
  conventionalPlan,
  getFixedTrip,
  buildAnimationPath,
  roadGeometryStore,
} from './services/routingEngine';
import {
  isValidCoordinate,
  migrateStorageData,
  CURRENT_SCHEMA_VERSION,
} from './services/coordinateUtils';
import {
  buildDistanceMatrix,
  clearMatrixCache,
  DistanceMatrixResult,
} from './services/distanceMatrix';
import { RealtimeSyncManager, playAlertChime } from './services/realtimeSync';

const MAP_STORAGE_KEY = 'trashroute_map_v5';
const THEME_STORAGE_KEY = 'trashroute_theme';
const TPS_CONFIG_STORAGE_KEY = 'trashroute_tps_config';
const TPS_COMPLETED_STORAGE_KEY = 'trashroute_tps_completed';

export default function App() {
  // -------------------------------------------------------------
  // THEME MANAGEMENT (HIGH-CONTRAST DARK / LIGHT)
  // -------------------------------------------------------------
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {}
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // -------------------------------------------------------------
  // INITIAL MAP DATA WITH SCHEMA MIGRATION & COORDINATE VALIDATION
  // -------------------------------------------------------------
  const initialMapData = useMemo(() => {
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return migrateStorageData(parsed, DEFAULT_DEPOT, DEFAULT_BINS_24);
      }
    } catch {}
    return {
      depot: DEFAULT_DEPOT,
      bins: DEFAULT_BINS_24,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }, []);

  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [depot, setDepot] = useState<Depot>(initialMapData.depot);
  const [bins, setBins] = useState<Bin[]>(initialMapData.bins);

  // Asynchronous OSRM Road Distance Matrix State
  const [distMatrix, setDistMatrix] = useState<DistanceMatrixResult | null>(null);
  const [isCalculatingMatrix, setIsCalculatingMatrix] = useState<boolean>(false);

  const [selectedScenario, setSelectedScenario] = useState('sedikit');
  const [selectedTripFilter, setSelectedTripFilter] = useState<'all' | 'fixed' | number | string>('all');
  const [showFixedComparison, setShowFixedComparison] = useState(false);
  const [manualSplitMode, setManualSplitMode] = useState<'auto' | number>('auto');
  const [editMode, setEditMode] = useState(false);
  const [mapPickMode, setMapPickMode] = useState<'bin' | 'depot' | null>(null);
  const [addBinCoords, setAddBinCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [showMatrixDetail, setShowMatrixDetail] = useState(false);

  // Reports State
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [activeReportAlert, setActiveReportAlert] = useState<CitizenReport | null>(null);
  const [mqttStatus, setMqttStatus] = useState<'connected' | 'connecting' | 'fallback'>('connecting');

  // Animation State
  const [animRunning, setAnimRunning] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(2);
  const [animWaypoint, setAnimWaypoint] = useState<AnimWaypoint | null>(null);
  const [currentTruckLoad, setCurrentTruckLoad] = useState(0);
  const [prevTruckLoad, setPrevTruckLoad] = useState(0);

  // TPS (Tempat Pembuangan Sementara) Capacity State
  const [tpsMaxCapacity, setTpsMaxCapacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TPS_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tpsMaxCapacity) return parsed.tpsMaxCapacity;
      }
    } catch {}
    return 6000; // 6,000 Liter (6 m3) kapasitas kontainer/hanggar TPS 3R Godean
  });

  const [tpsInitialWaste, setTpsInitialWaste] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TPS_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tpsInitialWaste !== undefined) return parsed.tpsInitialWaste;
      }
    } catch {}
    return 0;
  });

  const [completedTripIds, setCompletedTripIds] = useState<(number | string)[]>(() => {
    try {
      const saved = localStorage.getItem(TPS_COMPLETED_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Modals State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBinId, setEditingBinId] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [depotModalOpen, setDepotModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [gmapsModalOpen, setGmapsModalOpen] = useState(false);
  const [gmapsInitialTripIndex, setGmapsInitialTripIndex] = useState<number | string | undefined>(undefined);

  const handleOpenGoogleMaps = useCallback((tripIdx?: number | string) => {
    setGmapsInitialTripIndex(tripIdx);
    setGmapsModalOpen(true);
  }, []);

  // Persist TPS State
  useEffect(() => {
    try {
      localStorage.setItem(
        TPS_CONFIG_STORAGE_KEY,
        JSON.stringify({ tpsMaxCapacity, tpsInitialWaste })
      );
    } catch {}
  }, [tpsMaxCapacity, tpsInitialWaste]);

  useEffect(() => {
    try {
      localStorage.setItem(TPS_COMPLETED_STORAGE_KEY, JSON.stringify(completedTripIds));
    } catch {}
  }, [completedTripIds]);

  // Refs for animation loop
  const animFrameRef = useRef<number | null>(null);
  const animIndexRef = useRef(0);
  const animPathRef = useRef<AnimWaypoint[]>([]);
  const syncManagerRef = useRef<RealtimeSyncManager | null>(null);

  // -------------------------------------------------------------
  // ASYNCHRONOUS OSRM DISTANCE MATRIX CALCULATION
  // Non-blocking: UI remains interactive while table API is fetching
  // -------------------------------------------------------------
  useEffect(() => {
    let isCurrent = true;
    setIsCalculatingMatrix(true);

    buildDistanceMatrix([depot, ...bins], config)
      .then(matrix => {
        if (isCurrent) {
          setDistMatrix(matrix);
          setIsCalculatingMatrix(false);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setIsCalculatingMatrix(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [depot, bins, config.truckSpeedKmh]);

  // -------------------------------------------------------------
  // CALCULATIONS (ROUTING & CONVENTIONAL PLAN WITH SAME DISTANCE MATRIX)
  // Reactive subscription to roadGeometryStore ensures distances sync with real OSRM / Google Maps driving distances
  // -------------------------------------------------------------
  const roadGeomVersion = useSyncExternalStore(
    roadGeometryStore.subscribe,
    roadGeometryStore.getSnapshot
  );

  const result: ExecutionResult = useMemo(() => {
    return runFlowchartLogic(bins, depot, config, manualSplitMode, distMatrix);
  }, [bins, depot, config, manualSplitMode, distMatrix, roadGeomVersion]);

  const convPlan = useMemo(() => {
    return conventionalPlan(bins, depot, config, distMatrix);
  }, [bins, depot, config, distMatrix, roadGeomVersion]);

  const fixedTrip = useMemo(() => {
    return getFixedTrip(bins, depot, config, distMatrix);
  }, [bins, depot, config, distMatrix, roadGeomVersion]);

  // Persist Map State with schema version
  useEffect(() => {
    try {
      localStorage.setItem(
        MAP_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          depot,
          bins,
        })
      );
    } catch {}
  }, [depot, bins]);

  // -------------------------------------------------------------
  // REAL-TIME SYNC & MQTT INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    syncManagerRef.current = new RealtimeSyncManager(
      // On report received
      report => {
        setReports(prev => {
          if (prev.some(r => r.reportId === report.reportId)) return prev;
          return [report, ...prev];
        });
        setActiveReportAlert(report);
        playAlertChime();

        // Mark bin as having active report
        setBins(prevBins =>
          prevBins.map(b => {
            if (b.id === report.binId) {
              const newFill = report.type.includes('Meluap') ? Math.max(88, b.fill) : b.fill;
              return {
                ...b,
                fill: newFill,
                hasActiveReport: true,
                reportType: report.type,
                reportTime: report.time,
              };
            }
            return b;
          })
        );
      },
      // On telemetry received from ESP32
      (binId, fillPercent) => {
        setBins(prevBins =>
          prevBins.map(b => (b.id === binId ? { ...b, fill: Math.round(fillPercent) } : b))
        );
      },
      // On status change
      status => setMqttStatus(status)
    );

    return () => {
      syncManagerRef.current?.destroy();
    };
  }, []);

  // -------------------------------------------------------------
  // TRUCK ANIMATION ENGINE
  // -------------------------------------------------------------
  const handleToggleAnimation = useCallback(() => {
    if (animRunning) {
      setAnimRunning(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    } else {
      let tripsToAnimate = result.trips;
      if (selectedTripFilter === 'fixed') {
        tripsToAnimate = [fixedTrip];
      } else if (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-')) {
        const subIdx = parseInt(selectedTripFilter.replace('fixed-', ''), 10) - 1;
        if (fixedTrip.subTrips && fixedTrip.subTrips[subIdx]) {
          const st = fixedTrip.subTrips[subIdx];
          tripsToAnimate = [
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
        } else {
          tripsToAnimate = [fixedTrip];
        }
      } else if (selectedTripFilter !== 'all') {
        tripsToAnimate = result.trips.filter(t => t.tripIndex === selectedTripFilter);
      }

      if (tripsToAnimate.length === 0) return;

      const path = buildAnimationPath(tripsToAnimate);
      if (path.length === 0) return;

      animPathRef.current = path;
      if (animIndexRef.current >= path.length) {
        animIndexRef.current = 0;
        setCurrentTruckLoad(0);
        setPrevTruckLoad(0);
      }

      setAnimRunning(true);
    }
  }, [animRunning, result.trips, selectedTripFilter, fixedTrip]);

  const pauseTicksRef = useRef<number>(0);

  const handleResetAnimation = useCallback(() => {
    setAnimRunning(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animIndexRef.current = 0;
    pauseTicksRef.current = 0;
    setAnimWaypoint(null);
    setCurrentTruckLoad(0);
    setPrevTruckLoad(0);
  }, []);

  // Animation Step Loop
  useEffect(() => {
    if (!animRunning) return;

    let lastTime = 0;
    const step = (timestamp: number) => {
      const interval = 80 / animSpeed;
      if (timestamp - lastTime >= interval) {
        lastTime = timestamp;

        if (pauseTicksRef.current > 0) {
          pauseTicksRef.current--;
          animFrameRef.current = requestAnimationFrame(step);
          return;
        }

        if (animIndexRef.current < animPathRef.current.length) {
          const pt = animPathRef.current[animIndexRef.current];
          setAnimWaypoint(pt);

          if (pt.isStop && pt.stopBin) {
            // Pause 8-14 frames to show collection and fill bar rising
            pauseTicksRef.current = Math.max(6, Math.round(12 / animSpeed));

            if (pt.stopBin.id === 'P') {
              if (pt.tripIndex !== undefined) {
                setCompletedTripIds(prev => {
                  if (prev.includes(pt.tripIndex)) return prev;
                  return [...prev, pt.tripIndex];
                });
              }
              setPrevTruckLoad(currentTruckLoad);
              setCurrentTruckLoad(0);
            } else {
              const binLiter = Math.round((('fill' in pt.stopBin ? pt.stopBin.fill || 0 : 0) * config.binCap) / 100);
              setCurrentTruckLoad(prev => {
                setPrevTruckLoad(prev);
                return Math.min(config.C, prev + binLiter);
              });
            }
          }

          animIndexRef.current++;
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          // Finished all trips
          setAnimRunning(false);
          animIndexRef.current = 0;
          pauseTicksRef.current = 0;
        }
      } else {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animRunning, animSpeed, config.binCap, config.C]);

  const handlePlaySpecificTripAnim = (tripIdx: number | string) => {
    setSelectedTripFilter(tripIdx);
    handleResetAnimation();
    setTimeout(() => {
      let tripsToAnimate = result.trips.filter(t => t.tripIndex === tripIdx);
      if (tripIdx === 'fixed') {
        tripsToAnimate = [fixedTrip];
      } else if (typeof tripIdx === 'string' && tripIdx.startsWith('fixed-')) {
        const subIdx = parseInt(tripIdx.replace('fixed-', ''), 10) - 1;
        if (fixedTrip.subTrips && fixedTrip.subTrips[subIdx]) {
          const st = fixedTrip.subTrips[subIdx];
          tripsToAnimate = [
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
        } else {
          tripsToAnimate = [fixedTrip];
        }
      }
      const path = buildAnimationPath(tripsToAnimate);
      animPathRef.current = path;
      animIndexRef.current = 0;
      setAnimRunning(true);
    }, 100);
  };

  // -------------------------------------------------------------
  // PRESET SCENARIOS
  // -------------------------------------------------------------
  const handleSelectScenario = (scenario: string) => {
    setSelectedScenario(scenario);
    handleResetAnimation();
    setCompletedTripIds([]);

    setBins(prev => {
      const updated = prev.map(b => ({ ...b, noData: false }));

      if (scenario === 'kosong') {
        // Kasus 1: Tidak ada tong merah
        updated.forEach((b, idx) => {
          b.fill = idx % 2 === 0 ? 30 : 60;
        });
      } else if (scenario === 'sedikit') {
        // Kasus 2: Sedikit tong (~535 Liter, 1 Trip)
        updated.forEach(b => {
          if ([1, 4, 15, 21].includes(b.id)) {
            b.fill = 85;
          } else if ([2, 14, 22].includes(b.id)) {
            b.fill = 65;
          } else {
            b.fill = 20;
          }
        });
      } else if (scenario === 'cukup') {
        // Kasus 3: Cukup banyak (~1.440 Liter, 2 Trip)
        updated.forEach(b => {
          if ([1, 3, 4, 6, 8, 9, 10, 12, 13, 15, 17, 19, 21, 24].includes(b.id)) {
            b.fill = 88;
          } else if ([2, 7, 14, 18, 22].includes(b.id)) {
            b.fill = 68;
          } else {
            b.fill = 25;
          }
        });
      } else if (scenario === 'banyak') {
        // Kasus 4: Sangat banyak (~2.150 Liter, 3 Trip)
        const fills = [90, 88, 92, 85, 91, 89, 93, 87, 90, 86, 94, 88, 89, 91, 87, 92, 85, 90, 88, 93, 89, 91, 86, 92];
        updated.forEach((b, idx) => {
          b.fill = fills[idx % fills.length];
        });
      } else if (scenario === 'abu') {
        // Kasus 5: Ada tong abu-abu (tanpa data)
        updated.forEach(b => {
          if ([4, 12, 20].includes(b.id)) b.noData = true;
          else if ([1, 8, 15].includes(b.id)) b.fill = 85;
          else b.fill = 40;
        });
      } else if (scenario === 'random') {
        updated.forEach(b => {
          b.fill = Math.floor(10 + Math.random() * 88);
        });
      }
      return updated;
    });
  };

  // -------------------------------------------------------------
  // BIN & DEPOT ACTIONS
  // -------------------------------------------------------------
  const handleOpenBinModal = (binId: number) => {
    setEditingBinId(binId);
    setEditModalOpen(true);
  };

  const handleSaveBinModal = (
    binId: number,
    fill: number,
    noData: boolean,
    name?: string,
    location?: string
  ) => {
    setBins(prev =>
      prev.map(b =>
        b.id === binId
          ? {
              ...b,
              fill,
              noData,
              name: name !== undefined && name.trim() !== '' ? name.trim() : b.name,
              location: location !== undefined ? location.trim() : b.location,
            }
          : b
      )
    );
    setEditModalOpen(false);
  };

  const handleDeleteBin = (binId: number) => {
    if (bins.length <= 1) {
      return;
    }
    setBins(prev => prev.filter(item => item.id !== binId));
    setEditModalOpen(false);
  };

  const handleQuickFillChange = (binId: number, fill: number) => {
    setBins(prev => prev.map(b => (b.id === binId ? { ...b, fill, noData: false } : b)));
  };

  const handleUpdateBinPosition = (binId: number, lat: number, lng: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    setBins(prev =>
      prev.map(b =>
        b.id === binId
          ? {
              ...b,
              lat: Math.round(lat * 100000) / 100000,
              lng: Math.round(lng * 100000) / 100000,
            }
          : b
      )
    );
  };

  const handleUpdateDepotPosition = (lat: number, lng: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    setDepot(prev => ({
      ...prev,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
    }));
  };

  const handleAddBin = (name: string, location: string, lat: number, lng: number, fill: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    const nextId = bins.reduce((max, b) => Math.max(max, b.id), 0) + 1;
    const newBin: Bin = {
      id: nextId,
      name,
      location,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
      fill,
      noData: false,
    };
    setBins(prev => [...prev, newBin]);
  };

  const handleStartPickBinOnMap = () => {
    setAddModalOpen(false);
    setMapPickMode('bin');
  };

  const handleMapClickCoord = (lat: number, lng: number) => {
    if (mapPickMode === 'depot') {
      handleUpdateDepotPosition(lat, lng);
      setMapPickMode(null);
      return;
    }
    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLng = Math.round(lng * 100000) / 100000;
    setAddBinCoords({ lat: roundedLat, lng: roundedLng });
    setMapPickMode(null);
    setAddModalOpen(true);
  };

  const handleSaveDepotModal = (name: string, location: string, lat: number, lng: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    setDepot(prev => ({
      ...prev,
      name,
      location,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
    }));
  };

  const handleResetMap = () => {
    try {
      localStorage.removeItem(MAP_STORAGE_KEY);
    } catch {}
    setDepot(DEFAULT_DEPOT);
    setBins(DEFAULT_BINS_24);
    handleSelectScenario('sedikit');
  };

  // -------------------------------------------------------------
  // CITIZEN REPORTS
  // -------------------------------------------------------------
  const handleTriggerDemoReport = () => {
    const randomBin = bins[Math.floor(Math.random() * bins.length)];
    const types = [
      'Sampah Meluap (Penuh Sesak)',
      'Tutup Tong Rusak/Pecah',
      'Bau Menyengat & Lalat',
    ];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    const newReport: CitizenReport = {
      reportId: 'REP-' + Math.floor(1000 + Math.random() * 9000),
      binId: randomBin.id,
      binName: randomBin.name,
      type: chosenType,
      time: new Date().toLocaleTimeString('id-ID'),
      notes: 'Laporan warga masuk via Portal Pelaporan Real-Time IoT.',
      status: 'pending',
      timestamp: Date.now(),
    };

    syncManagerRef.current?.publishReport(newReport);
  };

  const handleUserCitizenReport = (binId: number, type: string, notes: string) => {
    const targetBin = bins.find(b => b.id === binId);
    const newReport: CitizenReport = {
      reportId: 'REP-' + Math.floor(1000 + Math.random() * 9000),
      binId,
      binName: targetBin ? targetBin.name : `Tong ${binId}`,
      type,
      time: new Date().toLocaleTimeString('id-ID'),
      notes,
      status: 'pending',
      timestamp: Date.now(),
    };

    syncManagerRef.current?.publishReport(newReport);
  };

  const handleResolveReport = (reportId: string, binId: number) => {
    const targetBin = bins.find(b => b.id === binId);
    setReports(prev =>
      prev.map(r => (r.reportId === reportId ? { ...r, status: 'resolved' as const } : r))
    );

    if (activeReportAlert?.reportId === reportId) {
      setActiveReportAlert(null);
    }

    if (targetBin) {
      setBins(prev =>
        prev.map(b => (b.id === binId ? { ...b, hasActiveReport: false, fill: 15 } : b))
      );
      syncManagerRef.current?.resolveReport(reportId, binId, targetBin.name);
    }
  };

  const handleClearResolvedReports = () => {
    setReports(prev => prev.filter(r => r.status === 'pending'));
  };

  const handleFocusBin = (binId: number) => {
    handleOpenBinModal(binId);
  };

  const handleRefreshRoadGeometries = useCallback(async () => {
    if (selectedTripFilter === 'fixed' || (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-'))) {
      const fixedTours: (Bin | Depot)[][] = [fixedTrip.tour];
      if (fixedTrip.subTrips) {
        fixedTrip.subTrips.forEach(st => {
          if (st.tour && st.tour.length >= 2) fixedTours.push(st.tour);
        });
      }
      await roadGeometryStore.refreshTourGeometries(fixedTours);
      return;
    }

    let tripsToRefresh = result.trips;
    if (selectedTripFilter !== 'all') {
      tripsToRefresh = result.trips.filter(t => t.tripIndex === selectedTripFilter);
    }

    const tours = tripsToRefresh.map(t => t.tour).filter(tour => tour && tour.length >= 2);
    if (tours.length > 0) {
      await roadGeometryStore.refreshTourGeometries(tours);
    }
  }, [result.trips, selectedTripFilter, fixedTrip]);

  // TPS Capacity Action Handlers
  const handleToggleTripCompleted = useCallback((tripIndex: number | string) => {
    setCompletedTripIds(prev =>
      prev.includes(tripIndex) ? prev.filter(id => id !== tripIndex) : [...prev, tripIndex]
    );
  }, []);

  const handleCompleteAllTrips = useCallback(() => {
    setCompletedTripIds(result.trips.map(t => t.tripIndex));
  }, [result.trips]);

  const handleResetTps = useCallback(() => {
    setCompletedTripIds([]);
    setTpsInitialWaste(0);
  }, []);

  const handleChangeTpsMaxCapacity = useCallback((capacity: number) => {
    setTpsMaxCapacity(capacity);
  }, []);

  const handleChangeTpsInitialWaste = useCallback((waste: number) => {
    setTpsInitialWaste(waste);
  }, []);

  const editingBin = bins.find(b => b.id === editingBinId) || null;

  return (
    <div className="flex min-h-screen flex-col bg-[#EEF1EC] text-[#10303A] font-['Public_Sans'] dark:bg-[#0B1317] dark:text-[#F3F7F5]">
      {/* Header */}
      <Header
        mqttStatus={mqttStatus}
        activeReportAlert={activeReportAlert}
        onDismissAlert={() => setActiveReportAlert(null)}
        onFocusReportedBin={handleFocusBin}
        onOpenConfig={() => setConfigModalOpen(true)}
        onRunOptimization={() => handleRefreshRoadGeometries()}
        selectedScenario={selectedScenario}
        onSelectScenario={handleSelectScenario}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenGoogleMaps={() => handleOpenGoogleMaps()}
      />

      {/* Main Workspace */}
      <main className="mx-auto flex-1 w-full max-w-7xl space-y-4 sm:space-y-6 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 pb-8">
        {/* Top KPI Cards */}
        <KpiStrip bins={bins} result={result} config={config} />

        {/* ======================================================== */}
        {/* WORKSPACE LAYOUT (2 Columns on lg+) */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 Cols): Unified Map & Route Analytics */}
          <div className="space-y-5 lg:col-span-8">
            <RouteMap
              bins={bins}
              depot={depot}
              config={config}
              result={result}
              selectedTripFilter={selectedTripFilter}
              onSelectTripFilter={setSelectedTripFilter}
              onEditBin={handleOpenBinModal}
              onDeleteBin={handleDeleteBin}
              onQuickFillChange={handleQuickFillChange}
              onTriggerReport={binId => {
                const target = bins.find(b => b.id === binId);
                if (target) {
                  handleUserCitizenReport(
                    binId,
                    'Sampah Meluap (Penuh Sesak)',
                    'Aduan darurat dikirim via marker peta.'
                  );
                }
              }}
              onUpdateBinPosition={handleUpdateBinPosition}
              onUpdateDepotPosition={handleUpdateDepotPosition}
              editMode={editMode}
              onToggleEditMode={() => setEditMode(!editMode)}
              onOpenAddBin={() => {
                setAddBinCoords(null);
                setAddModalOpen(true);
              }}
              onStartPickBinOnMap={handleStartPickBinOnMap}
              onOpenDepotModal={() => setDepotModalOpen(true)}
              onResetMap={handleResetMap}
              animRunning={animRunning}
              animSpeed={animSpeed}
              onToggleAnimation={handleToggleAnimation}
              onResetAnimation={handleResetAnimation}
              onChangeAnimSpeed={setAnimSpeed}
              currentTruckWaypoint={animWaypoint}
              currentTruckLoad={currentTruckLoad}
              mapPickMode={mapPickMode}
              onMapClickCoord={handleMapClickCoord}
              onRefreshRoadGeometries={handleRefreshRoadGeometries}
              theme={theme}
              fixedTrip={fixedTrip}
              showFixedComparison={showFixedComparison}
              onToggleFixedComparison={() => setShowFixedComparison(prev => !prev)}
              onOpenGoogleMapsModal={() =>
                handleOpenGoogleMaps(selectedTripFilter !== 'all' ? selectedTripFilter : undefined)
              }
            />

            {animRunning && (
              <TruckTelemetryBar
                waypoint={animWaypoint}
                load={currentTruckLoad}
                prevLoad={prevTruckLoad}
                config={config}
                speed={animSpeed}
                onChangeSpeed={setAnimSpeed}
              />
            )}

            <EfficiencyCard
              result={result}
              config={config}
              convPlan={convPlan}
              binCount={bins.length}
              fixedTrip={fixedTrip}
              selectedTripFilter={selectedTripFilter}
              onSelectTripFilter={setSelectedTripFilter}
              onPlaySpecificTripAnim={handlePlaySpecificTripAnim}
              showFixedComparison={showFixedComparison}
              onToggleFixedComparison={() => setShowFixedComparison(prev => !prev)}
              onOpenGoogleMapsForTrip={handleOpenGoogleMaps}
            />

            <TripBreakdownCard
              result={result}
              config={config}
              manualSplitMode={manualSplitMode}
              onSetSplitMode={setManualSplitMode}
              selectedTripFilter={selectedTripFilter}
              onSelectTripFilter={setSelectedTripFilter}
              onPlaySpecificTripAnim={handlePlaySpecificTripAnim}
              fixedTrip={fixedTrip}
              depot={depot}
              onOpenGoogleMapsForTrip={handleOpenGoogleMaps}
            />
          </div>

          {/* Right Column (4 Cols): TPS 3R Capacity Card & Bins Quick Inspector */}
          <div className="space-y-5 lg:col-span-4">
            <TpsCapacityCard
              depot={depot}
              result={result}
              config={config}
              tpsMaxCapacity={tpsMaxCapacity}
              tpsInitialWaste={tpsInitialWaste}
              completedTripIds={completedTripIds}
              onToggleTripCompleted={handleToggleTripCompleted}
              onCompleteAllTrips={handleCompleteAllTrips}
              onResetTps={handleResetTps}
              onChangeMaxCapacity={handleChangeTpsMaxCapacity}
              onChangeInitialWaste={handleChangeTpsInitialWaste}
              selectedTripFilter={selectedTripFilter}
              onSelectTripFilter={setSelectedTripFilter}
              onPlaySpecificTripAnim={handlePlaySpecificTripAnim}
            />

            <BinsQuickGrid
              bins={bins}
              config={config}
              onOpenBinModal={handleOpenBinModal}
            />
          </div>
        </div>

        {/* Bottom Section: Incident Desk */}
        <div>
          <IncidentDesk
            reports={reports}
            bins={bins}
            onTriggerDemoReport={handleTriggerDemoReport}
            onClearResolved={handleClearResolvedReports}
            onFocusBin={handleFocusBin}
            onResolveReport={handleResolveReport}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-[#D9DFD7] bg-white py-4 dark:bg-[#101A1F] dark:border-[#243741]">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2 px-4 text-xs text-[#5B6A60] font-mono dark:text-[#8FB0B4]">
          <div>TrashRoute © 2026 • Wilayah Kapanewon Godean, Sleman</div>
          <div className="flex items-center gap-3">
            <span>Metrik: Jarak Jalan Raya Nyata + Held-Karp TSP</span>
          </div>
        </div>
      </footer>

      {/* Floating Map Picking Helper Banner */}
      {mapPickMode && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex max-w-xl w-[92%] sm:w-auto items-center justify-between gap-3.5 rounded-2xl border-2 border-emerald-500 bg-[#10303A] p-4 text-white shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold shadow-md animate-pulse">
              <Crosshair className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-['Bricolage_Grotesque'] text-sm font-bold text-white">
                  {mapPickMode === 'bin' ? 'Mode Klik Peta Aktif (Tambah Tong)' : 'Mode Pindah Pangkalan'}
                </span>
                <span className="rounded bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Kursor ⊕ Aktif
                </span>
              </div>
              <p className="text-xs text-[#C4CEC2]">
                {mapPickMode === 'bin'
                  ? 'Klik pada jalan atau titik mana saja pada peta untuk menentukan lokasi tong baru.'
                  : 'Klik pada peta untuk menetapkan koordinat baru pangkalan armada.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setMapPickMode(null);
              if (mapPickMode === 'bin') {
                setAddModalOpen(true);
              }
            }}
            className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25 cursor-pointer"
          >
            Batal
          </button>
        </aside>
      )}

      {/* Modals */}
      <EditBinModal
        bin={editingBin}
        config={config}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveBinModal}
        onDelete={handleDeleteBin}
      />

      <AddBinModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddBinCoords(null);
        }}
        onAddBin={(name, location, lat, lng, fill) => {
          handleAddBin(name, location, lat, lng, fill);
          setAddBinCoords(null);
        }}
        nextId={bins.reduce((max, b) => Math.max(max, b.id), 0) + 1}
        initialLat={addBinCoords?.lat}
        initialLng={addBinCoords?.lng}
        onPickOnMap={handleStartPickBinOnMap}
      />

      <DepotModal
        depot={depot}
        isOpen={depotModalOpen}
        onClose={() => setDepotModalOpen(false)}
        onSaveDepot={handleSaveDepotModal}
      />

      <ConfigModal
        config={config}
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSaveConfig={newCfg => setConfig(prev => ({ ...prev, ...newCfg }))}
      />

      <GoogleMapsNavModal
        isOpen={gmapsModalOpen}
        onClose={() => setGmapsModalOpen(false)}
        result={result}
        depot={depot}
        config={config}
        fixedTrip={fixedTrip}
        initialTripIndex={gmapsInitialTripIndex}
        distMatrix={distMatrix}
      />
    </div>
  );
}
