import React, { useState } from 'react';
import { Gauge, Eye, Play, Layers, ChevronDown, ChevronUp, Route, CheckCircle2 } from 'lucide-react';
import { ExecutionResult, SystemConfig, Trip } from '../types';
import { toRealKm } from '../services/routingEngine';

interface EfficiencyCardProps {
  result: ExecutionResult;
  config: SystemConfig;
  convPlan: { trips: number; dist: number; liter: number };
  binCount: number;
  fixedTrip?: Trip;
  selectedTripFilter?: 'all' | 'fixed' | number | string;
  onSelectTripFilter?: (filter: 'all' | 'fixed' | number | string) => void;
  onPlaySpecificTripAnim?: (tripIdx: number | 'fixed') => void;
  showFixedComparison?: boolean;
  onToggleFixedComparison?: () => void;
}

export const EfficiencyCard: React.FC<EfficiencyCardProps> = ({
  result,
  config,
  convPlan,
  binCount,
  fixedTrip,
  selectedTripFilter,
  onSelectTripFilter,
  onPlaySpecificTripAnim,
  showFixedComparison = false,
  onToggleFixedComparison,
}) => {
  const [showSubTripsDetail, setShowSubTripsDetail] = useState(false);

  const convKm = toRealKm(convPlan.dist);
  const smartKm = toRealKm(result.totalDistance);
  const savedDist = convPlan.dist - result.totalDistance;
  const pctSaved = convPlan.dist > 0 ? ((savedDist / convPlan.dist) * 100).toFixed(1) : '0.0';
  const savedKm = (parseFloat(convKm) - parseFloat(smartKm)).toFixed(1);
  const savedFuel = (parseFloat(savedKm) * (config.fuelPerKm || 0.22)).toFixed(1);

  const isFixedActive = selectedTripFilter === 'fixed' || (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-'));

  return (
    <div className="space-y-3.5 rounded-2xl border border-[#D9DFD7] bg-white p-4 shadow-sm dark:bg-[#121D22] dark:border-[#243741] transition">
      {/* Header with Title & Quick Map Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E5E9E2] pb-3 dark:border-[#243741]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Gauge className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-['Bricolage_Grotesque'] text-sm font-bold text-[#10303A] dark:text-white">
                Analisis Efisiensi: Rute Tetap vs Rute Cerdas
              </h3>
              {isFixedActive ? (
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                  RUTE TETAP AKTIF DI PETA
                </span>
              ) : showFixedComparison ? (
                <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold dark:bg-blue-900/50 dark:text-blue-300">
                  OVERLAY BANDINGKAN: ON
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-[#5B6A60] dark:text-[#A3B9B1]">
              Komparasi konsumsi jarak tempuh jalan raya, BBM solar, dan kapasitas armada truk (C = {config.C.toLocaleString()} L).
            </p>
          </div>
        </div>

        {/* Action Buttons for Rute Tetap */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {onSelectTripFilter && (
            <button
              onClick={() => onSelectTripFilter(isFixedActive ? 'all' : 'fixed')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition shadow-2xs cursor-pointer ${
                isFixedActive
                  ? 'bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
                  : 'border border-[#C4CEC2] bg-[#F8FAF6] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
              }`}
              title={isFixedActive ? 'Kembali ke rute cerdas' : 'Tampilkan rute untuk trip tetap di peta'}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{isFixedActive ? 'Kembali ke Rute Cerdas' : 'Lihat Rute Tetap di Peta'}</span>
            </button>
          )}

          {onToggleFixedComparison && (
            <button
              onClick={onToggleFixedComparison}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition shadow-2xs cursor-pointer ${
                showFixedComparison
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400 hover:bg-blue-700'
                  : 'border border-[#C4CEC2] bg-[#F8FAF6] text-[#10303A] hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
              }`}
              title="Tampilkan garis rute tetap bersamaan dengan rute cerdas di peta"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{showFixedComparison ? 'Bandingkan: Aktif' : 'Bandingkan di Peta'}</span>
            </button>
          )}

          {onPlaySpecificTripAnim && (
            <button
              onClick={() => onPlaySpecificTripAnim('fixed')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-1.5 font-bold text-white shadow-2xs transition hover:bg-slate-800 cursor-pointer dark:bg-slate-600 dark:hover:bg-slate-500"
              title="Simulasikan armada melintasi rute tetap konvensional"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Simulasi Rute Tetap</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Comparative Metrics */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#D9DFD7] bg-white sm:grid-cols-3 dark:border-[#243741] dark:bg-[#17262D]">
        {/* Cell 1: Conventional Fixed Route */}
        <div
          className={`p-4 transition border-b border-[#D9DFD7] sm:border-b-0 sm:border-r dark:border-[#243741] ${
            isFixedActive ? 'bg-slate-100/90 dark:bg-slate-800/40 ring-2 ring-inset ring-slate-400' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5B6A60] dark:text-[#A3B9B1]">
              Rute Tetap (Konvensional)
            </span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              T1..T{binCount}
            </span>
          </div>
          <div className="mt-1.5 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#46554B] dark:text-slate-200">
            {convKm} km
          </div>
          <div className="mt-0.5 text-[11px] text-[#7D8B81] dark:text-slate-400">
            {convPlan.trips} trip armada · Mengangkut {convPlan.liter.toLocaleString()} L total
          </div>
          <p className="mt-1 text-[11px] text-[#5B6A60] opacity-80 dark:text-[#A3B9B1]">
            Kunjungi semua {binCount} tong tanpa seleksi; kembali ke pangkalan saat truk penuh.
          </p>
        </div>

        {/* Cell 2: Smart Multi-Trip Route */}
        <div
          className={`p-4 transition border-b border-[#D9DFD7] bg-blue-50/40 sm:border-b-0 sm:border-r dark:bg-blue-950/20 dark:border-[#243741] ${
            !isFixedActive ? 'ring-2 ring-inset ring-[#0F6B73]/30' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#0F6B73] dark:text-[#2dd4bf]">
              Rute Cerdas (Held-Karp TSP)
            </span>
            <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-900/50 dark:text-teal-300">
              ADAPTIF
            </span>
          </div>
          <div className="mt-1.5 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#0F6B73] dark:text-teal-300">
            {smartKm} km
          </div>
          <div className="mt-0.5 text-[11px] text-[#0F6B73]/90 dark:text-teal-400">
            {result.tripCount} trip armada · Prioritas {result.redBins.length} tong merah + {result.acceptedYellowBins.length} kuning searah
          </div>
          <p className="mt-1 text-[11px] text-[#0F6B73]/80 opacity-80 dark:text-teal-400/90">
            Hanya mengunjungi tong darurat &amp; searah jalan raya, menghindari rute mubazir.
          </p>
        </div>

        {/* Cell 3: Savings */}
        <div className="bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              Penghematan &amp; Efisiensi
            </span>
            <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
              SOLAR &amp; WAKTU
            </span>
          </div>
          <div className="mt-1.5 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
            {savedDist >= 0 ? `Hemat ${pctSaved}%` : `+${Math.abs(parseFloat(savedKm))} km`}
          </div>
          <div className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
            Hemat solar ~<strong>{Math.max(0, parseFloat(savedFuel))}</strong> Liter · Selisih {Math.abs(parseFloat(savedKm))} km
          </div>
          <p className="mt-1 text-[11px] text-emerald-700 opacity-80 dark:text-emerald-400">
            {convPlan.trips === result.tripCount
              ? 'Jumlah trip sama dengan jarak jauh lebih ringkas.'
              : convPlan.trips > result.tripCount
              ? `Berhasil pangkas ${convPlan.trips - result.tripCount} trip bolak-balik pangkalan!`
              : `Rute cerdas membagi menjadi ${result.tripCount} trip agar muatan optimal.`}
          </p>
        </div>
      </div>

      {/* Visual Distance Reduction Progress Bar */}
      <div className="space-y-1.5 rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 text-xs dark:bg-[#17262D] dark:border-[#243741]">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#5B6A60] dark:text-[#A3B9B1]">
          <span>Perbandingan Jarak Tempuh Jalan Raya</span>
          <span className="font-mono text-[#10303A] dark:text-white">
            {smartKm} km (Cerdas) vs {convKm} km (Tetap)
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-300 dark:bg-slate-700">
          <div
            className="h-full bg-[#0F6B73] transition-all duration-500 rounded-full"
            style={{
              width: `${Math.min(100, (parseFloat(smartKm) / Math.max(0.1, parseFloat(convKm))) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Rute Tetap Breakdown Drawer (Urutan Perhentian & Sub-Trip) */}
      {fixedTrip && (
        <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 dark:bg-[#17262D] dark:border-[#243741] transition">
          <button
            onClick={() => setShowSubTripsDetail(prev => !prev)}
            className="flex w-full items-center justify-between text-xs font-bold text-[#10303A] dark:text-white cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>
                Detail Perjalanan Rute Tetap ({fixedTrip.subTripCount || 1} Sub-Trip Pengangkutan)
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#5B6A60] dark:text-[#A3B9B1]">
              <span>{showSubTripsDetail ? 'Sembunyikan' : 'Buka Rincian'}</span>
              {showSubTripsDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </div>
          </button>

          {showSubTripsDetail && (
            <div className="mt-3 space-y-2 border-t border-[#D9DFD7] pt-2.5 dark:border-[#243741]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fixedTrip.subTrips?.map((st, sIdx) => {
                  const firstBin = st.bins[0]?.name || `T${st.bins[0]?.id}`;
                  const lastBin = st.bins[st.bins.length - 1]?.name || `T${st.bins[st.bins.length - 1]?.id}`;
                  const isSubActive = selectedTripFilter === `fixed-${st.subIndex || sIdx + 1}`;

                  return (
                    <div
                      key={sIdx}
                      className={`rounded-lg border p-2.5 text-xs transition ${
                        isSubActive
                          ? 'border-slate-700 bg-slate-200/80 dark:border-slate-500 dark:bg-slate-800'
                          : 'border-[#D9DFD7] bg-white dark:border-[#243741] dark:bg-[#121D22]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[#10303A] dark:text-white">
                        <span>Sub-Trip Tetap #{sIdx + 1}</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          {st.bins.length} Tong
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#5B6A60] dark:text-[#A3B9B1]">
                        Lintasan: <strong>{firstBin}</strong> → <strong>{lastBin}</strong>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#7D8B81]">
                        <span>Muatan: {st.loadLiter} L</span>
                        <span>Jarak: {st.realRoadKm || toRealKm(st.distance)} km</span>
                      </div>
                      {onSelectTripFilter && (
                        <button
                          onClick={() => onSelectTripFilter(`fixed-${sIdx + 1}`)}
                          className="mt-2 w-full rounded border border-[#C4CEC2] bg-[#F8FAF6] py-1 text-[10px] font-bold text-[#10303A] hover:bg-slate-200 cursor-pointer dark:bg-[#17262D] dark:border-[#243741] dark:text-white"
                        >
                          Fokus Sub-Trip #{sIdx + 1} di Peta
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Full Tour String */}
              <div className="mt-2 text-[11px] text-[#5B6A60] dark:text-[#A3B9B1]">
                <div className="font-semibold">Urutan Lengkap Rute Tetap:</div>
                <div className="mt-1 rounded-lg border border-[#D9DFD7] bg-white p-2 font-mono text-[11px] text-[#10303A] break-all dark:bg-[#121D22] dark:border-[#243741] dark:text-white">
                  {fixedTrip.tour.map(n => n.name || n.id).join(' → ')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
