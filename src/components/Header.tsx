import React from 'react';
import { Truck, Sliders, Play, AlertTriangle, X, Radio, Sun, Moon, Navigation } from 'lucide-react';
import { CitizenReport } from '../types';

interface HeaderProps {
  mqttStatus: 'connected' | 'connecting' | 'fallback';
  activeReportAlert: CitizenReport | null;
  onDismissAlert: () => void;
  onFocusReportedBin: (binId: number) => void;
  onOpenConfig: () => void;
  onRunOptimization: () => void;
  selectedScenario: string;
  onSelectScenario: (scenario: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenGoogleMaps?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mqttStatus,
  activeReportAlert,
  onDismissAlert,
  onFocusReportedBin,
  onOpenConfig,
  onRunOptimization,
  selectedScenario,
  onSelectScenario,
  theme,
  onToggleTheme,
  onOpenGoogleMaps,
}) => {
  return (
    <>
      <header className="sticky top-0 z-40 bg-[#10303A] text-white shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-2.5 lg:px-8">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-[#F2C14E] text-[#10303A] shadow-xs">
              <Truck className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center font-['Bricolage_Grotesque'] text-base sm:text-lg font-extrabold tracking-tight truncate">
                <span>Trash<span className="text-[#F2C14E]">Route</span></span>
                <span
                  className={`ml-2 h-2 w-2 rounded-full shrink-0 ${
                    mqttStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                  title={mqttStatus === 'connected' ? 'IoT Sync Aktif' : 'Menghubungkan IoT...'}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#A9C1C4] truncate">
                Kapanewon Godean, Sleman
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Scenario Selector right in Header */}
            <select
              value={selectedScenario}
              onChange={e => onSelectScenario(e.target.value)}
              aria-label="Pilih Skenario Pengujian"
              className="max-w-[125px] sm:max-w-[170px] truncate rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[11px] sm:text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-[#F2C14E] cursor-pointer"
            >
              <option value="sedikit" className="bg-[#10303A] text-white">Kasus 1 Trip (~535 L)</option>
              <option value="cukup" className="bg-[#10303A] text-white">Kasus 2 Trip (~1.440 L)</option>
              <option value="banyak" className="bg-[#10303A] text-white">Kasus 3 Trip (~2.150 L)</option>
              <option value="kosong" className="bg-[#10303A] text-white">Kasus Kosong (0 Trip)</option>
              <option value="abu" className="bg-[#10303A] text-white">Sensor Error</option>
              <option value="random" className="bg-[#10303A] text-white">Acak Muatan</option>
            </select>

            {/* Global Theme Switcher */}
            <button
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              className="inline-flex items-center justify-center rounded-lg border border-white/20 p-1.5 text-xs text-white transition hover:bg-white/10 cursor-pointer focus:outline-none"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-300" />
              ) : (
                <Moon className="h-4 w-4 text-[#F2C14E]" />
              )}
            </button>

            {/* Config Parameter */}
            <button
              onClick={onOpenConfig}
              aria-label="Atur Parameter Sistem"
              title="Atur Parameter Sistem"
              className="inline-flex items-center justify-center rounded-lg border border-white/20 p-1.5 text-xs text-white transition hover:bg-white/10 cursor-pointer focus:outline-none"
            >
              <Sliders className="h-4 w-4" />
            </button>

            {/* Google Maps Direct Navigation */}
            {onOpenGoogleMaps && (
              <button
                onClick={onOpenGoogleMaps}
                aria-label="Buka Navigasi Rute Langsung ke Google Maps"
                title="Buka Navigasi Rute Langsung ke Google Maps"
                className="inline-flex items-center gap-1 rounded-lg border border-blue-400/40 bg-blue-600/30 hover:bg-blue-600 px-2.5 py-1 text-xs font-bold text-white transition cursor-pointer focus:outline-none"
              >
                <Navigation className="h-3.5 w-3.5 fill-current text-blue-300" />
                <span className="hidden md:inline">G-Maps</span>
              </button>
            )}

            {/* Hitung Rute */}
            <button
              onClick={onRunOptimization}
              className="inline-flex items-center gap-1 rounded-lg bg-[#F2C14E] px-2.5 py-1 sm:px-3 sm:py-1 text-xs font-bold text-[#10303A] shadow-2xs transition hover:bg-[#f6cf72] cursor-pointer"
              title="Hitung ulang rute Held-Karp TSP"
            >
              <Play className="h-3.5 w-3.5 fill-current shrink-0" />
              <span>Hitung</span>
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Citizen Report Alert Banner */}
      {activeReportAlert && (
        <div className="sticky top-[53px] sm:top-[64px] z-35 border-b-2 border-amber-500 bg-amber-100 shadow-lg">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-3 py-2 sm:px-6 sm:py-2.5 lg:px-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 animate-bounce items-center justify-center rounded-lg bg-red-600 text-sm sm:text-base text-white shadow-xs">
                🚨
              </span>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-amber-950 sm:text-sm truncate">
                  LAPORAN:{' '}
                  <span className="text-red-700 underline">{activeReportAlert.binName}</span> —{' '}
                  <span className="font-semibold">{activeReportAlert.type}</span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-amber-900 truncate">
                  {activeReportAlert.time} · {activeReportAlert.notes}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onFocusReportedBin(activeReportAlert.binId)}
                className="rounded-md bg-amber-700 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-white shadow-xs transition hover:bg-amber-800 cursor-pointer"
              >
                📍 Fokus Peta
              </button>
              <button
                onClick={onDismissAlert}
                className="flex items-center gap-1 rounded-md border border-amber-600 px-2 py-1 text-[11px] sm:text-xs font-semibold text-amber-900 transition hover:bg-amber-200 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Tutup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
