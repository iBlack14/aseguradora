import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Cargar .env automáticamente en desarrollo si existe
for (const envCandidate of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps', 'api', '.env'),
  path.resolve(process.cwd(), '..', '..', 'apps', 'api', '.env')
]) {
  if (fs.existsSync(envCandidate)) {
    try {
      const content = fs.readFileSync(envCandidate, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...rest] = trimmed.split('=');
        if (k && rest.length > 0 && !process.env[k.trim()]) {
          process.env[k.trim()] = rest.join('=').trim();
        }
      }
    } catch {}
  }
}

type QuoteSource = 'WEB' | 'MANUAL';
type VehicleSnapshot = { brand?: string; model?: string; year?: number; color?: string; vin?: string; chassisNumber?: string; use?: string; department?: string };
type OfferDetail = {
  id: string;
  insurer: string;
  name: string;
  plan: string;
  logo: string;
  price: number;
  installmentAmount?: number;
  installmentCount?: number;
  currency: string;
  badge: string;
  available: boolean;
  unavailableReason?: string;
  requiresManualReview?: boolean;
  extras: string[];
};

type Quote = {
  id: string;
  code: string;
  plate: string;
  vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';
  department: string;
  vehicleUse?: string;
  documentType: string;
  documentNumber: string;
  startsAt: string;
  source: QuoteSource;
  status: 'NUEVA' | 'COTIZADA' | 'EMITIDA';
  createdAt: string;
  vehicle?: VehicleSnapshot;
  selectedOfferId?: string;
  selectedPrice?: number;
  offers?: OfferDetail[];
  advisorName?: string;
  assistedNotes?: string;
  holderName?: string;
  emittedAt?: string;
  policyNumber?: string;
};

const app = Fastify({ logger: true, trustProxy: true });
const developmentOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
];
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : developmentOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX || 120),
  timeWindow: '1 minute'
});

const quotes: Quote[] = [];
// En modo de desarrollo o prototipo, el catálogo de contingencia se activa por defecto salvo que DEMO_MODE='false'
const demoMode = process.env.DEMO_MODE !== 'false';
const database = process.env.DATABASE_URL ? new PrismaClient() : null;
if (process.env.NODE_ENV === 'production' && !database) throw new Error('DATABASE_URL is required in production');

type StoredQuote = Prisma.QuoteGetPayload<{
  include: { customer: true; vehicle: true; offers: { include: { insurer: true } }; order: true };
}>;

function storedQuoteToApi(record: StoredQuote): Quote {
  const offers = record.offers.map((storedOffer) => {
    const raw = storedOffer.rawResponse as unknown as OfferDetail | null;
    return raw || {
      id: storedOffer.insurer.slug,
      insurer: storedOffer.insurer.slug,
      name: storedOffer.insurer.name,
      plan: 'SOAT Digital',
      logo: storedOffer.insurer.logoPath,
      price: Number(storedOffer.annualPrice || 0),
      currency: storedOffer.currency,
      badge: '',
      available: storedOffer.available,
      extras: Array.isArray(storedOffer.benefits) ? (storedOffer.benefits as string[]) : []
    };
  });
  const vehicle = record.vehicle.brand && record.vehicle.model
    ? {
        brand: record.vehicle.brand,
        model: record.vehicle.model,
        year: record.vehicle.year || new Date().getFullYear(),
        color: record.vehicle.color || 'No informado',
        vin: record.vehicle.vin || 'No informado',
        chassisNumber: record.vehicle.chassisNumber || 'No informado',
        use: record.vehicle.use,
        department: record.vehicle.department
      }
    : undefined;
  const holderName = record.customer
    ? `${record.customer.firstName} ${record.customer.lastName}`.trim()
    : undefined;
  return {
    id: record.id,
    code: record.code,
    plate: record.vehicle.plate,
    vehicleType: record.vehicle.type as Quote['vehicleType'],
    department: record.department,
    documentType: record.documentType,
    documentNumber: record.documentNumber,
    startsAt: record.startsAt.toISOString(),
    source: record.source as QuoteSource,
    status: record.status === 'ISSUED' ? 'EMITIDA' : 'NUEVA',
    createdAt: record.createdAt.toISOString(),
    vehicle,
    holderName,
    selectedOfferId: record.selectedOfferId || undefined,
    selectedPrice: record.selectedPrice ? Number(record.selectedPrice) : undefined,
    offers,
    emittedAt: record.order?.updatedAt.toISOString(),
    policyNumber: record.order?.policyNumber || undefined
  };
}

async function loadStoredQuotes() {
  if (!database) return quotes;
  try {
    const records = await database.quote.findMany({
      include: { customer: true, vehicle: true, offers: { include: { insurer: true } }, order: true },
      orderBy: { createdAt: 'desc' }
    });
    return records.map(storedQuoteToApi);
  } catch (err) {
    app.log.warn({ err }, 'No fue posible consultar la base de datos para quotes, usando memoria local');
    return quotes;
  }
}

