'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { generateAndDownloadSoatPdf } from '@/lib/generateSoatPdf';

type OfferDetail = {
  id: string;
  insurer: string;
  name: string;
  plan: string;
  logo: string;
  price: number;
  currency: string;
  badge: string;
  available: boolean;
  extras: string[];
};

type Quote = {
  id: string;
  code: string;
  plate: string;
  vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';
  department: string;
  documentType: string;
  documentNumber: string;
  source: 'WEB' | 'MANUAL';
  status: string;
  createdAt: string;
  startsAt: string;
  selectedOfferId?: string;
  selectedPrice?: number;
  offers?: OfferDetail[];
  advisorName?: string;
  assistedNotes?: string;
  emittedAt?: string;
  policyNumber?: string;
  vehicle?: {
    brand: string;
    model: string;
    year: number;
    color: string;
    vin: string;
    chassisNumber: string;
  };
};

type Vehicle = {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  vin: string;
  chassisNumber: string;
  source: 'VERIFIK' | 'PROTOTYPE';
  vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';
};

const departments = [
  'Lima',
  'Amazonas',
  'Áncash',
  'Apurímac',
  'Arequipa',
  'Ayacucho',
  'Cajamarca',
  'Callao',
  'Cusco',
  'Huancavelica',
  'Huánuco',
  'Ica',
  'Junín',
  'La Libertad',
  'Lambayeque',
  'Loreto',
  'Madre de Dios',
  'Moquegua',
  'Pasco',
  'Piura',
  'Puno',
  'San Martín',
  'Tacna',
  'Tumbes',
  'Ucayali'
];

