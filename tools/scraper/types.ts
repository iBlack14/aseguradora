export type VehicleType = 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';
export type VehicleUse  = 'PARTICULAR' | 'TAXI' | 'COMERCIAL';

export interface ScrapeInput {
  plate:       string;      // Placa del vehículo (ej. ABC-123)
  vehicleType: VehicleType;
  department:  string;      // Ej. "Lima"
  use:         VehicleUse;
  documentType:   string;   // DNI, RUC, etc.
  documentNumber: string;
  /** Fecha inicio vigencia en formato YYYY-MM-DD */
  startsAt: string;
}

export interface ScrapedOffer {
  insurerSlug: string;
  insurerName: string;
  price:       number;    // PEN (soles)
  currency:    string;
  planName:    string;
  extras:      string[];
  scrapedAt:   string;    // ISO timestamp
  source:      string;    // URL de origen
  confidence:  'HIGH' | 'MEDIUM' | 'LOW'; // qué tan confiable es el precio
}

export interface ScrapeResult {
  ok:      boolean;
  offers:  ScrapedOffer[];
  errors:  string[];
  input:   ScrapeInput;
  durationMs: number;
}

export interface TariffCacheEntry {
  vehicleType: VehicleType;
  vehicleUse:  VehicleUse;
  department:  string;
  insurerSlug: string;
  price:       number;
  scrapedAt:   string;
  expiresAt:   string;
}
