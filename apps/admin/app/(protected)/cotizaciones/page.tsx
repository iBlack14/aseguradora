'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';

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

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/backend/v1/quotes')
      .then((r) => r.json())
      .then((result) => setQuotes(result.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: Vehicle; offers: OfferDetail[] };
      setVehicle(result.data);
      setVehicleType(result.data.vehicleType);
      if (result.offers && result.offers.length > 0) {
        setOffers(result.offers);
        setSelectedOfferId(result.offers[0].id);
      }
    } catch {
      alert('No pudimos consultar esa placa. Verifica que la API esté activa e intenta nuevamente.');
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
        }
      }
    } catch {}
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const chosenOffer = offers.find((o) => o.id === selectedOfferId) || offers[0];

    const body = {
      ...Object.fromEntries(form),
      vehicleType,
      selectedOfferId,
      selectedPrice: chosenOffer ? chosenOffer.price : undefined,
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
      setVehicleType('AUTO');
      setShowForm(false);
      load();
    } catch {
      alert('Error al comunicarse con la API.');
    }
  }

  const selectedOffer = offers.find((o) => o.id === selectedOfferId);

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
            <div className="offers-section">
              <div className="offers-heading">
                <h3>Tarifas disponibles para este vehículo ({vehicleLabels[vehicleType]})</h3>
                <p className="muted">
                  Selecciona la aseguradora y plan convenido con el cliente para registrar la cotización:
                </p>
              </div>

              <div className="offers-grid">
                {offers.map((offer) => {
                  const isSelected = selectedOfferId === offer.id;
                  return (
                    <div
                      key={offer.id}
                      className={`admin-offer-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedOfferId(offer.id)}
                    >
                      <div className="offer-header">
                        <span className="offer-name">{offer.name}</span>
                        <span className="offer-badge">{offer.badge}</span>
                      </div>
                      <div className="offer-plan">{offer.plan}</div>
                      <div className="offer-price">S/ {offer.price.toFixed(2)}</div>
                      <div className="offer-radio">
                        <input
                          type="radio"
                          name="selectedOfferRadio"
                          checked={isSelected}
                          onChange={() => setSelectedOfferId(offer.id)}
                        />
                        <span>{isSelected ? 'Seleccionada' : 'Elegir'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="button ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button className="button" type="submit">
              Guardar cotización {selectedOffer ? `(S/ ${selectedOffer.price.toFixed(2)})` : ''}
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
            <table>
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
                    <td>
                      <strong>{q.code}</strong>
                    </td>
                    <td>
                      <strong style={{ fontSize: 15, letterSpacing: '0.04em' }}>{q.plate}</strong>
                      <small>
                        {q.vehicle
                          ? `${q.vehicle.brand} ${q.vehicle.model} (${q.vehicle.year})`
                          : vehicleLabels[q.vehicleType] || q.vehicleType}
                      </small>
                    </td>
                    <td>
                      {q.documentType} {q.documentNumber.replace(/.(?=.{3})/g, '•')}
                    </td>
                    <td>
                      <span className="price-pill">
                        S/ {q.selectedPrice ? q.selectedPrice.toFixed(2) : '65.00'}
                      </span>
                      <small style={{ textTransform: 'capitalize' }}>
                        {q.selectedOfferId ? q.selectedOfferId.replace('-', ' ') : 'Oferta base'}
                      </small>
                    </td>
                    <td>
                      <span className={`source ${q.source.toLowerCase()}`}>
                        {q.source === 'WEB' ? 'Web Pública' : 'Gestión Interna'}
                      </span>
                    </td>
                    <td>
                      <span className="status">Nueva</span>
                    </td>
                    <td>{new Date(q.createdAt).toLocaleString('es-PE')}</td>
                    <td>
                      <button
                        className="button ghost"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => setSelectedQuote(q)}
                      >
                        Ver detalle
                      </button>
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

            <div style={{ marginTop: 22, textAlign: 'right' }}>
              <button className="button" onClick={() => setSelectedQuote(null)}>
                Cerrar detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
