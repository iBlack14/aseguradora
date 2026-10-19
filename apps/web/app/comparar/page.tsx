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
    'la-positiva': 630.0,
    mapfre: 645.0,
    interseguro: 610.0,
    pacifico: 650.0,
    protecta: 590.0
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

const allOffers = [
  {
    id: 'la-positiva',
    name: 'La Positiva',
    logo: 'la-positiva.png',
    grua: '1 servicio en ciudad',
    auxilio: 'Auxilio de batería 24/7'
  },
  {
    id: 'pacifico',
    name: 'Pacífico Seguros',
    logo: 'pacifico.png',
    grua: 'Hasta 2 servicios nacionales',
    auxilio: 'Batería, llanta y orientación médica'
  },
  {
    id: 'mapfre',
    name: 'MAPFRE Perú',
    logo: 'mapfre.png',
    grua: '1 servicio en ruta nacional',
    auxilio: 'Batería, gasolina y cerrajería'
  },
  {
    id: 'interseguro',
    name: 'Interseguro',
    logo: 'interseguro.png',
    grua: 'Red de auxilio express',
    auxilio: 'Asistencia telefónica y grúa'
  },
  {
    id: 'protecta',
    name: 'Protecta Security',
    logo: 'protecta.png',
    grua: 'Auxilio en ruta básico',
    auxilio: 'Orientación médica y legal'
  }
];

export default function ComparePage() {
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>(['la-positiva', 'pacifico']);
  const [plate, setPlate] = useState('ABC-123');
  const [vehicleType, setVehicleType] = useState<VehicleType>('AUTO');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('placa') || params.get('plate');
    if (p) setPlate(p.toUpperCase());

    const t = (params.get('tipo') || '').toUpperCase() as VehicleType;
    if (['AUTO', 'MOTO', 'MOTOTAXI', 'VAN', 'CARGO'].includes(t)) {
      setVehicleType(t);
    } else if (/^\d{2,4}/.test(p || '')) {
      setVehicleType('MOTO');
    }

    const ofertasParam = params.get('ofertas');
    if (ofertasParam) {
      const ids = ofertasParam.split(',').filter((id) => allOffers.some((o) => o.id === id));
      if (ids.length >= 2) setSelectedOfferIds(ids);
    }
  }, []);

  const comparedOffers = useMemo(() => {
    const tariffs = tariffsByVehicle[vehicleType] || tariffsByVehicle.AUTO;
    return allOffers
      .filter((o) => selectedOfferIds.includes(o.id))
      .map((o) => ({
        ...o,
        price: tariffs[o.id] || 65.0
      }));
  }, [selectedOfferIds, vehicleType]);

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[12px] font-bold text-[#486800] uppercase tracking-wider">
            Comparativa Frente a Frente
          </span>
          <h1 className="text-[30px] sm:text-[36px] font-extrabold text-[#161c22] mt-1">
            Elige la oferta que mejor se adapta a ti
          </h1>
          <p className="text-[14px] text-[#434935] mt-1">
            La cobertura legal obligatoria del SOAT es exactamente equivalente por mandato de la SBS en todas las opciones.
          </p>
        </div>
        <div className="bg-white px-4 py-2.5 rounded-xl border border-[#dde3eb] text-xs">
          <span className="text-[#434935]">Vehículo:</span>{' '}
          <strong className="text-[#161c22]">{plate} ({vehicleType})</strong>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-2xl border border-[#dde3eb] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-[#dde3eb]">
                <th className="p-5 font-bold text-[#434935] w-56">Comparando</th>
                {comparedOffers.map((o) => (
                  <th key={o.id} className="p-5 border-l border-[#dde3eb]">
                    <div className="h-10 mb-2">
                      <Image
                        src={`/assets/logos/${o.logo}`}
                        alt={o.name}
                        width={120}
                        height={40}
                        className="max-h-8 w-auto object-contain"
                      />
                    </div>
                    <h2 className="font-extrabold text-[15px] text-[#161c22]">{o.name}</h2>
                    <div className="text-[24px] font-extrabold text-[#486800] mt-1">
                      S/ {o.price.toFixed(2)}
                    </div>
                    <small className="text-[#434935]">Pago anual referencial</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dde3eb]">
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-[#161c22]">Muerte / Invalidez Permanente</td>
                {comparedOffers.map((o) => (
                  <td key={o.id} className="p-4 border-l border-[#dde3eb] font-semibold text-[#161c22]">
                    Hasta 4 UIT (S/ 22,000.00)
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-[#161c22]">Gastos Médicos y Hospitalarios</td>
                {comparedOffers.map((o) => (
                  <td key={o.id} className="p-4 border-l border-[#dde3eb] font-semibold text-[#161c22]">
                    Hasta 5 UIT (S/ 27,500.00)
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-[#161c22]">Incapacidad Temporal / Sepelio</td>
                {comparedOffers.map((o) => (
                  <td key={o.id} className="p-4 border-l border-[#dde3eb] text-[#434935]">
                    Hasta 1 UIT c/u (S/ 5,500.00)
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-[#161c22]">Servicio de Grúa en Ruta</td>
                {comparedOffers.map((o) => (
                  <td key={o.id} className="p-4 border-l border-[#dde3eb] text-[#434935]">
                    ✓ {o.grua}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-[#161c22]">Auxilio Mecánico / Batería</td>
                {comparedOffers.map((o) => (
                  <td key={o.id} className="p-4 border-l border-[#dde3eb] text-[#434935]">
                    ✓ {o.auxilio}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/30">
                <td className="p-4 font-bold bg-slate-50/50 text-[#161c22]">Acción</td>
                {comparedOffers.map((o) => (
                  <td key={o.id} className="p-4 border-l border-[#dde3eb]">
                    <Link
                      href={`/pago?oferta=${o.id}&placa=${encodeURIComponent(plate)}&tipo=${encodeURIComponent(vehicleType)}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8bc500] hover:bg-[#7ab000] text-[#344d00] font-extrabold text-xs shadow-xs transition-all active:scale-[0.98]"
                    >
                      <span>Elegir {o.name}</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <Link
          href={`/resultados?placa=${encodeURIComponent(plate)}&tipo=${encodeURIComponent(vehicleType)}`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-[#161c22] hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Volver a resultados</span>
        </Link>
      </div>
    </main>
  );
}
