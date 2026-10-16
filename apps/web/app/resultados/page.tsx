'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

type VehicleType = 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';

const tariffsByVehicle: Record<VehicleType, Record<string, number>> = {
  AUTO: {
    'la-positiva': 65.0,
    mapfre: 68.0,
    interseguro: 69.9,
    pacifico: 72.0,
    protecta: 62.0
  },
  MOTO: {
    'la-positiva': 165.0,
    mapfre: 180.0,
    interseguro: 175.0,
    pacifico: 195.0,
    protecta: 159.0
  },
  MOTOTAXI: {
    'la-positiva': 120.0,
    mapfre: 135.0,
    interseguro: 128.0,
    pacifico: 142.0,
    protecta: 115.0
  },
  VAN: {
    'la-positiva': 130.0,
    mapfre: 145.0,
    interseguro: 138.0,
    pacifico: 155.0,
    protecta: 125.0
  },
  CARGO: {
    'la-positiva': 210.0,
    mapfre: 235.0,
    interseguro: 225.0,
    pacifico: 250.0,
    protecta: 195.0
  }
};

// Tarifa oficial de mercado para Mototaxis en servicio de Taxi / Público (ej. Callao / Lima)
const mototaxiTaxiTariffs: Record<string, number> = {
  'la-positiva': 295.0,
  interseguro: 295.0,
  protecta: 285.0,
  mapfre: 298.0,
  pacifico: 305.0
};

const baseOffers = [
  {
    id: 'la-positiva',
    name: 'La Positiva Seguros',
    logo: 'la-positiva.png',
    plan: 'SOAT Digital Tradicional',
    badge: 'Tradicional',
    extras: ['Auxilio de batería 24/7 en ciudad', '1 servicio de grúa en ciudad', 'Atención médica legal inmediata']
  },
  {
    id: 'pacifico',
    name: 'Pacífico Seguros',
    logo: 'pacifico.png',
    plan: 'SOAT Pacífico Digital Plus',
    badge: 'Mejor valor',
    extras: ['Red médica preferencial de clínicas', 'Hasta 2 grúas anuales por siniestro', '200 CMR Puntos de bienvenida']
  },
  {
    id: 'mapfre',
    name: 'MAPFRE Perú',
    logo: 'mapfre.png',
    plan: 'SOAT Conectado MAPFRE',
    badge: 'Más asistencias',
    extras: ['Auxilio mecánico y cerrajería en ruta', 'Ambulancia 24 hrs en caso de emergencia', 'Descuentos en talleres afiliados']
  },
  {
    id: 'interseguro',
    name: 'Interseguro',
    logo: 'interseguro.png',
    plan: 'SOAT Digital Express',
    badge: '100% Digital',
    extras: ['Emisión y sincronización inmediata con MTC', 'Orientación médica telefónica 24/7', 'Asistencia express en ruta']
  },
  {
    id: 'protecta',
    name: 'Protecta Security',
    logo: 'protecta.png',
    plan: 'SOAT Protecta Flex',
    badge: 'Tarifa económica',
    extras: ['Atención médica hospitalaria inmediata', 'Orientación legal en ruta', 'Red de auxilio básico']
  }
];

