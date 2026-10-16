import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

type QuoteSource = 'WEB' | 'MANUAL';
type VehicleSnapshot = { brand: string; model: string; year: number; color: string; vin: string; chassisNumber: string };
type OfferDetail = {
  id: string;
  insurer: string;
  name: string;
  plan: string;
  logo: string;
  price: number;
  currency: string;
  badge: string;
  available: boolean;
  requiresManualReview?: boolean;
  extras: string[];
};

type Quote = {
  id: string;
  code: string;
  plate: string;
  vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';
  department: string;
  documentType: string;
  documentNumber: string;
  startsAt: string;
  source: QuoteSource;
  status: 'NUEVA';
  createdAt: string;
  vehicle?: VehicleSnapshot;
  selectedOfferId?: string;
  selectedPrice?: number;
  offers?: OfferDetail[];
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
const demoMode = process.env.DEMO_MODE === 'true' || (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false');
const database = process.env.DATABASE_URL ? new PrismaClient() : null;
if (process.env.NODE_ENV === 'production' && !database) throw new Error('DATABASE_URL is required in production');

type StoredQuote = Prisma.QuoteGetPayload<{ include: { vehicle: true; offers: { include: { insurer: true } } } }>;

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
        chassisNumber: record.vehicle.chassisNumber || 'No informado'
      }
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
    status: 'NUEVA',
    createdAt: record.createdAt.toISOString(),
    vehicle,
    selectedOfferId: record.selectedOfferId || undefined,
    selectedPrice: record.selectedPrice ? Number(record.selectedPrice) : undefined,
    offers
  };
}

