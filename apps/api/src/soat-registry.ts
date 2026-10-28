import type { FastifyInstance } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Ingresa una fecha válida.');
const optionalText = (max = 120) => z.preprocess(value => value === '' || value === undefined ? null : value, z.string().trim().max(max).nullable());
const optionalDate = z.preprocess(value => value === '' || value === undefined ? null : value, date.nullable());
const shape = z.object({
  Placa: z.string().trim().toUpperCase().transform(value => value.replace(/-/g, '')).pipe(z.string().regex(/^[A-Z0-9]{6,8}$/)),
  NombreCompania: z.string().trim().min(2).max(100).transform(value => value.replace(/\s+/g, ' ').toUpperCase()),
  NumeroPoliza: z.string().trim().min(1).max(100),
  FechaInicio: date,
  FechaFin: date,
  Estado: z.enum(['VIGENTE', 'VENCIDO', 'ANULADO', 'AUN_NO_VIGENTE']),
  NombreUsoVehiculo: z.string().trim().min(2).max(80),
  NombreClaseVehiculo: z.string().trim().min(2).max(80),
  TipoCertificado: z.enum(['DIGITAL', 'FISICO']),
  CodigoUnicoPoliza: optionalText(), CodigoSBSAseguradora: optionalText(20),
  FechaControlPolicial: optionalDate, NombreContratante: optionalText(200),
  NombreUbigeo: optionalText(150), NumeroSerieMotor: optionalText(),
  NumeroSerieChasis: optionalText(), NumeroAseguradora: optionalText(40),
  FechaCreacion: z.preprocess(value => value === '' || value === undefined ? null : value,
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine(value =>
      date.safeParse(value.slice(0, 10)).success && Number(value.slice(11, 13)) < 24 && Number(value.slice(14)) < 60).nullable()),
  FechaAnulacion: optionalDate,
  NumeroAsientos: z.preprocess(value => value === '' || value === undefined ? null : value, z.number().int().min(1).max(100).nullable()),
  ModeloVehiculo: optionalText(), Marca: optionalText(80)
}).strict();
const input = shape.superRefine((data, context) => {
  if (data.FechaFin <= data.FechaInicio) context.addIssue({ code: 'custom', path: ['FechaFin'], message: 'El fin de vigencia debe ser posterior al inicio.' });
  if (data.Estado === 'ANULADO' && !data.FechaAnulacion) context.addIssue({ code: 'custom', path: ['FechaAnulacion'], message: 'Indica la fecha de anulación.' });
  if (data.Estado !== 'ANULADO' && data.FechaAnulacion) context.addIssue({ code: 'custom', path: ['FechaAnulacion'], message: 'Selecciona el estado Anulado para registrar esta fecha.' });
});
type Input = z.infer<typeof input>;
type Record = Omit<Input, 'Estado' | 'TipoCertificado'> & { Estado: string; TipoCertificado: string; id: string; createdAt: string | Date; updatedAt: string | Date };

function present(record: Record) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const Estado = record.Estado === 'ANULADO' ? 'ANULADO' : record.FechaInicio > today ? 'AUN_NO_VIGENTE' : record.FechaFin < today ? 'VENCIDO' : 'VIGENTE';
  return { ...record, Estado, source: 'INTERNAL_REGISTER' as const };
}

export async function registerSoatRegistry(app: FastifyInstance, database: PrismaClient | null) {
  // Durable local storage for development; production requires PostgreSQL in server.ts.
  const file = path.resolve(process.cwd(), '.local-data', 'soat-certificates.json');
  let records: Record[] = [];
  if (!database) {
    try {
      records = z.array(shape.extend({ id: z.string(), createdAt: z.string(), updatedAt: z.string() })).parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  let queue = Promise.resolve();
  async function writeLocal(data: Input, id?: string): Promise<Record> {
    const operation = queue.then(async () => {
      const existing = id ? records.find(record => record.id === id) : undefined;
      if (id && !existing) throw new Error('NOT_FOUND');
      if (records.some(record => record.id !== id && record.Placa === data.Placa && record.NumeroPoliza === data.NumeroPoliza && record.NombreCompania.toLowerCase() === data.NombreCompania.toLowerCase())) throw new Error('DUPLICATE');
      const now = new Date().toISOString();
      const record = { ...data, id: existing?.id || randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now };
      const next = [record, ...records.filter(item => item.id !== id)];
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
      records = next;
      return record;
    });
    queue = operation.then(() => {}, () => {});
    return operation;
  }

  app.get('/v1/soat-registry', async (request, reply) => {
    const parsed = z.object({ plate: z.string().max(9).regex(/^[a-zA-Z0-9-]*$/).default('') }).safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR' });
    const plate = parsed.data.plate.replace(/-/g, '').toUpperCase();
    const where = plate ? { Placa: { contains: plate } } : {};
    const data = database
      ? await database.soatCertificate.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 })
      : records.filter(record => record.Placa.includes(plate)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 100);
    const total = database ? await database.soatCertificate.count({ where }) : records.filter(record => record.Placa.includes(plate)).length;
    return { data: data.map(present), total, storage: database ? 'DATABASE' : 'LOCAL_FILE' };
  });

  for (const method of ['POST', 'PUT'] as const) {
    app.route({ method, url: method === 'POST' ? '/v1/soat-registry' : '/v1/soat-registry/:id', handler: async (request, reply) => {
      const parsed = input.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      const id = method === 'PUT' ? (request.params as { id: string }).id : undefined;
      try {
        const record = database ? await database.$transaction(async transaction => {
          const result = id
            ? await transaction.soatCertificate.update({ where: { id }, data: parsed.data })
            : await transaction.soatCertificate.create({ data: parsed.data });
          await transaction.auditLog.create({ data: { action: id ? 'SOAT_CERTIFICATE_UPDATED' : 'SOAT_CERTIFICATE_CREATED', entity: 'SoatCertificate', entityId: result.id, ipAddress: request.ip, metadata: { role: String(request.headers['x-admin-role']) } } });
          return result;
        }) : await writeLocal(parsed.data, id);
        return reply.status(id ? 200 : 201).send({ data: present(record) });
      } catch (error) {
        const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : (error as Error).message;
        if (code === 'P2002' || code === 'DUPLICATE') return reply.status(409).send({ error: 'CERTIFICATE_ALREADY_EXISTS', message: 'Ya existe esa póliza para la placa y aseguradora.' });
        if (code === 'P2025' || code === 'NOT_FOUND') return reply.status(404).send({ error: 'CERTIFICATE_NOT_FOUND' });
        throw error;
      }
    } });
  }
}
