import React from 'react';
import { Truck } from 'lucide-react';
import { AnimWaypoint, SystemConfig } from '../types';

interface TruckTelemetryBarProps {
  waypoint: AnimWaypoint | null;
  load: number;
  prevLoad: number;
  config: SystemConfig;
  speed: number;
  onChangeSpeed: (speed: number) => void;
}

export const TruckTelemetryBar: React.FC<TruckTelemetryBarProps> = ({
  waypoint,
  load,
  prevLoad,
  config,
  speed,
  onChangeSpeed,
}) => {
  if (!waypoint) return null;

  const pct = Math.min(100, Math.round((load / config.C) * 100));
  const isOver = load > config.C;
  const delta = load - prevLoad;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#10303A] p-3.5 font-['Public_Sans'] text-xs text-white shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 font-bold text-white shadow-xs animate-pulse">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-['Bricolage_Grotesque'] font-bold text-blue-300">
              TRIP {waypoint.tripIndex === 'fixed' ? 'RUTE TETAP' : waypoint.tripIndex} AKTIF
            </span>
            <span className="text-[11px] text-[#A9C1C4]">
              {waypoint.isStop && waypoint.stopBin
                ? waypoint.stopBin.id === 'P'
                  ? 'Tiba di Pangkalan & TPS 3R (P) — Muatan Ditampung ke TPS'
                  : `Mengangkut ${waypoint.stopBin.name}`
                : `Menuju ${waypoint.targetBin ? waypoint.targetBin.name : 'Pangkalan & TPS 3R'}`}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#8FB0B4]">
            Koordinat GPS: {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Capacity Gauge Bar */}
      <div className="w-full max-w-xs flex-1">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-bold">
            <span className="text-base text-white">{load}</span>{' '}
            <span className="text-[#A9C1C4]">/ {config.C} Liter</span>
          </span>
          {delta > 0 && <span className="font-bold text-emerald-300 animate-bounce">+{delta} L</span>}
          {load === 0 && prevLoad > 0 && <span className="text-xs font-bold text-teal-300">✓ Masuk ke TPS 3R</span>}
          <span className={`font-bold ${isOver ? 'text-red-400' : 'text-white'}`}>{pct}%</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full border border-white/20 bg-[#0A2229]">
          <div
            className={`h-full transition-all duration-300 ${
              pct >= 80 ? 'bg-[#D63B2F]' : pct >= 50 ? 'bg-[#E3A008]' : 'bg-[#2E9E5B]'
            }`}
            style={{ width: `${pct}%` }}
          />
          {/* Tick marks at 50% and 80% */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
          <div className="absolute inset-y-0 left-[80%] w-px bg-white/40" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[#A9C1C4]">
        <span>Kecepatan:</span>
        <select
          value={speed}
          onChange={e => onChangeSpeed(parseFloat(e.target.value))}
          className="rounded border border-white/20 bg-[#1B4552] px-2 py-0.5 text-xs text-white"
        >
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="2">2x</option>
          <option value="4">4x</option>
          <option value="8">8x</option>
        </select>
      </div>
    </div>
  );
};
