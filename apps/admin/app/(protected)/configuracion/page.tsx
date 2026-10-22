'use client';

import { FormEvent, useEffect, useState } from 'react';

type PaymentConfig = {
  yapeEnabled: boolean;
  yapeName: string;
  yapeNumber: string;
  yapeInstructions: string;
  yapeQrUrl: string;
};

const initialConfig: PaymentConfig = {
  yapeEnabled: false,
  yapeName: 'Yape / Plin / Billetera digital',
  yapeNumber: '',
  yapeInstructions: 'Realiza el pago y conserva la constancia para que un asesor valide tu solicitud.',
  yapeQrUrl: ''
};

export default function ConfiguracionPage() {
  const [config, setConfig] = useState(initialConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/backend/v1/payment-config')
      .then((response) => response.json())
      .then((result) => setConfig({ ...initialConfig, ...(result.data || {}) }))
      .catch(() => setMessage('No se pudo cargar la configuración.'))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/backend/v1/admin/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) throw new Error();
      setMessage('Configuración guardada.');
    } catch {
      setMessage('No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="muted">Configuración comercial</p>
          <h1>Canales de pago</h1>
        </div>
      </header>

      <section className="card settings-card">
        <div className="settings-heading">
          <div>
            <h2>Yape y billetera digital</h2>
            <p className="muted">Controla si este medio aparece en el checkout público.</p>
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={config.yapeEnabled} onChange={(event) => setConfig({ ...config, yapeEnabled: event.target.checked })} />
            <span>{config.yapeEnabled ? 'Habilitado' : 'Deshabilitado'}</span>
          </label>
        </div>

        {loading ? <p className="muted">Cargando…</p> : <form onSubmit={save} className="settings-form">
          <label>Nombre visible<input value={config.yapeName} onChange={(event) => setConfig({ ...config, yapeName: event.target.value })} /></label>
          <label>Número o identificador<input value={config.yapeNumber} onChange={(event) => setConfig({ ...config, yapeNumber: event.target.value })} placeholder="Ej. 999 999 999" /></label>
          <label className="settings-full">URL del QR (opcional)<input value={config.yapeQrUrl} onChange={(event) => setConfig({ ...config, yapeQrUrl: event.target.value })} placeholder="https://..." /></label>
          <label className="settings-full">Instrucciones para el cliente<textarea value={config.yapeInstructions} onChange={(event) => setConfig({ ...config, yapeInstructions: event.target.value })} rows={4} /></label>
          <div className="settings-actions">
            <button className="button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            {message && <span className="muted">{message}</span>}
          </div>
        </form>}
      </section>
    </>
  );
}
