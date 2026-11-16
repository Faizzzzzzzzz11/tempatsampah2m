import { Bin, Depot, SystemConfig } from '../types';

export const DEFAULT_CONFIG: SystemConfig = {
  C: 1000,
  binCap: 100,
  redLimit: 80,
  yellowLimit: 50,
  maxYellowDetour: 4,
  maxYellowDetourKm: 1.8,
  targetInitialPercent: 90,
  kmPerGridUnit: 0.45,
  truckSpeedKmh: 30,
  fuelPerKm: 0.22,
};

export const DEFAULT_DEPOT: Depot = {
  id: 'P',
  name: 'Pangkalan Truk (Kantor Kapanewon Godean)',
  location: 'Kantor Kapanewon Godean, Jl. Godean KM 9.5, Sleman',
  lat: -7.7682,
  lng: 110.2938,
};

export const DEFAULT_BINS_24: Bin[] = [
  { id: 1, name: 'Tong 1', location: '', lat: -7.7680, lng: 110.2923, fill: 85, status: 'red' },
  { id: 2, name: 'Tong 2', location: '', lat: -7.7694, lng: 110.2918, fill: 65, status: 'yellow' },
  { id: 3, name: 'Tong 3', location: '', lat: -7.7704, lng: 110.2930, fill: 40, status: 'green' },
  { id: 4, name: 'Tong 4', location: '', lat: -7.7648, lng: 110.2962, fill: 90, status: 'red' },
  { id: 5, name: 'Tong 5', location: '', lat: -7.7668, lng: 110.2944, fill: 35, status: 'green' },
  { id: 6, name: 'Tong 6', location: '', lat: -7.7682, lng: 110.2954, fill: 75, status: 'yellow' },
  { id: 7, name: 'Tong 7', location: '', lat: -7.7654, lng: 110.2974, fill: 60, status: 'yellow' },
  { id: 8, name: 'Tong 8', location: '', lat: -7.7642, lng: 110.2984, fill: 82, status: 'red' },
  { id: 9, name: 'Tong 9', location: '', lat: -7.7654, lng: 110.2948, fill: 30, status: 'green' },
  { id: 10, name: 'Tong 10', location: '', lat: -7.7640, lng: 110.2942, fill: 88, status: 'red' },
  { id: 11, name: 'Tong 11', location: '', lat: -7.7704, lng: 110.2966, fill: 45, status: 'green' },
  { id: 12, name: 'Tong 12', location: '', lat: -7.7694, lng: 110.2956, fill: 70, status: 'yellow' },
  { id: 13, name: 'Tong 13', location: '', lat: -7.7720, lng: 110.2974, fill: 85, status: 'red' },
  { id: 14, name: 'Tong 14', location: '', lat: -7.7690, lng: 110.2982, fill: 65, status: 'yellow' },
  { id: 15, name: 'Tong 15', location: '', lat: -7.7674, lng: 110.2986, fill: 88, status: 'red' },
  { id: 16, name: 'Tong 16', location: '', lat: -7.7668, lng: 110.2968, fill: 40, status: 'green' },
  { id: 17, name: 'Tong 17', location: '', lat: -7.7712, lng: 110.2940, fill: 78, status: 'yellow' },
  { id: 18, name: 'Tong 18', location: '', lat: -7.7696, lng: 110.2944, fill: 55, status: 'yellow' },
  { id: 19, name: 'Tong 19', location: '', lat: -7.7664, lng: 110.2902, fill: 85, status: 'red' },
  { id: 20, name: 'Tong 20', location: '', lat: -7.7650, lng: 110.2914, fill: 35, status: 'green' },
  { id: 21, name: 'Tong 21', location: '', lat: -7.7656, lng: 110.2930, fill: 85, status: 'red' },
  { id: 22, name: 'Tong 22', location: '', lat: -7.7666, lng: 110.2920, fill: 68, status: 'yellow' },
  { id: 23, name: 'Tong 23', location: '', lat: -7.7698, lng: 110.2904, fill: 25, status: 'green' },
  { id: 24, name: 'Tong 24', location: '', lat: -7.7718, lng: 110.2892, fill: 85, status: 'red' },
];

