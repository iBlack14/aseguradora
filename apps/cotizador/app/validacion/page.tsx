'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Suspense } from 'react';

type VehicleData = { brand?: string; model?: string; year?: number; vin?: string; chassisNumber?: string; vehicleType?: string };

function ValidacionContent() {
  const params = useSearchParams();
  const plate = params.get('plate') || '';
  const vehicle = params.get('vehicle') === 'moto' ? 'moto' : 'auto';
  const displayPlate = vehicle === 'moto' && plate.length > 4 ? `${plate.slice(0, 4)}-${plate.slice(4)}` : vehicle === 'auto' && plate.length > 3 ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
  const [data, setData] = useState<VehicleData>({});
  const [flowStep, setFlowStep] = useState(0);
  const [typing, setTyping] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plate) return;
    fetch(`/api/backend/v1/vehicles/${encodeURIComponent(plate)}`)
      .then(response => response.json())
      .then(json => setData(json?.data || {}))
      .catch(() => setData({}));
  }, [plate]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => { setFlowStep(1); setTyping(true); }, 1100),
      window.setTimeout(() => { setFlowStep(2); setTyping(true); }, 2400),
      window.setTimeout(() => { setFlowStep(3); setTyping(true); }, 3800),
      window.setTimeout(() => { setFlowStep(4); setTyping(false); }, 5200),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (flowStep > 0) window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  }, [flowStep, typing]);

  const fallback = vehicle === 'moto'
    ? { brand: 'Suzuki', model: 'GSX-R150 ABS', year: 2022, vehicleType: 'MOTO' }
    : { brand: 'Toyota', model: 'Yaris', year: 2022, vehicleType: 'AUTO' };
  const vehicleData = { ...fallback, ...data };

  return <main className="validation-page">
    <header className="validation-header"><img src="/assets/reference/lapositiva-logo.png" alt="La Positiva Seguros" /></header>
    <section className="quote-flow standalone-flow" aria-live="polite">
      <div className="flow-progress"><span className="flow-clock">◷</span><div><div className="progress-track"><i /></div><p>COMPRA TU SOAT ELECTRÓNICO EN SOLO UNOS MINUTOS.</p></div><b>5%</b></div>
      <div className="flow-message user-message">{displayPlate}</div>
      <small className="flow-time">Ahora</small>
      {flowStep === 0 && <div className="flow-loading">Estamos consultando los datos de tu vehículo…</div>}
      {flowStep >= 1 && <div className="flow-message bot-message">Dime, ¿es este tu vehículo?</div>}
      {flowStep >= 2 && <div className="flow-message bot-message wide">Por favor revisa los datos y confírmame tu zona de circulación y uso</div>}
      {typing && <div className="typing-bubble"><img src="/assets/reference/img-chat-writing.gif" alt="Escribiendo" /></div>}
      {flowStep >= 3 && <>
        <div className="vehicle-confirm-card"><h3>{vehicleData.brand} {vehicleData.model}</h3><dl>
          <div><dt>PLACA</dt><dd>{displayPlate}</dd></div>
          <div><dt>NRO. DE SERIE</dt><dd>{vehicleData.vin || vehicleData.chassisNumber || '—'}</dd></div>
          <div><dt>CLASE</dt><dd>{vehicleData.vehicleType === 'MOTO' || vehicle === 'moto' ? 'MOTO' : 'AUTO'}</dd></div>
          <div><dt>AÑO DE FABRICACIÓN</dt><dd>{vehicleData.year || '—'}</dd></div>
          <div><dt>ZONA DE CIRCULACIÓN</dt><dd className="select-placeholder">Selecciona zona de circulación⌄</dd></div>
          <div><dt>USO</dt><dd className="select-placeholder">Selecciona uso⌄</dd></div>
        </dl></div>
        {flowStep >= 4 && <div className="confirmation-row"><div className="coach-row"><img className="coach-avatar" src="/assets/reference/cotizador-coach.png" alt="Asesor" /><small>Ahora</small></div><div className="confirmation-actions"><button type="button" className="confirm-vehicle">Sí, los datos son correctos</button><button type="button" className="not-mine">NO ES MÍO</button></div></div>}
      </>}
      <div ref={endRef} />
    </section>
  </main>;
}

export default function ValidacionPage() {
  return <Suspense fallback={<main className="validation-page" aria-busy="true"><section className="quote-flow standalone-flow"><div className="flow-loading">Estamos preparando la validación de tu vehículo…</div></section></main>}><ValidacionContent /></Suspense>;
}