async function loadStoredQuotes() {
  if (!database) return quotes;
  const records = await database.quote.findMany({
    include: { vehicle: true, offers: { include: { insurer: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return records.map(storedQuoteToApi);
}

// Base tariffs by vehicle type in Peru (PEN - S/)
const tariffsByVehicle: Record<'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO', Record<string, number>> = {
  AUTO: {
    'la-positiva': 65.0,
    mapfre: 68.0,
    interseguro: 69.9,
    pacifico: 72.0,
    protecta: 62.0
  },
  MOTO: {
    'la-positiva': 165.0,
    mapfre: 180.0,
    interseguro: 175.0,
    pacifico: 195.0,
    protecta: 159.0
  },
  MOTOTAXI: {
    'la-positiva': 120.0,
    mapfre: 135.0,
    interseguro: 128.0,
    pacifico: 142.0,
    protecta: 115.0
  },
  VAN: {
    'la-positiva': 130.0,
    mapfre: 145.0,
    interseguro: 138.0,
    pacifico: 155.0,
    protecta: 125.0
  },
  CARGO: {
    'la-positiva': 210.0,
    mapfre: 235.0,
    interseguro: 225.0,
    pacifico: 250.0,
    protecta: 195.0
  }
};

export function calculateOffers(vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO', _department: string = 'Lima'): OfferDetail[] {
  const prices = tariffsByVehicle[vehicleType] || tariffsByVehicle.AUTO;
  return [
    {
      id: 'la-positiva',
      insurer: 'la-positiva',
      name: 'La Positiva',
      plan: 'SOAT Digital Tradicional',
      logo: 'la-positiva.png',
      price: prices['la-positiva'],
      currency: 'PEN',
      badge: 'Más económico',
      available: true,
      extras: ['Auxilio de batería 24/7', 'Servicio de grúa en ciudad (1 evento)', 'Atención médica legal inmediata']
    },
    {
      id: 'mapfre',
      insurer: 'mapfre',
      name: 'MAPFRE',
      plan: 'SOAT Conectado MAPFRE',
      logo: 'mapfre.png',
      price: prices.mapfre,
      currency: 'PEN',
      badge: 'Más asistencias',
      available: true,
      extras: ['Auxilio mecánico y cerrajería', 'Ambulancia 24 hrs en caso de emergencia', 'Descuentos exclusivos en talleres']
    },
    {
      id: 'interseguro',
      insurer: 'interseguro',
      name: 'Interseguro',
      plan: 'SOAT Digital Express',
      logo: 'interseguro.png',
      price: prices.interseguro,
      currency: 'PEN',
      badge: '100% digital',
      available: true,
      extras: ['Emisión y entrega instantánea por correo', 'Orientación médica telefónica', 'Sincronización MTC inmediata']
    },
    {
      id: 'pacifico',
      insurer: 'pacifico',
      name: 'Pacífico',
      plan: 'SOAT Pacífico Digital Plus',
      logo: 'pacifico.png',
      price: prices.pacifico,
      currency: 'PEN',
      badge: 'Mejor valor',
      available: true,
      extras: ['Red médica preferencial de clínicas', 'Hasta 2 grúas anuales por siniestro', '200 CMR Puntos de bienvenida']
    },
    {
      id: 'protecta',
      insurer: 'protecta',
      name: 'Protecta Security',
      plan: 'SOAT Protecta Flex',
      logo: 'protecta.png',
      price: prices.protecta,
      currency: 'PEN',
      badge: 'Precio preferente',
      available: true,
      extras: ['Asistencia telefónica 24 horas', 'Atención directa ante la SBS', 'Certificado digital verificable']
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
      brand: z.string(),
      model: z.string(),
      year: z.number().int(),
      color: z.string(),
      vin: z.string(),
      chassisNumber: z.string()
    })
    .optional(),
  selectedOfferId: z.string().optional(),
  selectedPrice: z.number().optional(),
  source: z.enum(['WEB', 'MANUAL']).default('WEB')
}).superRefine((input, context) => {
  if (input.documentType === 'DNI' && !/^\d{8}$/.test(input.documentNumber)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['documentNumber'], message: 'El DNI debe tener 8 dígitos.' });
  }
  if (input.documentType === 'RUC' && !/^\d{11}$/.test(input.documentNumber)) {
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
      department: z.string().min(2).default('Lima')
    })
    .safeParse(req.query);
  if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  return { data: calculateOffers(parsed.data.vehicleType, parsed.data.department) };
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
    vehicleType: 'MOTO' | 'AUTO';
    vin: string;
    chassisNumber: string;
  }
> = {
  '1274-UP': {
    brand: 'Suzuki',
    model: 'GSX-R150 ABS',
    year: 2026,
    color: 'Negro',
    vehicleType: 'MOTO',
    vin: '9FSDL23E3TC101115',
    chassisNumber: '9FSDL23E3TC101115'
  },
  '1274UP': {
    brand: 'Suzuki',
    model: 'GSX-R150 ABS',
    year: 2026,
    color: 'Negro',
    vehicleType: 'MOTO',
    vin: '9FSDL23E3TC101115',
    chassisNumber: '9FSDL23E3TC101115'
  },
  'ABC-123': {
    brand: 'Toyota',
    model: 'Corolla 1.8 XEi',
    year: 2023,
    color: 'Gris Oscuro',
    vehicleType: 'AUTO',
    vin: '9BRBL42E9P8123456',
    chassisNumber: '9BRBL42E9P8123456'
  },
  'ABC123': {
    brand: 'Toyota',
    model: 'Corolla 1.8 XEi',
    year: 2023,
    color: 'Gris Oscuro',
    vehicleType: 'AUTO',
    vin: '9BRBL42E9P8123456',
    chassisNumber: '9BRBL42E9P8123456'
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

  if (!demoMode) {
    return reply.status(503).send({
      error: 'VEHICLE_LOOKUP_UNAVAILABLE',
      message: 'No fue posible validar la placa con el proveedor configurado.'
    });
  }

  // 2. Try verified demo vehicles
  const verified = verifiedDemoVehicles[normalized] || verifiedDemoVehicles[normalized.replace(/-/g, '')];
  if (verified) {
    const data = { plate: normalized, ...verified, source: 'PROTOTYPE' as const };
    const offers = calculateOffers(verified.vehicleType, 'Lima');
    return { data, offers, mode: 'DEMO_VERIFIED' };
  }

  // 3. Fallback catalog matching pattern
  const isMoto = /^\d{4}-[A-Z0-9]{2}$/.test(normalized);
  const catalog = isMoto ? motoCatalog : autoCatalog;
  const index = [...normalized].reduce((total, char) => total + char.charCodeAt(0), 0) % catalog.length;
  const item = catalog[index];
  const vehicleType = isMoto ? ('MOTO' as const) : item.vehicleType;
  const data = {
    plate: normalized,
    brand: item.brand,
    model: item.model,
    year: item.year,
    color: item.color,
    vehicleType,
    ...vehicleIdentifiers(normalized),
    source: 'PROTOTYPE' as const
  };
  const offers = calculateOffers(vehicleType, 'Lima');
  return { data, offers, mode: 'DEMO' };
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

  const offers = calculateOffers(parsed.data.vehicleType, parsed.data.department);
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
    documentType: parsed.data.documentType,
    documentNumber: parsed.data.documentNumber,
    startsAt: parsed.data.startsAt.toISOString(),
    vehicle: parsed.data.vehicle,
    selectedOfferId: selectedOffer.id,
    selectedPrice: selectedOffer.price,
    offers,
    source: parsed.data.source,
    status: 'NUEVA',
    createdAt: now.toISOString()
  };

  if (database) {
    await database.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.upsert({
        where: { plate: quote.plate },
        update: {
          type: quote.vehicleType,
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
          use: 'PARTICULAR',
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
  } else {
    quotes.unshift(quote);
  }
  return reply.status(201).send({ data: quote, offers });
});

app.post('/v1/orders', async (_req, reply) =>
  reply.status(501).send({
    error: 'PAYMENT_PROVIDER_NOT_CONNECTED',
    message: 'La emisión real se habilitará al configurar la pasarela y las integraciones de aseguradoras.'
  })
);

const port = Number(process.env.API_PORT || 4000);
if (database) await database.$connect();
app.addHook('onClose', async () => {
  await database?.$disconnect();
});
await app.listen({ port, host: '0.0.0.0' });
