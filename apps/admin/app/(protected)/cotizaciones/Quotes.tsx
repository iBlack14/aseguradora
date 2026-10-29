'use client';
import { FormEvent, useCallback, useEffect, useState, useMemo } from 'react';
import { generateAndDownloadSoatPdf } from '@/lib/generateSoatPdf';

import { getBrandsForType, getModelsForBrand, resolveCatalogBrand } from '@/lib/vehicleCatalog';

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
  policyUrl?: string;
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

const basePriceByVehicle: Record<Vehicle['vehicleType'], number> = {
  AUTO: 65,
  MOTO: 630,
  MOTOTAXI: 120,
  VAN: 130,
  CARGO: 210
};

type TariffEditor = { annualPrice: string; installmentAmount: string; installmentCount: string };
type TariffResponse = { baseTariffs: Record<string, Record<string, number>>; tariffs: Array<{ insurerSlug: string; vehicleType: string; vehicleUse: string; department: string; annualPrice: number; installmentAmount?: number; installmentCount?: number }> };

export default function Quotes({ isAdmin, canSell = false }: { isAdmin: boolean; canSell?: boolean }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleType, setVehicleType] = useState<Vehicle['vehicleType']>('AUTO');
  const [offers, setOffers] = useState<OfferDetail[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('la-positiva');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const [emitting, setEmitting] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [realPriceOverride, setRealPriceOverride] = useState('');
  const [advisorName, setAdvisorName] = useState('Asesor de operaciones');
  const [assistedNotes, setAssistedNotes] = useState('');
  const [tariffType, setTariffType] = useState<Vehicle['vehicleType']>('MOTO');
  const [tariffUse, setTariffUse] = useState('PARTICULAR');
  const [tariffDepartment, setTariffDepartment] = useState('Lima');
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, TariffEditor>>({});
  const [savingTariff, setSavingTariff] = useState<string | null>(null);
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [annullingQuoteId, setAnnullingQuoteId] = useState<string | null>(null);

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
    setPaymentReference('');
    setPaymentConfirmed(false);
    setSelectedQuote(q);
    setEditHolderName(q.holderName || '');
    setEditBrand(q.vehicle?.brand || '');
    setEditModel(q.vehicle?.model || '');
    setEditYear(String(q.vehicle?.year || 2023));
    setEditVin(q.vehicle?.chassisNumber || q.vehicle?.vin || '');
    setEditUse(q.vehicle?.use || 'PARTICULAR');
    setEditDepartment(q.vehicle?.department || q.department || 'Lima');
    setEditOfferId(q.selectedOfferId || 'la-positiva');
    setEditPrice(q.selectedPrice ? q.selectedPrice.toFixed(2) : `${basePriceByVehicle[q.vehicleType] || 65}.00`);
    const selectedOffer = q.offers?.find((offer) => offer.id === q.selectedOfferId);
    const hasInstallments = Boolean(selectedOffer?.installmentCount && selectedOffer.installmentCount > 1);
    setEditPaymentMethod(q.paymentMethod || (hasInstallments ? 'INSTALLMENTS' : 'CASH'));
    setEditInstallmentCount(String(q.installmentCount || selectedOffer?.installmentCount || 4));
    setEditInstallmentAmount((q.installmentAmount || selectedOffer?.installmentAmount)?.toFixed(2) || '');
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

  async function deleteQuote(q: Quote) {
    if (deletingQuoteId) return;
    if (!window.confirm(`¿Eliminar la cotización ${q.code}? Esta acción no se puede deshacer.`)) return;
    setDeletingQuoteId(q.id);
    try {
      const response = await fetch(`/api/backend/v1/quotes/${encodeURIComponent(q.id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(failure?.message || 'No fue posible eliminar la cotización.');
      }
      setQuotes((current) => current.filter((item) => item.id !== q.id));
      if (selectedQuote?.id === q.id) setSelectedQuote(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No fue posible eliminar la cotización.');
    } finally {
      setDeletingQuoteId(null);
    }
  }

  async function annulQuote(q: Quote) {
    if (annullingQuoteId || q.status !== 'EMITIDA') return;
    if (!window.confirm(`¿Anular el SOAT ${q.policyNumber || q.code}? La póliza quedará registrada como anulada y no se podrá eliminar.`)) return;
    setAnnullingQuoteId(q.id);
    try {
      const response = await fetch(`/api/backend/v1/quotes/${encodeURIComponent(q.id)}/annul`, { method: 'POST' });
      const result = await response.json().catch(() => null) as { data?: Quote; message?: string } | null;
      if (!response.ok || !result?.data) throw new Error(result?.message || 'No fue posible anular el SOAT.');
      setQuotes((current) => current.map((item) => item.id === q.id ? result.data! : item));
      if (selectedQuote?.id === q.id) setSelectedQuote(result.data);
      alert('SOAT anulado correctamente.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No fue posible anular el SOAT.');
    } finally {
      setAnnullingQuoteId(null);
    }
  }

  async function handleEmit(
    q: Quote,
    overridePrice?: number,
    offerId?: string,
    updatedHolderName?: string,
    updatedVehicle?: Partial<NonNullable<Quote['vehicle']>>,
    payment?: { method: 'CASH' | 'INSTALLMENTS'; installmentCount?: number; installmentAmount?: number }
  ) {
    if (!canSell || q.status === 'EMITIDA' || q.status === 'ANULADA' || emitting) return;
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
          paymentReference: paymentReference.trim(),
          paymentConfirmed,
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
        const emittedData: Quote = result.data;
        if (!emittedData?.policyNumber || emittedData.status !== 'EMITIDA') {
          alert('No se recibió la póliza emitida. Actualiza la lista para verificar el estado antes de reintentar.');
          return;
        }
        if (!emittedData.selectedOfferId) emittedData.selectedOfferId = finalOfferId;
        if (!emittedData.holderName && finalHolderName) emittedData.holderName = finalHolderName;
        if (!emittedData.vehicle && finalVehicle) emittedData.vehicle = finalVehicle;
        emittedData.paymentMethod = payment?.method;
        emittedData.installmentCount = payment?.installmentCount;
        emittedData.installmentAmount = payment?.installmentAmount;
        setSelectedQuote(emittedData);
        setQuotes((currentQuotes) => currentQuotes.map((currentQuote) =>
          currentQuote.id === emittedData.id ? emittedData : currentQuote
        ));
        try {
          await generateAndDownloadSoatPdf(emittedData);
        } catch {
          alert(`La póliza ${emittedData.policyNumber} está guardada. No se pudo descargar el PDF; vuelve a intentarlo con Descargar PDF.`);
        }
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
          const base = result.baseTariffs[tariffType]?.[id] || basePriceByVehicle[tariffType];
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

  useEffect(() => { if (isAdmin) loadTariffs(); }, [isAdmin, loadTariffs]);

  async function saveTariff(insurerSlug: string) {
    if (!isAdmin) return;
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
    if (newType !== vehicleType) {
      setAdminBrand('');
      setAdminModel('');
      setAdminCustomBrand(false);
      setAdminCustomModel(false);
    }
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
        {canSell && <button className="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cerrar formulario' : '+ Nueva cotización'}
        </button>}
      </header>

      {canSell && showForm && (
        <form className="card quote-form" onSubmit={submit}>
          <div className="form-heading">
            <div>
              <span className="quick-quote-kicker">Cotización rápida</span>
              <h2>Nueva cotización</h2>
              <p className="muted">
                Busca la placa, completa los datos del cliente y elige la mejor tarifa.
              </p>
            </div>
          </div>

          <div className="quick-quote-grid">
            <label className="quick-plate-field">
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
              Documento
              <select name="documentType">
                <option value="DNI">DNI</option>
                <option value="CE">CE</option>
                <option value="RUC">RUC</option>
              </select>
            </label>

            <label>
              Número
              <input name="documentNumber" required minLength={8} maxLength={11} placeholder="Ej. 12345678" inputMode="numeric" />
            </label>

            <label className="quick-holder-field">
              Nombre del titular
              <input
                name="holderName"
                required
                placeholder="Nombres y apellidos"
                style={{ textTransform: 'uppercase' }}
              />
            </label>

            <label>
              Inicio de vigencia
              <input
                name="startsAt"
                required
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </label>
          </div>

          <details className="quick-quote-advanced">
            <summary>
              <span>Datos del vehículo</span>
              <small>Opcional: tipo, uso, marca, modelo, año y VIN</small>
            </summary>
            <div className="admin-form-grid">
              <label>
                Tipo de vehículo
                <select name="vehicleType" value={vehicleType} onChange={(e) => handleVehicleTypeChange(e.target.value as Vehicle['vehicleType'])}>
                  {Object.entries(vehicleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label>
                Departamento
                <select name="department" value={adminDepartment} onChange={(event) => { const value = event.target.value; setAdminDepartment(value); handleVehicleTypeChange(vehicleType, value, adminUse); }}>
                  {departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
                </select>
              </label>
              <label>
                Uso del vehículo
                <select value={adminUse} onChange={(event) => { const value = event.target.value; setAdminUse(value); handleVehicleTypeChange(vehicleType, adminDepartment, value); }}>
                  <option value="PARTICULAR">Particular</option>
                  <option value="PUBLICO">Servicio público / pasajeros</option>
                  <option value="COMERCIAL">Comercial / carga</option>
                </select>
              </label>
              <label>
                Marca ({adminAvailableBrands.length} disponibles)
                <select value={adminCustomBrand ? '__OTRA__' : (adminAvailableBrands.includes(resolveCatalogBrand(vehicleType, adminBrand)) ? resolveCatalogBrand(vehicleType, adminBrand) : (adminBrand ? '__OTRA__' : ''))} onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__OTRA__') { setAdminCustomBrand(true); setAdminBrand(''); setAdminModel(''); setAdminCustomModel(false); }
                  else {
                    setAdminCustomBrand(false); setAdminBrand(val);
                    setAdminModel(''); setAdminCustomModel(false);
                  }
                }}>
                  <option value="">Selecciona una marca</option>
                  {adminAvailableBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                  <option value="__OTRA__">Otra marca</option>
                </select>
              </label>
              {(adminCustomBrand || (adminBrand && !adminAvailableBrands.includes(resolveCatalogBrand(vehicleType, adminBrand)))) && <label>Escribe la marca<input value={adminBrand} onChange={(e) => setAdminBrand(e.target.value)} /></label>}
              <label>
                Modelo
                {adminAvailableModels.length > 0 ? <select value={adminCustomModel ? '__OTRO__' : (adminAvailableModels.includes(adminModel) ? adminModel : (adminModel ? '__OTRO__' : ''))} onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__OTRO__') setAdminCustomModel(true);
                  else { setAdminCustomModel(false); setAdminModel(val); }
                }}>
                  <option value="">Selecciona el modelo</option>
                  {adminAvailableModels.map((model) => <option key={model} value={model}>{model}</option>)}
                  <option value="__OTRO__">Otro modelo</option>
                </select> : <input value={adminModel} onChange={(e) => setAdminModel(e.target.value)} placeholder="Escribe el modelo" />}
              </label>
              {(adminCustomModel || (adminModel && !adminAvailableModels.includes(adminModel) && adminAvailableModels.length > 0)) && <label>Escribe el modelo<input value={adminModel} onChange={(e) => setAdminModel(e.target.value)} /></label>}
              <label>Año<input value={adminYear} onChange={(e) => setAdminYear(e.target.value)} inputMode="numeric" /></label>
              <label>Chasis / VIN<input value={adminVin} onChange={(e) => setAdminVin(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} /></label>
            </div>
          </details>

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
                        {offer.name} - {offer.plan}{isAdmin && offer.installmentAmount && offer.installmentCount && offer.installmentCount > 1 ? ` · ${offer.installmentCount} cuotas de S/ ${offer.installmentAmount.toFixed(2)}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="selected-price-result">
                  <span>Precio cotizado</span>
                  <strong>S/ {(selectedFinalPrice || 0).toFixed(2)}</strong>
                  {isAdmin && selectedOffer?.installmentAmount && selectedOffer.installmentCount && selectedOffer.installmentCount > 1 && (
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
            <button className="button" type="submit" disabled={!selectedOffer || !selectedFinalPrice}>
              {selectedOffer && selectedFinalPrice ? `Guardar cotización · S/ ${selectedFinalPrice.toFixed(2)}` : 'Primero busca la placa'}
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
                      {q.status === 'EMITIDA' || q.status === 'ANULADA' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: q.status === 'ANULADA' ? '#fee2e2' : '#dcfce7',
                            color: q.status === 'ANULADA' ? '#b42318' : '#15803d',
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700
                          }}
                        >
                          {q.status === 'ANULADA' ? 'ANULADO' : 'EMITIDO'}
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
                          onClick={() => openQuoteDetail(q)}
                        >
                          Ver detalle
                        </button>
                        {q.status === 'EMITIDA' ? (
                          <button
                            className="button ghost"
                            style={{ padding: '6px 10px', fontSize: 12, color: '#b42318', borderColor: '#f2c5c0' }}
                            disabled={annullingQuoteId === q.id}
                            onClick={() => annulQuote(q)}
                          >
                            {annullingQuoteId === q.id ? 'Anulando…' : 'Anular'}
                          </button>
                        ) : q.status !== 'ANULADA' ? (
                          <button
                            className="button ghost"
                            style={{ padding: '6px 10px', fontSize: 12, color: '#b42318', borderColor: '#f2c5c0' }}
                            disabled={deletingQuoteId === q.id}
                            onClick={() => deleteQuote(q)}
                          >
                            {deletingQuoteId === q.id ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin && <section className="card tariff-card">
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
              <label>Precio anual<input className="price-editable" type="number" min="1" step="0.01" value={draft.annualPrice} onChange={(event) => setTariffDrafts((current) => ({ ...current, [id]: { ...draft, annualPrice: event.target.value } }))} /></label>
              <label>Cuota desde<input className="price-editable" type="number" min={tariffType === 'MOTO' ? 150 : 1} step="0.01" value={draft.installmentAmount} onChange={(event) => setTariffDrafts((current) => ({ ...current, [id]: { ...draft, installmentAmount: event.target.value } }))} /></label>
              <label>N.º cuotas<input type="number" min="1" step="1" value={draft.installmentCount} onChange={(event) => setTariffDrafts((current) => ({ ...current, [id]: { ...draft, installmentCount: event.target.value } }))} /></label>
              <button className="button" type="button" onClick={() => saveTariff(id)} disabled={savingTariff === id}>{savingTariff === id ? 'Guardando…' : 'Guardar'}</button>
            </div>;
          })}
        </div>
        {tariffType === 'MOTO' && <p className="tariff-note">Para motos, la cuota no puede ser menor a S/ 150. Ajusta el número de cuotas según el precio acordado.</p>}
      </section>}

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

            {selectedQuote.status !== 'EMITIDA' && selectedQuote.status !== 'ANULADA' && selectedQuote.offers && selectedQuote.offers.length > 0 && (
              <div>
                <h3 style={{ margin: '14px 0 8px', fontSize: 15 }}>Comparativa de Aseguradoras para esta Placa</h3>
                <table className="offers-table">
                  <thead>
                    <tr>
                      <th>Aseguradora</th>
                      <th>Plan</th>
                      <th>Beneficio Destacado</th>
                        <th>Precio Anual</th>
                        {canSell && <th>Cuotas</th>}
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
                        {canSell && <td>{off.installmentAmount && off.installmentCount && off.installmentCount > 1 ? `${off.installmentCount} × S/ ${off.installmentAmount.toFixed(2)}` : 'Pago único'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formulario de Verificación y Relleno de Datos Oficiales Antes de Emitir */}
            {selectedQuote.status !== 'EMITIDA' && selectedQuote.status !== 'ANULADA' && (
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
                      Marca del vehículo ({modalAvailableBrands.length} disponibles) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      value={editCustomBrand ? '__OTRA__' : (modalAvailableBrands.includes(resolveCatalogBrand(modalVehicleType, editBrand)) ? resolveCatalogBrand(modalVehicleType, editBrand) : (editBrand ? '__OTRA__' : ''))}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__OTRA__') {
                          setEditCustomBrand(true);
                          setEditBrand(''); setEditModel(''); setEditCustomModel(false);
                        } else {
                          setEditCustomBrand(false);
                          setEditBrand(val);
                          setEditModel('');
                          setEditCustomModel(false);
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
                    {(editCustomBrand || (editBrand && !modalAvailableBrands.includes(resolveCatalogBrand(modalVehicleType, editBrand)))) && (
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

                {canSell && <div className="payment-config">
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
                </div>}
                {canSell && <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  <strong>Emisión y certificado PDF</strong>
                  <p style={{ margin: 0, fontSize: 12 }}>Al emitir se asignará un número único de la serie 120605000-0 en adelante y se descargará el PDF.</p>
                  <label>Referencia del pago / comprobante *<input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} maxLength={200} /></label>
                  <label><input type="checkbox" checked={paymentConfirmed} onChange={e => setPaymentConfirmed(e.target.checked)} /> Confirmo que verifiqué el pago recibido y los datos para emitir.</label>
                </div>}
              </div>
            )}

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="button ghost" onClick={() => setSelectedQuote(null)}>
                Cerrar detalle
              </button>
              {selectedQuote.status === 'EMITIDA' && selectedQuote.policyUrl && <a className="button" href={selectedQuote.policyUrl} target="_blank" rel="noopener noreferrer">Ver póliza oficial</a>}
              {(selectedQuote.status === 'EMITIDA' || selectedQuote.status === 'ANULADA') && selectedQuote.policyNumber && <span style={{ alignSelf: 'center' }}>Póliza: <strong>{selectedQuote.policyNumber}</strong></span>}
              {selectedQuote.status === 'EMITIDA' && selectedQuote.policyNumber && <button className="button" onClick={() => generateAndDownloadSoatPdf(selectedQuote).catch(() => alert('No se pudo descargar el PDF. La póliza sigue guardada.'))}>Descargar PDF</button>}
              {canSell && selectedQuote.status !== 'EMITIDA' && selectedQuote.status !== 'ANULADA' && <button
                className="button"
                disabled={emitting || !paymentConfirmed || !paymentReference.trim()} title="Confirma los datos y el pago para emitir"
                style={{ background: '#16a34a' }}
                onClick={() => {
                  const q = selectedQuote;
                    if (!editHolderName.trim()) {
                      alert('Por favor ingresa los Nombres y Apellidos del Contratante / Titular antes de emitir.');
                      return;
                    }
                    const finalP = Number(editPrice);
                    if (!Number.isFinite(finalP) || finalP <= 0) {
                      alert('Ingresa un precio total válido.');
                      return;
                    }
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
                }}
              >
                {emitting ? 'Emitiendo…' : 'Emitir SOAT y generar PDF'}
              </button>}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
