'use client';
import { FormEvent, useCallback, useEffect, useState, useMemo } from 'react';
import { generateAndDownloadSoatPdf } from '@/lib/generateSoatPdf';
import { getBrandsForType, getModelsForBrand } from '@/lib/vehicleCatalog';

type OfferDetail = {
  id: string;
  insurer: string;
  name: string;
  plan: string;
  logo: string;
  price: number;
  installmentAmount?: number;
  installmentCount?: number;
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
  holderName?: string;
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
  paymentMethod?: 'CASH' | 'INSTALLMENTS';
  installmentCount?: number;
  installmentAmount?: number;
  vehicle?: {
    brand?: string;
    model?: string;
    year?: number;
    color?: string;
    vin?: string;
    chassisNumber?: string;
    use?: string;
    department?: string;
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
  source: 'VERIFIK' | 'PADRON' | 'MANUAL_ENTRY';
  vehicleType: 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';
  use?: string;
  department?: string;
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

const insurerLabels: Record<string, string> = {
  falabella: 'Seguros Falabella',
  'la-positiva': 'La Positiva',
  mapfre: 'MAPFRE',
  interseguro: 'Interseguro',
  pacifico: 'Pacífico',
  protecta: 'Protecta Security'
};

type TariffEditor = { annualPrice: string; installmentAmount: string; installmentCount: string };
type TariffResponse = { baseTariffs: Record<string, Record<string, number>>; tariffs: Array<{ insurerSlug: string; vehicleType: string; vehicleUse: string; department: string; annualPrice: number; installmentAmount?: number; installmentCount?: number }> };

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
  const [emitting, setEmitting] = useState(false);
  const [copiedPlate, setCopiedPlate] = useState(false);
  const [realPriceOverride, setRealPriceOverride] = useState('');
  const [advisorName, setAdvisorName] = useState('Asesor de operaciones');
  const [assistedNotes, setAssistedNotes] = useState('');
  const [tariffType, setTariffType] = useState<Vehicle['vehicleType']>('MOTO');
  const [tariffUse, setTariffUse] = useState('PARTICULAR');
  const [tariffDepartment, setTariffDepartment] = useState('Lima');
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, TariffEditor>>({});
  const [savingTariff, setSavingTariff] = useState<string | null>(null);

  // States for + Nueva cotización Brand & Model selectors
  const [adminBrand, setAdminBrand] = useState('');
  const [adminModel, setAdminModel] = useState('');
  const [adminYear, setAdminYear] = useState('2023');
  const [adminVin, setAdminVin] = useState('');
  const [adminUse, setAdminUse] = useState('PARTICULAR');
  const [adminDepartment, setAdminDepartment] = useState('Lima');
  const [adminCustomBrand, setAdminCustomBrand] = useState(false);
  const [adminCustomModel, setAdminCustomModel] = useState(false);

  const adminAvailableBrands = useMemo(() => getBrandsForType(vehicleType), [vehicleType]);
  const adminAvailableModels = useMemo(() => getModelsForBrand(vehicleType, adminBrand), [vehicleType, adminBrand]);

  // States for Detail & Pre-Emission Modal Edit
  const [editHolderName, setEditHolderName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editYear, setEditYear] = useState('2023');
  const [editVin, setEditVin] = useState('');
  const [editUse, setEditUse] = useState('PARTICULAR');
  const [editDepartment, setEditDepartment] = useState('Lima');
  const [editOfferId, setEditOfferId] = useState('la-positiva');
  const [editPrice, setEditPrice] = useState('65.00');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'INSTALLMENTS'>('CASH');
  const [editInstallmentCount, setEditInstallmentCount] = useState('4');
  const [editInstallmentAmount, setEditInstallmentAmount] = useState('');
  const [editCustomBrand, setEditCustomBrand] = useState(false);
  const [editCustomModel, setEditCustomModel] = useState(false);

  const modalVehicleType = selectedQuote ? selectedQuote.vehicleType : 'AUTO';
  const modalAvailableBrands = useMemo(() => getBrandsForType(modalVehicleType), [modalVehicleType]);
  const modalAvailableModels = useMemo(() => getModelsForBrand(modalVehicleType, editBrand), [modalVehicleType, editBrand]);

  function openQuoteDetail(q: Quote) {
    setSelectedQuote(q);
    setEditHolderName(q.holderName || '');
    setEditBrand(q.vehicle?.brand || '');
    setEditModel(q.vehicle?.model || '');
    setEditYear(String(q.vehicle?.year || 2023));
    setEditVin(q.vehicle?.chassisNumber || q.vehicle?.vin || '');
    setEditUse(q.vehicle?.use || 'PARTICULAR');
    setEditDepartment(q.vehicle?.department || q.department || 'Lima');
    setEditOfferId(q.selectedOfferId || 'la-positiva');
    setEditPrice(q.selectedPrice ? q.selectedPrice.toFixed(2) : '65.00');
    const selectedOffer = q.offers?.find((offer) => offer.id === q.selectedOfferId);
    const hasInstallments = Boolean(selectedOffer?.installmentCount && selectedOffer.installmentCount > 1);
    setEditPaymentMethod(hasInstallments ? 'INSTALLMENTS' : 'CASH');
    setEditInstallmentCount(String(selectedOffer?.installmentCount || 4));
    setEditInstallmentAmount(selectedOffer?.installmentAmount?.toFixed(2) || '');
    setEditCustomBrand(false);
    setEditCustomModel(false);
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/backend/v1/quotes')
      .then((r) => r.json())
      .then((result) => setQuotes(result.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleEmit(
    q: Quote,
    overridePrice?: number,
    offerId?: string,
    updatedHolderName?: string,
    updatedVehicle?: Partial<NonNullable<Quote['vehicle']>>,
    payment?: { method: 'CASH' | 'INSTALLMENTS'; installmentCount?: number; installmentAmount?: number }
  ) {
    if (q.status === 'EMITIDA' || emitting) return;
    const finalOfferId = offerId || q.selectedOfferId || selectedOfferId || 'la-positiva';
    const finalPrice = overridePrice || (realPriceOverride ? parseFloat(realPriceOverride) : q.selectedPrice);
    const finalHolderName = updatedHolderName !== undefined ? updatedHolderName : q.holderName;
    const finalVehicle = updatedVehicle ? { ...(q.vehicle || {}), ...updatedVehicle } : q.vehicle;

    setEmitting(true);
    try {
      const res = await fetch(`/api/backend/v1/quotes/${q.id}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisorName,
          assistedNotes,
          realPrice: finalPrice,
          selectedOfferId: finalOfferId,
          holderName: finalHolderName,
          vehicle: finalVehicle,
          paymentMethod: payment?.method,
          installmentCount: payment?.installmentCount,
          installmentAmount: payment?.installmentAmount
        })
      });
      if (res.ok) {
        const result = await res.json();
        const emittedData = result.data || {
          ...q,
          selectedOfferId: finalOfferId,
          selectedPrice: finalPrice,
          holderName: finalHolderName,
          vehicle: finalVehicle
        };
        if (!emittedData.selectedOfferId) emittedData.selectedOfferId = finalOfferId;
        if (!emittedData.holderName && finalHolderName) emittedData.holderName = finalHolderName;
        if (!emittedData.vehicle && finalVehicle) emittedData.vehicle = finalVehicle;
        emittedData.paymentMethod = payment?.method;
        emittedData.installmentCount = payment?.installmentCount;
        emittedData.installmentAmount = payment?.installmentAmount;
        setEmissionQuote(emittedData);
        setQuotes((currentQuotes) => currentQuotes.map((currentQuote) =>
          currentQuote.id === emittedData.id ? emittedData : currentQuote
        ));
      } else {
        const failure = await res.json().catch(() => null) as { message?: string } | null;
        alert(failure?.message || 'No fue posible emitir la póliza. Inténtalo nuevamente.');
      }
    } catch {
      alert('No fue posible conectar con la API para emitir la póliza.');
    } finally {
      setEmitting(false);
    }
    load();
  }

  useEffect(() => {
    load();
    setShowForm(new URLSearchParams(location.search).get('new') === '1');
  }, [load]);

  const loadTariffs = useCallback(() => {
    fetch('/api/backend/v1/tariffs')
      .then((response) => response.json())
      .then((result: TariffResponse) => {
        const drafts: Record<string, TariffEditor> = {};
        Object.entries(insurerLabels).forEach(([id]) => {
          const dynamic = result.tariffs.find((item) => item.insurerSlug === id && item.vehicleType === tariffType && item.vehicleUse === tariffUse && item.department.toLowerCase() === tariffDepartment.toLowerCase());
          const base = result.baseTariffs[tariffType]?.[id] || 0;
          const count = dynamic?.installmentCount || (tariffType === 'MOTO' ? 4 : 1);
          drafts[id] = {
            annualPrice: String(dynamic?.annualPrice ?? base),
            installmentAmount: String(dynamic?.installmentAmount ?? (count > 1 ? Math.max(150, base / count) : base)),
            installmentCount: String(count)
          };
        });
        setTariffDrafts(drafts);
      })
      .catch(() => {});
  }, [tariffType, tariffUse, tariffDepartment]);

  useEffect(() => { loadTariffs(); }, [loadTariffs]);

  async function saveTariff(insurerSlug: string) {
    const draft = tariffDrafts[insurerSlug];
    if (!draft) return;
    const annualPrice = Number(draft.annualPrice);
    const installmentAmount = Number(draft.installmentAmount);
    const installmentCount = Number(draft.installmentCount);
    if (!annualPrice || annualPrice <= 0 || !installmentAmount || installmentCount < 1 || (tariffType === 'MOTO' && installmentAmount < 150)) {
      alert(tariffType === 'MOTO' ? 'En motos la cuota mínima es S/ 150.' : 'Ingresa precios y cuotas válidos.');
      return;
    }
    setSavingTariff(insurerSlug);
    try {
      const response = await fetch('/api/backend/v1/admin/tariffs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insurerSlug, vehicleType: tariffType, department: tariffDepartment, vehicleUse: tariffUse, annualPrice, installmentAmount, installmentCount, source: 'ADMIN' })
      });
      if (!response.ok) throw new Error();
      alert('Precio actualizado correctamente.');
      loadTariffs();
    } catch { alert('No fue posible guardar el precio.'); }
    finally { setSavingTariff(null); }
  }

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
      if (result.data.brand) {
        setAdminBrand(result.data.brand);
        setAdminCustomBrand(false);
      }
      if (result.data.model) {
        setAdminModel(result.data.model);
        setAdminCustomModel(false);
      }
      if (result.data.year) setAdminYear(String(result.data.year));
      if (result.data.vin || result.data.chassisNumber) setAdminVin(result.data.vin || result.data.chassisNumber);
      if (result.data.use) setAdminUse(result.data.use);
      if (result.data.department) setAdminDepartment(result.data.department);
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
  async function handleVehicleTypeChange(newType: Vehicle['vehicleType'], department = adminDepartment, use = adminUse) {
    setVehicleType(newType);
    const plate = (document.getElementById('plate') as HTMLInputElement)?.value.trim() || 'ABC-123';
    try {
      const response = await fetch(`/api/backend/v1/offers?vehicleType=${encodeURIComponent(newType)}&department=${encodeURIComponent(department)}&use=${encodeURIComponent(use)}`);
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

    if (!chosenOffer || !finalPrice || !Number.isFinite(finalPrice)) {
      alert('Selecciona una aseguradora con un precio válido.');
      return;
    }

    const brandToUse = adminBrand || vehicle?.brand || 'Vehículo';
    const modelToUse = adminModel || vehicle?.model || 'Estándar';
    const yearToUse = Number(adminYear) || vehicle?.year || 2023;
    const vinToUse = adminVin || vehicle?.vin || vehicle?.chassisNumber || undefined;

    const body = {
      ...Object.fromEntries(form),
      vehicleType,
      selectedOfferId,
      selectedPrice: finalPrice,
      advisorName,
      assistedNotes,
      vehicle: {
        brand: brandToUse,
        model: modelToUse,
        year: yearToUse,
        color: vehicle?.color || 'Plateado',
        vin: vinToUse,
        chassisNumber: vinToUse,
        use: adminUse,
        department: adminDepartment
      },
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
      setAdminBrand('');
      setAdminModel('');
      setAdminYear('2023');
      setAdminVin('');
      setAdminUse('PARTICULAR');
      setAdminDepartment('Lima');
      setAdminCustomBrand(false);
      setAdminCustomModel(false);
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
                Ingresa la placa para consultar el vehículo y obtener las tarifas configuradas para el cliente.
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
                  placeholder="Ingresa la placa"
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
              Departamento o ciudad de registro de la placa
              <select name="department" value={adminDepartment} onChange={(event) => { const value = event.target.value; setAdminDepartment(value); handleVehicleTypeChange(vehicleType, value, adminUse); }}>
                {departments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Uso del vehículo
              <select value={adminUse} onChange={(event) => { const value = event.target.value; setAdminUse(value); handleVehicleTypeChange(vehicleType, adminDepartment, value); }}>
                <option value="PARTICULAR">Particular</option>
                <option value="PUBLICO">Servicio público / transporte de pasajeros</option>
                <option value="COMERCIAL">Comercial / carga</option>
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
              <input name="documentNumber" required minLength={8} maxLength={11} placeholder="Ingresa el número de documento" />
            </label>

            <label>
              Nombres y Apellidos del Contratante / Titular
              <input
                name="holderName"
                required
                placeholder="Ingresa nombres y apellidos"
                style={{ textTransform: 'uppercase' }}
              />
            </label>

            <label>
              Marca del vehículo
              <select
                value={adminCustomBrand ? '__OTRA__' : (adminAvailableBrands.includes(adminBrand) ? adminBrand : (adminBrand ? '__OTRA__' : ''))}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__OTRA__') {
                    setAdminCustomBrand(true);
                  } else {
                    setAdminCustomBrand(false);
                    setAdminBrand(val);
                    const models = getModelsForBrand(vehicleType, val);
                    if (models.length > 0) {
                      setAdminModel(models[0]);
                      setAdminCustomModel(false);
                    }
                  }
                }}
              >
                <option value="">-- Selecciona una marca --</option>
                {adminAvailableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="__OTRA__">Otra marca (escribir)...</option>
              </select>
            </label>

            {(adminCustomBrand || (adminBrand && !adminAvailableBrands.includes(adminBrand))) && (
              <label>
                Escribe la marca
                <input
                  value={adminBrand}
                  onChange={(e) => setAdminBrand(e.target.value)}
                  placeholder="Escribe la marca"
                />
              </label>
            )}

            <label>
              Modelo del vehículo
              {adminAvailableModels.length > 0 ? (
                <select
                  value={adminCustomModel ? '__OTRO__' : (adminAvailableModels.includes(adminModel) ? adminModel : (adminModel ? '__OTRO__' : ''))}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__OTRO__') {
                      setAdminCustomModel(true);
                    } else {
                      setAdminCustomModel(false);
                      setAdminModel(val);
                    }
                  }}
                >
                  <option value="">-- Selecciona el modelo --</option>
                  {adminAvailableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__OTRO__">Otro modelo (escribir)...</option>
                </select>
              ) : (
                <input
                  value={adminModel}
                  onChange={(e) => setAdminModel(e.target.value)}
                  placeholder="Escribe el modelo"
                />
              )}
            </label>

            {(adminCustomModel || (adminModel && !adminAvailableModels.includes(adminModel) && adminAvailableModels.length > 0)) && (
              <label>
                Escribe el modelo
                <input
                  value={adminModel}
                  onChange={(e) => setAdminModel(e.target.value)}
                  placeholder="Escribe el modelo"
                />
              </label>
            )}

            <label>
              Año de fabricación
              <input
                value={adminYear}
                onChange={(e) => setAdminYear(e.target.value)}
                placeholder="Año de fabricación"
              />
            </label>

            <label>
              N° de Chasis / Serie / VIN
              <input
                value={adminVin}
                onChange={(e) => setAdminVin(e.target.value.toUpperCase())}
                placeholder="Ingresa el chasis o VIN"
                style={{ textTransform: 'uppercase' }}
              />
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
                  {adminBrand || vehicle.brand} {adminModel || vehicle.model}
                </strong>
              </div>
              <div>
                <span>Placa</span>
                <strong>{vehicle.plate}</strong>
              </div>
              <div>
                <span>Año de fabricación</span>
                <strong>{adminYear || vehicle.year || 'No informado'}</strong>
              </div>
              <div>
                <span>Color</span>
                <strong>{vehicle.color}</strong>
              </div>
              <div>
                <span>N.º de Chasis</span>
                <strong>{adminVin || vehicle.vin || vehicle.chassisNumber || 'No informado'}</strong>
              </div>
              <small>
                {vehicle.source === 'VERIFIK'
                  ? 'Datos consultados en línea.'
                  : vehicle.source === 'PADRON'
                    ? 'Datos registrados del vehículo.'
                    : 'Datos ingresados para esta cotización.'}
              </small>
            </div>
          )}

          {offers.length > 0 && (
            <section className="internal-quote-result" aria-live="polite">
              <div className="internal-quote-heading">
                <div>
                  <h3>Selecciona la aseguradora</h3>
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
                        {offer.name} - {offer.plan}{offer.installmentAmount && offer.installmentCount && offer.installmentCount > 1 ? ` · ${offer.installmentCount} cuotas de S/ ${offer.installmentAmount.toFixed(2)}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="selected-price-result">
                  <span>Precio cotizado</span>
                  <strong>S/ {(selectedFinalPrice || 0).toFixed(2)}</strong>
                  {selectedOffer?.installmentAmount && selectedOffer.installmentCount && selectedOffer.installmentCount > 1 && (
                    <small>{selectedOffer.installmentCount} cuotas de S/ {selectedOffer.installmentAmount.toFixed(2)}</small>
                  )}
                </div>
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
            <h2>Bandeja de Cotizaciones</h2>
            <p className="muted">
              Visualiza las solicitudes que ingresan desde la web y las generadas por el equipo comercial.
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
                      {q.holderName && (
                        <strong style={{ display: 'block', fontSize: 13, color: '#0f172a', marginBottom: 2 }}>
                          {q.holderName}
                        </strong>
                      )}
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {q.documentType} {q.documentNumber.replace(/.(?=.{3})/g, '•')}
                      </span>
                    </td>
                    <td data-label="Aseguradora / Tarifa">
                      <span className="price-pill">
                        S/ {q.selectedPrice ? q.selectedPrice.toFixed(2) : '65.00'}
                      </span>
                      <small style={{ textTransform: 'capitalize' }}>
                        {q.selectedOfferId ? q.selectedOfferId.replace('-', ' ') : 'Oferta base'}
                      </small>
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
                        {q.status !== 'EMITIDA' && (
                          <button
                            className="button ghost"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                            onClick={() => openQuoteDetail(q)}
                          >
                            Ver detalle
                          </button>
                        )}
                        <button
                          className="button"
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            background: q.status === 'EMITIDA' ? '#0f766e' : '#16a34a'
                          }}
                          onClick={() => (q.status === 'EMITIDA' ? generateAndDownloadSoatPdf(q) : openQuoteDetail(q))}
                        >
                          {q.status === 'EMITIDA' ? 'Descargar póliza' : 'Emitir Póliza'}
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

      <section className="card tariff-card">
        <div className="topbar">
          <div>
            <h2>Precios por aseguradora</h2>
            <p className="muted">Administra las tarifas disponibles para las cotizaciones.</p>
          </div>
          <select value={tariffType} onChange={(event) => setTariffType(event.target.value as Vehicle['vehicleType'])}>
            {Object.entries(vehicleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={tariffUse} onChange={(event) => setTariffUse(event.target.value)}>
            <option value="PARTICULAR">Particular</option>
            <option value="PUBLICO">Servicio público / pasajeros</option>
            <option value="COMERCIAL">Comercial / carga</option>
          </select>
          <select value={tariffDepartment} onChange={(event) => setTariffDepartment(event.target.value)}>
            {departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </div>
        <div className="tariff-grid">
          {Object.entries(insurerLabels).map(([id, name]) => {
            const draft = tariffDrafts[id] || { annualPrice: '', installmentAmount: '', installmentCount: '1' };
            return <div className="tariff-row" key={id}>
              <div className="tariff-name"><strong>{name}</strong><small>{id === 'falabella' ? 'Incluida en el catálogo Falabella' : 'Aseguradora afiliada'}</small></div>
              <label>Precio anual<input type="number" min="1" step="0.01" value={draft.annualPrice} onChange={(event) => setTariffDrafts((current) => ({ ...current, [id]: { ...draft, annualPrice: event.target.value } }))} /></label>
              <label>Cuota desde<input type="number" min={tariffType === 'MOTO' ? 150 : 1} step="0.01" value={draft.installmentAmount} onChange={(event) => setTariffDrafts((current) => ({ ...current, [id]: { ...draft, installmentAmount: event.target.value } }))} /></label>
              <label>N.º cuotas<input type="number" min="1" step="1" value={draft.installmentCount} onChange={(event) => setTariffDrafts((current) => ({ ...current, [id]: { ...draft, installmentCount: event.target.value } }))} /></label>
              <button className="button" type="button" onClick={() => saveTariff(id)} disabled={savingTariff === id}>{savingTariff === id ? 'Guardando…' : 'Guardar'}</button>
            </div>;
          })}
        </div>
        {tariffType === 'MOTO' && <p className="tariff-note">Para motos, la cuota no puede ser menor a S/ 150. Ajusta el número de cuotas según el precio acordado.</p>}
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
                        <th>Cuotas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.offers.map((off) => (
                      <tr
                        key={off.id}
                        style={{
                          background: off.id === selectedQuote.selectedOfferId ? '#f4f9ea' : 'transparent',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setEditOfferId(off.id);
                          setEditPrice(off.price.toFixed(2));
                          const hasInstallments = Boolean(off.installmentCount && off.installmentCount > 1);
                          setEditPaymentMethod(hasInstallments ? 'INSTALLMENTS' : 'CASH');
                          setEditInstallmentCount(String(off.installmentCount || 4));
                          setEditInstallmentAmount(off.installmentAmount?.toFixed(2) || '');
                          setSelectedQuote({ ...selectedQuote, selectedOfferId: off.id, selectedPrice: off.price });
                        }}
                      >
                        <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img
                            src={`/assets/logos/${off.id}.png`}
                            alt={off.name}
                            style={{ height: 18, width: 45, objectFit: 'contain' }}
                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                          />
                          <strong>{off.name}</strong>
                          {off.id === (editOfferId || selectedQuote.selectedOfferId) && (
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
                        <td>{off.installmentAmount && off.installmentCount && off.installmentCount > 1 ? `${off.installmentCount} × S/ ${off.installmentAmount.toFixed(2)}` : 'Pago único'}</td>
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

            {/* Formulario de Verificación y Relleno de Datos Oficiales Antes de Emitir */}
            {selectedQuote.status !== 'EMITIDA' && (
              <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 10 }}>
                <strong style={{ display: 'block', fontSize: 13, color: '#0f172a', marginBottom: 4 }}>
                  📋 Datos Oficiales para la Emisión (Verificar o rellenar antes de emitir)
                </strong>
                <p style={{ margin: '0 0 12px', fontSize: 11, color: '#64748b' }}>
                  El nombre del contratante y las especificaciones vehiculares quedarán grabadas en el certificado electrónico SOAT oficial.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      Nombres y Apellidos del Contratante / Titular <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      value={editHolderName}
                      onChange={(e) => setEditHolderName(e.target.value)}
                      placeholder="Ingresa nombres y apellidos"
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1.5px solid #94a3b8',
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      Marca del vehículo (Selector) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      value={editCustomBrand ? '__OTRA__' : (modalAvailableBrands.includes(editBrand) ? editBrand : (editBrand ? '__OTRA__' : ''))}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__OTRA__') {
                          setEditCustomBrand(true);
                        } else {
                          setEditCustomBrand(false);
                          setEditBrand(val);
                          const models = getModelsForBrand(modalVehicleType, val);
                          if (models.length > 0) {
                            setEditModel(models[0]);
                            setEditCustomModel(false);
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1.5px solid #94a3b8',
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#fff'
                      }}
                    >
                      <option value="">-- Selecciona una marca --</option>
                      {modalAvailableBrands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      <option value="__OTRA__">Otra marca (escribir)...</option>
                    </select>
                    {(editCustomBrand || (editBrand && !modalAvailableBrands.includes(editBrand))) && (
                      <input
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        placeholder="Escribe la marca"
                        style={{
                          marginTop: 6,
                          width: '100%',
                          height: 34,
                          padding: '0 8px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          fontSize: 12
                        }}
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      Departamento o ciudad de registro
                    </label>
                    <select value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 6, border: '1.5px solid #94a3b8', fontSize: 12, background: '#fff' }}>
                      {departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      Uso del vehículo
                    </label>
                    <select value={editUse} onChange={(e) => setEditUse(e.target.value)} style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 6, border: '1.5px solid #94a3b8', fontSize: 12, background: '#fff' }}>
                      <option value="PARTICULAR">Particular</option>
                      <option value="PUBLICO">Servicio público / transporte de pasajeros</option>
                      <option value="COMERCIAL">Comercial / carga</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      Modelo del vehículo (Selector)
                    </label>
                    {modalAvailableModels.length > 0 ? (
                      <>
                        <select
                          value={editCustomModel ? '__OTRO__' : (modalAvailableModels.includes(editModel) ? editModel : (editModel ? '__OTRO__' : ''))}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__OTRO__') {
                              setEditCustomModel(true);
                            } else {
                              setEditCustomModel(false);
                              setEditModel(val);
                            }
                          }}
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '0 10px',
                            borderRadius: 6,
                            border: '1.5px solid #94a3b8',
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#fff'
                          }}
                        >
                          <option value="">-- Selecciona el modelo --</option>
                          {modalAvailableModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="__OTRO__">Otro modelo (escribir)...</option>
                        </select>
                        {(editCustomModel || (editModel && !modalAvailableModels.includes(editModel))) && (
                          <input
                            value={editModel}
                            onChange={(e) => setEditModel(e.target.value)}
                            placeholder="Escribe el modelo"
                            style={{
                              marginTop: 6,
                              width: '100%',
                              height: 34,
                              padding: '0 8px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: 12
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <input
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                        placeholder="Escribe el modelo"
                        style={{
                          width: '100%',
                          height: 38,
                          padding: '0 10px',
                          borderRadius: 6,
                          border: '1.5px solid #94a3b8',
                          fontSize: 12
                        }}
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      N° de Chasis / Serie / VIN
                    </label>
                    <input
                      value={editVin}
                      onChange={(e) => setEditVin(e.target.value.toUpperCase())}
                      placeholder="Ingresa el chasis o VIN"
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1.5px solid #94a3b8',
                        fontSize: 12,
                        textTransform: 'uppercase'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      Año de fabricación
                    </label>
                    <input
                      type="number"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      placeholder="Año de fabricación"
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1.5px solid #94a3b8',
                        fontSize: 12
                      }}
                    />
                  </div>

                </div>

                <div className="payment-config">
                  <div className="payment-config-heading">
                    <div>
                      <strong>Forma de pago</strong>
                      <span>Confirma cómo pagará el cliente antes de emitir.</span>
                    </div>
                    <div className="payment-methods" role="radiogroup" aria-label="Forma de pago">
                      <button type="button" className={editPaymentMethod === 'CASH' ? 'active' : ''} onClick={() => setEditPaymentMethod('CASH')}>
                        Al contado
                      </button>
                      <button type="button" className={editPaymentMethod === 'INSTALLMENTS' ? 'active' : ''} onClick={() => setEditPaymentMethod('INSTALLMENTS')}>
                        En cuotas
                      </button>
                    </div>
                  </div>

                  <div className="payment-fields">
                    <label>
                      Precio total (S/)
                      <input type="number" min="1" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                    </label>
                    {editPaymentMethod === 'INSTALLMENTS' && (
                      <>
                        <label>
                          N.º de cuotas
                          <input type="number" min="2" max="24" step="1" value={editInstallmentCount} onChange={(e) => setEditInstallmentCount(e.target.value)} />
                        </label>
                        <label>
                          Monto por cuota (S/)
                          <input type="number" min="1" step="0.01" value={editInstallmentAmount} onChange={(e) => setEditInstallmentAmount(e.target.value)} />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="button ghost" onClick={() => setSelectedQuote(null)}>
                Cerrar detalle
              </button>
              <button
                className="button"
                disabled={emitting}
                style={{ background: selectedQuote.status === 'EMITIDA' ? '#0f766e' : '#16a34a' }}
                onClick={() => {
                  const q = selectedQuote;
                  if (q.status === 'EMITIDA') {
                    setSelectedQuote(null);
                    setEmissionQuote(q);
                  } else {
                    if (!editHolderName.trim()) {
                      alert('Por favor ingresa los Nombres y Apellidos del Contratante / Titular antes de emitir.');
                      return;
                    }
                    const finalP = parseFloat(editPrice) || q.selectedPrice || 65;
                    const installmentCount = Number(editInstallmentCount);
                    const installmentAmount = Number(editInstallmentAmount);
                    if (editPaymentMethod === 'INSTALLMENTS' && (!Number.isInteger(installmentCount) || installmentCount < 2 || !installmentAmount || installmentAmount <= 0)) {
                      alert('Ingresa una cantidad de cuotas y un monto por cuota válidos.');
                      return;
                    }
                    const finalBrand = editBrand || q.vehicle?.brand || 'Vehículo';
                    const finalModel = editModel || q.vehicle?.model || 'Estándar';
                    const finalYear = Number(editYear) || q.vehicle?.year || 2023;
                    const finalVin = editVin || q.vehicle?.chassisNumber || q.vehicle?.vin || '';

                    setSelectedQuote(null);
                    handleEmit(
                      q,
                      finalP,
                      editOfferId,
                      editHolderName.trim(),
                      {
                        brand: finalBrand,
                        model: finalModel,
                        year: finalYear,
                        chassisNumber: finalVin,
                        vin: finalVin,
                        use: editUse,
                        department: editDepartment
                      },
                      editPaymentMethod === 'INSTALLMENTS'
                        ? { method: 'INSTALLMENTS', installmentCount, installmentAmount }
                        : { method: 'CASH' }
                    );
                  }
                }}
              >
                {selectedQuote.status === 'EMITIDA'
                  ? 'Descargar Certificado Oficial (PDF)'
                  : (emitting ? 'Emitiendo póliza…' : 'Emitir Póliza SOAT (PDF)')}
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
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <img
                      src={`/assets/logos/${(emissionQuote.selectedOfferId || 'la-positiva').toLowerCase().replace(/[^a-z-]/g, '')}.png`}
                      alt="Logo aseguradora"
                      style={{ height: 22, maxWidth: 100, objectFit: 'contain' }}
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>
                      {emissionQuote.selectedOfferId ? emissionQuote.selectedOfferId.toUpperCase().replace('-', ' ') : 'LA POSITIVA'}
                    </span>
                  </div>
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
                  <div>
                    <strong>Contratante / Titular:</strong>{' '}
                    <span style={{ color: 'var(--green)', fontWeight: 800 }}>
                      {emissionQuote.holderName || `TITULAR ${emissionQuote.documentType} ${emissionQuote.documentNumber}`}
                    </span>
                  </div>
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
                          <span>PRIMA TOTAL:</span>
                          <strong>S/ {price.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                          <span>Forma de pago:</span>
                          <strong>
                            {emissionQuote.paymentMethod === 'INSTALLMENTS'
                              ? `${emissionQuote.installmentCount} cuotas de S/ ${(emissionQuote.installmentAmount || 0).toFixed(2)}`
                              : 'Al contado'}
                          </strong>
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
