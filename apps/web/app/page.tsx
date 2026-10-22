'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useRef, useMemo } from 'react';
import { getBrandsForType, getModelsForBrand } from '@/lib/vehicleCatalog';

type VehicleType = 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';

interface DetectedVehicle {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  vehicleType: VehicleType;
  minPrice: number;
  vin?: string;
  use?: string;
  zone?: string;
}

const fallbackCatalog: Record<string, DetectedVehicle> = {
  '7463-BS': {
    brand: 'Zongshen',
    model: 'ZS',
    year: 2017,
    color: 'Azul',
    vehicleType: 'MOTOTAXI',
    plate: '7463-BS',
    minPrice: 285.0,
    vin: 'LZSPCKLF9J1023000',
    use: 'TAXI',
    zone: 'callao'
  },
  '7463BS': {
    brand: 'Zongshen',
    model: 'ZS',
    year: 2017,
    color: 'Azul',
    vehicleType: 'MOTOTAXI',
    plate: '7463-BS',
    minPrice: 285.0,
    vin: 'LZSPCKLF9J1023000',
    use: 'TAXI',
    zone: 'callao'
  },
  '0000-AA': { brand: 'Suzuki', model: 'GSX-R150 ABS', year: 2020, color: 'Negro', vehicleType: 'MOTO', plate: '0000-AA', minPrice: 630.0 },
  '0000AA': { brand: 'Suzuki', model: 'GSX-R150 ABS', year: 2020, color: 'Negro', vehicleType: 'MOTO', plate: '0000-AA', minPrice: 630.0 },
  'ABC-123': { brand: 'Toyota', model: 'Corolla 1.8 XEi', year: 2023, color: 'Gris Oscuro', vehicleType: 'AUTO', plate: 'ABC-123', minPrice: 32.0 },
  'ABC123': { brand: 'Toyota', model: 'Corolla 1.8 XEi', year: 2023, color: 'Gris Oscuro', vehicleType: 'AUTO', plate: 'ABC-123', minPrice: 32.0 },
  'AMY-477': { brand: 'BMW', model: '118i', year: 2013, color: 'Blanco', vehicleType: 'AUTO', plate: 'AMY-477', minPrice: 32.0, vin: 'WBA1A3104EJ681960' },
  'AMY477': { brand: 'BMW', model: '118i', year: 2013, color: 'Blanco', vehicleType: 'AUTO', plate: 'AMY-477', minPrice: 32.0, vin: 'WBA1A3104EJ681960' },
  'F3B-842': { brand: 'Hyundai', model: 'H-1 Minibus', year: 2022, color: 'Blanco', vehicleType: 'VAN', plate: 'F3B-842', minPrice: 125.0 },
  'F3B842': { brand: 'Hyundai', model: 'H-1 Minibus', year: 2022, color: 'Blanco', vehicleType: 'VAN', plate: 'F3B-842', minPrice: 125.0 },
  'T8K-912': { brand: 'Volvo', model: 'FH 460 6x4', year: 2021, color: 'Rojo', vehicleType: 'CARGO', plate: 'T8K-912', minPrice: 195.0 },
  'T8K912': { brand: 'Volvo', model: 'FH 460 6x4', year: 2021, color: 'Rojo', vehicleType: 'CARGO', plate: 'T8K-912', minPrice: 195.0 },
  '6543-2B': { brand: 'Bajaj', model: 'Torito RE 4S', year: 2024, color: 'Azul', vehicleType: 'MOTOTAXI', plate: '6543-2B', minPrice: 115.0 },
  '65432B': { brand: 'Bajaj', model: 'Torito RE 4S', year: 2024, color: 'Azul', vehicleType: 'MOTOTAXI', plate: '6543-2B', minPrice: 115.0 }
};

