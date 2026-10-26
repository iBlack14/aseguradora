'use client';

import { FormEvent, useState } from 'react';

type Vehicle = 'auto' | 'moto';

const faqs = [
  ['¿Qué es el SOAT y para qué sirve?', 'El Seguro Obligatorio de Accidentes de Tránsito (SOAT) es un seguro obligatorio establecido por ley que tiene como objetivo asegurar la atención, de manera inmediata e incondicional, a las víctimas de accidentes de tránsito en todo el territorio nacional que sufran lesiones corporales y muerte. Puedes cotizar SOAT para tu carro, moto o camión en La Positiva.'],
  ['¿Dónde comprar el SOAT?', 'Puedes cotizar y comprar un SOAT Virtual en La Positiva, donde contamos con diferentes coberturas y beneficios exclusivos. ¡Cotiza y descubre el precio SOAT hoy!.'],
  ['¿Qué no cubre el SOAT Vehicular La Positiva?', 'Estas incluyen accidentes en territorio extranjero, accidentes por competencias vehiculares y accidentes fortuitos por guerra o desastres, entre otros. Conoce más sobre nuestras exclusiones y cobertura en la página de SOAT de La Positiva.'],
  ['¿Cuál es la diferencia entre un SOAT Físico y un SOAT Digital?', 'Ambos SOAT representan el documento que acredita la contratación del Seguro Obligatorio de Accidentes de Tránsito. En el caso del SOAT Virtual o Digital, este se compró y emitió de forma digital.'],
  ['¿Cuál es el precio de SOAT de moto?', 'El precio de SOAT de moto varía según varios factores, como la zona donde está registrada, el tipo de moto, su cilindrada y el historial del asegurado. En La Positiva, puedes cotizar un SOAT desde S/ 180.'],
  ['¿Cuánto tiempo dura el SOAT para moto lineal?', 'El SOAT de moto lineal tiene una vigencia de un año desde la fecha de emisión. Si contrataste la opción de renovación automática, al acercarse la fecha de vencimiento se renueva por otro año inmediato.']
];

export default function CotizadorPage() {
  const [vehicle, setVehicle] = useState<Vehicle>('auto');
  const [plate, setPlate] = useState('');
  const [finalidadesAccepted, setFinalidadesAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ data?: { brand?: string; model?: string }; offers?: { price?: number }[] } | null>(null);
  const [openFaq, setOpenFaq] = useState(0);
  const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const validPlate = cleanPlate.length >= 6;
  const canSubmit = validPlate && finalidadesAccepted && privacyAccepted && !loading;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setResult(null);
    if (!validPlate) { setError('Debes ingresar una placa válida.'); return; }
    if (!privacyAccepted) { setError('Debes aceptar las Políticas de Privacidad.'); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/backend/v1/vehicles/${encodeURIComponent(cleanPlate)}`);
      const data = await response.json();
      if (!response.ok || !data?.data) throw new Error('No encontramos la información de esta placa.');
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos consultar la placa.'); }
    finally { setLoading(false); }
  }

  return <>
    <header className="topbar"><div className="brand"><img src="/assets/reference/lapositiva-logo.png" alt="La Positiva Seguros" /></div></header>
    <main>
      <section className="cotizador-shell"><div className="cotizador-card">
      <div className="banner"><picture><source media="(max-width: 767px)" srcSet="/assets/reference/Banner-mobile.png" /><img src="/assets/reference/Banner.png" alt="Cotiza tu SOAT" /></picture></div>
      <form className="quote" onSubmit={submit}>
        <div className="mobile-kicker">¡Qué buena elección!</div><h1>Cotiza tu <strong>SOAT 100% digital</strong></h1><p className="select-title">Selecciona tu vehículo</p>
        <div className="vehicle-grid">
          <button type="button" className={`vehicle ${vehicle === 'auto' ? 'active' : ''}`} onClick={() => setVehicle('auto')}><img src="/assets/reference/soat_auto_desk.svg" alt="" /><strong>Autos, camionetas<br />y “Pick ups”</strong><small><img className="benefit-icon" src="/assets/reference/ticket-auto.svg" alt="" /> Para uso particular, taxi y carga</small><i>✓</i></button>
          <button type="button" className={`vehicle ${vehicle === 'moto' ? 'active' : ''}`} onClick={() => setVehicle('moto')}><img src="/assets/reference/soat_moto_desk.svg" alt="" /><strong>Motos, mototaxis<br />y trimotos</strong><small><img className="benefit-icon" src="/assets/reference/tarjeta-moto.svg" alt="" /> Págalo <b>en cuotas</b> con tu tarjeta</small><i>✓</i></button>
        </div>
        <p className="plate-title">Ingresa tu número de placa</p><div className={`plate-wrap ${plate && !validPlate ? 'invalid' : ''}`}><img src="/assets/reference/icono-placa.svg" alt="" /><input id="plate" className="plate" value={plate} onChange={e => setPlate(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())} placeholder="X9X999" maxLength={8} required /></div>
        {plate && !validPlate && <div className="field-error">Debes ingresar una placa válida</div>}
        <label className="consent"><input type="checkbox" checked={finalidadesAccepted} onChange={e => setFinalidadesAccepted(e.target.checked)} />Acepto las <a href="#finalidades">Finalidades Secundarias</a></label>
        <label className="consent"><input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} />Acepto las <a href="#privacidad">Políticas de Privacidad</a></label>
        <button className="primary" disabled={!canSubmit}>{loading ? 'Consultando…' : 'Vamos por tu SOAT'}</button>
        {error && <div className="error">{error}</div>}
        {result && <div className="result"><h3>¡Encontramos tu vehículo!</h3><p>{result.data?.brand || 'Vehículo registrado'} {result.data?.model || ''}</p><p>Desde <strong>S/ {Math.min(...(result.offers || []).map(o => o.price || 9999), 9999).toFixed(2)}</strong></p></div>}
      </form></div><p className="info">Cotiza y compra un SOAT Digital en La Positiva. Selecciona el tipo de vehículo, ingresa la placa y conoce el precio del SOAT para auto, camioneta, motos y más.</p></section>
      <section className="faq-section"><div className="faq-title"><span>?</span><h2>Preguntas frecuentes sobre SOAT Vehicular</h2></div><div className="faq-list">{faqs.map(([question, answer], index) => <article className={`faq-item ${openFaq === index ? 'open' : ''}`} key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><b>{openFaq === index ? '−' : '+'}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section>
    </main>
    <footer className="footer">© {new Date().getFullYear()} La Positiva Seguros. Todos los derechos reservados.</footer>
  </>;
}

function Benefit({ image, title, text }: { image: string; title: string; text: string }) { return <article className="benefit"><img src={`/assets/reference/${image}`} alt="" />{title && <h3>{title}</h3>}{text && <p>{text}</p>}{title && title !== 'Promociones y descuentos' && <button type="button">Ver más</button>}</article>; }