export default function ResultsPage() {
  const [selected, setSelected] = useState<string[]>(['la-positiva', 'pacifico']);
  const [plate, setPlate] = useState('ABC-123');
  const [vehicleType, setVehicleType] = useState<VehicleType>('AUTO');
  const [department, setDepartment] = useState('Lima');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | string>(2023);
  const [vehicleUse, setVehicleUse] = useState<'PARTICULAR' | 'TAXI'>('PARTICULAR');
  const [vin, setVin] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  // Modal edit temporary state
  const [editPlate, setEditPlate] = useState('');
  const [editType, setEditType] = useState<VehicleType>('AUTO');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editYear, setEditYear] = useState<number | string>(2023);
  const [editUse, setEditUse] = useState<'PARTICULAR' | 'TAXI'>('PARTICULAR');
  const [editDep, setEditDep] = useState('Lima');
  const [editVin, setEditVin] = useState('');

  const [sortBy, setSortBy] = useState<'price' | 'value'>('price');
  const [selectedInsurers, setSelectedInsurers] = useState<string[]>([
    'la-positiva',
    'pacifico',
    'mapfre',
    'interseguro',
    'protecta'
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = (params.get('placa') || params.get('plate') || '').toUpperCase().trim();
    if (p) setPlate(p);

    const t = (params.get('tipo') || '').toUpperCase() as VehicleType;
    if (['AUTO', 'MOTO', 'MOTOTAXI', 'VAN', 'CARGO'].includes(t)) {
      setVehicleType(t);
    } else if (/^\d{2,4}/.test(p)) {
      setVehicleType('MOTO');
    }

    const d = params.get('dep') || params.get('zona');
    if (d) setDepartment(d.charAt(0).toUpperCase() + d.slice(1));

    const b = params.get('marca');
    if (b) setBrand(b);

    const m = params.get('modelo');
    if (m) setModel(m);

    const y = params.get('ano');
    if (y) setYear(y);

    const u = (params.get('uso') || '').toUpperCase();
    if (u === 'TAXI') setVehicleUse('TAXI');

    const s = params.get('serie');
    if (s) setVin(s);

    // Caso específico para la placa 7463-BS del padrón
    if (p === '7463-BS' || p === '7463BS') {
      setPlate('7463-BS');
      setVehicleType('MOTOTAXI');
      setBrand('Zongshen');
      setModel('ZS');
      setYear(2017);
      setVehicleUse('TAXI');
      setDepartment('Callao');
      setVin('LZSPCKLF9J1023000');
    }
  }, []);

  function handleOpenEdit() {
    setEditPlate(plate);
    setEditType(vehicleType);
    setEditBrand(brand);
    setEditModel(model);
    setEditYear(year);
    setEditUse(vehicleUse);
    setEditDep(department);
    setEditVin(vin);
    setShowEditModal(true);
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setPlate(editPlate.toUpperCase());
    setVehicleType(editType);
    setBrand(editBrand);
    setModel(editModel);
    setYear(editYear);
    setVehicleUse(editUse);
    setDepartment(editDep);
    setVin(editVin.toUpperCase());
    setShowEditModal(false);
  }

  const isMototaxiTaxi =
    vehicleType === 'MOTOTAXI' &&
    (vehicleUse === 'TAXI' || department.toLowerCase().includes('callao'));

  const offersWithPricing = useMemo(() => {
    const prices = isMototaxiTaxi ? mototaxiTaxiTariffs : (tariffsByVehicle[vehicleType] || tariffsByVehicle.AUTO);
    return baseOffers.map((o) => ({
      ...o,
      price: prices[o.id] || 65.0,
      badge: isMototaxiTaxi && o.id === 'la-positiva' ? 'Tarifa Oficial Taxi' : o.badge
    }));
  }, [vehicleType, isMototaxiTaxi]);

  const filteredAndSortedOffers = useMemo(() => {
    const list = offersWithPricing.filter((o) => selectedInsurers.includes(o.id));
    if (sortBy === 'price') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    return list;
  }, [offersWithPricing, selectedInsurers, sortBy]);

  function toggleCompare(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  function toggleInsurerFilter(id: string) {
    setSelectedInsurers((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    );
  }

  const vehicleLabel =
    vehicleType === 'MOTO'
      ? 'Motocicleta'
      : vehicleType === 'MOTOTAXI'
      ? 'Mototaxi'
      : vehicleType === 'VAN'
      ? 'Van / Minibús'
      : vehicleType === 'CARGO'
      ? 'Carga / Pesado'
      : 'Auto / Camioneta particular';

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Head */}
      <div className="mb-6">
        <span className="text-[12px] font-bold text-[#486800] uppercase tracking-wider">
          Paso 2 de 3 · Comparador Oficial
        </span>
        <h1 className="text-[30px] sm:text-[36px] font-extrabold text-[#161c22] mt-1">
          Compara y elige tu SOAT digital
        </h1>
        <p className="text-[14px] text-[#434935] mt-1">
          La cobertura legal obligatoria es equivalente por mandato de la SBS en todas las opciones. Compara precios y beneficios comerciales.
        </p>
      </div>

      {/* Summary Bar - Con botón para modificar y completar datos técnicos */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#dde3eb] shadow-xs flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-2 border-[#161c22] rounded-xl px-4 py-2 bg-[#fdfdfd] shadow-xs">
            <span className="text-[11px] font-extrabold text-[#486800]">PE</span>
            <span className="text-[18px] font-extrabold tracking-wider">{plate}</span>
          </div>
          <div>
            <strong className="text-[14px] text-[#161c22] block font-extrabold">
              {brand ? `${brand} ${model} (${year}) · ` : ''}Categoría: {vehicleLabel}
            </strong>
            <span className="text-[12px] text-[#434935] block">
              Circulación: <strong>{department}</strong> · Uso: <strong>{vehicleUse === 'TAXI' ? 'Taxi / Público' : 'Particular'}</strong>
              {vin ? ` · Serie: ${vin}` : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenEdit}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-[#161c22] hover:border-[#486800] hover:text-[#486800] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
          <span>Modificar datos</span>
        </button>
      </div>

      {/* Modal de Modificación de Datos del Vehículo */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-lg w-full rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-[#dde3eb]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#486800] text-[22px]">tune</span>
                <h3 className="text-[18px] font-extrabold text-[#161c22]">
                  Modificar datos del vehículo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#161c22] block mb-1">Número de placa</label>
                  <input
                    type="text"
                    required
                    value={editPlate}
                    onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-bold uppercase outline-none focus:border-[#486800]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#161c22] block mb-1">Clase / Categoría</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as VehicleType)}
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-semibold outline-none focus:border-[#486800] bg-white"
                  >
                    <option value="AUTO">Auto / Camioneta</option>
                    <option value="MOTO">Moto lineal</option>
                    <option value="MOTOTAXI">Mototaxi (Trimoto)</option>
                    <option value="VAN">Van / Minibús</option>
                    <option value="CARGO">Carga / Pesado</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#161c22] block mb-1">Marca del vehículo</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    placeholder="Ej. Zongshen, Bajaj, Toyota"
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-semibold outline-none focus:border-[#486800]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#161c22] block mb-1">Modelo</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    placeholder="Ej. ZS, Torito, Corolla"
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-semibold outline-none focus:border-[#486800]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#161c22] block mb-1">Año de fabricación</label>
                  <input
                    type="number"
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-semibold outline-none focus:border-[#486800]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#161c22] block mb-1">Zona de circulación</label>
                  <select
                    value={editDep}
                    onChange={(e) => setEditDep(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-semibold outline-none focus:border-[#486800] bg-white"
                  >
                    <option value="Callao">Callao</option>
                    <option value="Lima">Lima y Callao</option>
                    <option value="Arequipa">Arequipa</option>
                    <option value="Cusco">Cusco</option>
                    <option value="La Libertad">La Libertad</option>
                    <option value="Piura">Piura</option>
                    <option value="Otro">Otro departamento</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-[#161c22] block mb-1">Uso del vehículo</label>
                  <select
                    value={editUse}
                    onChange={(e) => setEditUse(e.target.value as 'PARTICULAR' | 'TAXI')}
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-semibold outline-none focus:border-[#486800] bg-white"
                  >
                    <option value="PARTICULAR">Particular (Uso privado)</option>
                    <option value="TAXI">Taxi / Servicio de transporte público</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-[#161c22] block mb-1">Nro. de Serie / Chasis (opcional)</label>
                  <input
                    type="text"
                    value={editVin}
                    onChange={(e) => setEditVin(e.target.value.toUpperCase())}
                    placeholder="Ej. LZSPCKLF9J1023000"
                    className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] text-xs font-semibold outline-none uppercase font-mono focus:border-[#486800]"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#486800] hover:bg-[#385c00] text-white text-xs font-extrabold shadow-sm transition-all"
                >
                  Guardar y recalcular ofertas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid: Filters + Offers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Filters Sidebar (4 cols) */}
        <aside className="lg:col-span-4 bg-white p-6 rounded-2xl border border-[#dde3eb] shadow-xs space-y-6">
          <div>
            <h3 className="text-[14px] font-bold text-[#161c22] mb-3">Ordenar ofertas</h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'price' | 'value')}
              className="w-full h-11 px-3 rounded-xl border border-[#dde3eb] bg-white text-xs font-semibold text-[#161c22] outline-none"
            >
              <option value="price">Menor precio primero</option>
              <option value="value">Mejor valor recomendado</option>
            </select>
          </div>

          <hr className="border-[#dde3eb]" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-[#161c22]">Aseguradoras (5)</h3>
              <span className="text-[11px] text-[#486800] font-bold">{selectedInsurers.length} de 5</span>
            </div>
            <div className="space-y-2.5">
              {baseOffers.map((o) => (
                <label key={o.id} className="flex items-center gap-2.5 text-xs text-[#434935] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedInsurers.includes(o.id)}
                    onChange={() => toggleInsurerFilter(o.id)}
                    className="rounded text-[#486800] focus:ring-[#8bc500] h-4 w-4"
                  />
                  <span className="font-semibold text-[#161c22]">{o.name}</span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-[#dde3eb]" />

          <div className="p-3.5 rounded-xl bg-[#f4f9ea] border border-[#486800]/20 text-xs text-[#1c3300] space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[16px] text-[#486800]">verified</span>
              <span>Coberturas Oficiales 2026</span>
            </div>
            <p className="text-[11px] text-[#434935] leading-relaxed">
              Muerte o invalidez permanente: hasta 4 UIT (S/ 22,000). Gastos médicos: hasta 5 UIT (S/ 27,500). UIT 2026 = S/ 5,500.
            </p>
          </div>
        </aside>

        {/* Offers Cards (8 cols) */}
        <section className="lg:col-span-8 space-y-4">
          {filteredAndSortedOffers.map((offer) => {
            const isCompared = selected.includes(offer.id);
            const targetUrl = `/pago?oferta=${offer.id}&placa=${encodeURIComponent(plate)}&tipo=${vehicleType}&dep=${encodeURIComponent(department)}&marca=${encodeURIComponent(brand)}&modelo=${encodeURIComponent(model)}&ano=${year}&uso=${vehicleUse}&serie=${encodeURIComponent(vin)}&precio=${offer.price}`;

            return (
              <article
                key={offer.id}
                className="bg-white p-6 rounded-2xl border border-[#dde3eb] hover:border-[#486800]/60 hover:shadow-md transition-all shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#434935]">
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => toggleCompare(offer.id)}
                        className="rounded text-[#486800] focus:ring-[#8bc500] h-4 w-4"
                      />
                      <span>Comparar</span>
                    </label>

                    <div className="h-10 w-28 flex items-center">
                      <Image
                        src={`/assets/logos/${offer.logo}`}
                        alt={offer.name}
                        width={112}
                        height={36}
                        className="max-h-8 w-auto object-contain"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#486800] bg-[#f4f9ea] px-2.5 py-0.5 rounded-full border border-[#486800]/20 block w-fit">
                        {offer.badge}
                      </span>
                      <h2 className="font-extrabold text-[16px] text-[#161c22] mt-0.5">{offer.plan}</h2>
                    </div>

                    <div className="text-right">
                      <span className="text-[26px] font-extrabold text-[#161c22] leading-none block">
                        S/ {offer.price.toFixed(2)}
                      </span>
                      <small className="text-[11px] text-[#434935]">Pago anual referencial</small>
                    </div>
                  </div>
                </div>

                <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <strong className="text-[#161c22] block font-bold mb-1">Cobertura Obligatoria de Ley</strong>
                    <p className="text-[#434935] leading-relaxed text-[11.5px]">
                      Hasta 4 UIT (S/ 22,000) por fallecimiento / invalidez y 5 UIT (S/ 27,500) en gastos médicos.
                    </p>
                  </div>

                  <div>
                    <strong className="text-[#161c22] block font-bold mb-1">Beneficios y Asistencias</strong>
                    <ul className="space-y-1 text-[#434935] text-[11.5px]">
                      {offer.extras.map((ex, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="text-[#486800] font-bold">✓</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                  <Link
                    href={targetUrl}
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#8bc500] hover:bg-[#7ab000] text-[#344d00] font-extrabold text-xs shadow-xs transition-all active:scale-[0.98]"
                  >
                    <span>Elegir esta oferta</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {/* Floating Comparison Drawer */}
      {selected.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-[1200px] mx-auto z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-[#dde3eb] shadow-xl flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#486800] text-[24px]">compare_arrows</span>
            <div>
              <strong className="text-xs font-bold text-[#161c22] block">
                {selected.length} {selected.length === 1 ? 'oferta seleccionada' : 'ofertas seleccionadas'}
              </strong>
              <span className="text-[11px] text-[#434935]">Compara hasta 3 aseguradoras frente a frente</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected([])}
              className="px-3 py-2 text-xs font-semibold text-[#434935] hover:text-[#161c22]"
            >
              Limpiar
            </button>
            <Link
              href={`/comparar?ofertas=${selected.join(',')}&placa=${encodeURIComponent(plate)}&tipo=${vehicleType}`}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#486800] hover:bg-[#385c00] text-white text-xs font-extrabold shadow-sm transition-all"
            >
              <span>Comparar ahora</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
