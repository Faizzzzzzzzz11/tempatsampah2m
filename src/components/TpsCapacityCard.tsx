import React, { useState } from 'react';
import {
  Warehouse,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sliders,
  Check,
  AlertTriangle,
  Play,
  Eye,
  Info,
  Scale,
  PlusCircle,
  Truck,
} from 'lucide-react';
import { ExecutionResult, SystemConfig, Depot } from '../types';
import { toRealKm, toTravelMinutes } from '../services/routingEngine';

interface TpsCapacityCardProps {
  depot: Depot;
  result: ExecutionResult;
  config: SystemConfig;
  tpsMaxCapacity: number;
  tpsInitialWaste: number;
  completedTripIds: (number | string)[];
  onToggleTripCompleted: (tripIndex: number | string) => void;
  onCompleteAllTrips: () => void;
  onResetTps: () => void;
  onChangeMaxCapacity: (capacity: number) => void;
  onChangeInitialWaste: (waste: number) => void;
  selectedTripFilter: 'all' | 'fixed' | number | string;
  onSelectTripFilter: (filter: 'all' | 'fixed' | number | string) => void;
  onPlaySpecificTripAnim: (tripIdx: number | string) => void;
}

const TRIP_COLORS = [
  { stroke: '#1F5FD6', bg: '#DCE7FB', border: '#93C5FD', text: 'text-blue-700' },
  { stroke: '#8A3FC4', bg: '#EEE0F8', border: '#D8B4FE', text: 'text-purple-700' },
  { stroke: '#0A8F99', bg: '#D2EEF0', border: '#99F6E4', text: 'text-teal-700' },
  { stroke: '#C8326B', bg: '#F8DCE7', border: '#FBCFE8', text: 'text-pink-700' },
];

