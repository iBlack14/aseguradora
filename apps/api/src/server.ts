import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { registerSoatRegistry } from './soat-registry.js';
import { reserveLocalPolicyNumber } from './policy-number.js';

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
          const value = rest.join('=').trim();
          process.env[k.trim()] = /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
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
  status: 'NUEVA' | 'COTIZADA' | 'EMITIDA' | 'ANULADA';
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
  policyUrl?: string;
  paymentReference?: string;
  paymentMethod?: 'CASH' | 'INSTALLMENTS';
  installmentCount?: number;
  installmentAmount?: number;
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX || 120),
  timeWindow: '1 minute'
});

const quotes: Quote[] = [];
type PaymentConfig = {
  yapeEnabled: boolean;
  yapeName: string;
  yapeNumber: string;
  yapeInstructions: string;
  yapeQrUrl: string;
};

let paymentConfig: PaymentConfig = {
  yapeEnabled: false,
  yapeName: 'Yape / Plin / Billetera digital',
  yapeNumber: '',
  yapeInstructions: 'Realiza el pago y conserva la constancia para que un asesor valide tu solicitud.',
  yapeQrUrl: ''
};
// En modo de desarrollo o prototipo, el catálogo de contingencia se activa por defecto salvo que DEMO_MODE='false'
const demoMode = process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE === 'true';
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_API_KEY) throw new Error('ADMIN_API_KEY is required in production');
const database = process.env.DATABASE_URL ? new PrismaClient() : null;
if (process.env.NODE_ENV === 'production' && !database) throw new Error('DATABASE_URL is required in production');

const scryptAsync = promisify(crypto.scrypt);
type UserTheme = 'CORPORATE' | 'DARK' | 'OCEAN' | 'PLUM';
const temporaryUsers: Array<{ id: string; email: string; name: string; role: 'SALES' | 'OPERATIONS' | 'SUPPORT' | 'AUDITOR'; theme: UserTheme; active: boolean; passwordHash: string; createdAt: string }> = [];
async function hashUserPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}
async function verifyUserPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}
function publicUser(user: { id: string; email: string; name: string; role: string; theme: string; active: boolean; createdAt: Date | string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, theme: user.theme, active: user.active, createdAt: user.createdAt };
}
function validAdminKey(req: { headers: Record<string, string | string[] | undefined> }) {
  const key = req.headers['x-admin-key'];
  return Boolean(process.env.ADMIN_API_KEY && typeof key === 'string' && key === process.env.ADMIN_API_KEY);
}

// Only the authenticated admin proxy may supply the internal key and role.
app.addHook('preHandler', async (req, reply) => {
  const route = req.routeOptions.url || '';
  const publicRead = ['/health', '/v1/insurers', '/v1/offers', '/v1/payment-config', '/v1/vehicles/:plate', '/v1/soat/consulta'];
  if (req.method === 'OPTIONS' || (req.method === 'GET' && publicRead.includes(route)) ||
      (req.method === 'POST' && ['/v1/auth/login', '/v1/quotes'].includes(route))) return;
  if (!validAdminKey(req)) return reply.status(401).send({ error: 'UNAUTHORIZED' });
  const role = req.headers['x-admin-role'];
  const allowedRoles = ['ADMIN', 'OPERATIONS', 'SALES', 'SUPPORT', 'AUDITOR'];
  if (typeof role !== 'string' || !allowedRoles.includes(role)) return reply.status(403).send({ error: 'FORBIDDEN' });
  if ((route.startsWith('/v1/admin/') && role !== 'ADMIN') ||
      (req.method !== 'GET' && !['ADMIN', 'OPERATIONS', 'SALES'].includes(role))) {
    return reply.status(403).send({ error: 'FORBIDDEN' });
  }
});

async function getPaymentConfig(): Promise<PaymentConfig> {
  if (!database) return paymentConfig;
  try {
    const stored = await database.appSetting.findUnique({ where: { key: 'payment-config' } });
    if (stored?.value && typeof stored.value === 'object' && !Array.isArray(stored.value)) {
      return { ...paymentConfig, ...(stored.value as Partial<PaymentConfig>) };
    }
  } catch (error) {
    app.log.warn({ error }, 'No fue posible leer la configuración de pagos');
  }
  return paymentConfig;
}