const popularBrandsByType: Record<VehicleType, string[]> = {
  AUTO: ['Toyota', 'Hyundai', 'Kia', 'Nissan', 'Suzuki', 'BMW', 'Chevrolet', 'Volkswagen', 'Honda', 'Mazda'],
  MOTO: ['Honda', 'Yamaha', 'Bajaj', 'Wanxin', 'Zongshen', 'Ronco', 'Suzuki', 'Italika'],
  MOTOTAXI: ['Bajaj', 'Zongshen', 'Wanxin', 'TVS', 'Motokar'],
  VAN: ['Hyundai', 'Toyota', 'Kia', 'Foton', 'JAC', 'Chevrolet'],
  CARGO: ['Volvo', 'Scania', 'Mercedes-Benz', 'Hino', 'Isuzu', 'Freightliner']
};

const vehicleTabs: { type: VehicleType; label: string; icon: string; placeholder: string }[] = [
  { type: 'AUTO', label: 'Auto / Camioneta', icon: 'directions_car', placeholder: 'ABC-123' },
  { type: 'MOTO', label: 'Moto', icon: 'two_wheeler', placeholder: '0000-AA' },
  { type: 'MOTOTAXI', label: 'Mototaxi', icon: 'electric_rickshaw', placeholder: '6543-2B' },
  { type: 'VAN', label: 'Van', icon: 'airport_shuttle', placeholder: 'F3B-842' },
  { type: 'CARGO', label: 'Carga / Pesado', icon: 'local_shipping', placeholder: 'T8K-912' }
];

const insurers = [
  { slug: 'la-positiva', name: 'La Positiva', logo: '/assets/logos/la-positiva.png' },
  { slug: 'pacifico', name: 'Pacífico Seguros', logo: '/assets/logos/pacifico.png' },
  { slug: 'mapfre', name: 'MAPFRE Perú', logo: '/assets/logos/mapfre.png' },
  { slug: 'interseguro', name: 'Interseguro', logo: '/assets/logos/interseguro.png' },
  { slug: 'protecta', name: 'Protecta Security', logo: '/assets/logos/protecta.png' }
];

const faqs = [
  {
    q: '¿Qué coberturas incluye el SOAT obligatorio por ley?',
    a: 'Por normativa SBS y D.S. N° 024-2002-MTC, el SOAT cubre hasta 4 UIT por fallecimiento (S/ 22,000), hasta 4 UIT por invalidez permanente (S/ 22,000), hasta 1 UIT por incapacidad temporal (S/ 5,500), hasta 5 UIT en gastos médicos y hospitalarios (S/ 27,500) y hasta 1 UIT en gastos de sepelio (S/ 5,500). UIT 2026 = S/ 5,500.'
  },
  {
    q: '¿Cómo se valida la autenticidad de mi certificado electrónico?',
    a: 'Cada certificado emitido incluye un código QR único que enlaza directamente con el Registro Nacional de APESEG y la base oficial del Ministerio de Transportes y Comunicaciones (MTC). La Policía Nacional y autoridades de tránsito validan la vigencia al instante mediante la placa vehicular.'
  },
  {
    q: '¿Cuánto tiempo tarda en activarse el SOAT tras la emisión?',
    a: 'La activación es inmediata en el sistema de la aseguradora elegida y se sincroniza en línea con APESEG y la base de datos nacional del MTC.'
  },
  {
    q: '¿Por qué cotizar a través de Seguros Falabella?',
    a: 'Porque somos un corredor autorizado SBS (Reg. J-0723) que compara las 5 principales aseguradoras del país de forma transparente, sin inventar tarifas ni simular valores, permitiendo obtener el mejor precio real.'
  }
];

