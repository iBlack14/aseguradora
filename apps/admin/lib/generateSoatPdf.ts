import { jsPDF } from 'jspdf';

interface QuoteForPdf {
  code: string;
  plate: string;
  vehicleType: string;
  department: string;
  documentType: string;
  documentNumber: string;
  holderName?: string;
  startsAt?: string;
  selectedPrice?: number;
  selectedOfferId?: string;
  policyNumber?: string;
  emittedAt?: string;
  createdAt?: string;
  source?: string;
  vehicle?: {
    brand?: string;
    model?: string;
    year?: number;
    vin?: string;
    chassisNumber?: string;
  };
  offers?: Array<{
    id: string;
    insurer?: string;
    name: string;
    price: number;
    logo?: string;
  }>;
}

const PURPLE: [number, number, number] = [89, 43, 145];
const MUTED: [number, number, number] = [158, 151, 174];
const LIGHT: [number, number, number] = [167, 174, 178];
const LINE: [number, number, number] = [216, 216, 222];

interface InsurerMeta {
  logoPath: string;
  name: string;
  emergencyPhone: string;
  width: number;
  height: number;
}

const INSURERS: Record<string, InsurerMeta> = {
  falabella: {
    // Esta variante no tiene el gran margen transparente del logo genérico,
    // por lo que conserva una presencia visual correcta dentro del certificado.
    logoPath: '/assets/logos/seguros-falabella-header.png',
    name: 'SEGUROS FALABELLA CORREDORES DE SEGUROS',
    emergencyPhone: '01 615 4300 LIMA Y PROVINCIAS',
    width: 22.7,
    height: 9.2
  },
  'la-positiva': {
    logoPath: '/assets/logos/la-positiva.png',
    name: 'LA POSITIVA SEGUROS Y REASEGUROS',
    emergencyPhone: '211 0211 LIMA Y/O PROVINCIAS',
    width: 27.0,
    height: 8.5
  },
  pacifico: {
    logoPath: '/assets/logos/pacifico.png',
    name: 'PACÍFICO COMPAÑÍA DE SEGUROS',
    emergencyPhone: '(01) 415 1515 LIMA Y PROVINCIAS',
    width: 26.0,
    height: 8.0
  },
  mapfre: {
    logoPath: '/assets/logos/mapfre.png',
    name: 'MAPFRE PERÚ COMPAÑÍA DE SEGUROS',
    emergencyPhone: '213 3333 LIMA / 0801 1 1133',
    width: 27.0,
    height: 7.2
  },
  interseguro: {
    logoPath: '/assets/logos/interseguro.png',
    name: 'INTERSEGURO COMPAÑÍA DE SEGUROS',
    emergencyPhone: '500 0000 LIMA / 0801 0 0160',
    width: 26.5,
    height: 7.8
  },
  protecta: {
    logoPath: '/assets/logos/protecta.png',
    name: 'PROTECTA SECURITY COMPAÑÍA DE SEGUROS',
    emergencyPhone: '391 3000 LIMA / 0801 1 1230',
    width: 27.0,
    height: 8.2
  }
};

function normalizeInsurerKey(raw?: string): string {
  if (!raw) return 'la-positiva';
  const clean = raw.toLowerCase().trim();
  if (clean.includes('positiva')) return 'la-positiva';
  if (clean.includes('pacifico') || clean.includes('pacífico')) return 'pacifico';
  if (clean.includes('mapfre')) return 'mapfre';
  if (clean.includes('interseguro')) return 'interseguro';
  if (clean.includes('protecta')) return 'protecta';
  if (clean.includes('falabella')) return 'falabella';
  return clean.replace(/[^a-z0-9-]/g, '-');
}

function loadImageDataUrl(url: string): Promise<string> {
  const fullUrl = typeof window !== 'undefined' && url.startsWith('/')
    ? `${window.location.origin}${url}`
    : url;

  return fetch(fullUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`No se pudo cargar ${fullUrl}: ${response.status}`);
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        })
    );
}