async function savePaymentConfig(next: PaymentConfig): Promise<void> {
  if (database) {
    await database.appSetting.upsert({
      where: { key: 'payment-config' },
      create: { key: 'payment-config', value: next },
      update: { value: next }
    });
  }
  paymentConfig = next;
}

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
    ? `${record.customer.firstName} ${/^titular$/i.test(record.customer.lastName.trim()) ? '' : record.customer.lastName}`.trim()
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
    status: record.status === 'ISSUED' ? 'EMITIDA' : record.status === 'CANCELLED' ? 'ANULADA' : 'NUEVA',
    createdAt: record.createdAt.toISOString(),
    vehicle,
    holderName,
    selectedOfferId: record.selectedOfferId || undefined,
    selectedPrice: record.selectedPrice ? Number(record.selectedPrice) : undefined,
    offers,
    emittedAt: record.order?.updatedAt.toISOString(),
    policyNumber: record.order?.policyNumber || undefined,
    policyUrl: record.order?.policyUrl || undefined,
    paymentReference: record.order?.paymentReference || undefined,
    ...((record.order?.manualDetails as { paymentMethod?: 'CASH' | 'INSTALLMENTS'; installmentCount?: number; installmentAmount?: number } | null) || {})
  };
}

async function loadStoredQuotes() {
  if (!database) return quotes;
  const records = await database.quote.findMany({
    include: { customer: true, vehicle: true, offers: { include: { insurer: true } }, order: true },
    orderBy: { createdAt: 'desc' }
  });
  return records.map(storedQuoteToApi);
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
async function persistTariffs(next: Map<string, DynamicTariff>) {
  if (database) {
    const value = JSON.parse(JSON.stringify(Array.from(next.values())));
    await database.appSetting.upsert({ where: { key: 'dynamic-tariffs' }, create: { key: 'dynamic-tariffs', value }, update: { value } });
  }
  dynamicTariffs.clear();
  for (const [key, value] of next) dynamicTariffs.set(key, value);
}

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
if (database) {
  const stored = await database.appSetting.findUnique({ where: { key: 'dynamic-tariffs' } });
  if (Array.isArray(stored?.value)) {
    for (const item of stored.value as unknown as DynamicTariff[]) dynamicTariffs.set(tariffKey(item.insurerSlug, item.vehicleType, item.department, item.vehicleUse), item);
  }
}

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
      badge: posPrice.verified ? 'Precio actualizado' : (isMototaxiTaxi ? 'Tarifa Oficial Taxi' : 'Más económico'),
      available: true,
      extras: ['Auxilio de batería 24/7', 'Servicio de grúa en ciudad (1 evento)', 'Atención médica legal inmediata']
    },
    {
      id: 'protecta',
      insurer: 'protecta',
      name: 'Protecta Security',
      plan: 'SOAT Protecta Flex',
      logo: 'protecta.png',
      price: proPrice.price,
      installmentAmount: proPrice.installmentAmount,
      installmentCount: proPrice.installmentCount,
      currency: 'PEN',
      badge: proPrice.verified ? 'Precio actualizado' : 'Precio preferente',
      available: true,
      extras: ['Asistencia telefónica 24 horas', 'Atención directa ante la SBS', 'Certificado digital verificable']
    },
    {
      id: 'interseguro',
      insurer: 'interseguro',
      name: 'Interseguro',
      plan: 'SOAT Digital Express',
      logo: 'interseguro.png',
      price: intPrice.price,
      installmentAmount: intPrice.installmentAmount,
      installmentCount: intPrice.installmentCount,
      currency: 'PEN',
      badge: intPrice.verified ? 'Precio actualizado' : '100% digital',
      available: true,
      extras: ['Emisión y entrega instantánea por correo', 'Orientación médica telefónica', 'Sincronización MTC inmediata']
    },
    {
      id: 'mapfre',
      insurer: 'mapfre',
      name: 'MAPFRE',
      plan: 'SOAT Conectado MAPFRE',
      logo: 'mapfre.png',
      price: mapPrice.price,
      installmentAmount: mapPrice.installmentAmount,
      installmentCount: mapPrice.installmentCount,
      currency: 'PEN',
      badge: mapPrice.verified ? 'Precio actualizado' : 'Más asistencias',
      available: true,
      extras: ['Auxilio mecánico y cerrajería', 'Ambulancia 24 hrs en caso de emergencia', 'Descuentos exclusivos en talleres']
    },
    {
      id: 'pacifico',
      insurer: 'pacifico',
      name: 'Pacífico',
      plan: 'SOAT Pacífico Digital Plus',
      logo: 'pacifico.png',
      price: pacPrice.price,
      installmentAmount: pacPrice.installmentAmount,
      installmentCount: pacPrice.installmentCount,
      currency: 'PEN',
      badge: pacPrice.verified ? 'Precio actualizado' : 'Mejor valor',
      available: true,
      extras: ['Red médica preferencial de clínicas', 'Hasta 2 grúas anuales por siniestro', '200 CMR Puntos de bienvenida']
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

app.post('/v1/auth/login', async (req, reply) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
  const email = parsed.data.email.trim().toLowerCase();
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configuredEmail && email === configuredEmail && parsed.data.password === process.env.ADMIN_PASSWORD) {
    return { success: true, user: { email: configuredEmail, name: 'Administrador', role: 'ADMIN', theme: 'CORPORATE' } };
  }
  if (database) {
    const user = await database.user.findUnique({ where: { email } });
    if (user?.active && user.passwordHash && await verifyUserPassword(parsed.data.password, user.passwordHash)) {
      return { success: true, user: publicUser(user) };
    }
  } else {
    const user = temporaryUsers.find((candidate) => candidate.email === email && candidate.active);
    if (user && await verifyUserPassword(parsed.data.password, user.passwordHash)) {
      return { success: true, user: publicUser(user) };
    }
  }
  return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
});

