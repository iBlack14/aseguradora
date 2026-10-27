'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Vehicle = 'auto' | 'moto';
type VehicleResult = { brand?: string; model?: string; year?: number; vin?: string; chassisNumber?: string; use?: string; department?: string; vehicleType?: string };

function formatPlate(value: string, vehicle: Vehicle) {
  const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  if (vehicle === 'moto' && clean.length > 4) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  if (vehicle === 'auto' && clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return clean;
}

const faqs = [
  ['¿Qué es el SOAT y para qué sirve?', 'El Seguro Obligatorio de Accidentes de Tránsito (SOAT) es un seguro obligatorio establecido por ley que tiene como objetivo asegurar la atención, de manera inmediata e incondicional, a las víctimas de accidentes de tránsito en todo el territorio nacional que sufran lesiones corporales y muerte. Puedes cotizar SOAT para tu carro, moto o camión en La Positiva.'],
  ['¿Dónde comprar el SOAT?', 'Puedes cotizar y comprar un SOAT Virtual en La Positiva, donde contamos con diferentes coberturas y beneficios exclusivos. ¡Cotiza y descubre el precio SOAT hoy!.'],
  ['¿Qué no cubre el SOAT Vehicular La Positiva?', 'Estas incluyen accidentes en territorio extranjero, accidentes por competencias vehiculares y accidentes fortuitos por guerra o desastres, entre otros. Conoce más sobre nuestras exclusiones y cobertura en la página de SOAT de La Positiva.'],
  ['¿Cuál es la diferencia entre un SOAT Físico y un SOAT Digital?', 'Ambos SOAT representan el documento que acredita la contratación del Seguro Obligatorio de Accidentes de Tránsito. En el caso del SOAT Virtual o Digital, este se compró y emitió de forma digital.'],
  ['¿Cuál es el precio de SOAT de moto?', 'El precio de SOAT de moto varía según varios factores, como la zona donde está registrada, el tipo de moto, su cilindrada y el historial del asegurado. En La Positiva, puedes cotizar un SOAT desde S/ 180.'],
  ['¿Cuánto tiempo dura el SOAT para moto lineal?', 'El SOAT de moto lineal tiene una vigencia de un año desde la fecha de emisión. Si contrataste la opción de renovación automática, al acercarse la fecha de vencimiento se renueva por otro año inmediato.']
];

export default function CotizadorPage() {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle>('auto');
  const [plate, setPlate] = useState('');
  const [finalidadesAccepted, setFinalidadesAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ data?: VehicleResult; offers?: { price?: number }[] } | null>(null);
  const [flowStarted, setFlowStarted] = useState(false);
  const flowRef = useRef<HTMLElement>(null);
  const [openFaq, setOpenFaq] = useState(-1);
  const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const validPlate = cleanPlate.length >= 6;
  const canSubmit = validPlate && finalidadesAccepted && privacyAccepted && !loading;

  function changeVehicle(next: Vehicle) {
    setVehicle(next);
    setPlate(formatPlate(plate, next));
  }

  function changePlate(value: string) {
    const raw = value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    const compact = raw.replace(/-/g, '');
    // If the user pastes/types the moto pattern (four characters, hyphen, two
    // characters), keep the vehicle selector synchronized with the input.
    // Moto plates in this flow start with four digits; detect that before the
    // auto formatter inserts the hyphen after the third character.
    const looksLikeMoto = /^\d{4}/.test(compact) || /^[A-Z0-9]{4}-/.test(raw);
    const looksLikeAuto = /^[A-Z]{3}\d/.test(compact);
    const nextVehicle: Vehicle = looksLikeMoto ? 'moto' : looksLikeAuto ? 'auto' : vehicle;
    if (nextVehicle !== vehicle) setVehicle(nextVehicle);
    setPlate(formatPlate(raw, nextVehicle));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setResult(null);
    setFlowStarted(true);
    window.setTimeout(() => flowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    if (!validPlate) { setError('Debes ingresar una placa válida.'); return; }
    if (!privacyAccepted) { setError('Debes aceptar las Políticas de Privacidad.'); return; }
    router.push(`/validacion?plate=${encodeURIComponent(cleanPlate)}&vehicle=${vehicle}`);
  }

  const fallbackVehicle: VehicleResult = vehicle === 'moto'
    ? { brand: 'Suzuki', model: 'GSX-R150 ABS', year: 2022, vehicleType: 'MOTO' }
    : { brand: 'Toyota', model: 'Yaris', year: 2022, vehicleType: 'AUTO' };
  const vehicleData = result?.data || fallbackVehicle;

  return <>
    <header className="topbar"><div className="brand"><img src="/assets/reference/lapositiva-logo.png" alt="La Positiva Seguros" /></div></header>
    <main>
      <section className="cotizador-shell"><div className="cotizador-card">
      <div className="banner"><picture><source media="(max-width: 767px)" srcSet="/assets/reference/Banner-mobile.png" /><img src="/assets/reference/Banner.png" alt="Cotiza tu SOAT" /></picture></div>
      <form className="quote" onSubmit={submit}>
        <div className="mobile-kicker">¡Qué buena elección!</div><h1>Cotiza tu <strong>SOAT 100% digital</strong></h1><p className="select-title">Selecciona tu vehículo</p>
        <div className="vehicle-grid">
          <button type="button" aria-pressed={vehicle === 'auto'} className={`vehicle ${vehicle === 'auto' ? 'active' : ''}`} onClick={() => changeVehicle('auto')}><img src="/assets/reference/soat_auto_desk.svg" alt="" /><strong>Autos, camionetas<br />y “Pick ups”</strong><small><img className="benefit-icon" src="/assets/reference/ticket-auto.svg" alt="" /> Para uso particular, taxi y carga</small><i>✓</i></button>
          <button type="button" aria-pressed={vehicle === 'moto'} className={`vehicle ${vehicle === 'moto' ? 'active' : ''}`} onClick={() => changeVehicle('moto')}><img src="/assets/reference/soat_moto_desk.svg" alt="" /><strong>Motos, mototaxis<br />y trimotos</strong><small><img className="benefit-icon" src="/assets/reference/tarjeta-moto.svg" alt="" /> Págalo <b>en cuotas</b> con tu tarjeta</small><i>✓</i></button>
        </div>
        <p className="plate-title">Ingresa tu número de placa</p><div className={`plate-wrap ${plate && !validPlate ? 'invalid' : ''}`}><img src="/assets/reference/icono-placa.svg" alt="" /><input id="plate" className="plate" value={plate} onChange={e => changePlate(e.target.value)} placeholder={vehicle === 'moto' ? '0000-AA' : 'ABC-123'} maxLength={7} required /></div>
        {plate && !validPlate && <div className="field-error">Debes ingresar una placa válida</div>}
        <label className="consent"><input type="checkbox" checked={finalidadesAccepted} onChange={e => setFinalidadesAccepted(e.target.checked)} />Acepto las <a href="#finalidades">Finalidades Secundarias</a></label>
        <label className="consent"><input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} />Acepto las <a href="#privacidad">Políticas de Privacidad</a></label>
        <button className="primary" disabled={!canSubmit}>{loading ? 'Consultando…' : 'Vamos por tu SOAT'}</button>
        {error && <div className="error">{error}</div>}
        {result && <div className="result"><h3>¡Encontramos tu vehículo!</h3><p>{result.data?.brand || 'Vehículo registrado'} {result.data?.model || ''}</p><p>Desde <strong>S/ {Math.min(...(result.offers || []).map(o => o.price || 9999), 9999).toFixed(2)}</strong></p></div>}
      </form></div><p className="info">Cotiza y compra un SOAT Digital en La Positiva. Selecciona el tipo de vehículo, ingresa la placa y conoce el precio del SOAT para auto, camioneta, motos y más.</p></section>
      {flowStarted && <section className="quote-flow" ref={flowRef} aria-live="polite">
        <div className="flow-progress"><span className="flow-clock">◷</span><div><div className="progress-track"><i /></div><p>COMPRA TU SOAT ELECTRÓNICO EN SOLO UNOS MINUTOS.</p></div><b>5%</b></div>
        <div className="flow-message user-message">{plate}</div>
        <small className="flow-time">Ahora</small>
        {loading ? <div className="flow-loading">Estamos consultando los datos de tu vehículo…</div> : <>
          <div className="flow-message bot-message">Dime, ¿es este tu vehículo?</div>
          <div className="flow-message bot-message wide">Por favor revisa los datos y confírmame tu zona de circulación y uso</div>
          <div className="vehicle-confirm-card"><h3>{vehicleData.brand || 'Vehículo'} {vehicleData.model || ''}</h3><dl><div><dt>PLACA</dt><dd>{plate}</dd></div><div><dt>NRO. DE SERIE</dt><dd>{vehicleData.vin || vehicleData.chassisNumber || '—'}</dd></div><div><dt>CLASE</dt><dd>{vehicleData.vehicleType === 'MOTO' || vehicle === 'moto' ? 'MOTO' : 'AUTO'}</dd></div><div><dt>AÑO DE FABRICACIÓN</dt><dd>{vehicleData.year || '—'}</dd></div><div><dt>ZONA DE CIRCULACIÓN</dt><dd className="select-placeholder">Selecciona zona de circulación⌄</dd></div><div><dt>USO</dt><dd className="select-placeholder">Selecciona uso⌄</dd></div></dl></div>
          <button type="button" className="confirm-vehicle">Sí, los datos son correctos</button>
        </>}
      </section>}
      <section className="faq-section"><div className="faq-title"><span>?</span><h2>Preguntas frecuentes sobre SOAT Vehicular</h2></div><div className="faq-list">{faqs.map(([question, answer], index) => <article className={`faq-item ${openFaq === index ? 'open' : ''}`} key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><b>{openFaq === index ? '−' : '+'}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section>
    </main>
    <footer className="footer">© {new Date().getFullYear()} La Positiva Seguros. Todos los derechos reservados.</footer>
  </>;
}

function Benefit({ image, title, text }: { image: string; title: string; text: string }) { return <article className="benefit"><img src={`/assets/reference/${image}`} alt="" />{title && <h3>{title}</h3>}{text && <p>{text}</p>}{title && title !== 'Promociones y descuentos' && <button type="button">Ver más</button>}</article>; }
