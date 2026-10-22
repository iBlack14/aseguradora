'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const vehicleLabels: Record<string, string> = {
  AUTO: 'Auto / Camioneta',
  MOTO: 'Moto',
  MOTOTAXI: 'Mototaxi',
  VAN: 'Van',
  CARGO: 'Carga / Pesado'
};

function ConfirmarVehiculoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plate = searchParams.get('placa') || '';
  const type = searchParams.get('tipo') || 'AUTO';
  const [brand, setBrand] = useState(searchParams.get('marca') || '');
  const [model, setModel] = useState(searchParams.get('modelo') || '');
  const [year, setYear] = useState(searchParams.get('ano') || '');
  const [department, setDepartment] = useState(searchParams.get('dep') || 'lima');
  const [use, setUse] = useState(searchParams.get('uso') || 'PARTICULAR');

  function continueToResults() {
    const params = new URLSearchParams({
      placa: plate,
      tipo: type,
      dep: department,
      uso: use,
      marca: brand,
      modelo: model,
      ano: year
    });
    const serie = searchParams.get('serie');
    if (serie) params.set('serie', serie);
    router.push(`/resultados?${params.toString()}`);
  }

  return (
    <main className="vehicle-confirm-page min-h-[calc(100vh-156px)]">
      <section className="vehicle-confirm-shell">
        <div className="vehicle-confirm-progress" aria-label="Progreso de compra">
          <span className="material-symbols-outlined">schedule</span>
          <div className="vehicle-confirm-progress-line"><span /></div>
          <span className="vehicle-confirm-percent">5%</span>
        </div>
        <p className="vehicle-confirm-progress-copy">COTIZA TU SOAT DIGITAL EN SOLO UNOS MINUTOS.</p>

        <div className="vehicle-confirm-conversation">
          <div className="vehicle-confirm-user-bubble">{plate}</div>
          <span className="vehicle-confirm-time">Ahora</span>
          <div className="vehicle-confirm-agent-row">
            <div className="vehicle-confirm-agent-avatar">SF</div>
            <div>
              <div className="vehicle-confirm-message">Confirma los datos de tu vehículo para continuar.</div>
              <div className="vehicle-confirm-dots"><span /><span /><span /></div>
            </div>
          </div>
        </div>

        <section className="vehicle-confirm-card" aria-labelledby="vehicle-confirm-title">
          <div className="vehicle-confirm-card-head">
            <div>
              <span className="vehicle-confirm-kicker">Vehículo identificado</span>
              <h1 id="vehicle-confirm-title">{brand || 'Datos del vehículo'}</h1>
              <p>{model || 'Completa la información pendiente'}</p>
            </div>
            <span className="vehicle-confirm-type">{vehicleLabels[type] || type}</span>
          </div>

          <div className="vehicle-confirm-details">
            <div><span>Placa</span><strong>{plate || '—'}</strong></div>
            <div><span>Marca</span><input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Ingresa la marca" /></div>
            <div><span>Modelo</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Ingresa el modelo" /></div>
            <div><span>Año de fabricación</span><input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" placeholder="Año" /></div>
            <label><span>Zona de circulación</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="lima">Lima y Callao</option><option value="arequipa">Arequipa</option><option value="la-libertad">La Libertad</option><option value="cusco">Cusco</option><option value="piura">Piura</option><option value="otro">Otro departamento</option></select></label>
            <label><span>Uso del vehículo</span><select value={use} onChange={(event) => setUse(event.target.value)}><option value="PARTICULAR">Particular</option><option value="PUBLICO">Servicio público</option><option value="COMERCIAL">Comercial / carga</option></select></label>
          </div>

          <button type="button" className="vehicle-confirm-primary" onClick={continueToResults}>Sí, los datos son correctos <span className="material-symbols-outlined">arrow_forward</span></button>
          <Link className="vehicle-confirm-secondary" href="/#cotizador">No es mi vehículo</Link>
        </section>
      </section>
    </main>
  );
}

export default function ConfirmarVehiculoPage() {
  return (
    <Suspense fallback={<main className="vehicle-confirm-page min-h-[calc(100vh-156px)]" />}>
      <ConfirmarVehiculoContent />
    </Suspense>
  );
}