app.get('/v1/admin/users', async (req, reply) => {
  if (!validAdminKey(req)) return reply.status(401).send({ error: 'UNAUTHORIZED' });
  const users = database
    ? (await database.user.findMany({ orderBy: { createdAt: 'desc' } })).map(publicUser)
    : temporaryUsers.map(publicUser);
  if (process.env.ADMIN_EMAIL) {
    users.unshift({ id: 'env-admin', email: process.env.ADMIN_EMAIL, name: 'Administrador', role: 'ADMIN', theme: 'CORPORATE', active: true, createdAt: new Date(0) });
  }
  return { data: users };
});

app.post('/v1/admin/users', async (req, reply) => {
  if (!validAdminKey(req)) return reply.status(401).send({ error: 'UNAUTHORIZED' });
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8).max(100),
    role: z.enum(['SALES', 'OPERATIONS', 'SUPPORT', 'AUDITOR']).default('SALES'),
    theme: z.enum(['CORPORATE', 'DARK', 'OCEAN', 'PLUM']).default('CORPORATE')
  }).safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  if (parsed.data.email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) return reply.status(409).send({ error: 'EMAIL_ALREADY_EXISTS' });
  const exists = database
    ? await database.user.findUnique({ where: { email: parsed.data.email } })
    : temporaryUsers.some((user) => user.email === parsed.data.email);
  if (exists) return reply.status(409).send({ error: 'EMAIL_ALREADY_EXISTS' });
  const passwordHash = await hashUserPassword(parsed.data.password);
  if (database) {
    const user = await database.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: parsed.data.role, theme: parsed.data.theme } });
    return reply.status(201).send({ data: publicUser(user) });
  }
  const user = { id: crypto.randomUUID(), name: parsed.data.name, email: parsed.data.email, passwordHash, role: parsed.data.role, theme: parsed.data.theme, active: true, createdAt: new Date().toISOString() };
  temporaryUsers.push(user);
  return reply.status(201).send({ data: publicUser(user) });
});