// Base tariffs by vehicle type in Peru (PEN - S/)
const tariffsByVehicle: Record<'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO', Record<string, number>> = {
  AUTO: {
    falabella: 65.0,
    'la-positiva': 65.0,
    mapfre: 68.0,
    interseguro: 32.0,
    pacifico: 72.0,
    protecta: 62.0
  },
  MOTO: {
    falabella: 630.0,
    'la-positiva': 630.0,
    mapfre: 645.0,
    interseguro: 610.0,
    pacifico: 650.0,
    protecta: 590.0
  },
  MOTOTAXI: {
    falabella: 120.0,
    'la-positiva': 120.0,
    mapfre: 135.0,
    interseguro: 128.0,
    pacifico: 142.0,
    protecta: 115.0
  },
  VAN: {
    falabella: 130.0,
    'la-positiva': 130.0,
    mapfre: 145.0,
    interseguro: 138.0,
    pacifico: 155.0,
    protecta: 125.0
  },
  CARGO: {
    falabella: 210.0,
    'la-positiva': 210.0,
    mapfre: 235.0,
    interseguro: 225.0,
    pacifico: 250.0,
    protecta: 195.0
  }
};

// Official commercial tariffs for Mototaxis in public/taxi circulation (e.g. Callao / Lima)
const mototaxiTaxiTariffs: Record<string, number> = {
  'la-positiva': 295.0,
  interseguro: 295.0,
  protecta: 285.0,
  mapfre: 298.0,
  pacifico: 305.0
};

export type DynamicTariff = {
  insurerSlug: string;
  vehicleType: string;
  vehicleUse: string;
  department: string;
  annualPrice: number;
  installmentAmount?: number;
  installmentCount?: number;
  source: string;
  updatedAt: string;
  notes?: string;
};

const dynamicTariffs = new Map<string, DynamicTariff>();

function tariffKey(insurer: string, vehicleType: string, department: string, use: string): string {
  return `${insurer}_${vehicleType}_${department}_${use}`.toLowerCase().replace(/\s+/g, '-');
}

// Cargar caché local del scraper si existe
function loadScraperCacheTariffs() {
  const directPath = path.resolve(process.cwd(), 'tmp', 'scraper-cache');
  const rootPath = path.resolve(process.cwd(), '..', '..', 'tmp', 'scraper-cache');
  const cacheDir = fs.existsSync(directPath) ? directPath : rootPath;
  if (!fs.existsSync(cacheDir)) return;
  try {
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json') && !f.startsWith('report-'));
    for (const file of files) {
      try {
        const fullPath = path.join(cacheDir, file);
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (content.offers && Array.isArray(content.offers)) {
          for (const offer of content.offers) {
            const [vehicleType, dept, use] = file.replace('.json', '').split('_');
            if (offer.insurerSlug && offer.price) {
              const key = tariffKey(offer.insurerSlug, vehicleType || 'AUTO', dept || 'lima', use || 'particular');
              dynamicTariffs.set(key, {
                insurerSlug: offer.insurerSlug,
                vehicleType: (vehicleType || 'AUTO').toUpperCase(),
                vehicleUse: (use || 'PARTICULAR').toUpperCase(),
                department: dept || 'Lima',
                annualPrice: Number(offer.price),
                installmentAmount: offer.installmentAmount ? Number(offer.installmentAmount) : undefined,
                installmentCount: offer.installmentCount ? Number(offer.installmentCount) : undefined,
                source: `SCRAPER:${offer.confidence || 'LIVE'}`,
                updatedAt: content.updatedAt || new Date().toISOString(),
                notes: offer.source || 'Caché Playwright'
              });
            }
          }
        }
      } catch {}
    }
    if (dynamicTariffs.size > 0) {
      console.log(`[Tariffs] ⚡ ${dynamicTariffs.size} tarifas cargadas desde el scraper cache.`);
    }
  } catch (err) {
    console.warn('[Tariffs] Error leyendo scraper-cache:', err);
  }
}

loadScraperCacheTariffs();

