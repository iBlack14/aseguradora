'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

type Consultation = {
  found: boolean;
  status: 'VIGENTE' | 'VENCIDO' | 'AÚN_NO_VIGENTE' | 'NO_ENCONTRADO';
  plate: string;
  policyNumber?: string;
  insurer?: string;
  vehicle?: { brand?: string; model?: string; year?: number };
  startsAt?: string;
  expiresAt?: string;
};

const statusCopy: Record<Consultation['status'], { title: string; detail: string; tone: string }> = {
  VIGENTE: { title: 'SOAT vigente', detail: 'El certificado se encuentra activo en nuestros registros.', tone: 'border-[#b8d889] bg-[#f3f9e8] text-[#315300]' },
  VENCIDO: { title: 'SOAT vencido', detail: 'El certificado registrado ya no se encuentra vigente.', tone: 'border-[#f0c7bd] bg-[#fff4f1] text-[#8d2817]' },
  AÚN_NO_VIGENTE: { title: 'SOAT aún no vigente', detail: 'La fecha de inicio del certificado todavía no ha llegado.', tone: 'border-[#ead69e] bg-[#fff9e8] text-[#765300]' },
  NO_ENCONTRADO: { title: 'No encontramos un SOAT emitido', detail: 'Verifica la placa ingresada o solicita una nueva cotización.', tone: 'border-[#dce3d5] bg-white text-[#434935]' }
};

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date(value));
}

export default function ConsultarSoatPage() {
  const [plate, setPlate] = useState('');
  const [result, setResult] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ plate: plate.trim().toUpperCase() });
      const response = await fetch(`/api/backend/v1/soat/consulta?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Revisa la placa ingresada.');
      setResult(payload.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible realizar la consulta.');
    } finally {
      setLoading(false);
    }
  }

  const status = result ? statusCopy[result.status] : null;

  return (
    <main className="consult-soat-page min-h-[calc(100vh-156px)] bg-[#f6f8f4]">
      <section className="consult-hero border-b border-[#dce3d5] bg-white">
        <div className="mx-auto grid max-w-[1100px] items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_260px] lg:px-8 lg:py-14">
          <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[#486800]">Consulta pública</p>
          <h1 className="max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-[#161c22] sm:text-5xl">Consulta el estado de tu SOAT</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667085]">Verifica la vigencia de tu certificado en pocos segundos.</p>
          </div>
          <img className="consult-hero-art mx-auto w-full max-w-[230px]" src="/assets/soat-verify.svg" alt="Verificación digital del SOAT" />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1100px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:px-8 lg:py-12">
        <div className="consult-card rounded-2xl border border-[#dce3d5] bg-white p-6 shadow-[0_12px_32px_rgba(48,70,20,.06)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-[#161c22]">Datos de consulta</h2>
            <p className="mt-1 text-sm text-[#667085]">Ingresa la placa para consultar la vigencia.</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <label className="grid gap-2 text-sm font-bold text-[#434935]" htmlFor="consulta-placa">
              Placa del vehículo
              <input id="consulta-placa" value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} required maxLength={9} placeholder="ABC-123" className="h-12 rounded-lg border border-[#cfd8c5] px-3 text-base uppercase outline-none focus:border-[#4e7f00] focus:ring-4 focus:ring-[#8bc500]/20" />
            </label>
            {error && <p className="rounded-lg border border-[#f0c7bd] bg-[#fff4f1] p-3 text-sm text-[#8d2817]">{error}</p>}
            <button type="submit" disabled={loading} className="h-12 rounded-lg bg-[#4e7f00] px-5 font-extrabold text-white transition hover:bg-[#3d6500] disabled:cursor-wait disabled:opacity-60">{loading ? 'Consultando…' : 'Consultar SOAT'}</button>
          </form>
          <p className="mt-5 text-xs leading-5 text-[#667085]">La consulta muestra únicamente información de certificados emitidos por esta plataforma. Para una validación oficial, revisa también los canales del MTC y APESEG.</p>
        </div>

        <div className="consult-result-card rounded-2xl border border-[#dce3d5] bg-[#f9fbf6] p-6 sm:p-8">
          {!result ? (
            <div className="flex h-full min-h-[260px] flex-col justify-center">
              <img className="consult-result-art consult-result-network mb-4 h-auto w-full max-w-[290px]" src="/assets/apeseg-network.png" alt="Red de validación y aseguradoras asociadas" />
              <span className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#709d17]">Validación digital</span>
              <h2 className="text-xl font-extrabold text-[#161c22]">Resultado de la consulta</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#667085]">Ingresa una placa para consultar el estado, la aseguradora y las fechas de vigencia de tu certificado.</p>
            </div>
          ) : (
            <div className="consult-result-body">
              {!result.found && <img className="consult-not-found-art mb-5 h-auto w-[150px]" src="/assets/soat-not-found.svg" alt="No se encontró un SOAT" />}
              <div className={`rounded-xl border p-4 ${status?.tone}`}>
                <p className="text-lg font-extrabold">{status?.title}</p>
                <p className="mt-1 text-sm">{status?.detail}</p>
              </div>
              {result.found && (
                <dl className="mt-6 grid gap-4 text-sm">
                  <div className="flex justify-between gap-4 border-b border-[#dce3d5] pb-3"><dt className="text-[#667085]">Placa</dt><dd className="font-extrabold text-[#161c22]">{result.plate}</dd></div>
                  <div className="flex justify-between gap-4 border-b border-[#dce3d5] pb-3"><dt className="text-[#667085]">Aseguradora</dt><dd className="text-right font-extrabold text-[#161c22]">{result.insurer}</dd></div>
                  <div className="flex justify-between gap-4 border-b border-[#dce3d5] pb-3"><dt className="text-[#667085]">Certificado</dt><dd className="text-right font-extrabold text-[#161c22]">{result.policyNumber}</dd></div>
                  <div className="flex justify-between gap-4 border-b border-[#dce3d5] pb-3"><dt className="text-[#667085]">Inicio de vigencia</dt><dd className="text-right font-semibold text-[#161c22]">{formatDate(result.startsAt)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-[#667085]">Fin de vigencia</dt><dd className="text-right font-semibold text-[#161c22]">{formatDate(result.expiresAt)}</dd></div>
                </dl>
              )}
              {!result.found && <Link href="/#cotizador" className="consult-start-quote mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8bc500] px-5 text-sm font-extrabold text-[#344d00] shadow-[0_8px_18px_rgba(139,197,0,.18)] transition hover:-translate-y-0.5 hover:bg-[#7ab000]">Iniciar una cotización <span className="material-symbols-outlined text-[19px]">arrow_forward</span></Link>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
