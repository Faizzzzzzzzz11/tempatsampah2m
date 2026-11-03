import React from 'react';
import { ListOrdered, Split, Eye, Play, Navigation, ExternalLink } from 'lucide-react';
import { ExecutionResult, SystemConfig, Trip, Depot } from '../types';
import { toRealKm, toTravelMinutes } from '../services/routingEngine';
import { buildGoogleMapsTripRouteUrl } from '../services/googleMapsService';

interface TripBreakdownCardProps {
  result: ExecutionResult;
  config: SystemConfig;
  manualSplitMode: 'auto' | number;
  onSetSplitMode: (mode: 'auto' | number) => void;
  selectedTripFilter: 'all' | 'fixed' | number | string;
  onSelectTripFilter: (filter: 'all' | 'fixed' | number | string) => void;
  onPlaySpecificTripAnim: (tripIdx: number | string) => void;
  fixedTrip: Trip;
  depot?: Depot;
  onOpenGoogleMapsForTrip?: (tripIdx: number | string) => void;
}

const TRIP_COLORS = [
  { stroke: '#1F5FD6', bg: '#DCE7FB', border: '#93C5FD' },
  { stroke: '#8A3FC4', bg: '#EEE0F8', border: '#D8B4FE' },
  { stroke: '#0A8F99', bg: '#D2EEF0', border: '#99F6E4' },
  { stroke: '#C8326B', bg: '#F8DCE7', border: '#FBCFE8' },
];

