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
    <header className="topbar"><div className="brand"><span className="brand-mark">✦</span> La Positiva <small>seguros</small></div><div className="help">¿Necesitas ayuda?</div></header>
    <main>
      <section className="cotizador-shell"><div className="cotizador-card">
      <div className="banner"><picture><source media="(max-width: 767px)" srcSet="/assets/reference/Banner-mobile.png" /><img src="/assets/reference/Banner.png" alt="Cotiza tu SOAT" /></picture></div>
      <form className="quote" onSubmit={submit}>
        <div className="mobile-kicker">¡Qué buena elección!</div><h1>Cotiza tu <strong>SOAT 100% digital</strong></h1><p className="select-title">Selecciona tu vehículo</p>
        <div className="vehicle-grid">
          <button type="button" className={`vehicle ${vehicle === 'auto' ? 'active' : ''}`} onClick={() => setVehicle('auto')}><img src="/assets/reference/soat_auto_desk.svg" alt="" /><strong>Autos, camionetas<br />y “Pick ups”</strong><small>Para uso particular, taxi y carga</small><i>✓</i></button>
          <button type="button" className={`vehicle ${vehicle === 'moto' ? 'active' : ''}`} onClick={() => setVehicle('moto')}><img src="/assets/reference/soat_moto_desk.svg" alt="" /><strong>Motos, mototaxis<br />y trimotos</strong><small>Págalo <b>en cuotas</b> con tu tarjeta</small><i>✓</i></button>
        </div>
        <p className="plate-title">Ingresa tu número de placa</p><div className="plate-wrap"><img src="/assets/reference/icono-placa.svg" alt="" /><input id="plate" className="plate" value={plate} onChange={e => setPlate(e.target.value)} placeholder="X9X999" maxLength={8} required /></div>
        <label className="consent"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />Acepto las <a href="#finalidades">Finalidades Secundarias</a></label>
        <label className="consent"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />Acepto las <a href="#privacidad">Políticas de Privacidad</a></label>
        <button className="primary" disabled={!accepted || loading}>{loading ? 'Consultando…' : 'Vamos por tu SOAT'}</button>
        {error && <div className="error">{error}</div>}
        {result && <div className="result"><h3>¡Encontramos tu vehículo!</h3><p>{result.data?.brand || 'Vehículo registrado'} {result.data?.model || ''}</p><p>Desde <strong>S/ {Math.min(...(result.offers || []).map(o => o.price || 9999), 9999).toFixed(2)}</strong></p></div>}
      </form></div><p className="info">Cotiza y compra un SOAT Digital. Selecciona el tipo de vehículo, ingresa la placa y conoce el precio del SOAT para auto, camioneta, motos y más.</p></section>
    </main>
    <footer className="footer">© {new Date().getFullYear()} Seguros Falabella. Todos los derechos reservados.</footer>
  </>;
}
