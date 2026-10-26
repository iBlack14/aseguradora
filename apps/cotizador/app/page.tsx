'use client';

import { FormEvent, useState } from 'react';

type Vehicle = 'auto' | 'moto';

export default function CotizadorPage() {
  const [vehicle, setVehicle] = useState<Vehicle>('auto');
  const [plate, setPlate] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ data?: { brand?: string; model?: string }; offers?: { price?: number }[] } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setResult(null); setLoading(true);
    try {
      const response = await fetch(`/api/backend/v1/vehicles/${encodeURIComponent(plate.replace(/\s/g, '').toUpperCase())}`);
      const data = await response.json();
      if (!response.ok || !data?.data) throw new Error('No encontramos la información de esta placa.');
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos consultar la placa.'); }
    finally { setLoading(false); }
  }

  return <>
    <header className="topbar"><div className="brand">SEGUROS FALABELLA</div><div className="help">¿Necesitas ayuda? 01 615 4300</div></header>
    <main>
      <section className="hero"><div className="hero-inner"><div><div className="eyebrow">SOAT 100% digital</div><h1>Protege tu vehículo en pocos minutos</h1><p className="subtitle">Cotiza tu SOAT de forma simple, segura y desde cualquier lugar.</p></div><img className="hero-image" src="/assets/reference/soat_auto_desk.svg" alt="Vehículo asegurado" /></div></section>
      <form className="card quote" onSubmit={submit}>
        <h2>Cotiza tu SOAT</h2><p>Selecciona tu vehículo e ingresa el número de placa.</p>
        <div className="vehicle-grid">
          <button type="button" className={`vehicle ${vehicle === 'auto' ? 'active' : ''}`} onClick={() => setVehicle('auto')}><span>🚗</span><strong>Auto, camioneta<br />o pick-up</strong></button>
          <button type="button" className={`vehicle ${vehicle === 'moto' ? 'active' : ''}`} onClick={() => setVehicle('moto')}><span>🏍️</span><strong>Moto, mototaxi<br />o trimoto</strong></button>
        </div>
        <label className="label" htmlFor="plate">Número de placa</label>
        <input id="plate" className="plate" value={plate} onChange={e => setPlate(e.target.value)} placeholder={vehicle === 'auto' ? 'ABC-123' : '0000-AA'} maxLength={8} required />
        <label className="consent"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />Acepto las finalidades secundarias y las políticas de privacidad.</label>
        <button className="primary" disabled={!accepted || loading}>{loading ? 'Consultando…' : 'Vamos por tu SOAT'}</button>
        {error && <div className="error">{error}</div>}
        {result && <div className="result"><h3>¡Encontramos tu vehículo!</h3><p>{result.data?.brand || 'Vehículo registrado'} {result.data?.model || ''}</p><p>Desde <strong>S/ {Math.min(...(result.offers || []).map(o => o.price || 9999), 9999).toFixed(2)}</strong></p></div>}
      </form>
      <section className="benefits"><h2>Beneficios de tu SOAT</h2><div className="benefit-grid"><Benefit image="beneficiosSOAT.svg" title="Protección inmediata" text="Compra online y recibe tu SOAT digital." /><Benefit image="servicio-grua.svg" title="Servicio de grúa" text="Asistencia cuando más la necesitas." /><Benefit image="descuentos-promociones.svg" title="Promociones y descuentos" text="Disfruta beneficios exclusivos." /></div></section>
    </main>
    <footer className="footer">© {new Date().getFullYear()} Seguros Falabella. Todos los derechos reservados.</footer>
  </>;
}

function Benefit({ image, title, text }: { image: string; title: string; text: string }) { return <article className="card benefit"><img src={`/assets/reference/${image}`} alt="" /><h3>{title}</h3><p>{text}</p></article>; }