export async function generateAndDownloadSoatPdf(quote: QuoteForPdf) {
  if (!quote.policyNumber?.trim()) throw new Error('La emisión debe tener un número de póliza asignado.');
  // Same compact vertical proportion as the official electronic certificate model.
  const pageWidth = 65.26;
  const pageHeight = 120.30;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageWidth, pageHeight] });
  const margin = 2.2;
  const usable = pageWidth - margin * 2;

  const setColor = (rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const divider = (y: number) => {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.18);
    doc.line(margin, y, pageWidth - margin, y);
  };
  const heading = (text: string, x: number, y: number, size = 7) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    setColor(MUTED);
    doc.text(text, x, y);
  };
  const label = (text: string, x: number, y: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    setColor(LIGHT);
    doc.text(text, x, y);
  };
  const value = (text: string, x: number, y: number, size = 7.1, maxWidth?: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    setColor(PURPLE);
    if (maxWidth) {
      let fittedSize = size;
      while (fittedSize > 4.5 && doc.getTextWidth(text) > maxWidth) {
        fittedSize -= 0.2;
        doc.setFontSize(fittedSize);
      }
    }
    doc.text(text, x, y);
  };
  const parseDate = (raw?: string) => {
    const date = raw ? new Date(raw) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);

  const start = parseDate(quote.startsAt);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  const emitted = parseDate(quote.emittedAt || quote.createdAt);
  const policy = quote.policyNumber;

  // Identificar la aseguradora elegida
  const rawOfferId = quote.selectedOfferId || (quote.offers && quote.offers[0]?.id) || 'la-positiva';
  const insurerKey = normalizeInsurerKey(rawOfferId);
  const insurerInfo = INSURERS[insurerKey] || INSURERS['la-positiva'];

  const vin = quote.vehicle?.vin || quote.vehicle?.chassisNumber || 'NO INFORMADO';
  const vehicleClass = quote.vehicleType || 'Vehículo Menor';
  const holder = quote.holderName?.trim().replace(/\s+titular$/i, '').trim();
  if (!holder || /^titular$/i.test(holder)) throw new Error('Completa el nombre del contratante antes de generar el PDF.');
  const price = quote.selectedPrice || 0;

  // 1. Logo oficial del MTC en la cabecera superior izquierda
  try {
    const mtcLogo = await loadImageDataUrl('/assets/logos/mtc.png');
    doc.addImage(mtcLogo, 'PNG', 2.2, 0.15, 28.5, 9.5, undefined, 'FAST');
  } catch {
    doc.setFillColor(239, 35, 35);
    doc.rect(7.7, 1.5, 5.6, 5.3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.4);
    doc.setTextColor(255, 255, 255);
    doc.text('PERÚ', 10.5, 5.0, { align: 'center' });
    doc.setFillColor(48, 48, 48);
    doc.rect(13.6, 1.5, 16.6, 5.3, 'F');
    doc.setFontSize(2.9);
    doc.text(['Ministerio', 'de Transportes', 'y Comunicaciones'], 14.2, 3.0, { lineHeightFactor: 0.78 });
  }

  heading('Certificado Electrónico', margin, 11.7, 7.5);
  heading('Decreto Supremo 015 - 2016 MTC', margin, 15.1, 6.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(21);
  setColor(PURPLE);
  doc.text('SOAT', pageWidth - margin, 15.5, { align: 'right' });
  divider(18.8);

  // 2. Bloque principal de aseguradora y central de emergencias.
  // Una superficie tenue y un divisor vertical ordenan ambos contenidos sin
  // perder la estética compacta del certificado oficial.
  doc.setFillColor(249, 247, 252);
  doc.roundedRect(2.8, 20.4, pageWidth - 5.6, 12.4, 1.2, 1.2, 'F');
  doc.setDrawColor(229, 224, 235);
  doc.setLineWidth(0.16);
  doc.line(32.6, 21.6, 32.6, 31.5);

  heading('COMPAÑÍA DE SEGUROS', 4.2, 23.0, 4.4);
  heading('CENTRAL DE EMERGENCIAS 24/7', 35.0, 23.0, 4.2);

  // Cargar y dibujar el logo oficial correspondiente de la empresa aseguradora
  let logoDrawn = false;
  try {
    const insurerLogo = await loadImageDataUrl(insurerInfo.logoPath);
    const logoScale = Math.min(25 / insurerInfo.width, 7 / insurerInfo.height, 1);
    const logoWidth = insurerInfo.width * logoScale;
    const logoHeight = insurerInfo.height * logoScale;
    const logoX = 12.7 - logoWidth / 2;
    const logoY = 24.1 + (7 - logoHeight) / 2;
    doc.addImage(insurerLogo, 'PNG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');
    logoDrawn = true;
  } catch (err) {
    console.warn(`[PDF] No se pudo cargar el logo ${insurerInfo.logoPath}, usando texto:`, err);
  }

  // Si fallara la imagen, pintar el nombre legal como respaldo
  if (!logoDrawn) {
    const insurerLines = doc.splitTextToSize(insurerInfo.name, 27.5).slice(0, 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    setColor(PURPLE);
    doc.text(insurerLines, 17.7, 26.8, { align: 'center', lineHeightFactor: 1.18 });
  }

  // Teléfono oficial de emergencias 24/7 de la aseguradora
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  const emergencyLines = doc.splitTextToSize(insurerInfo.emergencyPhone, 25.0).slice(0, 2);
  setColor(PURPLE);
  doc.text(emergencyLines, 35.0, 26.2, { lineHeightFactor: 1.12 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.6);
  setColor(LIGHT);
  doc.text('Atención inmediata en Lima y provincias', 35.0, 31.0);

  // Diagonal security band from the model.
  doc.setDrawColor(PURPLE[0], PURPLE[1], PURPLE[2]);
  doc.setLineWidth(0.55);
  for (let x = margin; x < pageWidth - margin; x += 1.25) doc.line(x, 33.7, x + 0.75, 35.0);

  heading('VIGENCIA DE LA PÓLIZA', 3.5, 38.3, 5.5);
  heading('CERTIFICADO SOAT', 29.8, 39.7, 5.3);
  heading('CONTROL POLICIAL', 29.8, 42.7, 5.3);

  label('N° Póliza - Certificado', 3.5, 41.0);
  value(`${policy} - 0`, 3.5, 44.8, 6.7, 24.5);
  label('Desde', 3.5, 47.6);
  value(formatDate(start), 3.5, 51.2, 7.1);
  label('Hasta', 3.5, 54.0);
  value(formatDate(end), 3.5, 57.6, 7.1);

  label('Desde', 29.8, 48.5);
  value(formatDate(start), 29.8, 52.1, 7.1);
  label('Hasta', 29.8, 54.9);
  value(formatDate(end), 29.8, 58.5, 7.1);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.16);
  doc.line(49.0, 44.2, 49.0, 61.4);
  doc.setFontSize(4.3);
  setColor(LIGHT);
  doc.text(['Vigencia de uso', 'exclusivo para', 'control policial'], 50.9, 51.8, { lineHeightFactor: 1.12 });
  divider(63.0);

  heading('VEHÍCULO ASEGURADO', 3.5, 67.1, 5.5);
  heading('CONTRATANTE / ASEGURADO', 31.8, 67.1, 5.2);
  label('Placa', 3.5, 70.0);
  value((quote.plate || 'SIN PLACA').toUpperCase(), 3.5, 73.5, 7.0);
  label('Categoría / Clase', 3.5, 76.3);
  value(vehicleClass, 3.5, 79.7, 6.6, 25.5);
  label('Uso', 3.5, 82.5);
  value('Particular', 3.5, 85.9, 6.5);
  label('Vin / N° de serie', 3.5, 88.7);
  value(vin.toUpperCase(), 3.5, 92.0, 5.8, 26.0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.7);
  setColor(PURPLE);
  const holderLines = doc.splitTextToSize(holder.toUpperCase(), 29.2).slice(0, 2);
  doc.text(holderLines, 31.8, 71.3, { lineHeightFactor: 1.1 });
  label('Importe de la prima', 31.8, 78.2);
  value(`S/. ${price.toFixed(2)}`, 31.8, 81.6, 6.6);
  label('Fecha', 31.8, 84.2);
  value(emitted.toISOString().slice(0, 10), 31.8, 87.5, 6.4);
  label('Hora de emisión', 31.8, 90.1);
  const time = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }).format(emitted);
  value(time.replace(':', ' h : ') + ' m', 31.8, 93.5, 6.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.8);
  setColor(LIGHT);
  const legal = 'Los establecimientos de salud públicos y privados están obligados a prestar atención médico quirúrgica de emergencia en caso de la ocurrencia de un accidente de tránsito conforme a la Ley N° 26842, Ley General de Salud y su Reglamento.';
  doc.text(doc.splitTextToSize(legal, usable - 2.4), 3.4, 100.2, { lineHeightFactor: 1.15 });

  doc.setFillColor(0, 0, 0);
  doc.rect(3.2, 106.0, pageWidth - 6.4, 11.6, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.3);
  doc.setTextColor(255, 255, 255);
  const footer = 'La información sobre las obligaciones y derechos del contratante/asegurado, coberturas y exclusiones, las podrás encontrar ingresando a www.apeseg.org.pe/soat o solicitando tu cartilla informativa en las oficinas de la compañía de seguros.';
  const footerLines = doc.splitTextToSize(footer, pageWidth - 10);
  doc.text(footerLines, pageWidth / 2, 109.0, { align: 'center', lineHeightFactor: 1.1 });

  doc.save(`Certificado-SOAT-${quote.plate || 'OFICIAL'}.pdf`);
}