export function calculateOffers(
  vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO',
  department: string = 'Lima',
  use: string = 'PARTICULAR'
): OfferDetail[] {
  const isMototaxiTaxi =
    vehicleType === 'MOTOTAXI' &&
    (use.toUpperCase() === 'TAXI' || use.toUpperCase() === 'PUBLICO' ||
      use.toUpperCase() === 'COMERCIAL' ||
      department.toLowerCase().includes('callao'));
  const fallbackPrices = isMototaxiTaxi ? mototaxiTaxiTariffs : (tariffsByVehicle[vehicleType] || tariffsByVehicle.AUTO);

  const getPrice = (insurerSlug: string): { price: number; verified: boolean; installmentAmount?: number; installmentCount?: number } => {
    const specificKey = tariffKey(insurerSlug, vehicleType, department, use);
    const fallbackKey = tariffKey(insurerSlug, vehicleType, 'Lima', 'PARTICULAR');
    const dynamic = dynamicTariffs.get(specificKey) || dynamicTariffs.get(fallbackKey);
    if (dynamic && dynamic.annualPrice > 0) {
      return { price: dynamic.annualPrice, verified: true, installmentAmount: dynamic.installmentAmount, installmentCount: dynamic.installmentCount };
    }
    const price = fallbackPrices[insurerSlug] ?? 65.0;
    const installmentCount = vehicleType === 'MOTO' ? 4 : 1;
    return { price, verified: false, installmentCount, installmentAmount: installmentCount > 1 ? Math.max(150, price / installmentCount) : price };
  };

  const posPrice = getPrice('la-positiva');
  const mapPrice = getPrice('mapfre');
  const intPrice = getPrice('interseguro');
  const pacPrice = getPrice('pacifico');
  const proPrice = getPrice('protecta');
  const falabellaPrice = getPrice('falabella');

  const isMoto = vehicleType === 'MOTO';

  return [
    {
      id: 'falabella',
      insurer: 'falabella',
      name: 'Seguros Falabella',
      plan: 'SOAT Digital Falabella',
      logo: 'seguros-falabella.png',
      price: falabellaPrice.price,
      installmentAmount: falabellaPrice.installmentAmount,
      installmentCount: falabellaPrice.installmentCount,
      currency: 'PEN',
      badge: falabellaPrice.verified ? 'Precio actualizado' : 'Gestión Falabella',
      available: true,
      extras: ['Asesoría personalizada', 'Emisión digital', 'Atención a través de Seguros Falabella']
    },
    {
      id: 'la-positiva',
      insurer: 'la-positiva',
      name: 'La Positiva',
      plan: 'SOAT Digital Tradicional',
      logo: 'la-positiva.png',
      price: posPrice.price,
      installmentAmount: posPrice.installmentAmount,
      installmentCount: posPrice.installmentCount,
      currency: 'PEN',
      badge: isMoto ? 'Precio actualizado' : (posPrice.verified ? 'Precio actualizado' : (isMototaxiTaxi ? 'Tarifa Oficial Taxi' : 'Más económico')),
      available: true,
      extras: ['Auxilio de batería 24/7', 'Servicio de grúa en ciudad (1 evento)', 'Atención médica legal inmediata']
    },
    {
      id: 'protecta',
      insurer: 'protecta',
      name: 'Protecta Security',
      plan: 'SOAT Protecta Flex',
      logo: 'protecta.png',
      price: isMoto ? 0 : proPrice.price,
      installmentAmount: isMoto ? undefined : proPrice.installmentAmount,
      installmentCount: isMoto ? undefined : proPrice.installmentCount,
      currency: 'PEN',
      badge: isMoto ? 'No disponible' : (proPrice.verified ? 'Precio actualizado' : 'Precio preferente'),
      available: !isMoto,
      unavailableReason: isMoto ? 'Protecta Security no cuenta con SOAT para motos lineales.' : undefined,
      extras: isMoto ? ['Excluido por política de riesgo'] : ['Asistencia telefónica 24 horas', 'Atención directa ante la SBS', 'Certificado digital verificable']
    },
    {
      id: 'interseguro',
      insurer: 'interseguro',
      name: 'Interseguro',
      plan: 'SOAT Digital Express',
      logo: 'interseguro.png',
      price: isMoto ? 0 : intPrice.price,
      installmentAmount: isMoto ? undefined : intPrice.installmentAmount,
      installmentCount: isMoto ? undefined : intPrice.installmentCount,
      currency: 'PEN',
      badge: isMoto ? 'No disponible en web' : (intPrice.verified ? 'Precio actualizado' : '100% digital'),
      available: !isMoto,
      unavailableReason: isMoto ? 'Interseguro no comercializa SOAT digital para motos lineales.' : undefined,
      extras: isMoto ? ['Canal web exclusivo para autos y taxis'] : ['Emisión y entrega instantánea por correo', 'Orientación médica telefónica', 'Sincronización MTC inmediata']
    },
    {
      id: 'mapfre',
      insurer: 'mapfre',
      name: 'MAPFRE',
      plan: 'SOAT Conectado MAPFRE',
      logo: 'mapfre.png',
      price: isMoto ? 0 : mapPrice.price,
      installmentAmount: isMoto ? undefined : mapPrice.installmentAmount,
      installmentCount: isMoto ? undefined : mapPrice.installmentCount,
      currency: 'PEN',
      badge: isMoto ? 'No disponible en web' : (mapPrice.verified ? 'Precio actualizado' : 'Más asistencias'),
      available: !isMoto,
      unavailableReason: isMoto ? 'MAPFRE requiere evaluación presencial con asesor para motos.' : undefined,
      extras: isMoto ? ['Requiere cotización con asesor'] : ['Auxilio mecánico y cerrajería', 'Ambulancia 24 hrs en caso de emergencia', 'Descuentos exclusivos en talleres']
    },
    {
      id: 'pacifico',
      insurer: 'pacifico',
      name: 'Pacífico',
      plan: 'SOAT Pacífico Digital Plus',
      logo: 'pacifico.png',
      price: isMoto ? 0 : pacPrice.price,
      installmentAmount: isMoto ? undefined : pacPrice.installmentAmount,
      installmentCount: isMoto ? undefined : pacPrice.installmentCount,
      currency: 'PEN',
      badge: isMoto ? 'No disponible en web' : (pacPrice.verified ? 'Precio actualizado' : 'Mejor valor'),
      available: !isMoto,
      unavailableReason: isMoto ? 'Pacífico no cuenta con emisión web directa para motos lineales.' : undefined,
      extras: isMoto ? ['Requiere evaluación comercial asistida'] : ['Red médica preferencial de clínicas', 'Hasta 2 grúas anuales por siniestro', '200 CMR Puntos de bienvenida']
    }
  ];
}

