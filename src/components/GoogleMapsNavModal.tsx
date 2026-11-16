import React, { useState, useMemo } from 'react';
import {
  MapPin,
  X,
  ExternalLink,
  Copy,
  Check,
  Navigation,
  Compass,
  Truck,
  ArrowRight,
  Info,
  Route,
  ChevronRight,
} from 'lucide-react';
import { Depot, ExecutionResult, SystemConfig, Trip } from '../types';
import {
  buildGoogleMapsTripRouteUrl,
  buildGoogleMapsUniversalTripUrl,
  buildGoogleMapsNavUrl,
  getTripStopsWithGmapsLinks,
  copyToClipboard,
} from '../services/googleMapsService';
import { toRealKm, toTravelMinutes } from '../services/routingEngine';
import { DistanceMatrixResult } from '../services/distanceMatrix';

interface GoogleMapsNavModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ExecutionResult;
  depot: Depot;
  config: SystemConfig;
  fixedTrip?: Trip;
  initialTripIndex?: number | string;
  distMatrix?: DistanceMatrixResult | null;
}

export const GoogleMapsNavModal: React.FC<GoogleMapsNavModalProps> = ({
  isOpen,
  onClose,
  result,
  depot,
  config,
  fixedTrip,
  initialTripIndex,
  distMatrix,
}) => {
  const [selectedTripKey, setSelectedTripKey] = useState<string>(() => {
    if (initialTripIndex !== undefined && initialTripIndex !== 'all') {
      return String(initialTripIndex);
    }
    return result.trips.length > 0 ? String(result.trips[0].tripIndex) : '1';
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStepId, setCopiedStepId] = useState<string | number | null>(null);

  // Sync when initialTripIndex changes
  React.useEffect(() => {
    if (initialTripIndex !== undefined && initialTripIndex !== 'all') {
      setSelectedTripKey(String(initialTripIndex));
    }
  }, [initialTripIndex]);

  const activeTrip: Trip | undefined = useMemo(() => {
    if (selectedTripKey === 'fixed') {
      return fixedTrip;
    }
    if (selectedTripKey.startsWith('fixed-')) {
      const subIdx = parseInt(selectedTripKey.replace('fixed-', ''), 10) - 1;
      if (fixedTrip?.subTrips && fixedTrip.subTrips[subIdx]) {
        const st = fixedTrip.subTrips[subIdx];
        return {
          tripIndex: `fixed-${st.subIndex || subIdx + 1}`,
          isFixed: true,
          bins: st.bins,
          loadLiter: st.loadLiter,
          tour: st.tour || [depot, ...st.bins, depot],
          distance: st.distance,
          roadCoords: st.roadCoords,
          realRoadKm: st.realRoadKm,
        };
      }
      return fixedTrip;
    }
    const idx = parseInt(selectedTripKey, 10);
    return result.trips.find(t => t.tripIndex === idx) || result.trips[0] || fixedTrip;
  }, [selectedTripKey, result.trips, fixedTrip, depot]);

  const activeRouteUrl = useMemo(() => {
    if (!activeTrip) {
      return buildGoogleMapsNavUrl(depot.lat, depot.lng);
    }
    return buildGoogleMapsTripRouteUrl(activeTrip, depot);
  }, [activeTrip, depot]);

  const activeUniversalRouteUrl = useMemo(() => {
    if (!activeTrip) {
      return buildGoogleMapsNavUrl(depot.lat, depot.lng);
    }
    return buildGoogleMapsUniversalTripUrl(activeTrip, depot);
  }, [activeTrip, depot]);

  const stopItems = useMemo(() => {
    if (!activeTrip) return [];
    return getTripStopsWithGmapsLinks(activeTrip, depot, distMatrix?.getDist);
  }, [activeTrip, depot, distMatrix]);

  if (!isOpen) return null;

  const handleCopyRouteLink = async () => {
    const ok = await copyToClipboard(activeUniversalRouteUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyStepLink = async (stepId: string | number, url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedStepId(stepId);
      setTimeout(() => setCopiedStepId(null), 1800);
    }
  };

  const tripKm = activeTrip ? (activeTrip.realRoadKm || toRealKm(activeTrip.distance)) : 0;
  const tripMin = activeTrip ? toTravelMinutes(activeTrip.distance, config) : 0;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-auto flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-[#D9DFD7] bg-white shadow-2xl overflow-hidden dark:bg-[#121D22] dark:border-[#243741]">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E9E2] px-5 py-4 dark:border-[#243741] bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-700 shadow-xs font-bold">
              <Navigation className="h-5 w-5 fill-current" />
            </div>
            <div>
              <h3 className="font-['Bricolage_Grotesque'] text-base font-bold">
                Navigasi Presisi Langsung ke Google Maps
              </h3>
              <p className="text-xs text-blue-100">
                Urutan lintasan turn-by-turn sinkron 100% dengan peta algoritma &amp; jalan raya
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white cursor-pointer transition"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs overscroll-contain">
          {/* Trip Selector Buttons */}
          <div>
            <label className="mb-1.5 block font-bold text-[#10303A] dark:text-white">
              Pilih Rute / Trip yang Akan Dijalankan:
            </label>
            <div className="flex flex-wrap gap-2">
              {result.trips.map(t => {
                const isSelected = selectedTripKey === String(t.tripIndex);
                return (
                  <button
                    key={t.tripIndex}
                    onClick={() => {
                      setSelectedTripKey(String(t.tripIndex));
                    }}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-['Bricolage_Grotesque'] text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                        : 'border-[#C4CEC2] bg-[#F5F7F3] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>TRIP {t.tripIndex}</span>
                    <span className="text-[10px] font-normal opacity-90">
                      ({t.bins.length} tong · {t.loadLiter} L)
                    </span>
                  </button>
                );
              })}

              {fixedTrip?.subTrips && fixedTrip.subTrips.length > 1 ? (
                <>
                  {fixedTrip.subTrips.map((st, i) => {
                    const key = `fixed-${st.subIndex || i + 1}`;
                    const isSelected = selectedTripKey === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedTripKey(key);
                        }}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-['Bricolage_Grotesque'] text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                            : 'border-[#C4CEC2] bg-[#F5F7F3] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                        }`}
                      >
                        <Compass className="h-3.5 w-3.5" />
                        <span>RUTE TETAP #{st.subIndex || i + 1}</span>
                        <span className="text-[10px] font-normal opacity-90">
                          ({st.bins.length} tong · {st.loadLiter} L)
                        </span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setSelectedTripKey('fixed');
                    }}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-['Bricolage_Grotesque'] text-xs font-bold transition cursor-pointer ${
                      selectedTripKey === 'fixed'
                        ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                        : 'border-[#C4CEC2] bg-[#F5F7F3] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                    }`}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>SEMUA RUTE TETAP</span>
                  </button>
                </>
              ) : fixedTrip ? (
                <button
                  onClick={() => {
                    setSelectedTripKey('fixed');
                  }}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-['Bricolage_Grotesque'] text-xs font-bold transition cursor-pointer ${
                    selectedTripKey === 'fixed'
                      ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                      : 'border-[#C4CEC2] bg-[#F5F7F3] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>RUTE TETAP KONVENSIONAL</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Car Mode Guarantee Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50/90 p-3 text-xs text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
              <Truck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <strong className="font-['Bricolage_Grotesque'] text-xs font-bold text-emerald-900 dark:text-emerald-100">
                  Mode Rute: Mobil / Armada Roda 4 (Bukan Sepeda Motor)
                </strong>
                <span className="rounded bg-emerald-200/90 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-800 dark:text-emerald-200">
                  Mode Mobil: travelmode=driving · dirflg=d
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-800/90 dark:text-emerald-300 leading-relaxed">
                Navigasi Google Maps dikunci permanen pada mode mobil sehingga armada truk sampah diarahkan melalui koridor jalan aspal yang muat dilewati kendaraan roda 4 dan tidak masuk ke gang sempit motor. Jarak tempuh dihitung akurat berdasarkan jalan raya riil.
              </p>
            </div>
          </div>

          {/* Active Trip Summary Banner */}
          {activeTrip && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 text-center dark:bg-[#17262D] dark:border-[#243741]">
              <div className="p-1">
                <span className="block text-[10px] font-medium text-[#5B6A60] dark:text-[#A3B9B1]">
                  Total Titik
                </span>
                <span className="font-['Bricolage_Grotesque'] text-sm font-bold text-[#10303A] dark:text-white">
                  {activeTrip.bins.length} Bak Sampah
                </span>
              </div>
              <div className="p-1">
                <span className="block text-[10px] font-medium text-[#5B6A60] dark:text-[#A3B9B1]">
                  Jarak Jalan Raya (Mobil)
                </span>
                <span className="font-['Bricolage_Grotesque'] text-sm font-bold text-blue-600 dark:text-blue-400">
                  {tripKm} km
                </span>
                <span className="block text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  ✓ Sinkron Google Maps
                </span>
              </div>
              <div className="p-1">
                <span className="block text-[10px] font-medium text-[#5B6A60] dark:text-[#A3B9B1]">
                  Estimasi Tempuh
                </span>
                <span className="font-['Bricolage_Grotesque'] text-sm font-bold text-[#10303A] dark:text-white">
                  ≈ {tripMin} Menit
                </span>
              </div>
              <div className="p-1">
                <span className="block text-[10px] font-medium text-[#5B6A60] dark:text-[#A3B9B1]">
                  Total Muatan
                </span>
                <span className="font-['Bricolage_Grotesque'] text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {activeTrip.loadLiter} L ({Math.min(100, Math.round((activeTrip.loadLiter / config.C) * 100))}%)
                </span>
              </div>
            </div>
          )}

          {/* Big Action Buttons */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={activeUniversalRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-['Bricolage_Grotesque'] text-sm font-bold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.01] active:scale-[0.99] text-center"
              >
                <ExternalLink className="h-4 w-4" />
                <span>🚗 Buka Rute di Google Maps (Mode Mobil Otomatis)</span>
              </a>

              <button
                onClick={handleCopyRouteLink}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#C4CEC2] bg-white px-4 py-3 font-bold text-[#10303A] shadow-xs transition hover:bg-slate-100 dark:bg-[#15242B] dark:border-[#243741] dark:text-white cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Link Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-blue-600" />
                    <span>Salin Link Rute Mobil</span>
                  </>
                )}
              </button>
            </div>

            {/* Alternative Direct Path Link */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E9E2] bg-[#F8FAF6] p-2 dark:bg-[#15242B] dark:border-[#243741]">
              <span className="text-[11px] text-[#5B6A60] dark:text-[#A3B9B1] flex items-center gap-1.5">
                <span>🌐 Format Alternatif:</span>
                <span className="font-semibold text-[#10303A] dark:text-white">Direct Slash Route Path</span>
              </span>
              <a
                href={activeRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50 dark:bg-[#17262D] dark:border-blue-700 dark:text-blue-300"
              >
                <ExternalLink className="h-3 w-3" />
                <span>Buka Direct URL</span>
              </a>
            </div>
          </div>

          {/* Quick Notice Info */}
          <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div>
              <strong>Jaminan Urutan Titik &amp; Mode Mobil (Zero Drift):</strong>
              <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                Format path direct Google Maps: stop 1, stop 2, dst. dikunci sesuai urutan optimal hasil perhitungan algoritma dan parameter mode mobil (`travelmode=driving`, `dirflg=d`, &amp; `!3e0`). Untuk pengemudi di jalan, Anda juga dapat menekan <strong>"Navigasi Leg"</strong> pada tiap titik di bawah untuk panduan step-by-step dari titik sebelumnya.
              </p>
            </div>
          </div>

          {/* Step-by-Step Waypoint List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-['Bricolage_Grotesque'] text-xs font-bold text-[#10303A] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5 text-blue-600" />
                <span>Urutan Lintasan Titik Singgah (1 s/d {stopItems.length - 2}):</span>
              </h4>
              <span className="text-[11px] text-[#7D8B81] dark:text-[#8FB0B4]">
                Total {stopItems.length} Titik Singgah
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {stopItems.map((item, idx) => {
                const isCopied = copiedStepId === item.id;
                const isStart = idx === 0;
                const isEnd = idx === stopItems.length - 1;

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 transition ${
                      item.isDepot
                        ? 'border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-800'
                        : 'border-[#E5E9E2] bg-white hover:border-[#C4CEC2] dark:bg-[#15242B] dark:border-[#243741]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-['Bricolage_Grotesque'] text-xs font-bold text-white shadow-2xs ${
                          isStart || isEnd
                            ? 'bg-blue-600'
                            : 'bg-emerald-600'
                        }`}
                      >
                        {isStart ? 'P' : isEnd ? 'TPS' : item.step}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#10303A] dark:text-white truncate">
                            {item.name}
                          </span>
                          {item.fill !== undefined && (
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                item.fill >= config.redLimit
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
                                  : item.fill >= config.yellowLimit
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              }`}
                            >
                              {item.fill}%
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#5B6A60] dark:text-[#A3B9B1] truncate flex items-center gap-1.5">
                          {item.prevName ? (
                            <span>
                              Dari: <strong className="text-[#10303A] dark:text-white">{item.prevName}</strong> (+{item.distanceFromPrevKm} km)
                            </span>
                          ) : (
                            <span>Titik Keberangkatan Awal Armada</span>
                          )}
                          <span>·</span>
                          <span>GPS ({item.lat.toFixed(5)}, {item.lng.toFixed(5)})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.legNavUrl && !isStart && (
                        <a
                          href={item.legNavUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-800 shadow-2xs"
                          title={`Panduan arah dari ${item.prevName} menuju ${item.name}`}
                        >
                          <Navigation className="h-3 w-3 fill-current" />
                          <span>Navigasi Leg</span>
                        </a>
                      )}

                      <a
                        href={item.navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-blue-700 shadow-2xs"
                        title="Buka Navigasi Driving Langsung dari Posisi GPS HP Saat Ini"
                      >
                        <ChevronRight className="h-3 w-3" />
                        <span>Langsung</span>
                      </a>

                      <a
                        href={item.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#C4CEC2] bg-[#F5F7F3] px-2 py-1 text-[11px] font-semibold text-[#10303A] transition hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white"
                        title="Lihat Pin Lokasi di Peta Google"
                      >
                        <MapPin className="h-3 w-3 text-red-500" />
                        <span className="hidden sm:inline">Pin</span>
                      </a>

                      <button
                        onClick={() => handleCopyStepLink(item.id, item.navUrl)}
                        className="rounded-lg border border-[#C4CEC2] p-1 text-[#5B6A60] hover:bg-slate-100 hover:text-[#10303A] dark:border-[#243741] dark:text-[#A3B9B1] dark:hover:bg-[#17262D] cursor-pointer"
                        title="Salin Link Titik Ini"
                        aria-label="Salin Link"
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#E5E9E2] bg-[#F8FAF6] px-5 py-3 dark:bg-[#15242B] dark:border-[#243741]">
          <span className="text-[11px] text-[#7D8B81] dark:text-[#8FB0B4]">
            Kompatibel dengan Google Maps Web Browser
          </span>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#C4CEC2] bg-white px-4 py-1.5 font-bold text-[#10303A] transition hover:bg-slate-100 dark:bg-[#17262D] dark:border-[#243741] dark:text-white cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