export default function HomePage() {
  const router = useRouter();

  const [vehicleType, setVehicleType] = useState<VehicleType>('AUTO');
  const [plate, setPlate] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [detectedVehicle, setDetectedVehicle] = useState<DetectedVehicle | null>(null);
  const [lookupMessage, setLookupMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  // Technical vehicle details that the user or catalog can fill in
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | string>(2023);
  const [vehicleUse, setVehicleUse] = useState<'PARTICULAR' | 'PUBLICO' | 'COMERCIAL'>('PARTICULAR');
  const [vin, setVin] = useState('');
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showMoreVehicleTypes, setShowMoreVehicleTypes] = useState(false);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);

  const [department, setDepartment] = useState('lima');
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [termsAccepted, setTermsAccepted] = useState(true);

  const availableBrands = useMemo(() => getBrandsForType(vehicleType), [vehicleType]);
  const availableModels = useMemo(() => getModelsForBrand(vehicleType, brand), [vehicleType, brand]);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Consulta al padrón vehicular (backend o catálogo contingencia)
  async function lookupVehicle(plateToLookup: string): Promise<DetectedVehicle | null> {
    const clean = plateToLookup.trim().toUpperCase();
    if (clean.length < 5) return null;

    setLookingUp(true);
    setLookupMessage(null);

    try {
      let v: DetectedVehicle | null = null;

      // 1. Consulta al backend si está disponible
      try {
        const res = await fetch(`/api/backend/v1/vehicles/${encodeURIComponent(clean)}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            const availableOffers = Array.isArray(json.offers)
              ? json.offers.filter((o: { available?: boolean; price?: number }) => o.available && (o.price || 0) > 0)
              : [];
            const minPrice = availableOffers.length > 0
              ? Math.min(...availableOffers.map((o: { price: number }) => o.price))
              : (json.data.vehicleType === 'MOTO' ? 630.0 : 32.0);
            if (json.data.brand && json.data.model) {
              v = {
                brand: json.data.brand,
                model: json.data.model,
                year: json.data.year || 2026,
                color: json.data.color || 'Registrado',
                plate: json.data.plate,
                vehicleType: json.data.vehicleType,
                minPrice,
                vin: json.data.vin || json.data.chassisNumber,
                use: json.data.use,
                zone: json.data.department
              };
            } else if (json.data.vehicleType) {
              setVehicleType(json.data.vehicleType);
            }
          }
        }
      } catch {}

      // 2. Catálogo verificado de contingencia
      if (!v) {
        const normalized = clean.replace(/\s+/g, '');
        const fallback = fallbackCatalog[normalized] || fallbackCatalog[normalized.replace('-', '')];
        if (fallback) v = fallback;
      }

      if (v) {
        setDetectedVehicle(v);
        setVehicleType(v.vehicleType);
        if (v.brand) setBrand(v.brand);
        if (v.model) setModel(v.model);
        if (v.year) setYear(v.year);
        if (v.vin) setVin(v.vin);
        if (v.use === 'TAXI' || v.use === 'PUBLICO') setVehicleUse('PUBLICO');
        if (v.use === 'COMERCIAL') setVehicleUse('COMERCIAL');
        if (v.zone) setDepartment(v.zone.toLowerCase().includes('callao') ? 'callao' : v.zone);
        setShowTechDetails(true);
        return v;
      } else {
        setDetectedVehicle(null);
        setLookupMessage({
          text: `Placa ${clean} detectada. No figura en el padrón automático: confirma la marca y modelo abajo para cotizar con precisión.`,
          type: 'info'
        });
        setShowTechDetails(true);
        return null;
      }
    } catch {
      setDetectedVehicle(null);
      setLookupMessage({
        text: 'No fue posible consultar el padrón. Puedes ingresar los datos técnicos del vehículo.',
        type: 'info'
      });
      setShowTechDetails(true);
      return null;
    } finally {
      setLookingUp(false);
    }
  }

  // Mueve dinámicamente la pestaña según la placa y consulta automáticamente al completar formato
  function handlePlateInput(raw: string) {
    let value = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (/^\d{4}/.test(value) && value.length > 4) {
      value = value.slice(0, 4) + '-' + value.slice(4, 7);
    } else if (value.length > 3) {
      value = value.slice(0, 3) + '-' + value.slice(3, 7);
    }
    setPlate(value);
    setLookupMessage(null);

    // Detección dinámica de pestaña según patrón
    const clean = value.replace(/[^A-Z0-9]/g, '');
    if (/^\d{2,4}/.test(clean)) {
      if (vehicleType !== 'MOTOTAXI') {
        setVehicleType('MOTO');
      }
    } else if (/^[A-Z]{2,3}/.test(clean)) {
      if (vehicleType !== 'VAN' && vehicleType !== 'CARGO') {
        setVehicleType('AUTO');
      }
    }

    // Al tener una placa completa (6 caracteres), consulta automáticamente sin requerir botón secundario
    if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
    if (clean.length >= 6) {
      lookupTimeoutRef.current = setTimeout(() => {
        lookupVehicle(value);
      }, 400);
    } else if (detectedVehicle) {
      setDetectedVehicle(null);
    }
  }

  // Envío del formulario: única acción que valida, consulta si falta y cotiza
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const finalPlate = plate.trim().toUpperCase() || 'ABC-123';

    let v = detectedVehicle;
    if (!v) {
      v = await lookupVehicle(finalPlate);
    }

    const params = new URLSearchParams({
      placa: finalPlate,
      tipo: v?.vehicleType || vehicleType,
      dep: department
    });
    const finalBrand = brand || v?.brand || '';
    const finalModel = model || v?.model || '';
    const finalYear = year || v?.year || '';
    const finalUse = vehicleUse || v?.use || 'PARTICULAR';
    const finalVin = vin || v?.vin || '';

    if (finalBrand) params.set('marca', finalBrand);
    if (finalModel) params.set('modelo', finalModel);
    if (finalYear) params.set('ano', String(finalYear));
    if (finalUse) params.set('uso', finalUse);
    if (finalVin) params.set('serie', finalVin);
    if (holderName.trim()) params.set('titular', holderName.trim());
    if (documentType) params.set('docType', documentType);
    if (documentNumber.trim()) params.set('docNum', documentNumber.trim());

    router.push(`/resultados?${params.toString()}`);
  }

  const currentTab = vehicleTabs.find((t) => t.type === vehicleType) || vehicleTabs[0];
  const primaryVehicleTabs = vehicleTabs.filter((tab) => tab.type === 'AUTO' || tab.type === 'MOTO');
  const additionalVehicleTabs = vehicleTabs.filter((tab) => tab.type !== 'AUTO' && tab.type !== 'MOTO');

  return (
    <main className="marketing-home flex-grow">
      {/* 3. HERO SECTION (Layout 2 columnas) */}
      <section className="home-hero max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 lg:pt-12 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Columna Izquierda: Cotizador Hero Dominante (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6" id="cotizador">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#F4F9EA] text-[#486800] px-3.5 py-1.5 rounded-full border border-[#486800]/20 text-[12px] font-bold mb-3">
                <span className="material-symbols-outlined text-[#486800] text-[18px]">verified</span>
                <span>SOAT 100% digital oficial</span>
              </div>
              <h1 className="text-[36px] sm:text-[44px] font-extrabold text-[#161c22] leading-tight tracking-tight">
                Cotiza y compara tu SOAT en minutos
              </h1>
              <p className="mt-2 text-[17px] text-[#434935] leading-relaxed">
                Encuentra la compañía ideal para tu auto o moto y recibe tu póliza digital respaldada por las 5 aseguradoras autorizadas.
              </p>
              <Link
                href="/consultar-soat"
                className="mt-2 inline-flex w-fit items-center gap-2 text-sm font-extrabold text-[#486800] underline decoration-[#8bc500] decoration-2 underline-offset-4 hover:text-[#344d00]"
              >
                ¿Ya tienes SOAT? Consulta su vigencia
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>

            {/* Selector de pestañas dinámico */}
            <div className="vehicle-tabs bg-[#e3e9f0] p-1.5 rounded-2xl flex gap-1" role="tablist">
              {primaryVehicleTabs.map((tab) => {
                const isActive = vehicleType === tab.type;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    onClick={() => {
                      setVehicleType(tab.type);
                      setLookupMessage(null);
                    }}
                    className={`flex-1 min-w-[90px] py-2.5 px-3 rounded-xl text-center text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#486800] shadow-sm scale-[1.02]'
                        : 'text-[#434935] hover:text-[#161c22] hover:bg-white/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowMoreVehicleTypes((current) => !current)}
                className={`vehicle-more-trigger flex-1 min-w-[108px] py-2.5 px-3 rounded-xl text-center text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  vehicleType !== 'AUTO' && vehicleType !== 'MOTO'
                    ? 'bg-white text-[#486800] shadow-sm'
                    : 'text-[#434935] hover:text-[#161c22] hover:bg-white/60'
                }`}
                aria-expanded={showMoreVehicleTypes}
              >
                <span className="material-symbols-outlined text-[18px]">{vehicleType !== 'AUTO' && vehicleType !== 'MOTO' ? currentTab.icon : 'more_horiz'}</span>
                <span>{vehicleType !== 'AUTO' && vehicleType !== 'MOTO' ? currentTab.label : 'Más tipos'}</span>
                <span className="material-symbols-outlined text-[16px]">{showMoreVehicleTypes ? 'expand_less' : 'expand_more'}</span>
              </button>
              {showMoreVehicleTypes && (
                <div className="vehicle-more-menu absolute z-10 mt-[58px] right-0 min-w-[190px] rounded-xl border border-[#dbe4d7] bg-white p-1.5 shadow-lg">
                  {additionalVehicleTabs.map((tab) => (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => {
                        setVehicleType(tab.type);
                        setLookupMessage(null);
                        setShowMoreVehicleTypes(false);
                      }}
                      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold ${
                        vehicleType === tab.type ? 'bg-[#f4f9ea] text-[#486800]' : 'text-[#434935] hover:bg-[#f8faf4]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario Principal de Cotización */}
            <form
              onSubmit={handleSubmit}
              className="quote-form bg-white p-6 sm:p-8 rounded-2xl border border-[#dde3eb] shadow-md space-y-5"
            >
              {/* Campo de Placa con Botón de Búsqueda */}
              <div>
                <label className="block text-[14px] font-bold text-[#161c22] mb-1.5" htmlFor="placa">
                  Número de placa <span className="text-[#ba1a1a]">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <div className="flex items-center gap-1 bg-[#e9eef6] px-1.5 py-0.5 rounded border border-[#dde3eb] text-[11px] font-extrabold text-[#161c22]">
                      <span>🇵🇪</span>
                      <span>PE</span>
                    </div>
                  </div>
                  <input
                    id="placa"
                    name="placa"
                    type="text"
                    maxLength={9}
                    required
                    value={plate}
                    onChange={(e) => handlePlateInput(e.target.value)}
                    placeholder={`Ej. ${currentTab.placeholder}`}
                    className="w-full h-[54px] pl-16 pr-12 rounded-xl border border-[#dde3eb] bg-white text-[#161c22] text-center font-bold tracking-widest text-[19px] uppercase focus:border-[#486800] focus:ring-4 focus:ring-[#8bc500]/25 transition-all outline-none"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    {lookingUp ? (
                      <span className="material-symbols-outlined text-[20px] text-[#486800] animate-spin">sync</span>
                    ) : detectedVehicle ? (
                      <span className="material-symbols-outlined text-[20px] text-[#4e7f00]">verified</span>
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-[#a0a6b5]">directions_car</span>
                    )}
                  </div>
                </div>

                {/* Tarjeta de Vehículo Identificado */}
                {detectedVehicle && (
                  <div className="mt-2.5 p-3 rounded-xl border border-[#4e7f00] bg-[#f4f9ea] text-[#1c3300] text-xs flex items-start gap-2.5 shadow-xs animate-fade-in">
                    <span className="material-symbols-outlined text-[20px] text-[#4e7f00] shrink-0 mt-0.5">verified</span>
                    <div>
                      <strong className="font-extrabold text-[13px] block text-[#1c3300]">
                        Vehículo identificado: {detectedVehicle.brand} {detectedVehicle.model} ({detectedVehicle.year})
                      </strong>
                      <span>
                        Color: {detectedVehicle.color} · Placa: <strong>{detectedVehicle.plate}</strong> · SOAT desde{' '}
                        <strong className="text-[#4e7f00] text-[14px]">S/ {detectedVehicle.minPrice.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Mensaje de Info o Alerta */}
                {lookupMessage && (
                  <div className="mt-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-700">info</span>
                    <span>{lookupMessage.text}</span>
                  </div>
                )}

                <p className="mt-1.5 text-[11px] text-[#434935]/80">
                  Validación automática según el padrón vehicular oficial.
                </p>

                {/* Acordeón de Datos Técnicos Completables */}
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="text-[12px] font-bold text-[#486800] hover:text-[#385c00] flex items-center justify-between w-full py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[17px]">tune</span>
                      <span>{showTechDetails ? 'Ocultar datos técnicos del vehículo' : '¿Deseas verificar o ingresar Marca, Modelo, Año o Uso?'}</span>
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      {showTechDetails ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {showTechDetails && (
                    <div className="mt-2.5 p-3.5 bg-[#f8faf4] border border-[#d8e7bd] rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-fade-in">
                      <div>
                        <label className="font-bold text-[#161c22] block mb-1">
                          Marca del vehículo <span className="text-[#ba1a1a]">*</span>
                        </label>
                        {/* Selector desplegable de Marca */}
                        <select
                          value={isCustomBrand ? '__OTRA__' : (availableBrands.includes(brand) ? brand : (brand ? '__OTRA__' : ''))}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__OTRA__') {
                              setIsCustomBrand(true);
                            } else {
                              setIsCustomBrand(false);
                              setBrand(val);
                              const models = getModelsForBrand(vehicleType, val);
                              if (models.length > 0 && !models.includes(model)) {
                                setModel(models[0]);
                                setIsCustomModel(false);
                              }
                            }
                          }}
                          className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none focus:border-[#486800] focus:ring-2 focus:ring-[#8bc500]/20"
                        >
                          <option value="">-- Selecciona una marca --</option>
                          {availableBrands.map((bName) => (
                            <option key={bName} value={bName}>
                              {bName}
                            </option>
                          ))}
                          <option value="__OTRA__">Otra marca...</option>
                        </select>

                        {/* Entrada manual para otra marca */}
                        {(isCustomBrand || (brand && !availableBrands.includes(brand))) && (
                          <input
                            type="text"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="Escribe la marca del vehículo"
                            className="mt-1.5 w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none focus:border-[#486800]"
                          />
                        )}

                        {/* Pills de acceso rápido para las marcas más comunes */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {availableBrands.slice(0, 5).map((bName) => (
                            <button
                              key={bName}
                              type="button"
                              onClick={() => {
                                setIsCustomBrand(false);
                                setBrand(bName);
                                const models = getModelsForBrand(vehicleType, bName);
                                if (models.length > 0) {
                                  setModel(models[0]);
                                  setIsCustomModel(false);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                                brand.toLowerCase() === bName.toLowerCase() && !isCustomBrand
                                  ? 'bg-[#486800] text-white border-[#486800]'
                                  : 'bg-white text-[#434935] border-slate-200 hover:border-[#486800]'
                              }`}
                            >
                              {bName}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="font-bold text-[#161c22] block mb-1">Modelo</label>
                        {availableModels.length > 0 ? (
                          <>
                            <select
                              value={isCustomModel ? '__OTRO__' : (availableModels.includes(model) ? model : (model ? '__OTRO__' : ''))}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__OTRO__') {
                                  setIsCustomModel(true);
                                } else {
                                  setIsCustomModel(false);
                                  setModel(val);
                                }
                              }}
                              className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none focus:border-[#486800] focus:ring-2 focus:ring-[#8bc500]/20"
                            >
                              <option value="">-- Selecciona el modelo --</option>
                              {availableModels.map((mName) => (
                                <option key={mName} value={mName}>
                                  {mName}
                                </option>
                              ))}
                              <option value="__OTRO__">Otro modelo...</option>
                            </select>
                            {(isCustomModel || (model && !availableModels.includes(model))) && (
                              <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="Escribe el modelo"
                                className="mt-1.5 w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none focus:border-[#486800]"
                              />
                            )}
                          </>
                        ) : (
                          <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="Escribe el modelo"
                            className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none focus:border-[#486800]"
                          />
                        )}
                      </div>
                      <div>
                        <label className="font-bold text-[#161c22] block mb-1">Año de fabricación</label>
                        <input
                          type="number"
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          placeholder="Año de fabricación"
                          className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none focus:border-[#486800]"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-[#161c22] block mb-1">Uso del vehículo</label>
                        <select
                          value={vehicleUse}
                          onChange={(e) => setVehicleUse(e.target.value as 'PARTICULAR' | 'PUBLICO' | 'COMERCIAL')}
                          className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none focus:border-[#486800]"
                        >
                          <option value="PARTICULAR">Particular (Personal)</option>
                          <option value="PUBLICO">Servicio público / transporte de pasajeros</option>
                          <option value="COMERCIAL">Comercial / carga</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-bold text-[#161c22] block mb-1">Nro. de Serie / Chasis / VIN (opcional)</label>
                        <input
                          type="text"
                          value={vin}
                          onChange={(e) => setVin(e.target.value.toUpperCase())}
                          placeholder="Ingresa el chasis o VIN"
                          className="w-full h-10 px-3 rounded-lg border border-[#dde3eb] bg-white text-xs font-semibold outline-none uppercase font-mono focus:border-[#486800]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Grilla 2 columnas: Departamento y Documento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-[#161c22] mb-1.5" htmlFor="departamento">
                    Departamento o ciudad de registro de la placa <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <select
                    id="departamento"
                    name="departamento"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-[#dde3eb] bg-white text-[#161c22] text-sm focus:border-[#486800] focus:ring-4 focus:ring-[#8bc500]/25 transition-all outline-none"
                  >
                    <option value="lima">Lima y Callao</option>
                    <option value="arequipa">Arequipa</option>
                    <option value="la-libertad">La Libertad (Trujillo)</option>
                    <option value="cusco">Cusco</option>
                    <option value="piura">Piura</option>
                    <option value="lambayeque">Lambayeque (Chiclayo)</option>
                    <option value="junin">Junín (Huancayo)</option>
                    <option value="otro">Otro departamento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#161c22] mb-1.5" htmlFor="docNumber">
                    Documento del contratante <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-24 h-12 px-2 rounded-xl border border-[#dde3eb] bg-white text-[#161c22] text-sm outline-none"
                    >
                      <option value="DNI">DNI</option>
                      <option value="CE">CE</option>
                      <option value="RUC">RUC</option>
                    </select>
                    <input
                      id="docNumber"
                      type="text"
                      required
                      maxLength={11}
                      placeholder="N° de documento"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 h-12 px-3 rounded-xl border border-[#dde3eb] bg-white text-[#161c22] text-sm outline-none focus:border-[#486800]"
                    />
                  </div>
                </div>
              </div>

              {/* Nombres y Apellidos del Contratante / Titular */}
              <div>
                <label className="block text-[13px] font-bold text-[#161c22] mb-1.5" htmlFor="holderName">
                  Nombres y Apellidos del Contratante / Titular <span className="text-[#ba1a1a]">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[19px]">person</span>
                  </div>
                  <input
                    id="holderName"
                    name="holderName"
                    type="text"
                    required
                    placeholder="Ingresa nombres y apellidos"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-[#dde3eb] bg-white text-[#161c22] text-sm font-semibold uppercase outline-none focus:border-[#486800] focus:ring-4 focus:ring-[#8bc500]/25 transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#434935]/80">
                  Nombre completo oficial que figurará en el Certificado Electrónico SOAT emitido.
                </p>
              </div>

              {/* Vigencia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-[#161c22] mb-1.5" htmlFor="startsAt">
                    Inicio de vigencia de póliza
                  </label>
                  <input
                    id="startsAt"
                    type="date"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-[#dde3eb] bg-white text-[#161c22] text-sm outline-none"
                  />
                </div>
                <div className="flex items-center text-xs text-[#434935] pt-2 sm:pt-6">
                  <span className="material-symbols-outlined text-[#486800] text-[18px] mr-1.5">event_available</span>
                  <span>Vigencia estándar de 1 año calendario completo conforme a Ley.</span>
                </div>
              </div>

              {/* Checkbox de Privacidad */}
              <label className="flex items-start gap-3 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 rounded text-[#486800] focus:ring-[#8bc500] h-4 w-4"
                />
                <span className="text-[12px] text-[#434935] leading-relaxed">
                  Autorizo el tratamiento de mis datos personales para cotizar y comparar ofertas de SOAT según la{' '}
                  <span className="text-[#486800] underline font-semibold">Política de Privacidad</span> de Seguros Falabella.
                </span>
              </label>

              {/* CTA Submit Button (Único botón de acción) */}
              <button
                type="submit"
                disabled={lookingUp}
                className="w-full h-14 bg-[#8bc500] hover:bg-[#7ab000] text-[#344d00] font-extrabold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#8bc500]/25 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-75"
              >
                {lookingUp ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                    <span>Consultando padrón y cotizando...</span>
                  </>
                ) : (
                  <>
                    <span>Cotizar y comparar ofertas (5 Aseguradoras)</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Columna Derecha: Beneficios y Ficha de Confianza (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="trust-card relative rounded-3xl overflow-hidden border border-[#dde3eb] bg-gradient-to-br from-[#f8faef] to-white p-6 shadow-sm">
              <Image
                src="/assets/soat-vehicle-hero-v1.png"
                alt="Vehículos SOAT"
                width={600}
                height={400}
                className="w-full h-auto object-contain rounded-2xl"
                priority
              />
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#dff5ad] text-[#486800] flex items-center justify-center shrink-0 font-bold">
                    <span className="material-symbols-outlined text-[22px]">bolt</span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#161c22]">Emisión digital e inmediata</h3>
                    <p className="text-[12px] text-[#434935] mt-0.5">
                      Recibe tu certificado electrónico oficial con código QR válido para la Policía y el MTC.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#dff5ad] text-[#486800] flex items-center justify-center shrink-0 font-bold">
                    <span className="material-symbols-outlined text-[22px]">balance</span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#161c22]">Comparativa transparente SBS</h3>
                    <p className="text-[12px] text-[#434935] mt-0.5">
                      Compara precios reales entre La Positiva, Pacífico, MAPFRE, Interseguro y Protecta Security sin valores inventados.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#dff5ad] text-[#486800] flex items-center justify-center shrink-0 font-bold">
                    <span className="material-symbols-outlined text-[22px]">support_agent</span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#161c22]">Cotización asistida con asesor</h3>
                    <p className="text-[12px] text-[#434935] mt-0.5">
                      Un asesor autorizado revisa tu placa en los portales oficiales para garantizar tu emisión conforme a ley.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SECCIÓN ASEGURADORAS VISIBLES */}
      <section className="insurer-strip bg-white py-14 border-y border-[#dde3eb]" id="seguros">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-[12px] font-extrabold text-[#486800] uppercase tracking-wider">
            Alianzas Oficiales
          </span>
          <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[#161c22] mt-1">
            Comparamos las 5 aseguradoras autorizadas del Perú
          </h2>
          <p className="text-[14px] text-[#434935] max-w-2xl mx-auto mt-2">
            La cobertura de ley es equivalente por mandato de la SBS. Elige por precio real, asistencias en ruta y red de clínicas preferenciales.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-8">
            {insurers.map((ins) => (
              <div
                key={ins.slug}
                className="h-24 p-4 rounded-2xl border border-[#dde3eb] bg-[#fdfdfd] hover:border-[#486800] hover:shadow-md transition-all flex items-center justify-center"
              >
                <Image
                  src={ins.logo}
                  alt={ins.name}
                  width={140}
                  height={55}
                  className="max-h-12 w-auto object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SECCIÓN PREGUNTAS FRECUENTES (FAQ) */}
      <section className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-16" id="faq">
        <div className="text-center mb-10">
          <span className="text-[12px] font-extrabold text-[#486800] uppercase tracking-wider">
            Resolución de dudas
          </span>
          <h2 className="text-[28px] font-extrabold text-[#161c22] mt-1">Preguntas Frecuentes sobre el SOAT</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="border border-[#dde3eb] rounded-2xl bg-white overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-[15px] text-[#161c22] cursor-pointer hover:bg-slate-50/50"
                >
                  <span>{faq.q}</span>
                  <span className={`material-symbols-outlined text-[#486800] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-[13px] text-[#434935] leading-relaxed border-t border-slate-100 bg-slate-50/30">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
