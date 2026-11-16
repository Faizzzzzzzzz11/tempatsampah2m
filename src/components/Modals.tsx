import React, { useState, useEffect } from 'react';
import { Sliders, X, Building2, MapPin, Crosshair } from 'lucide-react';
import { Bin, Depot, SystemConfig } from '../types';
import { GODEAN_DEPOT_PRESETS } from '../data/godeanData';
import { litersOf } from '../services/routingEngine';

// ==========================================
// 1. EDIT BIN MODAL
// ==========================================
interface EditBinModalProps {
  bin: Bin | null;
  config: SystemConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (binId: number, fill: number, noData: boolean, name?: string, location?: string) => void;
  onDelete: (binId: number) => void;
}

export const EditBinModal: React.FC<EditBinModalProps> = ({
  bin,
  config,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !bin) return null;

  const [name, setName] = useState(bin.name);
  const [fill, setFill] = useState(bin.fill);
  const [liter, setLiter] = useState(Math.round((bin.fill * config.binCap) / 100));
  const [notes, setNotes] = useState(bin.location || '');
  const [noData, setNoData] = useState(!!bin.noData);
  const [pingStatus, setPingStatus] = useState('');

  useEffect(() => {
    setName(bin.name);
    setFill(bin.fill);
    setLiter(Math.round((bin.fill * config.binCap) / 100));
    setNotes(bin.location || '');
    setNoData(!!bin.noData);
    setPingStatus('');
  }, [bin, config.binCap]);

  const handleFillChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setFill(clamped);
    setLiter(Math.round((clamped * config.binCap) / 100));
  };

  const handleLiterChange = (val: number) => {
    const clampedLiter = Math.max(0, Math.min(config.binCap, val));
    setLiter(clampedLiter);
    setFill(Math.round((clampedLiter / config.binCap) * 100));
  };

  const handlePing = () => {
    setPingStatus('Mengirim sinyal radio ke modul ESP32...');
    setTimeout(() => {
      setPingStatus('✓ ESP32 membalas sinyal: Sensor HC-SR04 aktif normal.');
      setNoData(false);
    }, 600);
  };

  const handleSave = () => {
    onSave(bin.id, fill, noData, name.trim() || `Tong ${bin.id}`, notes.trim());
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-auto flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl border border-[#D9DFD7] bg-white shadow-2xl overflow-hidden dark:bg-[#121D22] dark:border-[#243741]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E9E2] px-5 py-3.5 dark:border-[#243741]">
          <h4 className="flex items-center gap-2 font-['Bricolage_Grotesque'] text-sm font-bold text-[#10303A] dark:text-[#F3F7F5]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-xs">
              {bin.id}
            </span>
            <span>Edit Data &amp; Keterisian Tong</span>
          </h4>
          <button onClick={onClose} className="rounded-lg p-1 text-[#7D8B81] hover:bg-slate-100 hover:text-[#10303A] dark:hover:bg-[#17262D] dark:hover:text-[#F3F7F5] cursor-pointer transition" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs overscroll-contain">
          {/* Edit Nama Tong */}
          <div>
            <label className="mb-1 block font-semibold text-[#10303A]">Nama Tong:</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Tong 1"
              className="w-full rounded-xl border border-[#C4CEC2] px-3 py-2 font-semibold text-[#10303A] focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Edit Jumlah Keterisian */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="font-semibold text-[#10303A]">Jumlah Keterisian:</label>
              <span className="font-bold text-blue-600">
                {fill}% ({liter} Liter / {config.binCap} L)
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={fill}
              onChange={e => handleFillChange(parseInt(e.target.value) || 0)}
              className="w-full accent-blue-600 cursor-pointer"
            />

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6A60] mb-0.5">Persen (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={fill}
                  onChange={e => handleFillChange(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-[#C4CEC2] px-2.5 py-1 text-center font-bold text-[#10303A] focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6A60] mb-0.5">Liter (L):</label>
                <input
                  type="number"
                  min="0"
                  max={config.binCap}
                  value={liter}
                  onChange={e => handleLiterChange(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-[#C4CEC2] px-2.5 py-1 text-center font-bold text-[#10303A] focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Preset Cepat Jumlah */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5 text-center font-semibold">
            <button
              type="button"
              onClick={() => handleFillChange(0)}
              className="rounded-lg bg-slate-100 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
            >
              0% (Kosong)
            </button>
            <button
              type="button"
              onClick={() => handleFillChange(25)}
              className="rounded-lg bg-emerald-100 py-1 text-[11px] text-emerald-700 hover:bg-emerald-200"
            >
              25% (Aman)
            </button>
            <button
              type="button"
              onClick={() => handleFillChange(65)}
              className="rounded-lg bg-amber-100 py-1 text-[11px] text-amber-700 hover:bg-amber-200"
            >
              65% (Siaga)
            </button>
            <button
              type="button"
              onClick={() => handleFillChange(90)}
              className="rounded-lg bg-red-100 py-1 text-[11px] text-red-700 hover:bg-red-200"
            >
              90% (Penuh)
            </button>
          </div>

          {/* Edit Keterangan / Catatan */}
          <div>
            <label className="mb-1 block font-semibold text-[#10303A]">Keterangan Tambahan (Opsional):</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Catatan kondisi lapangan atau identifikasi tong..."
              className="w-full rounded-xl border border-[#C4CEC2] px-3 py-2 text-[#10303A] focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Koordinat GPS & Link Google Maps */}
          <div className="flex items-center justify-between rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-2.5 text-[11px] text-[#5B6A60] dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1]">
            <div>
              <span className="font-semibold block text-[#10303A] dark:text-white">Koordinat GPS:</span>
              <span>{bin.lat.toFixed(5)}, {bin.lng.toFixed(5)}</span>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${bin.lat},${bin.lng}&travelmode=driving&dirflg=d`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition"
              title="Buka rute navigasi ke tong ini di Google Maps (Mode Mobil)"
            >
              <span>🚗 Google Maps (Mobil)</span>
            </a>
          </div>

          {/* Toggle Tanpa Data */}
          <div className="space-y-1.5 rounded-lg border border-[#D9DFD7] bg-[#F8FAF6] p-2.5">
            <label className="flex cursor-pointer items-center gap-2 font-medium text-[#10303A]">
              <input
                type="checkbox"
                checked={noData}
                onChange={e => setNoData(e.target.checked)}
                className="accent-slate-700"
              />
              <span>Tong offline / sensor tanpa data (abu-abu)</span>
            </label>
            <button
              type="button"
              onClick={handlePing}
              className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Tes Ping ke ESP32
            </button>
            {pingStatus && <div className="text-[11px] font-medium text-emerald-700">{pingStatus}</div>}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex shrink-0 items-center gap-2 border-t border-[#E5E9E2] px-5 py-3 bg-slate-50 dark:bg-[#17262D] dark:border-[#243741]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#D9DFD7] py-2 text-xs font-medium text-[#5B6A60] hover:bg-white dark:border-[#243741] dark:text-[#A3B9B1] dark:hover:bg-[#121D22] cursor-pointer transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onDelete(bin.id)}
            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40 cursor-pointer transition"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 cursor-pointer transition"
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. ADD BIN MODAL
// ==========================================
interface AddBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBin: (name: string, location: string, lat: number, lng: number, fill: number) => void;
  nextId: number;
  initialLat?: number;
  initialLng?: number;
  onPickOnMap?: () => void;
}

export const AddBinModal: React.FC<AddBinModalProps> = ({
  isOpen,
  onClose,
  onAddBin,
  nextId,
  initialLat,
  initialLng,
  onPickOnMap,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(`Tong ${nextId}`);
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState(initialLat ?? -7.768);
  const [lng, setLng] = useState(initialLng ?? 110.295);
  const [fill, setFill] = useState(85);
  const [hasPickedFromMap, setHasPickedFromMap] = useState(initialLat !== undefined && initialLng !== undefined);

  useEffect(() => {
    if (isOpen) {
      setName(`Tong ${nextId}`);
      setLocation('');
      setFill(85);
      if (initialLat !== undefined && initialLng !== undefined) {
        setLat(initialLat);
        setLng(initialLng);
        setHasPickedFromMap(true);
      } else {
        setLat(-7.768);
        setLng(110.295);
        setHasPickedFromMap(false);
      }
    }
  }, [isOpen, nextId, initialLat, initialLng]);

  const handleSubmit = () => {
    onAddBin(name.trim() || `Tong ${nextId}`, location.trim(), lat, lng, fill);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-auto flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-[#D9DFD7] bg-white shadow-2xl overflow-hidden dark:bg-[#121D22] dark:border-[#243741]">
        {/* Header - Fixed */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E9E2] px-6 py-4 dark:border-[#243741]">
          <h4 className="flex items-center gap-2 font-['Bricolage_Grotesque'] text-base font-bold text-[#10303A] dark:text-[#F3F7F5]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-xs">
              ➕
            </span>
            <span>Tambah Titik Tong Sampah Baru</span>
          </h4>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#7D8B81] hover:bg-slate-100 hover:text-[#10303A] dark:hover:bg-[#17262D] dark:hover:text-[#F3F7F5] cursor-pointer transition"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 text-xs overscroll-contain">
          {hasPickedFromMap && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <span className="text-base">📍</span>
              <div>
                <p className="font-bold">Koordinat Terpilih dari Klik Peta:</p>
                <p className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                  Latitude: {lat.toFixed(5)} · Longitude: {lng.toFixed(5)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-[#10303A] dark:text-[#F3F7F5]">Nama Tong:</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Tong ${nextId}`}
              className="w-full rounded-xl border border-[#C4CEC2] px-3 py-2 font-mono text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Fitur Klik Lokasi pada Map */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 dark:border-emerald-700/60 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 text-xs">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Pilih Lokasi di Peta</span>
              </span>
              {hasPickedFromMap && (
                <span className="rounded-md bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 font-mono">
                  ✓ {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mb-2">
              Anda juga bisa langsung mengklik jalan atau lokasi mana saja pada peta untuk mengganti titik koordinat.
            </p>
            {onPickOnMap && (
              <button
                type="button"
                onClick={onPickOnMap}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 cursor-pointer"
              >
                <Crosshair className="h-4 w-4" />
                <span>📍 Pilih Titik Langsung dari Peta</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Latitude:</label>
              <input
                type="number"
                step="0.00001"
                value={lat}
                onChange={e => {
                  setLat(parseFloat(e.target.value) || 0);
                  setHasPickedFromMap(false);
                }}
                className="w-full rounded-lg border border-[#C4CEC2] px-3 py-1.5 font-mono text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Longitude:</label>
              <input
                type="number"
                step="0.00001"
                value={lng}
                onChange={e => {
                  setLng(parseFloat(e.target.value) || 0);
                  setHasPickedFromMap(false);
                }}
                className="w-full rounded-lg border border-[#C4CEC2] px-3 py-1.5 font-mono text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="font-semibold text-[#10303A] dark:text-[#F3F7F5]">Keterisian Awal (%):</label>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{fill}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={fill}
              onChange={e => setFill(parseInt(e.target.value) || 0)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="mt-1.5 flex gap-1.5 text-center font-semibold">
              <button
                type="button"
                onClick={() => setFill(25)}
                className="flex-1 rounded-md bg-emerald-100 py-1 text-[11px] text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 cursor-pointer"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => setFill(65)}
                className="flex-1 rounded-md bg-amber-100 py-1 text-[11px] text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 cursor-pointer"
              >
                65%
              </button>
              <button
                type="button"
                onClick={() => setFill(90)}
                className="flex-1 rounded-md bg-red-100 py-1 text-[11px] text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 cursor-pointer"
              >
                90%
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#10303A] dark:text-[#F3F7F5]">Keterangan / Catatan (Opsional):</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Contoh: Depan pertokoan / Pos keamanan"
              className="w-full rounded-xl border border-[#C4CEC2] px-3 py-2 text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-[#D9DFD7] bg-[#F8FAF6] p-2.5 text-[11px] text-[#5B6A60] dark:bg-[#17262D] dark:border-[#243741] dark:text-[#A3B9B1]">
            💡 <em>Tong baru akan otomatis terintegrasi ke jaringan jalan Kapanewon Godean dan dievaluasi dalam optimasi multi-trip TSP.</em>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex shrink-0 items-center gap-2 border-t border-[#E5E9E2] px-6 py-3.5 bg-slate-50 dark:bg-[#17262D] dark:border-[#243741]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#D9DFD7] py-2.5 text-xs font-semibold text-[#5B6A60] hover:bg-white dark:border-[#243741] dark:text-[#A3B9B1] dark:hover:bg-[#121D22] cursor-pointer transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer transition"
          >
            Simpan &amp; Tambah Tong
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. DEPOT MODAL
// ==========================================
interface DepotModalProps {
  depot: Depot;
  isOpen: boolean;
  onClose: () => void;
  onSaveDepot: (name: string, location: string, lat: number, lng: number) => void;
}

export const DepotModal: React.FC<DepotModalProps> = ({ depot, isOpen, onClose, onSaveDepot }) => {
  if (!isOpen) return null;

  const [name, setName] = useState(depot.name);
  const [location, setLocation] = useState(depot.location || 'Kantor Kapanewon Godean');
  const [lat, setLat] = useState(depot.lat);
  const [lng, setLng] = useState(depot.lng);

  const handleSelectPreset = (key: string) => {
    if (!key || !GODEAN_DEPOT_PRESETS[key]) return;
    const p = GODEAN_DEPOT_PRESETS[key];
    setName(p.name);
    setLocation(p.location);
    setLat(p.lat);
    setLng(p.lng);
  };

  const handleSave = () => {
    onSaveDepot(name, location, lat, lng);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-auto flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-[#D9DFD7] bg-white shadow-2xl overflow-hidden dark:bg-[#121D22] dark:border-[#243741]">
        {/* Header - Fixed */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E9E2] px-6 py-4 dark:border-[#243741]">
          <h4 className="flex items-center gap-2 font-['Bricolage_Grotesque'] text-base font-bold text-[#10303A] dark:text-[#F3F7F5]">
            <Building2 className="h-5 w-5 text-blue-600" />
            <span>Atur / Pindah Pangkalan Truk (Depot P)</span>
          </h4>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#7D8B81] hover:bg-slate-100 hover:text-[#10303A] dark:hover:bg-[#17262D] dark:hover:text-[#F3F7F5] cursor-pointer transition" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 text-xs overscroll-contain">
          <div>
            <label className="mb-1 block font-semibold text-[#10303A] dark:text-[#F3F7F5]">Nama Pangkalan:</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-[#C4CEC2] px-3 py-2 font-mono text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#10303A] dark:text-[#F3F7F5]">Alamat / Lokasi Strategis:</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full rounded-xl border border-[#C4CEC2] px-3 py-2 text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#10303A] dark:text-[#F3F7F5]">Pilih Cepat Lokasi di Godean:</label>
            <select
              onChange={e => handleSelectPreset(e.target.value)}
              className="w-full rounded-xl border border-[#C4CEC2] bg-white px-3 py-2 text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-blue-600 focus:outline-none"
            >
              <option value="">-- Pilih Lokasi Strategis --</option>
              <option value="kapanewon">1. Kantor Kapanewon Godean (Pusat, Jl. Godean KM 9.5)</option>
              <option value="pasar">2. Pasar Godean (Sentra Niaga &amp; Kuliner)</option>
              <option value="sidomoyo">3. Balai Kalurahan Sidomoyo (Godean Utara)</option>
              <option value="sidoarum">4. Balai Kalurahan Sidoarum (Godean Selatan)</option>
              <option value="sidokarto">5. Balai Kalurahan Sidokarto (Godean Tengah)</option>
              <option value="sidorejo">6. Balai Kalurahan Sidorejo (Godean Barat)</option>
              <option value="demakijo">7. Simpang Demak Ijo / Ring Road Barat (Gerbang Timur)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Latitude:</label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={e => setLat(parseFloat(e.target.value))}
                className="w-full rounded-lg border border-[#C4CEC2] px-3 py-1.5 font-mono text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#5B6A60] dark:text-[#A3B9B1]">Longitude:</label>
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={e => setLng(parseFloat(e.target.value))}
                className="w-full rounded-lg border border-[#C4CEC2] px-3 py-1.5 font-mono text-[#10303A] dark:text-white dark:bg-[#17262D] dark:border-[#243741] focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-2.5 text-[11px] text-teal-800 dark:bg-teal-950/30 dark:border-teal-900/60 dark:text-teal-300">
            🏢 <em>Pangkalan armada ini berfungsi ganda sebagai TPS 3R (Tempat Pengolahan Sampah Sementara) Kapanewon Godean yang menampung muatan sampah hasil pengangkutan tiap trip.</em>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex shrink-0 items-center gap-2 border-t border-[#E5E9E2] px-6 py-3.5 bg-slate-50 dark:bg-[#17262D] dark:border-[#243741]">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#D9DFD7] py-2.5 text-xs font-semibold text-[#5B6A60] hover:bg-white dark:border-[#243741] dark:text-[#A3B9B1] dark:hover:bg-[#121D22] cursor-pointer transition"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 cursor-pointer transition"
          >
            Terapkan &amp; Hitung Rute Baru
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. CONFIG PARAMETERS MODAL
// ==========================================
interface ConfigModalProps {
  config: SystemConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (newConfig: Partial<SystemConfig>) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  config,
  isOpen,
  onClose,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  const [truckCap, setTruckCap] = useState(config.C);
  const [binCap, setBinCap] = useState(config.binCap);
  const [redLimit, setRedLimit] = useState(config.redLimit);
  const [yellowLimit, setYellowLimit] = useState(config.yellowLimit);
  const [maxDetour, setMaxDetour] = useState(config.maxYellowDetour);
  const [targetPercent, setTargetPercent] = useState(config.targetInitialPercent);

  const handleSave = () => {
    onSaveConfig({
      C: truckCap,
      binCap,
      redLimit,
      yellowLimit,
      maxYellowDetour: maxDetour,
      maxYellowDetourKm: maxDetour * (config.kmPerGridUnit || 0.45),
      targetInitialPercent: targetPercent,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-auto flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-[#D9DFD7] bg-white shadow-2xl overflow-hidden dark:bg-[#121D22] dark:border-[#243741]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E9E2] px-5 py-3.5 dark:border-[#243741]">
          <h4 className="flex items-center gap-2 font-['Bricolage_Grotesque'] text-sm font-bold text-[#10303A] dark:text-[#F3F7F5]">
            <Sliders className="h-4 w-4 text-blue-600" />
            <span>Parameter Algoritma Flowchart</span>
          </h4>
          <button onClick={onClose} className="rounded-lg p-1 text-[#7D8B81] hover:bg-slate-100 hover:text-[#10303A] dark:hover:bg-[#17262D] dark:hover:text-[#F3F7F5] cursor-pointer transition" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs overscroll-contain">
          <div>
            <label className="mb-1 block font-semibold text-[#10303A]">Daya Tampung Truk (C):</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="50"
                min="500"
                max="3000"
                value={truckCap}
                onChange={e => setTruckCap(parseInt(e.target.value) || 1000)}
                className="flex-1 rounded-lg border border-[#C4CEC2] bg-[#F8FAF6] px-3 py-1.5 font-mono text-[#10303A]"
              />
              <span className="font-mono text-[#5B6A60]">Liter</span>
            </div>
            <span className="text-[10px] text-[#7D8B81]">Standar diagram: 1.000 liter</span>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#10303A]">Kapasitas Tiap Tong:</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="10"
                min="10"
                max="1000"
                value={binCap}
                onChange={e => setBinCap(parseInt(e.target.value) || 100)}
                className="flex-1 rounded-lg border border-[#C4CEC2] bg-[#F8FAF6] px-3 py-1.5 font-mono text-[#10303A]"
              />
              <span className="font-mono text-[#5B6A60]">Liter</span>
            </div>
            <span className="text-[10px] text-[#7D8B81]">Default 100 L (1% keterisian = 1 L).</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-[#10303A]">Batas Merah (&ge;):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="99"
                  value={redLimit}
                  onChange={e => setRedLimit(parseInt(e.target.value) || 80)}
                  className="w-full rounded-lg border border-[#C4CEC2] bg-[#F8FAF6] px-3 py-1.5 font-mono text-[#10303A]"
                />
                <span className="font-mono text-[#5B6A60]">%</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#10303A]">Batas Kuning (&ge;):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="80"
                  value={yellowLimit}
                  onChange={e => setYellowLimit(parseInt(e.target.value) || 50)}
                  className="w-full rounded-lg border border-[#C4CEC2] bg-[#F8FAF6] px-3 py-1.5 font-mono text-[#10303A]"
                />
                <span className="font-mono text-[#5B6A60]">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#10303A]">Batas Tambahan Jalan (Detour):</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10"
                value={maxDetour}
                onChange={e => setMaxDetour(parseInt(e.target.value) || 4)}
                className="flex-1 rounded-lg border border-[#C4CEC2] bg-[#F8FAF6] px-3 py-1.5 font-mono text-[#10303A]"
              />
              <span className="font-mono text-[#5B6A60]">≈ {(maxDetour * 0.45).toFixed(1)} km</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#10303A]">Target Isi Trip Awal (Minimal):</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="70"
                max="100"
                value={targetPercent}
                onChange={e => setTargetPercent(parseFloat(e.target.value) || 90)}
                className="flex-1 rounded-lg border border-[#C4CEC2] bg-[#F8FAF6] px-3 py-1.5 font-mono text-[#10303A]"
              />
              <span className="font-mono text-[#5B6A60]">% dari C</span>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex shrink-0 items-center gap-2 border-t border-[#E5E9E2] px-5 py-3 bg-slate-50 dark:bg-[#17262D] dark:border-[#243741]">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#D9DFD7] py-2 text-xs font-semibold text-[#5B6A60] hover:bg-white dark:border-[#243741] dark:text-[#A3B9B1] dark:hover:bg-[#121D22] cursor-pointer transition"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 cursor-pointer transition"
          >
            Terapkan Parameter
          </button>
        </div>
      </div>
    </div>
  );
};