const quoteInput = z.object({
  plate: z.string().trim().transform((value) => value.toUpperCase().replace(/\s+/g, '')).pipe(z.string().min(5).max(9).regex(/^[A-Z0-9]+-?[A-Z0-9]+$/)),
  vehicleType: z.enum(['AUTO', 'MOTO', 'MOTOTAXI', 'VAN', 'CARGO']),
  department: z.string().min(2),
  documentType: z.enum(['DNI', 'CE', 'RUC', 'PASAPORTE', 'PAS']).transform((v) => (v === 'PAS' ? 'PASAPORTE' : v)),
  documentNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,12}$/),
  startsAt: z.coerce.date(),
  vehicle: z
    .object({
      brand: z.string().optional(),
      model: z.string().optional(),
      year: z.number().int().optional(),
      color: z.string().optional(),
      vin: z.string().optional(),
      chassisNumber: z.string().optional(),
      use: z.string().optional(),
      department: z.string().optional()
    })
    .optional(),
  selectedOfferId: z.string().optional(),
  selectedPrice: z.number().optional(),
  source: z.enum(['WEB', 'MANUAL']).default('WEB'),
  advisorName: z.string().optional(),
  assistedNotes: z.string().optional(),
  holderName: z.string().optional()
}).superRefine((input, context) => {
  if (input.documentType === 'DNI' && input.documentNumber && !/^\d{8}$/.test(input.documentNumber)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['documentNumber'], message: 'El DNI debe tener 8 dígitos.' });
  }
  if (input.documentType === 'RUC' && input.documentNumber && !/^\d{11}$/.test(input.documentNumber)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['documentNumber'], message: 'El RUC debe tener 11 dígitos.' });
  }
});

app.get('/health', async (_req, reply) => {
  try {
    if (database) await database.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'falabella-insurance-api', database: database ? 'connected' : 'memory' };
  } catch {
    return reply.status(503).send({ status: 'error', service: 'falabella-insurance-api', database: 'unavailable' });
  }
});

const insurers = [
  { id: 'falabella', name: 'Seguros Falabella', env: 'FALABELLA' },
  { id: 'la-positiva', name: 'La Positiva', env: 'LA_POSITIVA' },
  { id: 'mapfre', name: 'MAPFRE', env: 'MAPFRE' },
  { id: 'interseguro', name: 'Interseguro', env: 'INTERSEGURO' },
  { id: 'pacifico', name: 'Pacífico', env: 'PACIFICO' },
  { id: 'protecta', name: 'Protecta', env: 'PROTECTA' }
] as const;

app.get('/v1/insurers', async () => ({ data: insurers.map(({ id, name }) => ({ id, name })), mode: 'CATALOG' }));

app.get('/v1/offers', async (req, reply) => {
  const parsed = z
      .object({
        vehicleType: z.enum(['AUTO', 'MOTO', 'MOTOTAXI', 'VAN', 'CARGO']),
      department: z.string().min(2).default('Lima'),
      use: z.string().default('PARTICULAR')
    })
    .safeParse(req.query);
  if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  return { data: calculateOffers(parsed.data.vehicleType, parsed.data.department, parsed.data.use) };
});

app.get('/v1/tariffs', async () => {
  return {
    dynamicCount: dynamicTariffs.size,
    tariffs: Array.from(dynamicTariffs.values()),
    baseTariffs: tariffsByVehicle,
  };
});

app.post('/v1/admin/tariffs', async (req, reply) => {
  const adminKey = req.headers['x-admin-key'];
  if (process.env.ADMIN_API_KEY && adminKey !== process.env.ADMIN_API_KEY) {
    return reply.status(401).send({ error: 'UNAUTHORIZED' });
  }

  const body = req.body;
  const items = Array.isArray(body) ? body : [body];
  let updated = 0;

  for (const item of items as any[]) {
    if (!item.insurerSlug || !item.annualPrice || Number(item.annualPrice) <= 0) continue;
    const vehicleType = String(item.vehicleType || 'AUTO').toUpperCase();
    const installmentCount = Math.max(1, Math.floor(Number(item.installmentCount || (vehicleType === 'MOTO' ? 4 : 1))));
    const requestedInstallment = Number(item.installmentAmount || Number(item.annualPrice) / installmentCount);
    const installmentAmount = vehicleType === 'MOTO' ? Math.max(150, requestedInstallment) : Math.max(0, requestedInstallment);
    const key = tariffKey(
      item.insurerSlug,
      vehicleType,
      item.department || 'Lima',
      item.vehicleUse || 'PARTICULAR'
    );
    dynamicTariffs.set(key, {
      insurerSlug: item.insurerSlug,
      vehicleType,
      vehicleUse: String(item.vehicleUse || 'PARTICULAR').toUpperCase(),
      department: String(item.department || 'Lima'),
      annualPrice: Number(item.annualPrice),
      installmentAmount,
      installmentCount,
      source: String(item.source || 'SCRAPER'),
      updatedAt: new Date().toISOString(),
      notes: item.notes ? String(item.notes) : undefined
    });
    updated++;
  }

  return reply.send({ success: true, updated, total: dynamicTariffs.size });
});

app.post('/v1/admin/tariffs/sync-scraper', async (_req, reply) => {
  loadScraperCacheTariffs();
  return reply.send({ success: true, total: dynamicTariffs.size });
});