export const GODEAN_DEPOT_PRESETS: Record<string, { name: string; location: string; lat: number; lng: number }> = {
  kapanewon: { name: 'Pangkalan Truk (Kantor Kapanewon)', location: 'Kantor Kapanewon Godean, Jl. Godean KM 9.5', lat: -7.7682, lng: 110.2938 },
  pasar: { name: 'Pangkalan Truk (Pasar Godean)', location: 'Sentra Niaga Pasar Godean', lat: -7.7675, lng: 110.2925 },
  sidomoyo: { name: 'Pangkalan Truk (Sidomoyo)', location: 'Balai Kalurahan Sidomoyo (Godean Utara)', lat: -7.7565, lng: 110.3120 },
  sidoarum: { name: 'Pangkalan Truk (Sidoarum)', location: 'Balai Kalurahan Sidoarum (Godean Selatan)', lat: -7.7795, lng: 110.3200 },
  sidokarto: { name: 'Pangkalan Truk (Sidokarto)', location: 'Balai Kalurahan Sidokarto (Godean Tengah)', lat: -7.7720, lng: 110.3010 },
  sidorejo: { name: 'Pangkalan Truk (Sidorejo)', location: 'Balai Kalurahan Sidorejo (Godean Barat)', lat: -7.7810, lng: 110.2780 },
  demakijo: { name: 'Pangkalan Truk (Demak Ijo)', location: 'Simpang Demak Ijo / Ring Road Barat', lat: -7.7735, lng: 110.3280 },
};

/**
 * GODEAN ROAD NETWORK GRAPH
 * Key intersections and corridors of Kapanewon Godean.
 * If external OSRM times out or is rate-limited, this graph ensures
 * the generated fallback route follows REAL STREETS and turns at real corners,
 * NEVER a straight diagonal line!
 */
export interface RoadNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  neighbors: string[];
}

