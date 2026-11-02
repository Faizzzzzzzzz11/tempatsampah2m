import React from 'react';
import { Boxes } from 'lucide-react';
import { Bin, SystemConfig } from '../types';

interface BinsQuickGridProps {
  bins: Bin[];
  config: SystemConfig;
  onOpenBinModal: (binId: number) => void;
}

export const BinsQuickGrid: React.FC<BinsQuickGridProps> = ({
  bins,
  config,
  onOpenBinModal,
}) => {
  return (
    <div className="space-y-3 rounded-2xl border border-[#D9DFD7] bg-white p-4 shadow-sm dark:bg-[#121D22] dark:border-[#243741]">
      <div className="flex items-center justify-between border-b border-[#E5E9E2] pb-2 dark:border-[#243741]">
        <h3 className="flex items-center gap-2 font-['Bricolage_Grotesque'] text-sm font-bold text-[#10303A] dark:text-white">
          <Boxes className="h-4 w-4 text-[#5B6A60] dark:text-[#A3B9B1]" />
          <span>Daftar {bins.length} Tong Sampah</span>
        </h3>
        <span className="text-[11px] text-[#7D8B81] dark:text-[#8FB0B4]">Klik untuk ubah isi</span>
      </div>

      <div className="grid max-h-60 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
        {bins.map(b => {
          let bg = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
          if (b.noData) {
            bg = 'bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300';
          } else if (b.fill >= config.redLimit) {
            bg = 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100';
          } else if (b.fill >= config.yellowLimit) {
            bg = 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
          }

          return (
            <button
              key={b.id}
              onClick={() => onOpenBinModal(b.id)}
              className={`rounded-lg border p-1.5 text-center font-['Public_Sans'] text-xs font-semibold transition hover:scale-105 shadow-2xs ${bg}`}
              title={`${b.name}: ${b.noData ? 'Tanpa Data' : b.fill + '%'} — Klik untuk edit`}
            >
              <div className="font-bold">{b.name}</div>
              <div className="text-[10px] opacity-80">{b.noData ? '?' : `${b.fill}%`}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
