import React from 'react';
import { Bin, ExecutionResult, SystemConfig } from '../types';
import { toRealKm, toTravelMinutes, toFuelLiters } from '../services/routingEngine';

interface KpiStripProps {
  bins: Bin[];
  result: ExecutionResult;
  config: SystemConfig;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ bins, result, config }) => {
  const totalKm = toRealKm(result.totalDistance);
  const totalMin = toTravelMinutes(result.totalDistance, config);
  const totalFuel = toFuelLiters(result.totalDistance, config);

  return (
    <>
      {/* Mobile Sleek KPI Bar (< sm) */}
      <div className="sm:hidden rounded-xl bg-[#10303A] text-white p-2 shadow-2xs border border-white/10">
        <div className="grid grid-cols-4 divide-x divide-white/15 text-center">
          <div className="px-1">
            <div className="text-[10px] text-[#A9C1C4] font-medium">Rit</div>
            <div className="mt-0.5 font-['Bricolage_Grotesque'] text-sm font-bold text-white">
              {result.tripCount}
            </div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#A9C1C4] font-medium">Jarak</div>
            <div className="mt-0.5 font-['Bricolage_Grotesque'] text-sm font-bold text-[#F2C14E]">
              {totalKm} <span className="text-[9px] font-normal text-[#A9C1C4]">km</span>
            </div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#A9C1C4] font-medium">Muatan</div>
            <div className="mt-0.5 font-['Bricolage_Grotesque'] text-sm font-bold text-[#7EE0A3]">
              {result.totalLiter.toLocaleString()} <span className="text-[9px] font-normal text-[#A9C1C4]">L</span>
            </div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#A9C1C4] font-medium">Prioritas</div>
            <div className="mt-0.5 font-['Bricolage_Grotesque'] text-sm font-bold text-[#FF7A6B]">
              {result.redBins.length} <span className="text-[9px] font-normal text-[#A9C1C4]">tong</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tablet & Desktop Expanded KPI Grid (>= sm) */}
      <div className="hidden sm:grid grid-cols-3 lg:grid-cols-6 overflow-hidden rounded-xl bg-[#10303A] text-white shadow-2xs">
        <div className="border-l border-t border-white/10 p-3">
          <div className="text-[11px] text-[#A9C1C4] font-medium">Total Tong</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight">
            {bins.length}
          </div>
          <div className="mt-0.5 text-[10px] text-[#8FB0B4]">aktif di peta</div>
        </div>

        <div className="border-l border-t border-white/10 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#A9C1C4] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF7A6B]" />
            Wajib (&ge;{config.redLimit}%)
          </div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#FF7A6B]">
            {result.redBins.length}
          </div>
          <div className="mt-0.5 text-[10px] text-[#8FB0B4]">tong merah</div>
        </div>

        <div className="border-l border-t border-white/10 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#A9C1C4] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F2C14E]" />
            Selektif
          </div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#F2C14E]">
            {result.yellowBins.length}
          </div>
          <div className="mt-0.5 text-[10px] text-[#8FB0B4]">
            {result.acceptedYellowBins.length} lolos rute
          </div>
        </div>

        <div className="border-l border-t border-white/10 p-3">
          <div className="text-[11px] text-[#A9C1C4] font-medium">Total Muatan</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#7EE0A3]">
            {result.totalLiter.toLocaleString()} <span className="text-xs font-normal">L</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#8FB0B4]">kapasitas {config.C.toLocaleString()} L</div>
        </div>

        <div className="border-l border-t border-white/10 p-3">
          <div className="text-[11px] text-[#A9C1C4] font-medium">Jumlah Trip</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight">
            {result.tripCount}
          </div>
          <div className="mt-0.5 text-[10px] text-[#8FB0B4]">ritasi armada</div>
        </div>

        <div className="border-l border-t border-white/10 p-3">
          <div className="text-[11px] text-[#A9C1C4] font-medium">Jarak Tempuh</div>
          <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#F2C14E]">
            {totalKm} <span className="text-xs font-normal">km</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#8FB0B4]">
            ≈ {totalMin}m · {totalFuel}L
          </div>
        </div>
      </div>
    </>
  );
};