app.patch('/v1/admin/users/:id', async (req, reply) => {
  if (!validAdminKey(req)) return reply.status(401).send({ error: 'UNAUTHORIZED' });
  const parsed = z.object({ active: z.boolean().optional(), theme: z.enum(['CORPORATE', 'DARK', 'OCEAN', 'PLUM']).optional() }).refine((value) => value.active !== undefined || value.theme !== undefined).safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  if (req.params && typeof req.params === 'object' && 'id' in req.params && req.params.id === 'env-admin') return reply.status(400).send({ error: 'ENV_ADMIN_CANNOT_BE_CHANGED' });
  const id = (req.params as { id: string }).id;
  if (database) {
    const user = await database.user.update({ where: { id }, data: { ...(parsed.data.active === undefined ? {} : { active: parsed.data.active }), ...(parsed.data.theme === undefined ? {} : { theme: parsed.data.theme }) } }).catch(() => null);
    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    return { data: publicUser(user) };
  }
  const user = temporaryUsers.find((candidate) => candidate.id === id);
  if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
  if (parsed.data.active !== undefined) user.active = parsed.data.active;
  if (parsed.data.theme !== undefined) user.theme = parsed.data.theme;
  return { data: publicUser(user) };
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

app.get('/v1/payment-config', async () => ({ data: await getPaymentConfig() }));

app.put('/v1/admin/payment-config', async (req, reply) => {
  if (!validAdminKey(req)) {
    return reply.status(401).send({ error: 'UNAUTHORIZED' });
  }

  const parsed = z.object({
    yapeEnabled: z.boolean(),
    yapeName: z.string().trim().min(1).max(80),
    yapeNumber: z.string().trim().max(40),
    yapeInstructions: z.string().trim().max(240),
    yapeQrUrl: z.string().trim().max(500)
  }).safeParse(req.body);

  if (!parsed.success) {
    return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  await savePaymentConfig(parsed.data);
  return reply.send({ success: true, data: await getPaymentConfig() });
});

app.post('/v1/admin/tariffs', async (req, reply) => {
  if (!validAdminKey(req)) {
    return reply.status(401).send({ error: 'UNAUTHORIZED' });
  }

  const tariffSchema = z.object({
    insurerSlug: z.enum(['falabella', 'la-positiva', 'mapfre', 'interseguro', 'pacifico', 'protecta']),
    vehicleType: z.enum(['AUTO', 'MOTO', 'MOTOTAXI', 'VAN', 'CARGO']).default('AUTO'),
    vehicleUse: z.string().trim().min(1).max(80).default('PARTICULAR'),
    department: z.string().trim().min(2).max(80).default('Lima'),
    annualPrice: z.number().finite().positive(),
    installmentCount: z.number().int().positive().max(24).optional(),
    installmentAmount: z.number().finite().positive().optional(),
    source: z.string().max(80).optional(), notes: z.string().max(500).optional()
  });
  const parsed = z.array(tariffSchema).min(1).max(500).safeParse(Array.isArray(req.body) ? req.body : [req.body]);
  if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  const items = parsed.data;
  let updated = 0;
  const nextTariffs = new Map(dynamicTariffs);

  for (const item of items) {
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
    nextTariffs.set(key, {
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

  await persistTariffs(nextTariffs);
  return reply.send({ success: true, updated, total: dynamicTariffs.size });
});

app.post('/v1/admin/tariffs/sync-scraper', async (_req, reply) => {
  const previous = new Map(dynamicTariffs);
  loadScraperCacheTariffs();
  const next = new Map(dynamicTariffs);
  dynamicTariffs.clear();
  for (const [key, value] of previous) dynamicTariffs.set(key, value);
  await persistTariffs(next);
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
  '0000-AA': {
    brand: 'Suzuki',
    model: 'GSX-R150 ABS',
    year: 2020,
    color: 'Negro',
    vehicleType: 'MOTO',
    vin: 'JS1EXAMPLE00000001',
    chassisNumber: 'JS1EXAMPLE00000001',
    use: 'PARTICULAR',
    department: 'Lima'
  },
  '0000AA': {
    brand: 'Suzuki',
    model: 'GSX-R150 ABS',
    year: 2020,
    color: 'Negro',
    vehicleType: 'MOTO',
    vin: 'JS1EXAMPLE00000001',
    chassisNumber: 'JS1EXAMPLE00000001',
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

  // Format with hyphen if missing: ABC123 -> ABC-123 or 0000AA -> 0000-AA
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
    return { found: true, data: live, offers, mode: 'LIVE_VERIFIK' };
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

const lookupRegisteredCertificates = await registerSoatRegistry(app, database);

app.get('/v1/soat/consulta', async (req, reply) => {
  const query = req.query as { plate?: string; documentNumber?: string };
  const plate = String(query.plate || '').trim().toUpperCase().replace(/\s+/g, '');
  const documentNumber = String(query.documentNumber || '').trim().toUpperCase();
  if (!plate || !/^[A-Z0-9]{6,8}$/.test(plate.replace(/-/g, ''))) {
    return reply.status(400).send({ error: 'INVALID_PLATE', message: 'Ingresa una placa válida.' });
  }

  const normalizedPlate = plate.replace(/-/g, '');
  const registered = documentNumber ? [] : await lookupRegisteredCertificates(normalizedPlate);
  const data = await loadStoredQuotes();
  const matches = data
    .filter(quote => quote.plate.replace(/-/g, '') === normalizedPlate)
    .filter(quote => !documentNumber || quote.documentNumber === documentNumber)
    .filter(quote => ['EMITIDA', 'ANULADA'].includes(quote.status) && quote.policyNumber && !quote.policyNumber.startsWith('SOAT-2026-FALA-'))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const now = new Date();
  const issued = matches.map(quote => {
    const startsAt = new Date(quote.startsAt);
    const expiresAt = new Date(startsAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const selectedOffer = quote.offers?.find(offer => offer.id === quote.selectedOfferId);
    return {
      found: true, plate: quote.plate, policyNumber: quote.policyNumber!,
      insurer: selectedOffer?.name || quote.selectedOfferId || 'Aseguradora registrada',
      status: quote.status === 'ANULADA' ? 'ANULADO' : expiresAt < now ? 'VENCIDO' : startsAt > now ? 'AÚN_NO_VIGENTE' : 'VIGENTE',
      startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString(),
      cancelledAt: null, source: 'INTERNAL_ISSUANCE',
      vehicle: quote.vehicle ? { brand: quote.vehicle.brand, model: quote.vehicle.model, year: quote.vehicle.year } : undefined
    };
  });
  const history = [...registered, ...issued.filter(quote => !registered.some(record =>
    record.policyNumber === quote.policyNumber && record.insurer.toUpperCase() === quote.insurer.toUpperCase()))]
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt));
  const current = history.find(record => record.status === 'VIGENTE') || history[0];
  return reply.header('Cache-Control', 'no-store').send({ data: current
    ? { ...current, history, consultedAt: now.toISOString() }
    : { found: false, status: 'NO_ENCONTRADO', plate }
  });
});

app.get('/v1/quotes/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const data = await loadStoredQuotes();
  const found = data.find((quote) => quote.id === id || quote.code === id);
  if (!found) return reply.status(404).send({ error: 'QUOTE_NOT_FOUND' });
  return { data: found };
});

app.delete('/v1/quotes/:id', async (req, reply) => {
  const { id } = req.params as { id: string };

  if (database) {
    const stored = await database.quote.findFirst({
      where: { OR: [{ id }, { code: id }] },
      select: { id: true, status: true }
    });
    if (stored) {
      if (stored.status === 'ISSUED' || stored.status === 'CANCELLED') {
        return reply.status(409).send({
          error: 'ISSUED_QUOTE_CANNOT_BE_DELETED',
          message: stored.status === 'CANCELLED'
            ? 'Una póliza anulada debe conservarse para auditoría.'
            : 'Un SOAT emitido no se puede eliminar. Debes anularlo.'
        });
      }
      await database.$transaction(async (transaction) => {
        await transaction.order.deleteMany({ where: { quoteId: stored.id } });
        await transaction.quote.delete({ where: { id: stored.id } });
      });
      return reply.status(204).send();
    }
  }

  const index = quotes.findIndex((quote) => quote.id === id || quote.code === id);
  if (index === -1) return reply.status(404).send({ error: 'QUOTE_NOT_FOUND' });
  if (quotes[index].status === 'EMITIDA' || quotes[index].status === 'ANULADA') {
    return reply.status(409).send({
      error: 'ISSUED_QUOTE_CANNOT_BE_DELETED',
      message: quotes[index].status === 'ANULADA'
        ? 'Una póliza anulada debe conservarse para auditoría.'
        : 'Un SOAT emitido no se puede eliminar. Debes anularlo.'
    });
  }
  quotes.splice(index, 1);
  return reply.status(204).send();
});

app.post('/v1/quotes/:id/annul', async (req, reply) => {
  const { id } = req.params as { id: string };

  if (database) {
    const stored = await database.quote.findFirst({
      where: { OR: [{ id }, { code: id }] },
      select: { id: true, status: true }
    });
    if (!stored) return reply.status(404).send({ error: 'QUOTE_NOT_FOUND' });
    if (stored.status === 'CANCELLED') return reply.status(409).send({ error: 'QUOTE_ALREADY_CANCELLED', message: 'La póliza ya está anulada.' });
    if (stored.status !== 'ISSUED') return reply.status(409).send({ error: 'QUOTE_NOT_ISSUED', message: 'Solo se puede anular un SOAT emitido.' });

    await database.$transaction([
      database.quote.update({ where: { id: stored.id }, data: { status: 'CANCELLED' } }),
      database.order.updateMany({ where: { quoteId: stored.id }, data: { status: 'CANCELLED' } })
    ]);
    const data = await loadStoredQuotes();
    return reply.send({ data: data.find((quote) => quote.id === stored.id) });
  }

  const quote = quotes.find((item) => item.id === id || item.code === id);
  if (!quote) return reply.status(404).send({ error: 'QUOTE_NOT_FOUND' });
  if (quote.status === 'ANULADA') return reply.status(409).send({ error: 'QUOTE_ALREADY_CANCELLED', message: 'La póliza ya está anulada.' });
  if (quote.status !== 'EMITIDA') return reply.status(409).send({ error: 'QUOTE_NOT_ISSUED', message: 'Solo se puede anular un SOAT emitido.' });
  quote.status = 'ANULADA';
  return reply.send({ data: quote });
});

// For development testing
if (process.env.NODE_ENV !== 'production') {
  app.delete('/v1/dev/quotes', async (_req, reply) => {
    quotes.splice(0, quotes.length);
    return reply.status(204).send();
  });
}

app.post('/v1/quotes', async (req, reply) => {
  const internal = validAdminKey(req) && ['ADMIN', 'OPERATIONS', 'SALES'].includes(String(req.headers['x-admin-role']));
  if ((req.body as { source?: string })?.source === 'MANUAL' && !internal) return reply.status(403).send({ error: 'FORBIDDEN' });
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
    selectedPrice: internal ? (parsed.data.selectedPrice ?? selectedOffer.price) : selectedOffer.price,
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
          const lastName = parts.slice(1).join(' ');
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
      app.log.error({ err }, 'Error guardando cotización');
      return reply.status(503).send({ error: 'DATABASE_UNAVAILABLE', message: 'No se guardó la cotización. Inténtalo nuevamente.' });
    }
  } else {
    quotes.unshift(quote);
  }
  return reply.status(201).send({ data: quote, offers });
});

app.post('/v1/quotes/:id/emit', async (req, reply) => {
  const parsed = z.object({
    paymentConfirmed: z.literal(true),
    paymentReference: z.string().trim().min(1).max(200),
    holderName: z.string().trim().min(3).max(200),
    selectedOfferId: z.string().trim().min(1),
    realPrice: z.number().positive().max(100000),
    vehicle: z.object({ brand: z.string().trim().min(1), model: z.string().trim().min(1), year: z.number().int().min(1900).max(new Date().getFullYear() + 1), vin: z.string().max(100).optional(), chassisNumber: z.string().max(100).optional(), use: z.string().min(1), department: z.string().min(1) }),
    paymentMethod: z.enum(['CASH', 'INSTALLMENTS']),
    installmentCount: z.number().int().min(2).max(24).optional(),
    installmentAmount: z.number().positive().optional()
  }).superRefine((data, context) => {
    if (data.paymentMethod === 'INSTALLMENTS' && (!data.installmentCount || !data.installmentAmount)) context.addIssue({ code: 'custom', message: 'Completa las cuotas y su monto.' });
  }).safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Completa los datos y la confirmación del pago.', details: parsed.error.flatten() });
  const { id } = req.params as { id: string };
  const data = parsed.data;
  const manualDetails = { paymentMethod: data.paymentMethod, ...(data.paymentMethod === 'INSTALLMENTS' ? { installmentCount: data.installmentCount!, installmentAmount: data.installmentAmount! } : {}) };
  try {
    if (database) {
      await database.$transaction(async tx => {
        const quote = await tx.quote.findFirst({ where: { OR: [{ id }, { code: id }] }, include: { offers: { include: { insurer: true } } } });
        if (!quote) throw new Error('QUOTE_NOT_FOUND');
        const offer = quote.offers.find(item => item.insurer.slug === data.selectedOfferId);
        if (!offer) throw new Error('INVALID_OFFER');
        const claimed = await tx.quote.updateMany({ where: { id: quote.id, status: { notIn: ['ISSUED', 'CANCELLED'] } }, data: { status: 'ISSUED', selectedOfferId: data.selectedOfferId, selectedPrice: data.realPrice, department: data.vehicle.department } });
        if (!claimed.count) throw new Error('QUOTE_CLOSED');
        const [reserved] = await tx.$queryRaw<Array<{ value: string }>>`SELECT nextval('policy_number_seq')::text AS value`;
        const policyNumber = `${reserved.value}-0`;
        const [firstName, ...lastNames] = data.holderName.split(/\s+/);
        const customer = await tx.customer.upsert({ where: { documentType_documentNumber: { documentType: quote.documentType, documentNumber: quote.documentNumber } }, update: { firstName, lastName: lastNames.join(' ') }, create: { documentType: quote.documentType, documentNumber: quote.documentNumber, firstName, lastName: lastNames.join(' '), email: `${quote.documentNumber}@segurosfalabella.pe` } });
        await tx.quote.update({ where: { id: quote.id }, data: { customerId: customer.id } });
        await tx.vehicle.update({ where: { id: quote.vehicleId }, data: data.vehicle });
        await tx.order.create({ data: { code: `VENTA-${crypto.randomUUID()}`, status: 'ISSUED', quoteId: quote.id, offerId: offer.id, amount: data.realPrice, paymentReference: data.paymentReference, policyNumber, manualDetails } });
        await tx.auditLog.create({ data: { action: 'POLICY_ISSUED', entity: 'Quote', entityId: quote.id, ipAddress: req.ip, metadata: { role: String(req.headers['x-admin-role']), policyNumber, paymentReference: data.paymentReference } } });
      });
      const result = (await loadStoredQuotes()).find(quote => quote.id === id || quote.code === id);
      return { data: result };
    }
    const quote = quotes.find(item => item.id === id || item.code === id);
    if (!quote) throw new Error('QUOTE_NOT_FOUND');
    if (quote.status === 'EMITIDA' || quote.status === 'ANULADA') throw new Error('QUOTE_CLOSED');
    if (!quote.offers?.some(offer => offer.id === data.selectedOfferId)) throw new Error('INVALID_OFFER');
    const policyNumber = reserveLocalPolicyNumber();
    Object.assign(quote, { status: 'EMITIDA', emittedAt: new Date().toISOString(), holderName: data.holderName, vehicle: { ...quote.vehicle, ...data.vehicle }, department: data.vehicle.department, selectedOfferId: data.selectedOfferId, selectedPrice: data.realPrice, policyNumber, paymentReference: data.paymentReference, ...manualDetails });
    return { data: quote };
  } catch (error) {
    const code = (error as Error).message;
    if (code === 'QUOTE_NOT_FOUND') return reply.status(404).send({ error: code });
    if (code === 'QUOTE_CLOSED') return reply.status(409).send({ error: code, message: 'La cotización ya fue emitida o anulada.' });
    if (code === 'INVALID_OFFER') return reply.status(400).send({ error: code, message: 'Selecciona una aseguradora de la cotización.' });
    req.log.error(error);
    return reply.status(503).send({ error: 'ISSUANCE_SAVE_FAILED', message: 'No se pudo registrar la emisión. Verifica el estado antes de reintentar.' });
  }
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
    throw err;
  }
}
app.addHook('onClose', async () => {
  await database?.$disconnect().catch(() => {});
});
await app.listen({ port, host: '0.0.0.0' });