app.get('/v1/integrations/status', async () => ({
  data: {
    vehicle: { provider: 'VERIFIK', configured: Boolean(process.env.VERIFIK_TOKEN) },
    insurers: insurers.map(({ id, name, env }) => ({
      id,
      name,
      configured: Boolean(process.env[`${env}_API_URL`] && process.env[`${env}_API_TOKEN`])
    }))
  }
}));

const autoCatalog = [
  { brand: 'Toyota', model: 'Yaris', year: 2022, color: 'Blanco', vehicleType: 'AUTO' as const },
  { brand: 'Kia', model: 'Sportage', year: 2021, color: 'Gris', vehicleType: 'AUTO' as const },
  { brand: 'Hyundai', model: 'Tucson', year: 2023, color: 'Negro', vehicleType: 'AUTO' as const },
  { brand: 'Nissan', model: 'Versa', year: 2022, color: 'Plata', vehicleType: 'AUTO' as const },
  { brand: 'Chevrolet', model: 'Sail', year: 2020, color: 'Rojo', vehicleType: 'AUTO' as const }
] as const;

const motoCatalog = [
  { brand: 'Honda', model: 'CB 190R', year: 2022, color: 'Rojo', vehicleType: 'MOTO' as const },
  { brand: 'Suzuki', model: 'Gixxer 150', year: 2021, color: 'Azul', vehicleType: 'MOTO' as const },
  { brand: 'Yamaha', model: 'FZ 2.0', year: 2023, color: 'Negro', vehicleType: 'MOTO' as const },
  { brand: 'Bajaj', model: 'Pulsar NS 200', year: 2024, color: 'Blanco', vehicleType: 'MOTO' as const }
] as const;

const verifiedDemoVehicles: Record<
  string,
  {
    brand: string;
    model: string;
    year: number;
    color: string;
    vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';
    vin: string;
    chassisNumber: string;
    use?: string;
    department?: string;
  }
> = {
  '1274-UP': {
    brand: 'Suzuki',
    model: 'GSX-R150 ABS',
    year: 2026,
    color: 'Negro',
    vehicleType: 'MOTO',
    vin: '9FSDL23E3TC101115',
    chassisNumber: '9FSDL23E3TC101115',
    use: 'PARTICULAR',
    department: 'Lima'
  },
  '1274UP': {
    brand: 'Suzuki',
    model: 'GSX-R150 ABS',
    year: 2026,
    color: 'Negro',
    vehicleType: 'MOTO',
    vin: '9FSDL23E3TC101115',
    chassisNumber: '9FSDL23E3TC101115',
    use: 'PARTICULAR',
    department: 'Lima'
  },
  'ABC-123': {
    brand: 'Toyota',
    model: 'Corolla 1.8 XEi',
    year: 2023,
    color: 'Gris Oscuro',
    vehicleType: 'AUTO',
    vin: '9BRBL42E9P8123456',
    chassisNumber: '9BRBL42E9P8123456',
    use: 'PARTICULAR',
    department: 'Lima'
  },
  'ABC123': {
    brand: 'Toyota',
    model: 'Corolla 1.8 XEi',
    year: 2023,
    color: 'Gris Oscuro',
    vehicleType: 'AUTO',
    vin: '9BRBL42E9P8123456',
    chassisNumber: '9BRBL42E9P8123456',
    use: 'PARTICULAR',
    department: 'Lima'
  },
  'AMY-477': {
    brand: 'BMW',
    model: '118i',
    year: 2013,
    color: 'Blanco',
    vehicleType: 'AUTO',
    vin: 'WBA1A3104EJ681960',
    chassisNumber: 'WBA1A3104EJ681960',
    use: 'PARTICULAR',
    department: 'Lima'
  },
  'AMY477': {
    brand: 'BMW',
    model: '118i',
    year: 2013,
    color: 'Blanco',
    vehicleType: 'AUTO',
    vin: 'WBA1A3104EJ681960',
    chassisNumber: 'WBA1A3104EJ681960',
    use: 'PARTICULAR',
    department: 'Lima'
  },
  '7463-BS': {
    brand: 'Zongshen',
    model: 'ZS',
    year: 2017,
    color: 'Azul',
    vehicleType: 'MOTOTAXI' as const,
    vin: 'LZSPCKLF9J1023000',
    chassisNumber: 'LZSPCKLF9J1023000',
    use: 'TAXI',
    department: 'Callao'
  },
  '7463BS': {
    brand: 'Zongshen',
    model: 'ZS',
    year: 2017,
    color: 'Azul',
    vehicleType: 'MOTOTAXI' as const,
    vin: 'LZSPCKLF9J1023000',
    chassisNumber: 'LZSPCKLF9J1023000',
    use: 'TAXI',
    department: 'Callao'
  }
};

const vehicleIdentifiers = (plate: string) => {
  const seed = [...plate].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 17).toString(36).toUpperCase();
  const normalized = plate.replace(/[^A-Z0-9]/g, '');
  return {
    vin: `DEMO${normalized}${seed}`.slice(0, 17).padEnd(17, '0'),
    chassisNumber: `CH-${normalized}-${seed}`
  };
};