export const TripBreakdownCard: React.FC<TripBreakdownCardProps> = ({
  result,
  config,
  manualSplitMode,
  onSetSplitMode,
  selectedTripFilter,
  onSelectTripFilter,
  onPlaySpecificTripAnim,
  fixedTrip,
  depot,
  onOpenGoogleMapsForTrip,
}) => {
  return (
    <div className="space-y-3.5 rounded-2xl border border-[#D9DFD7] bg-white p-4 shadow-sm dark:bg-[#121D22] dark:border-[#243741]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E9E2] pb-2.5 dark:border-[#243741]">
        <h3 className="flex items-center gap-2 font-['Bricolage_Grotesque'] text-sm font-bold text-[#10303A] dark:text-white">
          <ListOrdered className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Rincian Rute dan Beban Tiap Trip</span>
        </h3>
        <span className="text-xs font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">
          {result.trips.length} Trip Direncanakan
        </span>
      </div>

      {/* Manual Splitter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 text-xs dark:bg-[#17262D] dark:border-[#243741]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 font-bold text-[#10303A] dark:text-white">
            <Split className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Pembagian Trip:</span>
          </span>
          <div className="inline-flex rounded-lg border border-[#C4CEC2] bg-white p-0.5 dark:bg-[#121D22] dark:border-[#243741]">
            <button
              onClick={() => onSetSplitMode('auto')}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                manualSplitMode === 'auto'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[#46554B] hover:bg-slate-100 dark:text-[#A3B9B1] dark:hover:bg-[#17262D]'
              }`}
            >
              Otomatis Flowchart
            </button>
            {[1, 2, 3, 4].map(m => (
              <button
                key={m}
                onClick={() => onSetSplitMode(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  manualSplitMode === m
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-[#46554B] hover:bg-slate-100'
                }`}
              >
                {m} Trip
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px]">
          {manualSplitMode === 'auto' ? (
            <span className="font-semibold text-blue-700">
              ✓ Otomatis Flowchart: Dibagi <strong>{result.trips.length} Trip</strong> (C = {config.C.toLocaleString()} L)
            </span>
          ) : result.trips.some(t => t.loadLiter > config.C) ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
              ⚠️ Manual {result.trips.length} Trip: Ada trip melebihi kapasitas truk ({config.C} L)!
            </span>
          ) : (
            <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
              ✓ Manual: Dipisah Jadi <strong>{result.trips.length} Trip</strong> (Semua ≤ C)
            </span>
          )}
        </div>
      </div>

      {/* Trip Cards Container */}
      <div className="space-y-3">
        {result.trips.length === 0 ? (
          <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-4 text-center text-xs text-[#5B6A60]">
            {result.statusMessage || 'Truk belum perlu berangkat.'}
          </div>
        ) : (
          result.trips.map((trip, idx) => {
            const colorObj = TRIP_COLORS[idx % TRIP_COLORS.length];
            const routeStr = trip.tour.map(n => n.name || n.id).join(' → ');
            const fillPct = ((trip.loadLiter / config.C) * 100).toFixed(1);
            const isIsolated = selectedTripFilter === trip.tripIndex;
            const tripKm = trip.realRoadKm || toRealKm(trip.distance);
            const tripMin = toTravelMinutes(trip.distance, config);

            return (
              <div
                key={trip.tripIndex}
                className={`rounded-xl border p-3.5 transition shadow-2xs ${
                  isIsolated
                    ? 'border-2 border-blue-600 bg-blue-50/40 ring-2 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-900'
                    : 'border-[#D9DFD7] bg-white hover:border-[#B5C0B3] dark:bg-[#15242B] dark:border-[#243741] dark:hover:border-[#38515E]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E9E2] pb-2 dark:border-[#243741]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded px-2.5 py-0.5 font-['Bricolage_Grotesque'] text-xs font-bold text-white"
                      style={{ backgroundColor: colorObj.stroke }}
                    >
                      TRIP {trip.tripIndex}
                    </span>
                    <span className="font-bold text-[#10303A] text-xs dark:text-white">
                      {trip.bins.length} Tong Sampah Terlayani
                    </span>
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
                      🚗 Mode Mobil (Lebar ≥ 5.5m)
                    </span>
                    {isIsolated && (
                      <span className="animate-pulse rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        SEDANG DILIHAT DI PETA
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {depot && (
                      <a
                        href={buildGoogleMapsTripRouteUrl(trip, depot)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700"
                        title="Buka rute turn-by-turn langsung di Google Maps (Mode Mobil)"
                      >
                        <Navigation className="h-3 w-3 fill-current" />
                        <span>G-Maps Mobil</span>
                      </a>
                    )}
                    {onOpenGoogleMapsForTrip && (
                      <button
                        onClick={() => onOpenGoogleMapsForTrip(trip.tripIndex as number)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-400/40 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300 transition cursor-pointer"
                        title="Panduan detail navigasi turn-by-turn per titik singgah"
                      >
                        <span>🧭 Panduan</span>
                      </button>
                    )}
                    <button
                      onClick={() => onSelectTripFilter(isIsolated ? 'all' : (trip.tripIndex as number))}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        isIsolated
                          ? 'border-[#10303A] bg-[#10303A] text-white dark:bg-blue-600 dark:border-blue-500'
                          : 'border-[#C4CEC2] bg-[#F5F7F3] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      <span>{isIsolated ? 'Semua' : 'Fokus'}</span>
                    </button>
                    <button
                      onClick={() => onPlaySpecificTripAnim(trip.tripIndex as number)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Animasi</span>
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
                  <span>
                    Jarak Jalan (Mobil): <strong className="text-[#10303A] dark:text-white">{tripKm} km</strong>
                  </span>
                  <span>
                    Waktu Tempuh: <strong className="text-[#10303A] dark:text-white">≈ {tripMin} mnt</strong>
                  </span>
                  <span>
                    Muatan: <strong className="text-blue-700 dark:text-blue-300">{trip.loadLiter} L ({fillPct}%)</strong>
                  </span>
                  <span>
                    Status:{' '}
                    <strong className={trip.loadLiter > config.C ? 'font-bold text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
                      {trip.loadLiter > config.C
                        ? `Melebihi C (${config.C} L)!`
                        : 'Aman (≤ C)'}
                    </strong>
                  </span>
                </div>

                <div className="mt-2 text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
                  <div className="text-[11px] font-medium text-[#7D8B81] dark:text-[#8FB0B4]">Urutan Lintasan Jalan Raya Godean:</div>
                  <div className="mt-0.5 rounded-lg border border-[#E5E9E2] bg-[#F8FAF6] p-2 text-[11px] font-mono text-[#10303A] break-all dark:bg-[#17262D] dark:border-[#243741] dark:text-white">
                    {routeStr}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Conventional Benchmark Trip Cards (Adaptive: Displays both/all trips if multi-trip) */}
        {fixedTrip && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-t border-dashed border-[#D9DFD7] pt-3 dark:border-[#243741]">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-700 px-2 py-0.5 font-['Bricolage_Grotesque'] text-xs font-bold text-white">
                  PEMBANDING
                </span>
                <span className="text-xs font-bold text-[#10303A] dark:text-white">
                  Rute Tetap Konvensional ({fixedTrip.subTripCount} Trip · {fixedTrip.realRoadKm || toRealKm(fixedTrip.distance)} km)
                </span>
              </div>
              {fixedTrip.subTrips && fixedTrip.subTrips.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => onSelectTripFilter(selectedTripFilter === 'fixed' ? 'all' : 'fixed')}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      selectedTripFilter === 'fixed'
                        ? 'border-slate-800 bg-slate-800 text-white shadow-2xs'
                        : 'border-[#C4CEC2] bg-[#F5F7F3] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>{selectedTripFilter === 'fixed' ? 'Tampilkan Semua Rute' : 'Lihat Semua Tetap'}</span>
                  </button>
                  <button
                    onClick={() => onPlaySpecificTripAnim('fixed')}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-slate-800 cursor-pointer"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Animasi Semua</span>
                  </button>
                </div>
              )}
            </div>

            {/* If fixed route is split into multiple trips (e.g. 2 trips), adaptively render each trip card */}
            {fixedTrip.subTrips && fixedTrip.subTrips.length > 1 ? (
              fixedTrip.subTrips.map((st, i) => {
                const subTripKey = `fixed-${st.subIndex || i + 1}`;
                const isIsolated = selectedTripFilter === subTripKey;
                const fillPct = ((st.loadLiter / config.C) * 100).toFixed(1);
                const subTripObj: Trip = {
                  tripIndex: subTripKey,
                  isFixed: true,
                  bins: st.bins,
                  loadLiter: st.loadLiter,
                  tour: st.tour || [depot!, ...st.bins, depot!],
                  distance: st.distance,
                  roadCoords: st.roadCoords,
                  realRoadKm: st.realRoadKm,
                };
                const subKm = st.realRoadKm || toRealKm(st.distance);
                const subMin = toTravelMinutes(st.distance, config);
                const routeStr = subTripObj.tour.map(n => n.name || n.id).join(' → ');

                return (
                  <div
                    key={subTripKey}
                    className={`rounded-xl border border-dashed p-3.5 transition shadow-2xs ${
                      isIsolated
                        ? 'border-2 border-slate-700 bg-slate-100 ring-2 ring-slate-300 dark:bg-slate-800 dark:border-slate-500'
                        : 'border-[#C4CEC2] bg-[#F8FAF6] hover:border-slate-400 dark:bg-[#17262D] dark:border-[#243741]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9DFD7] pb-2 dark:border-[#243741]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-700 px-2 py-0.5 font-['Bricolage_Grotesque'] text-xs font-bold text-white">
                          RUTE TETAP #{st.subIndex || i + 1}
                        </span>
                        <span className="text-xs font-bold text-[#10303A] dark:text-white">
                          {st.bins.length} Tong ({st.bins[0]?.name}–{st.bins[st.bins.length - 1]?.name})
                        </span>
                        <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                          {fillPct}% Kapasitas
                        </span>
                        {isIsolated && (
                          <span className="animate-pulse rounded bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white">
                            SEDANG DILIHAT DI PETA
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {depot && (
                          <a
                            href={buildGoogleMapsTripRouteUrl(subTripObj, depot)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700"
                            title={`Buka rute tetap Trip ${st.subIndex || i + 1} langsung di Google Maps`}
                          >
                            <Navigation className="h-3 w-3 fill-current" />
                            <span>G-Maps</span>
                          </a>
                        )}
                        {onOpenGoogleMapsForTrip && (
                          <button
                            onClick={() => onOpenGoogleMapsForTrip(subTripKey)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#C4CEC2] bg-white px-2 py-1 text-xs font-bold text-[#10303A] hover:bg-slate-100 dark:bg-[#15242B] dark:border-[#243741] dark:text-white transition cursor-pointer"
                            title="Panduan detail navigasi rute ini di Google Maps"
                          >
                            <span>🧭 Panduan</span>
                          </button>
                        )}
                        <button
                          onClick={() => onSelectTripFilter(isIsolated ? 'all' : subTripKey)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                            isIsolated
                              ? 'border-[#10303A] bg-[#10303A] text-white'
                              : 'border-[#C4CEC2] bg-white text-[#10303A] hover:bg-slate-100 dark:bg-[#15242B] dark:border-[#243741] dark:text-white'
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          <span>{isIsolated ? 'Semua' : 'Fokus'}</span>
                        </button>
                        <button
                          onClick={() => onPlaySpecificTripAnim(subTripKey)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-slate-800 cursor-pointer"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Animasi</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
                      <span>
                        Jarak Jalan Riil: <strong className="text-[#10303A] dark:text-white">{subKm} km</strong>
                        <span className="ml-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">(Sinkron Google Maps)</span>
                      </span>
                      <span>
                        Waktu Tempuh: <strong className="text-[#10303A] dark:text-white">≈ {subMin} mnt</strong>
                      </span>
                      <span>
                        Muatan: <strong className="text-blue-700 dark:text-blue-300">{st.loadLiter} L ({fillPct}%)</strong>
                      </span>
                      <span>
                        Status:{' '}
                        <strong className={st.loadLiter > config.C ? 'font-bold text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
                          {st.loadLiter > config.C
                            ? `Melebihi C (${config.C} L)!`
                            : 'Aman (≤ C)'}
                        </strong>
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
                      <div className="text-[11px] font-medium text-[#7D8B81] dark:text-[#8FB0B4]">Urutan Rute Konvensional:</div>
                      <div className="mt-0.5 rounded-lg border border-[#D9DFD7] bg-white p-2 text-[11px] font-mono text-[#10303A] break-all dark:bg-[#121D22] dark:border-[#243741] dark:text-white">
                        {routeStr}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Single Fixed Trip Card if only 1 trip needed */
              <div
                className={`rounded-xl border border-dashed p-3.5 transition shadow-2xs ${
                  selectedTripFilter === 'fixed'
                    ? 'border-2 border-slate-700 bg-slate-100 ring-2 ring-slate-300 dark:bg-slate-800 dark:border-slate-500'
                    : 'border-[#C4CEC2] bg-[#F8FAF6] hover:border-slate-400 dark:bg-[#17262D] dark:border-[#243741]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9DFD7] pb-2 dark:border-[#243741]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-700 px-2 py-0.5 font-['Bricolage_Grotesque'] text-xs font-bold text-white">
                      RUTE TETAP
                    </span>
                    <span className="text-xs font-bold text-[#10303A] dark:text-white">
                      Urutan Konvensional T1–T{fixedTrip.bins.length}
                    </span>
                    {selectedTripFilter === 'fixed' && (
                      <span className="animate-pulse rounded bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white">
                        SEDANG DILIHAT DI PETA
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {depot && (
                      <a
                        href={buildGoogleMapsTripRouteUrl(fixedTrip, depot)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700"
                        title="Buka rute konvensional langsung di Google Maps"
                      >
                        <Navigation className="h-3 w-3 fill-current" />
                        <span>G-Maps</span>
                      </a>
                    )}
                    {onOpenGoogleMapsForTrip && (
                      <button
                        onClick={() => onOpenGoogleMapsForTrip('fixed')}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#C4CEC2] bg-white px-2 py-1 text-xs font-bold text-[#10303A] hover:bg-slate-100 dark:bg-[#15242B] dark:border-[#243741] dark:text-white transition cursor-pointer"
                        title="Panduan detail navigasi rute tetap"
                      >
                        <span>🧭 Panduan</span>
                      </button>
                    )}
                    <button
                      onClick={() => onSelectTripFilter(selectedTripFilter === 'fixed' ? 'all' : 'fixed')}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        selectedTripFilter === 'fixed'
                          ? 'border-[#10303A] bg-[#10303A] text-white'
                          : 'border-[#C4CEC2] bg-white text-[#10303A] hover:bg-slate-100'
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      <span>{selectedTripFilter === 'fixed' ? 'Tampilkan Rute Cerdas' : 'Lihat di Peta'}</span>
                    </button>
                    <button
                      onClick={() => onPlaySpecificTripAnim('fixed')}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-slate-800"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Animasi Rute Tetap</span>
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
                  <span>
                    Jarak Jalan Riil: <strong className="text-[#10303A] dark:text-white">{fixedTrip.realRoadKm || toRealKm(fixedTrip.distance)} km</strong>
                    <span className="ml-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">(Sinkron Google Maps)</span>
                  </span>
                  <span>
                    Total Muatan: <strong className="text-blue-700 dark:text-blue-300">{fixedTrip.loadLiter} L total</strong>
                  </span>
                  <span>
                    Kapasitas: <strong className="text-emerald-700 dark:text-emerald-400">Muatan ≤ C ({config.C} L)</strong>
                  </span>
                </div>

                <div className="mt-2 text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
                  <div className="text-[11px] font-medium text-[#7D8B81] dark:text-[#8FB0B4]">Urutan Rute Tetap:</div>
                  <div className="mt-0.5 rounded-lg border border-[#D9DFD7] bg-white p-2 text-[11px] font-mono text-[#10303A] break-all dark:bg-[#121D22] dark:border-[#243741] dark:text-white">
                    {fixedTrip.tour.map(n => n.name || n.id).join(' → ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