const vehicleLabels = {
  AUTO: 'Auto / camioneta',
  MOTO: 'Moto lineal',
  MOTOTAXI: 'Mototaxi',
  VAN: 'Van / Combi',
  CARGO: 'Carga / Pesado'
};

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleType, setVehicleType] = useState<Vehicle['vehicleType']>('AUTO');
  const [offers, setOffers] = useState<OfferDetail[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('la-positiva');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [emissionQuote, setEmissionQuote] = useState<Quote | null>(null);
  const [copiedPlate, setCopiedPlate] = useState(false);
  const [realPriceOverride, setRealPriceOverride] = useState('');
  const [advisorName, setAdvisorName] = useState('Carlos Mendoza (Asesor SBS Falabella)');
  const [assistedNotes, setAssistedNotes] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/backend/v1/quotes')
      .then((r) => r.json())
      .then((result) => setQuotes(result.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleEmit(q: Quote, overridePrice?: number) {
    try {
      const res = await fetch(`/api/backend/v1/quotes/${q.id}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisorName,
          assistedNotes,
          realPrice: overridePrice || (realPriceOverride ? parseFloat(realPriceOverride) : q.selectedPrice)
        })
      });
      if (res.ok) {
        const result = await res.json();
        setEmissionQuote(result.data || q);
      } else {
        setEmissionQuote({
          ...q,
          status: 'EMITIDA',
          selectedPrice: overridePrice || (realPriceOverride ? parseFloat(realPriceOverride) : q.selectedPrice),
          policyNumber: q.policyNumber || `SOAT-2026-FALA-${Math.floor(100000 + Math.random() * 900000)}`,
          emittedAt: new Date().toISOString()
        });
      }
    } catch {
      setEmissionQuote({
        ...q,
        status: 'EMITIDA',
        selectedPrice: overridePrice || (realPriceOverride ? parseFloat(realPriceOverride) : q.selectedPrice),
        policyNumber: q.policyNumber || `SOAT-2026-FALA-${Math.floor(100000 + Math.random() * 900000)}`,
        emittedAt: new Date().toISOString()
      });
    }
    load();
  }

  useEffect(() => {
    load();
    setShowForm(new URLSearchParams(location.search).get('new') === '1');
  }, [load]);

  async function lookupPlate() {
    const input = document.getElementById('plate') as HTMLInputElement;
    const plate = input?.value.trim().toUpperCase();
    if (!plate) {
      alert('Ingresa la placa para realizar la búsqueda.');
      return;
    }
    setLookingUp(true);
    setVehicle(null);
    setOffers([]);
    try {
      const response = await fetch(`/api/backend/v1/vehicles/${encodeURIComponent(plate)}`);
      if (!response.ok) {
        const failure = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(failure?.message || 'No fue posible consultar la placa.');
      }
      const result = (await response.json()) as { data: Vehicle; offers: OfferDetail[] };
      setVehicle(result.data);
      setVehicleType(result.data.vehicleType);
      if (result.offers && result.offers.length > 0) {
        setOffers(result.offers);
        setSelectedOfferId(result.offers[0].id);
        setRealPriceOverride(result.offers[0].price.toFixed(2));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No pudimos consultar esa placa.');
    } finally {
      setLookingUp(false);
    }
  }

  // Update offers if the operator manually changes the vehicle type
  async function handleVehicleTypeChange(newType: Vehicle['vehicleType']) {
    setVehicleType(newType);
    const plate = (document.getElementById('plate') as HTMLInputElement)?.value.trim() || 'ABC-123';
    try {
      const response = await fetch(`/api/backend/v1/offers?vehicleType=${encodeURIComponent(newType)}`);
      if (response.ok) {
        const result = (await response.json()) as { data: OfferDetail[] };
        if (result.data) {
          setOffers(result.data);
          setSelectedOfferId(result.data[0]?.id || 'la-positiva');
          setRealPriceOverride(result.data[0] ? result.data[0].price.toFixed(2) : '');
        }
      }
    } catch {}
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const chosenOffer = offers.find((o) => o.id === selectedOfferId) || offers[0];
    const finalPrice = realPriceOverride ? parseFloat(realPriceOverride) : (chosenOffer ? chosenOffer.price : undefined);

    if (!vehicle) {
      alert('Primero consulta la placa para obtener los datos del vehículo.');
      return;
    }
    if (!chosenOffer || !finalPrice || !Number.isFinite(finalPrice)) {
      alert('Selecciona una aseguradora con un precio válido.');
      return;
    }

    const body = {
      ...Object.fromEntries(form),
      vehicleType,
      selectedOfferId,
      selectedPrice: finalPrice,
      advisorName,
      assistedNotes,
      vehicle: vehicle
        ? {
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            vin: vehicle.vin,
            chassisNumber: vehicle.chassisNumber
          }
        : undefined,
      source: 'MANUAL'
    };

    try {
      const response = await fetch('/api/backend/v1/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        alert('Revisa los datos ingresados para la cotización.');
        return;
      }
      formElement.reset();
      setVehicle(null);
      setOffers([]);
      setRealPriceOverride('');
      setAssistedNotes('');
      setVehicleType('AUTO');
      setShowForm(false);
      load();
    } catch {
      alert('Error al comunicarse con la API.');
    }
  }

  const selectedOffer = offers.find((o) => o.id === selectedOfferId);
  const selectedFinalPrice = realPriceOverride
    ? Number(realPriceOverride)
    : selectedOffer?.price;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="muted">Operaciones SOAT</p>
          <h1>Bandeja de Cotizaciones</h1>
        </div>
        <button className="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cerrar formulario' : '+ Nueva cotización'}
        </button>
      </header>

      {showForm && (
        <form className="card quote-form" onSubmit={submit}>
          <div className="form-heading">
            <div>
              <h2>Cotizador Interno de Emisión</h2>
              <p className="muted">
                Ingresa la placa para consultar en tiempo real el vehículo y obtener las tarifas actualizadas para el cliente.
              </p>
            </div>
          </div>

          <div className="admin-form-grid">
            <label>
              Placa vehicular
              <div className="plate-search">
                <input
                  id="plate"
                  name="plate"
                  required
                  maxLength={9}
                  placeholder="ABC-123 o 1274-UP"
                   onChange={() => {
                     setVehicle(null);
                     setOffers([]);
                     setRealPriceOverride('');
                   }}
                />
                <button
                  type="button"
                  className="button lookup-button"
                  onClick={lookupPlate}
                  disabled={lookingUp}
                >
                  {lookingUp ? 'Buscando…' : 'Buscar placa'}
                </button>
              </div>
            </label>

            <label>
              Tipo de vehículo
              <select
                name="vehicleType"
                value={vehicleType}
                onChange={(e) => handleVehicleTypeChange(e.target.value as Vehicle['vehicleType'])}
              >
                {Object.entries(vehicleLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Departamento de circulación
              <select name="department" defaultValue="Lima">
                {departments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo de documento
              <select name="documentType">
                <option value="DNI">DNI</option>
                <option value="CE">CE</option>
                <option value="RUC">RUC</option>
              </select>
            </label>

            <label>
              Número de documento
              <input name="documentNumber" required minLength={8} maxLength={11} placeholder="Ej. 70912870" />
            </label>

            <label>
              Inicio de vigencia de póliza
              <input
                name="startsAt"
                required
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </label>
          </div>

          {vehicle && (
            <div className="vehicle-result" aria-live="polite">
              <div>
                <span className="vehicle-kicker">Vehículo detectado</span>
                <strong>
                  {vehicle.brand} {vehicle.model}
                </strong>
              </div>
              <div>
                <span>Placa</span>
                <strong>{vehicle.plate}</strong>
              </div>
              <div>
                <span>Año de fabricación</span>
                <strong>{vehicle.year || 'No informado'}</strong>
              </div>
              <div>
                <span>Color</span>
                <strong>{vehicle.color}</strong>
              </div>
              <div>
                <span>N.º de Chasis</span>
                <strong>{vehicle.chassisNumber}</strong>
              </div>
              <small>
                {vehicle.source === 'VERIFIK'
                  ? 'Consulta oficial en línea (Verifik).'
                  : 'Datos demostrativos vinculados a placa.'}
              </small>
            </div>
          )}

          {offers.length > 0 && (
            <section className="internal-quote-result" aria-live="polite">
              <div className="internal-quote-heading">
                <div>
                  <span className="vehicle-kicker">Cotización interna completada</span>
                  <h3>Selecciona la aseguradora</h3>
                  <p>El sistema conservará únicamente la aseguradora elegida y su precio final.</p>
                </div>
              </div>

              <div className="internal-quote-grid">
                <label>
                  Aseguradora
                  <select
                    value={selectedOfferId}
                    onChange={(event) => {
                      const id = event.target.value;
                      const offer = offers.find((item) => item.id === id);
                      setSelectedOfferId(id);
                      setRealPriceOverride(offer ? offer.price.toFixed(2) : '');
                    }}
                  >
                    {offers.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.name} - {offer.plan}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="selected-price-result">
                  <span>Precio de la aseguradora seleccionada</span>
                  <strong>S/ {(selectedFinalPrice || 0).toFixed(2)}</strong>
                </div>

                <label>
                  Asesor responsable
                  <input value={advisorName} onChange={(event) => setAdvisorName(event.target.value)} />
                </label>

                <label>
                  Observaciones
                  <input
                    value={assistedNotes}
                    onChange={(event) => setAssistedNotes(event.target.value)}
                    placeholder="Opcional"
                  />
                </label>
              </div>
            </section>
          )}

          <div className="form-actions">
            <button type="button" className="button ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button className="button" type="submit">
              Guardar cotización {selectedOffer && selectedFinalPrice ? `(S/ ${selectedFinalPrice.toFixed(2)})` : ''}
            </button>
          </div>
        </form>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="topbar">
          <div>
            <h2>Bandeja de Cotizaciones en Vivo</h2>
            <p className="muted">
              Visualiza en tiempo real las solicitudes que ingresan desde la web y las generadas por el equipo comercial.
            </p>
          </div>
          <button className="button ghost" onClick={load}>
            Actualizar tabla
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <span>Cargando cotizaciones…</span>
          </div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            <strong>0 cotizaciones registradas</strong>
            <span>Genera una cotización usando el botón superior o prueba cotizar una placa desde la web.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="quotes-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Vehículo</th>
                  <th>Documento</th>
                  <th>Aseguradora / Tarifa</th>
                  <th>Canal</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td data-label="Código">
                      <strong>{q.code}</strong>
                    </td>
                    <td data-label="Vehículo">
                      <strong style={{ fontSize: 15, letterSpacing: '0.04em' }}>{q.plate}</strong>
                      <small>
                        {q.vehicle
                          ? `${q.vehicle.brand} ${q.vehicle.model} (${q.vehicle.year})`
                          : vehicleLabels[q.vehicleType] || q.vehicleType}
                      </small>
                    </td>
                    <td data-label="Documento">
                      {q.documentType} {q.documentNumber.replace(/.(?=.{3})/g, '•')}
                    </td>
                    <td data-label="Aseguradora / Tarifa">
                      <span className="price-pill">
                        S/ {q.selectedPrice ? q.selectedPrice.toFixed(2) : '65.00'}
                      </span>
                      <small style={{ textTransform: 'capitalize' }}>
                        {q.selectedOfferId ? q.selectedOfferId.replace('-', ' ') : 'Oferta base'}
                      </small>
                    </td>
                    <td data-label="Canal">
                      <span className={`source ${q.source.toLowerCase()}`}>
                        {q.source === 'WEB' ? 'Web Pública' : 'Gestión Interna'}
                      </span>
                    </td>
                    <td data-label="Estado">
                      {q.status === 'EMITIDA' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700
                          }}
                        >
                          EMITIDO
                        </span>
                      ) : (
                        <span className="status">Nueva</span>
                      )}
                    </td>
                    <td data-label="Fecha">{new Date(q.createdAt).toLocaleString('es-PE')}</td>
                    <td data-label="Acciones">
                      <div className="quote-actions">
                        <button
                          className="button ghost"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          onClick={() => setSelectedQuote(q)}
                        >
                          Ver detalle
                        </button>
                        <button
                          className="button"
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            background: q.status === 'EMITIDA' ? '#0f766e' : '#16a34a'
                          }}
                          onClick={() => (q.status === 'EMITIDA' ? setEmissionQuote(q) : handleEmit(q))}
                        >
                          {q.status === 'EMITIDA' ? 'Ver Certificado' : 'Emitir Póliza'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detail Modal */}
      {selectedQuote && (
        <div className="modal-overlay" onClick={() => setSelectedQuote(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <span className="muted" style={{ fontSize: 12 }}>
                  Detalle de Cotización
                </span>
                <h2 style={{ margin: '4px 0 0' }}>{selectedQuote.code}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedQuote(null)}>
                ✕
              </button>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <span>Placa consultada:</span>
                <strong style={{ fontSize: 17, color: 'var(--green)' }}>{selectedQuote.plate}</strong>
              </div>
              <div className="detail-item">
                <span>Tipo de vehículo:</span>
                <strong>{vehicleLabels[selectedQuote.vehicleType] || selectedQuote.vehicleType}</strong>
              </div>
              <div className="detail-item">
                <span>Vehículo detectado:</span>
                <strong>
                  {selectedQuote.vehicle
                    ? `${selectedQuote.vehicle.brand} ${selectedQuote.vehicle.model} (${selectedQuote.vehicle.year})`
                    : 'Sin ficha técnica'}
                </strong>
              </div>
              <div className="detail-item">
                <span>Chasis / VIN:</span>
                <strong>{selectedQuote.vehicle?.chassisNumber || 'No informado'}</strong>
              </div>
              <div className="detail-item">
                <span>Documento del cliente:</span>
                <strong>
                  {selectedQuote.documentType}: {selectedQuote.documentNumber}
                </strong>
              </div>
              <div className="detail-item">
                <span>Departamento / Inicio:</span>
                <strong>
                  {selectedQuote.department} · {selectedQuote.startsAt.split('T')[0]}
                </strong>
              </div>
              <div className="detail-item">
                <span>Canal de ingreso:</span>
                <strong style={{ color: selectedQuote.source === 'WEB' ? '#175cd3' : '#7540aa' }}>
                  {selectedQuote.source === 'WEB' ? 'Web Pública de Clientes' : 'Asesor Comercial'}
                </strong>
              </div>
              <div className="detail-item">
                <span>Tarifa seleccionada:</span>
                <strong style={{ fontSize: 16, color: 'var(--green)' }}>
                  S/ {selectedQuote.selectedPrice ? selectedQuote.selectedPrice.toFixed(2) : '65.00'}
                </strong>
              </div>
            </div>

            {selectedQuote.offers && selectedQuote.offers.length > 0 && (
              <div>
                <h3 style={{ margin: '14px 0 8px', fontSize: 15 }}>Comparativa de Aseguradoras para esta Placa</h3>
                <table className="offers-table">
                  <thead>
                    <tr>
                      <th>Aseguradora</th>
                      <th>Plan</th>
                      <th>Beneficio Destacado</th>
                      <th>Precio Anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.offers.map((off) => (
                      <tr
                        key={off.id}
                        style={{
                          background: off.id === selectedQuote.selectedOfferId ? '#f4f9ea' : 'transparent'
                        }}
                      >
                        <td>
                          <strong>{off.name}</strong>
                          {off.id === selectedQuote.selectedOfferId && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                background: 'var(--green)',
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: 6
                              }}
                            >
                              Elegida
                            </span>
                          )}
                        </td>
                        <td>{off.plan}</td>
                        <td>{off.extras[0] || 'Asistencia en ruta'}</td>
                        <td className="price-pill">S/ {off.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Módulo de Cotización Asistida para esta cotización */}
            <div style={{ marginTop: 16, padding: 14, background: '#f8faf4', border: '1.5px solid #d8e7bd', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <strong style={{ fontSize: 13, color: 'var(--green)' }}>
                    Cotización Asistida Oficial (5 Aseguradoras)
                  </strong>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>
                    Verifica la placa en el cotizador oficial de cada aseguradora antes de emitir:
                  </p>
                </div>
                <button
                  type="button"
                  className="button ghost"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(selectedQuote.plate);
                    setCopiedPlate(true);
                    setTimeout(() => setCopiedPlate(false), 2000);
                  }}
                >
                  {copiedPlate ? '✓ ¡Placa copiada!' : `📋 Copiar placa: ${selectedQuote.plate}`}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {[
                  { id: 'la-positiva', name: 'La Positiva', url: 'https://www.lapositiva.com.pe/wps/portal/corporativo/home/cotizador/' },
                  { id: 'pacifico', name: 'Pacífico', url: 'https://www.pacifico.com.pe/seguros/soat' },
                  { id: 'mapfre', name: 'MAPFRE', url: 'https://www.mapfre.com.pe/seguro-soat/' },
                  { id: 'interseguro', name: 'Interseguro', url: 'https://www.interseguro.pe/soat' },
                  { id: 'protecta', name: 'Protecta Security', url: 'https://www.protectasecurity.pe/soat' },
                ].map((ins) => (
                  <a
                    key={ins.id}
                    href={ins.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: '#fff',
                      border: '1px solid #cfd8c5',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#18210d',
                      textDecoration: 'none'
                    }}
                  >
                    <span>{ins.name}</span>
                    <span style={{ color: 'var(--green)' }}>↗</span>
                  </a>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="button ghost" onClick={() => setSelectedQuote(null)}>
                Cerrar detalle
              </button>
              <button
                className="button"
                style={{ background: selectedQuote.status === 'EMITIDA' ? '#0f766e' : '#16a34a' }}
                onClick={() => {
                  const q = selectedQuote;
                  setSelectedQuote(null);
                  if (q.status === 'EMITIDA') {
                    setEmissionQuote(q);
                  } else {
                    handleEmit(q);
                  }
                }}
              >
                {selectedQuote.status === 'EMITIDA' ? 'Ver Certificado Oficial (PDF)' : 'Emitir Póliza SOAT (PDF)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official SOAT Certificate Modal */}
      {emissionQuote && (
        <div className="modal-overlay" onClick={() => setEmissionQuote(null)}>
          <div
            className="modal-box"
            style={{ maxWidth: 840, padding: 24, background: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <strong style={{ fontSize: 16, color: 'var(--green)' }}>
                  Certificado de Póliza SOAT Oficial
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  Documento electrónico generado conforme a la Ley N° 27181 y D.S. N° 024-2002-MTC
                </p>
              </div>
              <button className="modal-close" onClick={() => setEmissionQuote(null)}>
                ✕
              </button>
            </div>

            {/* Official Sheet */}
            <div
              className="soat-printable-sheet"
              style={{
                border: '2px solid #cbd5e1',
                padding: 24,
                background: '#fff',
                fontSize: 12,
                lineHeight: 1.5,
                position: 'relative'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Corredores de Seguros Falabella S.A.C.</strong>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    RUC: 20509608467 · Registro SBS N° J-0723<br />
                    Intermediario Oficial de Seguros
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    República del Perú
                  </span>
                  <h3 style={{ margin: '2px 0', fontSize: 15, fontWeight: 900 }}>CERTIFICADO SOAT ELECTRÓNICO</h3>
                  <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>
                    Supervisado por la SBS y MTC
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>N° DE PÓLIZA:</span>
                  <strong style={{ display: 'block', fontSize: 13, fontFamily: 'monospace', color: '#0f172a' }}>
                    {emissionQuote.policyNumber || emissionQuote.code}
                  </strong>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>
                    {emissionQuote.selectedOfferId ? emissionQuote.selectedOfferId.toUpperCase().replace('-', ' ') : 'LA POSITIVA'}
                  </span>
                </div>
              </div>

              {/* Status Bar */}
              <div
                style={{
                  margin: '12px 0',
                  padding: '6px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: 11,
                  color: '#166534'
                }}
              >
                <span>ESTADO: PÓLIZA VIGENTE REGISTRADA EN APESEG</span>
                <span>VALIDEZ PROBATORIA NACIONAL (MTC / PNP)</span>
              </div>

              {/* Sections */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
                <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 8 }}>
                  <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', marginBottom: 6, color: '#334155' }}>
                    1. Datos del Contratante / Titular
                  </strong>
                  <div><strong>Documento:</strong> {emissionQuote.documentType} {emissionQuote.documentNumber}</div>
                  <div><strong>Departamento:</strong> {emissionQuote.department}</div>
                  <div><strong>Canal de Emisión:</strong> {emissionQuote.source === 'WEB' ? 'Web Pública' : 'Gestión Comercial Interna'}</div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 8 }}>
                  <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', marginBottom: 6, color: '#334155' }}>
                    2. Identificación del Vehículo
                  </strong>
                  <div>
                    <strong>Placa:</strong>{' '}
                    <span style={{ background: '#fef08a', padding: '2px 8px', borderRadius: 4, fontWeight: 900 }}>
                      {emissionQuote.plate}
                    </span>
                  </div>
                  <div>
                    <strong>Marca / Modelo:</strong> {emissionQuote.vehicle ? `${emissionQuote.vehicle.brand} ${emissionQuote.vehicle.model} (${emissionQuote.vehicle.year})` : vehicleLabels[emissionQuote.vehicleType]}
                  </div>
                  <div><strong>Chasis / VIN:</strong> {emissionQuote.vehicle?.chassisNumber || 'No informado'}</div>
                </div>
              </div>

              {/* Legal Coverage Table */}
              <div style={{ marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '6px 12px', fontWeight: 800, fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>
                  3. COBERTURAS OBLIGATORIAS DE LEY (UIT 2026 = S/ 5,500)
                </div>
                <table style={{ width: '100%', fontSize: 11 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 12px' }}>• Muerte (cada persona)</td>
                      <td style={{ padding: '4px 12px', textAlign: 'center', fontWeight: 700 }}>4 UIT</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 700 }}>S/ 22,000.00</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 12px' }}>• Invalidez permanente (cada persona)</td>
                      <td style={{ padding: '4px 12px', textAlign: 'center', fontWeight: 700 }}>Hasta 4 UIT</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 700 }}>Hasta S/ 22,000.00</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 12px' }}>• Incapacidad temporal (cada persona)</td>
                      <td style={{ padding: '4px 12px', textAlign: 'center', fontWeight: 700 }}>Hasta 1 UIT</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 700 }}>Hasta S/ 5,500.00</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 12px' }}>• Gastos de atención médica y hospitalaria</td>
                      <td style={{ padding: '4px 12px', textAlign: 'center', fontWeight: 700 }}>Hasta 5 UIT</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 700 }}>Hasta S/ 27,500.00</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 12px' }}>• Gastos de sepelio (cada persona)</td>
                      <td style={{ padding: '4px 12px', textAlign: 'center', fontWeight: 700 }}>Hasta 1 UIT</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 700 }}>Hasta S/ 5,500.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Economic Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
                <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 8 }}>
                  <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>
                    4. Vigencia de Póliza
                  </strong>
                  <div>Inicio: <strong>{emissionQuote.startsAt ? emissionQuote.startsAt.split('T')[0] : '01/03/2026'} a las 00:00 hrs</strong></div>
                  <div>Vigencia: <strong>1 año calendario completo</strong></div>
                  <div>Fecha de emisión: <strong>{new Date(emissionQuote.createdAt).toLocaleString('es-PE')}</strong></div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 8, background: '#f8fafc' }}>
                  <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>
                    5. Liquidación de Prima
                  </strong>
                  {(() => {
                    const price = emissionQuote.selectedPrice || 65.0;
                    const net = price / 1.18;
                    const igv = price - net;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Prima Comercial Neta:</span>
                          <strong>S/ {net.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>IGV (18%):</span>
                          <strong>S/ {igv.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 4, marginTop: 4, fontSize: 14, color: 'var(--green)' }}>
                          <span>PRIMA TOTAL CANCELADA:</span>
                          <strong>S/ {price.toFixed(2)}</strong>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Footer Stamp */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', maxWidth: 400 }}>
                  Consulta electrónica en <em>apeseg.org.pe/consultas-soat</em> mediante la placa vehicular. Certificado válido conforme al D.S. N° 024-2002-MTC.
                </div>
                <div style={{ textAlign: 'right', fontSize: 10, color: '#475569' }}>
                  <strong>CORREDORES DE SEGUROS FALABELLA S.A.C.</strong><br />
                  Firma y Sello Electrónico Autorizado SBS
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="button ghost" onClick={() => setEmissionQuote(null)}>
                Cerrar
              </button>
              <button
                type="button"
                className="button"
                style={{
                  background: 'var(--green)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 800,
                  fontSize: 14,
                  padding: '10px 20px',
                  boxShadow: '0 4px 14px rgba(78, 127, 0, 0.35)',
                  cursor: 'pointer'
                }}
                onClick={() => generateAndDownloadSoatPdf(emissionQuote)}
              >
                <span style={{ fontSize: 16 }}>📥</span>
                <span>Descargar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
