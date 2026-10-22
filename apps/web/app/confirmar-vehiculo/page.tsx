'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getBrandsForType, getModelsForBrand, VehicleType } from '@/lib/vehicleCatalog';

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
  const catalogType = (['AUTO', 'MOTO', 'MOTOTAXI', 'VAN', 'CARGO'].includes(type) ? type : 'AUTO') as VehicleType;
  const [brand, setBrand] = useState(searchParams.get('marca') || '');
  const [model, setModel] = useState(searchParams.get('modelo') || '');
  const [year, setYear] = useState(searchParams.get('ano') || '');
  const [department, setDepartment] = useState(searchParams.get('dep') || 'lima');
  const [use, setUse] = useState(searchParams.get('uso') || 'PARTICULAR');
  const [step, setStep] = useState<1 | 2>(1);
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [mobile, setMobile] = useState('');
  const catalogBrands = getBrandsForType(catalogType);
  // Mantiene visible una marca detectada aunque aún no exista en el catálogo local.
  const availableBrands = brand && !catalogBrands.some((item) => item.toLowerCase() === brand.trim().toLowerCase())
    ? [...catalogBrands, brand].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }))
    : catalogBrands;
  const availableModels = getModelsForBrand(catalogType, brand);

  function continueToResults() {
    if (step === 1) {
      setStep(2);
      return;
    }
    const params = new URLSearchParams({
      placa: plate,
      tipo: type,
      dep: department,
      uso: use,
      marca: brand,
      modelo: model,
      ano: year,
      docType: documentType,
      docNum: documentNumber,
      titular: holderName,
      celular: mobile
    });
    const serie = searchParams.get('serie');
    if (serie) params.set('serie', serie);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('soat-quote', JSON.stringify(Object.fromEntries(params.entries())));
    }
    router.push('/resultados');
  }

  return (
    <main className="vehicle-confirm-page min-h-[calc(100vh-156px)]">
      <section className="vehicle-confirm-shell">
        <div className="vehicle-confirm-progress" aria-label="Progreso de compra">
          <span className="material-symbols-outlined">schedule</span>
          <div className="vehicle-confirm-progress-line"><span style={{ width: step === 1 ? '35%' : '68%' }} /></div>
          <span className="vehicle-confirm-percent">{step === 1 ? '35%' : '68%'}</span>
        </div>
        <p className="vehicle-confirm-progress-copy">COTIZA TU SOAT DIGITAL EN SOLO UNOS MINUTOS.</p>

        <div className="vehicle-confirm-conversation">
          <div className="vehicle-confirm-user-bubble">{plate}</div>
          <span className="vehicle-confirm-time">Ahora</span>
          <div className="vehicle-confirm-agent-row">
            <div className="vehicle-confirm-agent-avatar">SF</div>
            <div>
              <div className="vehicle-confirm-message">{step === 1 ? 'Confirma los datos de tu vehículo para continuar.' : 'Por favor, ingresa tus datos para continuar.'}</div>
              <div className="vehicle-confirm-dots"><span /><span /><span /></div>
            </div>
          </div>
        </div>

        <section className="vehicle-confirm-card" aria-labelledby="vehicle-confirm-title">
          {step === 1 ? (
            <>
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
            <label><span>Marca <small>{availableBrands.length} disponibles</small></span><select value={brand} onChange={(event) => { setBrand(event.target.value); setModel(''); }}><option value="">Selecciona una marca</option>{availableBrands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>Modelo</span>{availableModels.length > 0 ? <select value={model} onChange={(event) => setModel(event.target.value)}><option value="">Selecciona un modelo</option>{availableModels.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Ingresa el modelo" />}</label>
            <div><span>Año de fabricación</span><input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" placeholder="Año" /></div>
            <label><span>Zona de circulación</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="lima">Lima y Callao</option><option value="arequipa">Arequipa</option><option value="la-libertad">La Libertad</option><option value="cusco">Cusco</option><option value="piura">Piura</option><option value="otro">Otro departamento</option></select></label>
            <label><span>Uso del vehículo</span><select value={use} onChange={(event) => setUse(event.target.value)}><option value="PARTICULAR">Particular</option><option value="PUBLICO">Servicio público</option><option value="COMERCIAL">Comercial / carga</option></select></label>
          </div>

          <button type="button" className="vehicle-confirm-primary" onClick={continueToResults}>Sí, los datos son correctos <span className="material-symbols-outlined">arrow_forward</span></button>
          <Link className="vehicle-confirm-secondary" href="/#cotizador">No es mi vehículo</Link>
            </>
          ) : (
            <>
              <div className="vehicle-confirm-card-head">
                <div><span className="vehicle-confirm-kicker">Datos del propietario</span><h1 id="vehicle-confirm-title">Completa tus datos</h1><p>Los usaremos para emitir tu cotización.</p></div>
              </div>
              <div className="vehicle-confirm-details">
                <label><span>Tipo de documento</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="DNI">DNI</option><option value="CE">Carné de extranjería</option><option value="RUC">RUC</option></select></label>
                <label><span>Nro. de documento</span><input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Ej. 45848552" required /></label>
                <label className="vehicle-confirm-full"><span>Nombres y apellidos</span><input value={holderName} onChange={(event) => setHolderName(event.target.value.toUpperCase())} placeholder="Ingresa nombres y apellidos" required /></label>
                <label className="vehicle-confirm-full"><span>Celular</span><input value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, ''))} inputMode="tel" placeholder="Ej. 999 999 999" required /></label>
              </div>
              <button type="button" className="vehicle-confirm-primary" onClick={continueToResults} disabled={!documentNumber || !holderName || !mobile}>¡Listo! <span className="material-symbols-outlined">arrow_forward</span></button>
              <button type="button" className="vehicle-confirm-secondary vehicle-confirm-back" onClick={() => setStep(1)}>Volver a revisar el vehículo</button>
            </>
          )}
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