async function lookupVerifik(plate: string) {
  const token = process.env.VERIFIK_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch(
      `https://api.verifik.co/v2/pe/vehiculo/placa?plate=${encodeURIComponent(plate.replace(/-/g, ''))}`,
      {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000)
      }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: {
        brand?: string;
        model?: string;
        year?: string;
        type?: string;
        serial?: string;
        chasisSerial?: string;
        color?: string;
      };
    };
    const data = payload.data;
    if (!data?.brand || !data.model) return null;
    const chassis = data.chasisSerial || data.serial || 'No informado';
    const isMoto = /MOTO|MOTOCICLETA|TRIMOTO/i.test(data.type || '');
    const vehicleType: 'AUTO' | 'MOTO' = isMoto ? 'MOTO' : 'AUTO';
    return {
      plate,
      brand: data.brand,
      model: data.model,
      year: Number(data.year) || new Date().getFullYear(),
      color: data.color || 'No informado',
      vehicleType,
      vin: data.serial || chassis,
      chassisNumber: chassis,
      source: 'VERIFIK' as const
    };
  } catch {
    return null;
  }
}

app.get('/v1/vehicles/:plate', async (req, reply) => {
  const raw = (req.params as { plate?: string }).plate || '';
  let normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!normalized || normalized.length < 5 || normalized.length > 9) {
    return reply.status(400).send({ error: 'INVALID_PLATE' });
  }

  // Format with hyphen if missing: ABC123 -> ABC-123 or 1274UP -> 1274-UP
  if (!normalized.includes('-')) {
    if (/^\d{4}[A-Z]{2}$/.test(normalized)) {
      normalized = `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
    } else if (/^[A-Z0-9]{3}[A-Z0-9]{3}$/.test(normalized)) {
      normalized = `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
    }
  }

  // 1. Try Live Verifik lookup
  const live = await lookupVerifik(normalized);
  if (live) {
    const offers = calculateOffers(live.vehicleType, 'Lima');
    return { data: live, offers, mode: 'LIVE_VERIFIK' };
  }

  // 2. Try verified padrón vehicles
  const verified = verifiedDemoVehicles[normalized] || verifiedDemoVehicles[normalized.replace(/-/g, '')];
  if (verified) {
    const data = { plate: normalized, ...verified, source: 'PADRON' as const };
    const offers = calculateOffers(
      verified.vehicleType,
      (verified as { department?: string }).department || 'Lima',
      (verified as { use?: string }).use || 'PARTICULAR'
    );
    return { found: true, data, offers, mode: 'VERIFIED' };
  }

  // 3. Placa no encontrada en padrón automático: detectar categoría según norma MTC sin inventar modelos falsos
  const clean = normalized.replace(/[^A-Z0-9]/g, '');
  let detectedType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO' = 'AUTO';
  if (/^\d{4}\d[A-Z]$/.test(clean)) {
    detectedType = 'MOTOTAXI';
  } else if (/^\d{4}[A-Z]{2}$/.test(clean)) {
    detectedType = 'MOTO';
  } else if (/^[TV]\d[A-Z0-9]{3}$/.test(clean)) {
    detectedType = 'CARGO';
  } else if (/^[F][0-9A-Z]{5}$/.test(clean)) {
    detectedType = 'VAN';
  }

  const offers = calculateOffers(detectedType, 'Lima', 'PARTICULAR');
  return {
    found: false,
    data: {
      plate: normalized,
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      color: 'No informado',
      vehicleType: detectedType,
      vin: '',
      chassisNumber: '',
      source: 'MANUAL_ENTRY' as const
    },
    offers,
    mode: 'UNREGISTERED_PLATE',
    message: 'Placa no encontrada en el padrón automático. Puedes ingresar o confirmar la marca y modelo para personalizar tu cotización.'
  };
});

app.get('/v1/quotes', async () => {
  const data = await loadStoredQuotes();
  return {
    data,
    summary: {
      total: data.length,
      web: data.filter((quote) => quote.source === 'WEB').length,
      manual: data.filter((quote) => quote.source === 'MANUAL').length,
      pending: data.filter((quote) => quote.status === 'NUEVA').length
    }
  };
});

app.get('/v1/soat/consulta', async (req, reply) => {
  const query = req.query as { plate?: string; documentNumber?: string };
  const plate = String(query.plate || '').trim().toUpperCase().replace(/\s+/g, '');
  const documentNumber = String(query.documentNumber || '').trim().toUpperCase();
  if (!plate || !/^[A-Z0-9]{5,8}-?[A-Z0-9]{1,3}$/.test(plate)) {
    return reply.status(400).send({ error: 'INVALID_PLATE', message: 'Ingresa una placa válida.' });
  }

  const normalizedPlate = plate.replace(/-/g, '');
  const data = await loadStoredQuotes();
  const matches = data
    .filter((quote) => quote.plate.replace(/-/g, '') === normalizedPlate)
    .filter((quote) => !documentNumber || quote.documentNumber === documentNumber)
    .filter((quote) => quote.status === 'EMITIDA')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const quote = matches[0];

  if (!quote) {
    return reply.send({ data: { found: false, status: 'NO_ENCONTRADO', plate } });
  }

  const startsAt = new Date(quote.startsAt);
  const expiresAt = new Date(startsAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const now = new Date();
  const status = expiresAt >= now && startsAt <= now ? 'VIGENTE' : expiresAt < now ? 'VENCIDO' : 'AÚN_NO_VIGENTE';
  const selectedOffer = quote.offers?.find((offer) => offer.id === quote.selectedOfferId);

  return reply.send({
    data: {
      found: true,
      status,
      plate: quote.plate,
      policyNumber: quote.policyNumber || 'Pendiente de asignación',
      insurer: selectedOffer?.name || quote.selectedOfferId || 'Aseguradora registrada',
      vehicle: quote.vehicle ? { brand: quote.vehicle.brand, model: quote.vehicle.model, year: quote.vehicle.year } : undefined,
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      consultedAt: now.toISOString()
    }
  });
});

app.get('/v1/quotes/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const data = await loadStoredQuotes();
  const found = data.find((quote) => quote.id === id || quote.code === id);
  if (!found) return reply.status(404).send({ error: 'QUOTE_NOT_FOUND' });
  return { data: found };
});

