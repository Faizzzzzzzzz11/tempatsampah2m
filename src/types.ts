/**
 * TrashRoute — STEM DIY 2026
 * TypeScript Interfaces & Types
 */

export type BinStatus = 'red' | 'yellow' | 'green' | 'gray';

export interface Bin {
  id: number;
  name: string;
  location?: string;
  x?: number; // legacy grid index (optional/derived)
  y?: number; // legacy grid index (optional/derived)
  lat: number;
  lng: number;
  fill: number; // 0 - 100%
  noData?: boolean;
  status?: BinStatus;
  detour?: number;
  isAccepted?: boolean;
  pickedGreen?: boolean;
  evalReason?: string;
  rejectType?: 'detour' | 'capacity' | 'detour_cumulative' | '';
  hasActiveReport?: boolean;
  reportType?: string;
  reportTime?: string;
}

export interface Depot {
  id: string;
  name: string;
  location?: string;
  x?: number; // legacy grid index (optional/derived)
  y?: number; // legacy grid index (optional/derived)
  lat: number;
  lng: number;
  tpsCapacity?: number;      // Kapasitas maksimal penampungan TPS (Liter), default 6000
  tpsBaselineWaste?: number; // Volume awal sampah sebelum pengangkutan hari ini (Liter), default 0
}

export interface SystemConfig {
  C: number;                   // Truck capacity (Liter), default 1000
  binCap: number;              // Capacity per bin (Liter), default 100
  redLimit: number;            // >= 80% (Red)
  yellowLimit: number;         // >= 50% (Yellow)
  maxYellowDetour: number;     // max detour in grid units (e.g. 4)
  maxYellowDetourKm?: number;  // max detour in km
  targetInitialPercent: number;// target fill for initial trips (e.g. 90%)
  kmPerGridUnit: number;       // km per grid unit (e.g. 0.45 km)
  truckSpeedKmh: number;       // speed km/h (e.g. 30 km/h)
  fuelPerKm: number;           // diesel fuel consumption (e.g. 0.22 L/km)
  tpsCapacity?: number;        // Kapasitas penampungan TPS (Liter)
}

export interface YellowEvaluation {
  bin: Bin;
  extraDistance: number;
  distToPath: number;
  isAccepted: boolean;
  rejectType?: 'detour' | 'capacity' | 'detour_cumulative' | '';
  reason: string;
}

export interface Trip {
  tripIndex: number | string;
  isFixed?: boolean;
  bins: Bin[];
  loadLiter: number;
  tour: (Bin | Depot)[];
  distance: number; // in grid units / km
  roadCoords?: [number, number][]; // [lat, lng] array along actual roads
  realRoadKm?: string;
  subTrips?: {
    subIndex?: number;
    bins: Bin[];
    loadLiter: number;
    distance: number;
    tour?: (Bin | Depot)[];
    roadCoords?: [number, number][];
    realRoadKm?: string;
  }[];
  subTripCount?: number;
}

export interface ExecutionResult {
  redBins: Bin[];
  yellowBins: Bin[];
  greenBins: Bin[];
  pickedGreenBins: Bin[];
  acceptedYellowBins: Bin[];
  rejectedYellowBins: Bin[];
  yellowEvaluations: YellowEvaluation[];
  selectedBins: Bin[];
  totalLiter: number;
  tripCount: number;
  trips: Trip[];
  totalDistance: number;
  totalRealRoadKm?: string;
  baseRedDist: number;
  statusMessage: string;
  distanceSource?: 'osrm' | 'fallback';
}

export interface CitizenReport {
  reportId: string;
  binId: number;
  binName: string;
  type: string;
  time: string;
  notes: string;
  status: 'pending' | 'resolved';
  timestamp: number;
}

export interface AnimWaypoint {
  lat: number;
  lng: number;
  tripIndex: number | string;
  targetBin: Bin | Depot;
  isStop: boolean;
  stopBin: Bin | Depot | null;
  bearing?: number;
}