export const GODEAN_ROAD_NODES: Record<string, RoadNode> = {
  // Arteri Utama: Jalan Godean (Barat ke Timur)
  R_GOD_1: { id: 'R_GOD_1', name: 'Jl. Godean KM 13 (Sidorejo Barat)', lat: -7.7722, lng: 110.2750, neighbors: ['R_GOD_2', 'R_SID_S'] },
  R_GOD_2: { id: 'R_GOD_2', name: 'Jl. Godean KM 12 (Sidorejo)', lat: -7.7710, lng: 110.2820, neighbors: ['R_GOD_1', 'R_GOD_3', 'R_SID_N'] },
  R_GOD_3: { id: 'R_GOD_3', name: 'Jl. Godean KM 11 (Pasar Godean Barat)', lat: -7.7680, lng: 110.2890, neighbors: ['R_GOD_2', 'R_GOD_4', 'R_KALI'] },
  R_GOD_4: { id: 'R_GOD_4', name: 'Simpang Pasar Godean (Sentra)', lat: -7.7675, lng: 110.2925, neighbors: ['R_GOD_3', 'R_GOD_5', 'R_SMP1', 'R_KAP'] },
  R_GOD_5: { id: 'R_GOD_5', name: 'Jl. Godean KM 9.5 (Kapanewon & Sentra Belut)', lat: -7.7682, lng: 110.2980, neighbors: ['R_GOD_4', 'R_GOD_6', 'R_KAP'] },
  R_GOD_6: { id: 'R_GOD_6', name: 'Jl. Godean KM 9 (SPBU Sidokarto)', lat: -7.7690, lng: 110.3080, neighbors: ['R_GOD_5', 'R_GOD_7', 'R_SIDOK_S', 'R_SIDOK_N'] },
  R_GOD_7: { id: 'R_GOD_7', name: 'Simpang Pertigaan Bantulan KM 8', lat: -7.7688, lng: 110.3180, neighbors: ['R_GOD_6', 'R_GOD_8', 'R_BANTUL_S', 'R_SIDOM_S'] },
  R_GOD_8: { id: 'R_GOD_8', name: 'Jl. Godean KM 6.5 (Menuju Demak Ijo)', lat: -7.7715, lng: 110.3240, neighbors: ['R_GOD_7', 'R_GOD_9'] },
  R_GOD_9: { id: 'R_GOD_9', name: 'Simpang Demak Ijo / Ring Road Barat', lat: -7.7735, lng: 110.3280, neighbors: ['R_GOD_8', 'R_RR_N', 'R_RR_S'] },

  // Koridor Utara: Jl. Kebon Agung & Jl. Sidomoyo
  R_KEBON_W: { id: 'R_KEBON_W', name: 'Jl. Kebon Agung Barat', lat: -7.7540, lng: 110.2960, neighbors: ['R_KEBON_M', 'R_KALI'] },
  R_KEBON_M: { id: 'R_KEBON_M', name: 'Simpang Sidomoyo Tengah', lat: -7.7550, lng: 110.3080, neighbors: ['R_KEBON_W', 'R_KEBON_E', 'R_SIDOK_N'] },
  R_KEBON_E: { id: 'R_KEBON_E', name: 'Jl. Kebon Agung Timur (Seyegan)', lat: -7.7500, lng: 110.3160, neighbors: ['R_KEBON_M', 'R_SIDOM_N'] },
  R_SIDOM_N: { id: 'R_SIDOM_N', name: 'Balai Kalurahan Sidomoyo', lat: -7.7550, lng: 110.3120, neighbors: ['R_KEBON_E', 'R_SIDOM_S'] },
  R_SIDOM_S: { id: 'R_SIDOM_S', name: 'Jl. Sidomoyo Selatan', lat: -7.7620, lng: 110.3150, neighbors: ['R_SIDOM_N', 'R_GOD_7'] },

  // Koridor Tengah & Penghubung
  R_KAP: { id: 'R_KAP', name: 'Pintu Gerbang Kapanewon Godean', lat: -7.7682, lng: 110.2938, neighbors: ['R_GOD_4', 'R_GOD_5'] },
  R_SMP1: { id: 'R_SMP1', name: 'Jl. Senuko / SMPN 1 Godean', lat: -7.7695, lng: 110.2915, neighbors: ['R_GOD_4', 'R_SIDOAGUNG_S'] },
  R_KALI: { id: 'R_KALI', name: 'Jl. Kali Godean / Kuliner', lat: -7.7630, lng: 110.2910, neighbors: ['R_GOD_3', 'R_KEBON_W'] },
  R_SIDOK_N: { id: 'R_SIDOK_N', name: 'Balai Sidokarto Utara', lat: -7.7640, lng: 110.3040, neighbors: ['R_KEBON_M', 'R_GOD_6'] },
  R_SIDOK_S: { id: 'R_SIDOK_S', name: 'Perumahan Godean Permai', lat: -7.7705, lng: 110.3020, neighbors: ['R_GOD_6', 'R_BANTUL_S'] },

  // Koridor Barat: Kalurahan Sidorejo
  R_SID_N: { id: 'R_SID_N', name: 'SMPN 2 & Puskesmas Sidorejo', lat: -7.7590, lng: 110.2840, neighbors: ['R_GOD_2', 'R_SID_W'] },
  R_SID_W: { id: 'R_SID_W', name: 'Balai Kalurahan Sidorejo', lat: -7.7610, lng: 110.2780, neighbors: ['R_SID_N', 'R_GOD_1'] },
  R_SID_S: { id: 'R_SID_S', name: 'Batas Barat Moyudan', lat: -7.7810, lng: 110.2700, neighbors: ['R_GOD_1'] },

  // Koridor Selatan: Sidoarum & Bantulan
  R_BANTUL_S: { id: 'R_BANTUL_S', name: 'Jl. Bantulan Sidoarum', lat: -7.7740, lng: 110.3150, neighbors: ['R_GOD_7', 'R_SIDOK_S', 'R_SIDOARUM_CTR'] },
  R_SIDOARUM_CTR: { id: 'R_SIDOARUM_CTR', name: 'Balai Kalurahan Sidoarum', lat: -7.7780, lng: 110.3180, neighbors: ['R_BANTUL_S', 'R_SIDOARUM_E', 'R_SIDOAGUNG_S'] },
  R_SIDOARUM_E: { id: 'R_SIDOARUM_E', name: 'Desa Wisata Jamur / Sidoarum Timur', lat: -7.7810, lng: 110.3200, neighbors: ['R_SIDOARUM_CTR', 'R_RR_S'] },
  R_SIDOAGUNG_S: { id: 'R_SIDOAGUNG_S', name: 'Jalur Kolektor Sidoagung Selatan', lat: -7.7750, lng: 110.2950, neighbors: ['R_SMP1', 'R_SIDOARUM_CTR'] },

  // Ring Road Barat
  R_RR_N: { id: 'R_RR_N', name: 'Ring Road Barat Utara', lat: -7.7650, lng: 110.3300, neighbors: ['R_GOD_9'] },
  R_RR_S: { id: 'R_RR_S', name: 'Ring Road Barat Selatan', lat: -7.7820, lng: 110.3260, neighbors: ['R_GOD_9', 'R_SIDOARUM_E'] },
};
