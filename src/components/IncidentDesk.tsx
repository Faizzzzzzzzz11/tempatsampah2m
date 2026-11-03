import React from 'react';
import { Inbox, PlusCircle, CheckCheck, Navigation } from 'lucide-react';
import { CitizenReport, Bin } from '../types';
import { buildGoogleMapsNavUrl } from '../services/googleMapsService';

interface IncidentDeskProps {
  reports: CitizenReport[];
  bins?: Bin[];
  onTriggerDemoReport: () => void;
  onClearResolved: () => void;
  onFocusBin: (binId: number) => void;
  onResolveReport: (reportId: string, binId: number) => void;
}

export const IncidentDesk: React.FC<IncidentDeskProps> = ({
  reports,
  bins = [],
  onTriggerDemoReport,
  onClearResolved,
  onFocusBin,
  onResolveReport,
}) => {
  const activeCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9DFD7] bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9E2] pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-lg font-bold text-white shadow-xs">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-['Bricolage_Grotesque'] text-base font-bold text-[#10303A]">
                Kotak Masuk Laporan Warga
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                  activeCount > 0
                    ? 'border-amber-300 bg-amber-100 text-amber-800 animate-pulse'
                    : 'border-[#D9DFD7] bg-slate-100 text-[#5B6A60]'
                }`}
              >
                {activeCount} Laporan Aktif
              </span>
            </div>
            <p className="text-xs text-[#5B6A60]">
              Aduan sampah meluap &amp; kerusakan dari Portal Warga via sinkronisasi real-time MQTT.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onTriggerDemoReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 shadow-2xs"
          >
            <PlusCircle className="h-3.5 w-3.5 text-amber-600" />
            <span>+ Simulasi Laporan Masuk</span>
          </button>
          <button
            onClick={onClearResolved}
            className="rounded-lg border border-[#D9DFD7] bg-[#F5F7F3] px-3 py-1.5 text-xs font-semibold text-[#5B6A60] transition hover:bg-slate-200"
          >
            Bersihkan Selesai
          </button>
        </div>
      </div>

      {/* Incident List for Mobile */}
      <div className="space-y-2.5 md:hidden">
        {reports.map(r => {
          const isPending = r.status === 'pending';
          return (
            <div
              key={r.reportId}
              className={`rounded-xl border p-3 text-xs transition ${
                isPending
                  ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800'
                  : 'border-[#E5E9E2] bg-white dark:bg-[#121D22] dark:border-[#243741]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono font-bold text-[#10303A] dark:text-white">#{r.reportId}</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    isPending
                      ? 'border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                  }`}
                >
                  {isPending ? 'Menunggu' : '✓ Selesai'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-sm text-[#10303A] dark:text-white">{r.binName}</span>
                <span className="font-mono text-[11px] text-[#5B6A60] dark:text-[#8FB0B4]">{r.time}</span>
              </div>

              <div className="mb-2">
                <span
                  className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold ${
                    r.type.includes('Meluap')
                      ? 'border-red-200 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : 'border-amber-200 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {r.type.includes('Meluap') ? '🚨 ' : '🛠️ '}
                  {r.type}
                </span>
                {r.notes && (
                  <p className="mt-1 text-[11px] text-[#46554B] dark:text-[#A3B9B1] line-clamp-2">
                    {r.notes}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                {(() => {
                  const targetBin = bins.find(b => b.id === r.binId);
                  if (!targetBin) return null;
                  return (
                    <a
                      href={buildGoogleMapsNavUrl(targetBin.lat, targetBin.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700"
                      title="Buka rute navigasi darurat ke bak sampah ini di Google Maps"
                    >
                      <Navigation className="h-3 w-3 fill-current" />
                      <span>G-Maps</span>
                    </a>
                  );
                })()}
                <button
                  onClick={() => onFocusBin(r.binId)}
                  className="rounded-lg border border-[#C4CEC2] bg-[#F5F7F3] px-3 py-1.5 text-xs font-bold text-[#10303A] transition hover:bg-slate-200 dark:bg-[#17262D] dark:border-[#243741] dark:text-white cursor-pointer"
                >
                  📍 Peta
                </button>
                {isPending && (
                  <button
                    onClick={() => onResolveReport(r.reportId, r.binId)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer"
                  >
                    ✓ Selesai
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Incident Table for Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-y border-[#D9DFD7] bg-[#F8FAF6] font-mono text-[11px] uppercase tracking-wider text-[#5B6A60] dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1]">
              <th className="px-3 py-2.5">No. Tiket</th>
              <th className="px-3 py-2.5">Titik Tong</th>
              <th className="px-3 py-2.5">Jenis Aduan</th>
              <th className="px-3 py-2.5">Waktu Masuk</th>
              <th className="px-3 py-2.5">Catatan / Sumber</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Aksi Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E9E2] dark:divide-[#243741]">
            {reports.map(r => {
              const isPending = r.status === 'pending';
              return (
                <tr
                  key={r.reportId}
                  className={`transition ${isPending ? 'bg-amber-50/40 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-[#17262D]'}`}
                >
                  <td className="px-3 py-3 font-mono font-bold text-[#10303A] dark:text-white">#{r.reportId}</td>
                  <td className="px-3 py-3">
                    <span className="font-bold text-[#10303A] dark:text-white">{r.binName}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold ${
                        r.type.includes('Meluap')
                          ? 'border-red-200 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : 'border-amber-200 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {r.type.includes('Meluap') ? '🚨 ' : '🛠️ '}
                      {r.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-[#5B6A60] dark:text-[#8FB0B4]">{r.time}</td>
                  <td className="max-w-xs truncate px-3 py-3 text-[#46554B] dark:text-[#A3B9B1]">{r.notes}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                        isPending
                          ? 'border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                          : 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                      }`}
                    >
                      {isPending ? 'Menunggu Tindakan' : '✅ Selesai Diangkut'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {(() => {
                      const targetBin = bins.find(b => b.id === r.binId);
                      if (!targetBin) return null;
                      return (
                        <a
                          href={buildGoogleMapsNavUrl(targetBin.lat, targetBin.lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-1.5 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition hover:bg-blue-700"
                          title="Buka rute navigasi darurat ke bak sampah ini di Google Maps"
                        >
                          <Navigation className="h-3 w-3 fill-current" />
                          <span>G-Maps</span>
                        </a>
                      );
                    })()}
                    <button
                      onClick={() => onFocusBin(r.binId)}
                      className="mr-1.5 rounded-md bg-[#F5F7F3] px-2.5 py-1 text-[11px] font-bold text-[#10303A] transition hover:bg-slate-200 dark:bg-[#17262D] dark:text-white cursor-pointer"
                    >
                      📍 Peta
                    </button>
                    {isPending && (
                      <button
                        onClick={() => onResolveReport(r.reportId, r.binId)}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer"
                      >
                        ✓ Selesai
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reports.length === 0 && (
        <div className="py-8 text-center text-[#7D8B81] space-y-1">
          <CheckCheck className="mx-auto h-8 w-8 text-[#A9C1C4]" />
          <p className="text-xs font-semibold text-[#46554B]">
            Tidak ada laporan aduan aktif saat ini. Seluruh titik tong terpantau normal.
          </p>
          <p className="text-[11px]">
            Kirim laporan aduan warga via <em>Portal Warga</em> atau klik tombol{' '}
            <strong>+ Simulasi Laporan Masuk</strong> di atas.
          </p>
        </div>
      )}
    </div>
  );
};