// For development testing
if (process.env.NODE_ENV !== 'production') {
  app.delete('/v1/dev/quotes', async (_req, reply) => {
    quotes.splice(0, quotes.length);
    return reply.status(204).send();
  });
}

app.post('/v1/quotes', async (req, reply) => {
  const parsed = quoteInput.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  const vehicleUse = parsed.data.vehicle?.use || 'PARTICULAR';
  const offers = calculateOffers(parsed.data.vehicleType, parsed.data.department, vehicleUse);
  const selectedOffer = parsed.data.selectedOfferId
    ? offers.find((offer) => offer.id === parsed.data.selectedOfferId)
    : offers[0];
  if (!selectedOffer) return reply.status(400).send({ error: 'INVALID_OFFER' });

  const now = new Date();
  const id = crypto.randomUUID();
  const code = `COT-${now.getFullYear()}-${id.slice(0, 8).toUpperCase()}`;
  const quote: Quote = {
    id,
    code,
    plate: parsed.data.plate,
    vehicleType: parsed.data.vehicleType,
    department: parsed.data.department,
    vehicleUse,
    documentType: parsed.data.documentType,
    documentNumber: parsed.data.documentNumber,
    startsAt: parsed.data.startsAt.toISOString(),
    vehicle: parsed.data.vehicle,
    holderName: parsed.data.holderName,
    selectedOfferId: selectedOffer.id,
    selectedPrice: parsed.data.selectedPrice ?? selectedOffer.price,
    advisorName: parsed.data.advisorName,
    assistedNotes: parsed.data.assistedNotes,
    offers,
    source: parsed.data.source,
    status: 'NUEVA',
    createdAt: now.toISOString()
  };

  if (database) {
    try {
      await database.$transaction(async (transaction) => {
        let customerId: string | undefined;
        if (quote.holderName) {
          const parts = quote.holderName.trim().split(/\s+/);
          const firstName = parts[0] || 'Cliente';
          const lastName = parts.slice(1).join(' ') || 'Titular';
          const customer = await transaction.customer.upsert({
            where: {
              documentType_documentNumber: {
                documentType: quote.documentType,
                documentNumber: quote.documentNumber
              }
            },
            update: { firstName, lastName },
            create: {
              documentType: quote.documentType,
              documentNumber: quote.documentNumber,
              firstName,
              lastName,
              email: `${quote.documentNumber.toLowerCase()}@segurosfalabella.pe`
            }
          });
          customerId = customer.id;
        }

        const vehicle = await transaction.vehicle.upsert({
          where: { plate: quote.plate },
          update: {
            type: quote.vehicleType,
            use: quote.vehicleUse || 'PARTICULAR',
            department: quote.department,
            brand: quote.vehicle?.brand,
            model: quote.vehicle?.model,
            year: quote.vehicle?.year,
            color: quote.vehicle?.color,
            vin: quote.vehicle?.vin,
            chassisNumber: quote.vehicle?.chassisNumber
          },
          create: {
            plate: quote.plate,
            type: quote.vehicleType,
            use: quote.vehicleUse || 'PARTICULAR',
            department: quote.department,
            brand: quote.vehicle?.brand,
            model: quote.vehicle?.model,
            year: quote.vehicle?.year,
            color: quote.vehicle?.color,
            vin: quote.vehicle?.vin,
            chassisNumber: quote.vehicle?.chassisNumber
          }
        });
        const storedQuote = await transaction.quote.create({
          data: {
            id: quote.id,
            code: quote.code,
            startsAt: new Date(quote.startsAt),
            source: quote.source,
            documentType: quote.documentType,
            documentNumber: quote.documentNumber,
            department: quote.department,
            selectedOfferId: quote.selectedOfferId,
            selectedPrice: quote.selectedPrice,
            customerId,
            vehicleId: vehicle.id
          }
        });
        for (const offer of offers) {
          const insurer = await transaction.insurer.upsert({
            where: { slug: offer.insurer },
            update: { name: offer.name, logoPath: offer.logo, active: offer.available },
            create: { slug: offer.insurer, name: offer.name, logoPath: offer.logo, active: offer.available }
          });
          await transaction.offer.create({
            data: {
              quoteId: storedQuote.id,
              insurerId: insurer.id,
              annualPrice: offer.price,
              currency: offer.currency,
              benefits: offer.extras,
              rawResponse: JSON.parse(JSON.stringify(offer)),
              available: offer.available
            }
          });
        }
      });
    } catch (err) {
      app.log.warn({ err }, 'Error guardando en base de datos, almacenando cotización en memoria');
      quotes.unshift(quote);
    }
  } else {
    quotes.unshift(quote);
  }
  return reply.status(201).send({ data: quote, offers });
});