export const TpsCapacityCard: React.FC<TpsCapacityCardProps> = ({
  depot,
  result,
  config,
  tpsMaxCapacity,
  tpsInitialWaste,
  completedTripIds,
  onToggleTripCompleted,
  onCompleteAllTrips,
  onResetTps,
  onChangeMaxCapacity,
  onChangeInitialWaste,
  selectedTripFilter,
  onSelectTripFilter,
  onPlaySpecificTripAnim,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [customCap, setCustomCap] = useState(tpsMaxCapacity);
  const [customInit, setCustomInit] = useState(tpsInitialWaste);

  // Total waste added from completed trips
  const completedTripsList = result.trips.filter(t => completedTripIds.includes(t.tripIndex));
  const completedWasteLiter = completedTripsList.reduce((acc, t) => acc + t.loadLiter, 0);

  // Current waste at TPS = baseline initial waste + completed trips
  const currentTpsVolume = tpsInitialWaste + completedWasteLiter;
  const tpsPercent = Math.min(100, Math.round((currentTpsVolume / tpsMaxCapacity) * 1000) / 10);
  const remainingCapacity = Math.max(0, tpsMaxCapacity - currentTpsVolume);
  const remainingPercent = Math.max(0, Math.round((100 - tpsPercent) * 10) / 10);

  // Estimated weight (standard municipal solid waste density ~0.28 kg/Liter)
  const weightKg = Math.round(currentTpsVolume * 0.28);
  const weightTon = (weightKg / 1000).toFixed(2);

  // Projected total if all planned trips finish
  const allTripsPlannedWaste = result.trips.reduce((acc, t) => acc + t.loadLiter, 0);
  const projectedTotalVolume = tpsInitialWaste + allTripsPlannedWaste;
  const projectedPercent = Math.min(100, Math.round((projectedTotalVolume / tpsMaxCapacity) * 1000) / 10);

  // Status classification
  const isCritical = tpsPercent >= 85;
  const isWarning = tpsPercent >= 65 && tpsPercent < 85;
  const isSafe = tpsPercent < 65;

  const handleApplySettings = () => {
    onChangeMaxCapacity(Math.max(1000, customCap));
    onChangeInitialWaste(Math.max(0, customInit));
    setShowSettings(false);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9DFD7] bg-white p-4 shadow-sm dark:bg-[#121D22] dark:border-[#243741]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9E2] pb-3 dark:border-[#243741]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-['Bricolage_Grotesque'] text-sm sm:text-base font-bold text-[#10303A] dark:text-[#F3F7F5]">
              <span>Perincian Kapasitas Penampungan TPS 3R</span>
              <span className="rounded bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                Pangkalan {depot.id || 'P'}
              </span>
            </h3>
            <p className="text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
              {depot.name} • Bertambah secara otomatis setiap kali armada truk menyelesaikan trip
            </p>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {isCritical ? (
            <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 animate-pulse dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>KRITIS: TPS {tpsPercent}% (Segera Transfer ke TPA)</span>
            </span>
          ) : isWarning ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>SIAGA: TPS {tpsPercent}% (Mendekati Batas)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>OPTIMAL: Kapasitas TPS Aman ({tpsPercent}%)</span>
            </span>
          )}

          <span className="rounded-full border border-[#D9DFD7] bg-[#F8FAF6] px-2.5 py-1 text-xs font-semibold text-[#5B6A60] dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1]">
            {completedTripsList.length} / {result.trips.length} Trip Masuk
          </span>
        </div>
      </div>

      {/* Main Capacity Visual Progress Gauge */}
      <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3.5 dark:bg-[#17262D] dark:border-[#243741]">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-[#10303A] dark:text-[#F3F7F5] flex items-center gap-1.5">
            <span>Keterisian Fisik TPS:</span>
            <span className="font-['Bricolage_Grotesque'] text-sm text-teal-700 dark:text-teal-400">
              {currentTpsVolume.toLocaleString()} / {tpsMaxCapacity.toLocaleString()} Liter
            </span>
            <span className="text-[#5B6A60] dark:text-[#A3B9B1]">({tpsPercent}%)</span>
          </div>
          <div className="text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
            Sisa Ruang Tersedia: <strong className="text-emerald-700 dark:text-emerald-400">{remainingCapacity.toLocaleString()} Liter</strong> ({remainingPercent}%)
          </div>
        </div>

        {/* Stacked Visual Bar */}
        <div className="mt-2.5 relative h-5 w-full overflow-hidden rounded-full border border-[#C4CEC2] bg-white shadow-inner dark:bg-[#0B1317] dark:border-[#2E4450]">
          {/* Baseline Initial Waste */}
          {tpsInitialWaste > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 bg-slate-400/80 transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
              style={{ width: `${Math.min(100, (tpsInitialWaste / tpsMaxCapacity) * 100)}%` }}
              title={`Sampah Awal TPS: ${tpsInitialWaste} L`}
            >
              Awal
            </div>
          )}

          {/* Completed Trips Segments */}
          {result.trips.map((trip, idx) => {
            if (!completedTripIds.includes(trip.tripIndex)) return null;

            // Calculate start offset of this trip segment
            const previousCompleted = result.trips
              .slice(0, idx)
              .filter(t => completedTripIds.includes(t.tripIndex))
              .reduce((s, t) => s + t.loadLiter, 0);

            const startLiter = tpsInitialWaste + previousCompleted;
            const leftPct = (startLiter / tpsMaxCapacity) * 100;
            const widthPct = (trip.loadLiter / tpsMaxCapacity) * 100;
            const color = TRIP_COLORS[idx % TRIP_COLORS.length];

            return (
              <div
                key={trip.tripIndex}
                className="absolute top-0 bottom-0 transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: color.stroke,
                }}
                title={`Trip ${trip.tripIndex}: +${trip.loadLiter} L`}
              >
                T{trip.tripIndex}
              </div>
            );
          })}

          {/* Reference Line for Warning (80%) */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ left: '80%' }}
            title="Batas Waspada 80% (Perlu Pengangkutan ke TPA)"
          />
        </div>

        {/* Legend & Milestone markers */}
        <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-[#5B6A60] dark:text-[#799088]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
              <span>Awal ({tpsInitialWaste} L)</span>
            </span>
            {result.trips.map((trip, idx) => {
              const color = TRIP_COLORS[idx % TRIP_COLORS.length];
              const isDone = completedTripIds.includes(trip.tripIndex);
              return (
                <span
                  key={trip.tripIndex}
                  className={`flex items-center gap-1 ${
                    isDone ? 'font-bold text-[#10303A] dark:text-white' : 'opacity-40'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: color.stroke }}
                  />
                  <span>
                    Trip {trip.tripIndex} (+{trip.loadLiter} L) {isDone ? '✓' : ''}
                  </span>
                </span>
              );
            })}
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span>0%</span>
            <span>50%</span>
            <span className="font-bold text-red-600 dark:text-red-400">80% (Batas TPA)</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* 4 Key Stat Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 dark:bg-[#17262D] dark:border-[#243741]">
          <div className="text-[11px] font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Total Sampah Terkumpul</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-teal-700 dark:text-teal-400">
            {currentTpsVolume.toLocaleString()}{' '}
            <span className="text-xs font-normal text-[#5B6A60] dark:text-[#A3B9B1]">Liter</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#7D8B81] dark:text-[#799088]">
            {tpsPercent}% dari kuota tampung
          </div>
        </div>

        <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 dark:bg-[#17262D] dark:border-[#243741]">
          <div className="text-[11px] font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Kapasitas Maksimal TPS</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-[#10303A] dark:text-[#F3F7F5]">
            {tpsMaxCapacity.toLocaleString()}{' '}
            <span className="text-xs font-normal text-[#5B6A60] dark:text-[#A3B9B1]">Liter</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#7D8B81] dark:text-[#799088]">
            Kontainer 6 m³ Standar Sleman
          </div>
        </div>

        <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 dark:bg-[#17262D] dark:border-[#243741]">
          <div className="text-[11px] font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Sisa Kuota Ruang</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {remainingCapacity.toLocaleString()}{' '}
            <span className="text-xs font-normal text-[#5B6A60] dark:text-[#A3B9B1]">Liter</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#7D8B81] dark:text-[#799088]">
            Mampu menampung {Math.floor(remainingCapacity / (config.binCap || 100))} tong lagi
          </div>
        </div>

        <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 dark:bg-[#17262D] dark:border-[#243741]">
          <div className="text-[11px] font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Estimasi Berat Sampah</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400">
            {weightTon}{' '}
            <span className="text-xs font-normal text-[#5B6A60] dark:text-[#A3B9B1]">Ton</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#7D8B81] dark:text-[#799088]">
            ≈ {weightKg.toLocaleString()} kg (0.28 kg/L)
          </div>
        </div>
      </div>

      {/* Quick Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-3 dark:bg-[#17262D] dark:border-[#243741]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onCompleteAllTrips}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-teal-700 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Selesaikan Semua Trip</span>
          </button>

          <button
            onClick={onResetTps}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C4CEC2] bg-white px-3 py-1.5 text-xs font-semibold text-[#10303A] shadow-2xs transition hover:bg-slate-100 dark:bg-[#121D22] dark:border-[#243741] dark:text-[#F3F7F5] dark:hover:bg-[#1B2C33] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
            <span>Kosongkan TPS (Kirim Armada ke TPA)</span>
          </button>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#C4CEC2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#46554B] hover:bg-slate-100 dark:bg-[#121D22] dark:border-[#243741] dark:text-[#A3B9B1] dark:hover:bg-[#1B2C33] cursor-pointer"
        >
          <Sliders className="h-3.5 w-3.5 text-teal-600" />
          <span>{showSettings ? 'Tutup Pengaturan' : 'Atur Kapasitas TPS'}</span>
        </button>
      </div>

      {/* Expandable TPS Settings Panel */}
      {showSettings && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3 dark:bg-teal-950/20 dark:border-teal-900/60">
          <div className="flex items-center justify-between">
            <h4 className="font-['Bricolage_Grotesque'] text-xs font-bold text-teal-900 dark:text-teal-300">
              Pengaturan Parameter Penampungan TPS 3R Godean
            </h4>
            <span className="text-[11px] text-teal-700 dark:text-teal-400">
              Data tersimpan otomatis di perangkat
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#10303A] dark:text-[#F3F7F5] mb-1">
                Kapasitas Maksimal TPS (Liter):
              </label>
              <input
                type="number"
                step="500"
                min="1000"
                max="25000"
                value={customCap}
                onChange={e => setCustomCap(parseInt(e.target.value) || 1000)}
                className="w-full rounded-lg border border-[#C4CEC2] bg-white px-3 py-2 font-mono text-[#10303A] dark:bg-[#121D22] dark:border-[#243741] dark:text-white"
              />
              <div className="mt-1.5 flex gap-1.5">
                {[4000, 6000, 8000, 10000].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCustomCap(v)}
                    className="flex-1 rounded border border-[#C4CEC2] bg-white py-1 text-[10px] font-semibold hover:bg-teal-100 dark:bg-[#121D22] dark:border-[#243741] dark:hover:bg-teal-950"
                  >
                    {v / 1000} m³
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#10303A] dark:text-[#F3F7F5] mb-1">
                Sampah Awal Sebelum Trip Dimulai (Liter):
              </label>
              <input
                type="number"
                step="100"
                min="0"
                max={customCap}
                value={customInit}
                onChange={e => setCustomInit(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-[#C4CEC2] bg-white px-3 py-2 font-mono text-[#10303A] dark:bg-[#121D22] dark:border-[#243741] dark:text-white"
              />
              <div className="mt-1.5 flex gap-1.5">
                {[0, 500, 1000, 1500].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCustomInit(v)}
                    className="flex-1 rounded border border-[#C4CEC2] bg-white py-1 text-[10px] font-semibold hover:bg-teal-100 dark:bg-[#121D22] dark:border-[#243741] dark:hover:bg-teal-950"
                  >
                    {v} L
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-lg border border-[#C4CEC2] bg-white px-3 py-1.5 text-xs text-[#5B6A60] hover:bg-slate-100 dark:bg-[#121D22] dark:border-[#243741] dark:text-[#A3B9B1]"
            >
              Batal
            </button>
            <button
              onClick={handleApplySettings}
              className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
            >
              Simpan Parameter
            </button>
          </div>
        </div>
      )}

      {/* Breakdown Table: Penambahan Sampah Setiap Selesai Trip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 font-['Bricolage_Grotesque'] text-xs sm:text-sm font-bold text-[#10303A] dark:text-[#F3F7F5]">
            <Truck className="h-4 w-4 text-teal-600" />
            <span>Tabel Perincian Masuk Sampah Tiap Trip ke TPS</span>
          </h4>
          <span className="text-[11px] text-[#5B6A60] dark:text-[#A3B9B1]">
            Klik centang untuk menandai trip selesai
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#D9DFD7] dark:border-[#243741]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E5E9E2] bg-[#F8FAF6] text-[#5B6A60] dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Trip &amp; Armada</th>
                <th className="py-2.5 px-3 font-semibold">Muatan Masuk</th>
                <th className="py-2.5 px-3 font-semibold">Tong Terlayani</th>
                <th className="py-2.5 px-3 font-semibold">Jarak &amp; Waktu</th>
                <th className="py-2.5 px-3 font-semibold">Dampak ke TPS</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status Masuk</th>
                <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9E2] dark:divide-[#243741]">
              {result.trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs text-[#5B6A60] dark:text-[#A3B9B1]">
                    Belum ada trip aktif yang direncanakan.
                  </td>
                </tr>
              ) : (
                result.trips.map((trip, idx) => {
                  const colorObj = TRIP_COLORS[idx % TRIP_COLORS.length];
                  const isDone = completedTripIds.includes(trip.tripIndex);
                  const isIsolated = selectedTripFilter === trip.tripIndex;
                  const tripKm = trip.realRoadKm || toRealKm(trip.distance);
                  const tripMin = toTravelMinutes(trip.distance, config);

                  // Calculate accumulation if this trip is added
                  const tripBinsStr = trip.bins.map(b => b.name).join(', ');

                  return (
                    <tr
                      key={trip.tripIndex}
                      className={`transition ${
                        isDone
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-[#17262D]'
                      }`}
                    >
                      {/* Trip ID */}
                      <td className="py-3 px-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded px-2 py-0.5 font-['Bricolage_Grotesque'] text-[11px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: colorObj.stroke }}
                          >
                            TRIP {trip.tripIndex}
                          </span>
                          {isIsolated && (
                            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              FOKUS
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Muatan Masuk */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-[#10303A] dark:text-white">
                          +{trip.loadLiter} L
                        </span>
                        <div className="text-[10px] text-[#7D8B81] dark:text-[#799088]">
                          ≈ {Math.round(trip.loadLiter * 0.28)} kg sampah
                        </div>
                      </td>

                      {/* Tong Terlayani */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-[#10303A] dark:text-white">
                          {trip.bins.length} Tong
                        </span>
                        <div className="text-[10px] text-[#5B6A60] dark:text-[#A3B9B1] truncate max-w-[140px]" title={tripBinsStr}>
                          {tripBinsStr}
                        </div>
                      </td>

                      {/* Jarak & Waktu */}
                      <td className="py-3 px-3 text-[#5B6A60] dark:text-[#A3B9B1]">
                        <div>{tripKm} km</div>
                        <div className="text-[10px] text-[#7D8B81] dark:text-[#799088]">≈ {tripMin} mnt</div>
                      </td>

                      {/* Dampak ke TPS */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-teal-700 dark:text-teal-400">
                          +{( (trip.loadLiter / tpsMaxCapacity) * 100 ).toFixed(1)}% TPS
                        </div>
                        <div className="text-[10px] text-[#7D8B81] dark:text-[#799088]">
                          {isDone ? 'Sudah ditampung' : 'Akan ditampung'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Check className="h-3 w-3" />
                            <span>Selesai di TPS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Clock className="h-3 w-3" />
                            <span>Belum Dibuang</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onToggleTripCompleted(trip.tripIndex)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                              isDone
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                            }`}
                            title={isDone ? 'Batalkan status selesai' : 'Tandai selesai dibongkar di TPS'}
                          >
                            {isDone ? 'Batal' : 'Tandai Selesai'}
                          </button>

                          <button
                            onClick={() => onPlaySpecificTripAnim(trip.tripIndex as number)}
                            className="rounded-lg border border-[#C4CEC2] bg-white p-1 text-[#10303A] hover:bg-slate-100 dark:bg-[#121D22] dark:border-[#243741] dark:text-white cursor-pointer"
                            title="Jalankan simulasi animasi trip ini"
                          >
                            <Play className="h-3 w-3 fill-current" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DLH Sleman SOP Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs text-teal-900 dark:bg-teal-950/20 dark:border-teal-900/60 dark:text-teal-300">
        <Info className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold">SOP Pengelolaan Sampah TPS 3R Kapanewon Godean (DLH Sleman):</span>
          <p className="text-[11px] text-teal-800 dark:text-teal-400">
            Armada pengangkut mengumpulkan sampah dari tong teroptimasi TSP multi-trip dan langsung membongkar ke TPS 3R. Sampah organik diproses menjadi pupuk kompos, anorganik disortir ke bank sampah kalurahan, dan residu tidak terurai ditransfer ke TPA Piyungan/Bawuran sebelum kapasitas TPS melampaui 80%.
          </p>
        </div>
      </div>
    </div>
  );
};