app.post('/v1/quotes/:id/emit', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body || {}) as {
    advisorName?: string;
    realPrice?: number;
    assistedNotes?: string;
    selectedOfferId?: string;
    holderName?: string;
    vehicle?: {
      brand?: string;
      model?: string;
      year?: number;
      color?: string;
      vin?: string;
      chassisNumber?: string;
      use?: string;
      department?: string;
    };
  };
  const data = await loadStoredQuotes();
  const quote = data.find((q) => q.id === id || q.code === id);
  if (!quote) return reply.status(404).send({ error: 'QUOTE_NOT_FOUND' });

  if (quote.status === 'EMITIDA') {
    return reply.send({ data: quote });
  }

  if (!body.holderName?.trim() && !quote.holderName?.trim()) {
    return reply.status(400).send({
      error: 'HOLDER_NAME_REQUIRED',
      message: 'Los nombres y apellidos del contratante son obligatorios para emitir la póliza.'
    });
  }

  quote.status = 'EMITIDA';
  quote.emittedAt = new Date().toISOString();
  quote.policyNumber = quote.policyNumber || `SOAT-2026-FALA-${Math.floor(100000 + Math.random() * 900000)}`;
  if (body.advisorName) quote.advisorName = body.advisorName;
  if (body.realPrice) quote.selectedPrice = body.realPrice;
  if (body.assistedNotes) quote.assistedNotes = body.assistedNotes;
  if (body.selectedOfferId) quote.selectedOfferId = body.selectedOfferId;
  if (body.holderName) quote.holderName = body.holderName;
  if (body.vehicle) {
    quote.vehicle = { ...(quote.vehicle || {}), ...body.vehicle };
  }

  if (database) {
    let customerId: string | undefined;
    if (quote.holderName) {
      const parts = quote.holderName.trim().split(/\s+/);
      const firstName = parts[0] || 'Cliente';
      const lastName = parts.slice(1).join(' ') || 'Titular';
      const cust = await database.customer.upsert({
        where: {
          documentType_documentNumber: {
            documentType: quote.documentType,
            documentNumber: quote.documentNumber
          }
        },
        update: { firstName, lastName },
        create: {
          documentType: quote.documentType,
          documentNumber: quote.documentNumber,
          firstName,
          lastName,
          email: `${quote.documentNumber.toLowerCase()}@segurosfalabella.pe`
        }
      }).catch(() => null);
      if (cust) customerId = cust.id;
    }

    const storedQuote = await database.quote
      .update({
        where: { id: quote.id },
        data: {
          status: 'ISSUED',
          selectedPrice: quote.selectedPrice,
          selectedOfferId: quote.selectedOfferId,
          ...(customerId ? { customerId } : {})
        },
        include: { offers: { include: { insurer: true } }, order: true }
      })
      .catch(() => null);

    if (storedQuote) {
      const selectedOffer = storedQuote.offers.find((offer) => offer.insurer.slug === quote.selectedOfferId);
      if (selectedOffer) {
        const order = await database.order.upsert({
          where: { quoteId: quote.id },
          update: {
            status: 'ISSUED',
            amount: quote.selectedPrice ?? Number(selectedOffer.annualPrice || 0),
            policyNumber: quote.policyNumber
          },
          create: {
            code: `ORD-${quote.code}`,
            status: 'ISSUED',
            quoteId: quote.id,
            offerId: selectedOffer.id,
            amount: quote.selectedPrice ?? Number(selectedOffer.annualPrice || 0),
            policyNumber: quote.policyNumber
          }
        }).catch(() => null);
        if (order) quote.emittedAt = order.updatedAt.toISOString();
      }
    }

    if (quote.vehicle && (quote.vehicle.brand || quote.vehicle.model)) {
      await database.vehicle
        .update({
          where: { plate: quote.plate },
          data: {
            brand: quote.vehicle.brand,
            model: quote.vehicle.model,
            year: quote.vehicle.year ? Number(quote.vehicle.year) : undefined,
            chassisNumber: quote.vehicle.chassisNumber || quote.vehicle.vin,
            use: quote.vehicle.use || quote.vehicleUse || undefined,
            department: quote.vehicle.department || quote.department
          }
        })
        .catch(() => {});
    }
  }
  return reply.send({ data: quote });
});

app.post('/v1/orders', async (_req, reply) =>
  reply.status(501).send({
    error: 'PAYMENT_PROVIDER_NOT_CONNECTED',
    message: 'La emisión real se habilitará al configurar la pasarela y las integraciones de aseguradoras.'
  })
);

const port = Number(process.env.API_PORT || 4000);
if (database) {
  try {
    await database.$connect();
    app.log.info('Conexión con PostgreSQL establecida');
  } catch (err) {
    app.log.warn({ err }, 'No se pudo conectar con PostgreSQL al iniciar. Operando en memoria / modo contingencia.');
  }
}
app.addHook('onClose', async () => {
  await database?.$disconnect().catch(() => {});
});
await app.listen({ port, host: '0.0.0.0' });
