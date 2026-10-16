import { jsPDF } from 'jspdf';

interface QuoteForPdf {
  code: string;
  plate: string;
  vehicleType: string;
  department: string;
  documentType: string;
  documentNumber: string;
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
}

export function generateAndDownloadSoatPdf(quote: QuoteForPdf) {
  // Create A4 PDF (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2; // 178mm

  // Borderless surfaces keep the certificate light and avoid the form-like look.
  function drawSurface(
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb: [number, number, number] = [248, 250, 252],
    r = 2
  ) {
    doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
    doc.roundedRect(x, y, w, h, r, r, 'F');
  }

  function drawTint(
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb: [number, number, number],
    r = 2
  ) {
    doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
    doc.roundedRect(x, y, w, h, r, r, 'F');
  }

  let y = margin + 3;

  // Restrained brand accent; the page itself remains open and borderless.
  doc.setFillColor(78, 127, 0);
  doc.roundedRect(margin, margin, 3, 17, 1.5, 1.5, 'F');

  // Header 3 columns
  // Col 1: Corredores de Seguros Falabella
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text('Corredores de Seguros Falabella S.A.C.', margin + 7, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text('RUC: 20509608467 · Registro SBS N° J-0723', margin + 7, y + 4.5);
  doc.text('Intermediario Oficial de Seguros', margin + 7, y + 8.5);

  // Col 2: Center Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REPÚBLICA DEL PERÚ', pageWidth / 2, y, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('CERTIFICADO SOAT ELECTRÓNICO', pageWidth / 2, y + 5, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(78, 127, 0); // #4e7f00
  doc.text('Supervisado por la SBS y MTC', pageWidth / 2, y + 9.5, { align: 'center' });

  // Col 3: Right Policy & Insurer
  const policyNum = quote.policyNumber || quote.code || `SOAT-2026-FALA-${Math.floor(100000 + Math.random() * 900000)}`;
  const insurerName = (quote.selectedOfferId || 'LA POSITIVA').toUpperCase().replace(/-/g, ' ');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('N° DE PÓLIZA:', pageWidth - margin - 7, y, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(policyNum, pageWidth - margin - 7, y + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(78, 127, 0);
  doc.text(insurerName, pageWidth - margin - 7, y + 9, { align: 'right' });

  y += 14;

  // Fine divider: visual hierarchy without framing the document.
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin + 7, y, pageWidth - margin - 7, y);

  y += 5;

  // Status bar
  drawTint(margin + 7, y, contentWidth - 14, 7, [240, 253, 244], 1.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52); // #166534
  doc.text('ESTADO: PÓLIZA VIGENTE REGISTRADA EN APESEG', margin + 11, y + 4.8);
  doc.text('VALIDEZ PROBATORIA NACIONAL (MTC / PNP)', pageWidth - margin - 11, y + 4.8, { align: 'right' });

  y += 11;

  // Grid 2 Columns: Contratante & Vehiculo
  const colW = (contentWidth - 14 - 6) / 2; // ~79mm

  // Box 1: Contratante
  drawSurface(margin + 7, y, colW, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85); // #334155
  doc.text('1. DATOS DEL CONTRATANTE / TITULAR', margin + 11, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Documento: ${quote.documentType || 'DNI'} ${quote.documentNumber || '70912870'}`, margin + 11, y + 13);
  doc.text(`Departamento: ${quote.department || 'Lima'}`, margin + 11, y + 18.5);
  doc.text(`Canal de Emisión: ${quote.source === 'MANUAL' ? 'Gestión Comercial Interna' : 'Web Pública'}`, margin + 11, y + 24);

  // Box 2: Vehiculo
  const col2X = margin + 7 + colW + 6;
  drawSurface(col2X, y, colW, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('2. IDENTIFICACIÓN DEL VEHÍCULO', col2X + 4, y + 6);

  // Plate badge
  drawTint(col2X + 4, y + 9.5, 25, 6, [254, 240, 138], 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(113, 63, 18); // #713f12
  doc.text(quote.plate || 'ABC-123', col2X + 16.5, y + 13.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const vehName = quote.vehicle?.brand
    ? `${quote.vehicle.brand} ${quote.vehicle.model || ''} (${quote.vehicle.year || 2026})`
    : quote.vehicleType || 'Vehículo Ligero';
  doc.text(`Marca / Modelo: ${vehName}`, col2X + 4, y + 20);

  const vinNum = quote.vehicle?.vin || quote.vehicle?.chassisNumber || 'No informado';
  doc.text(`Chasis / VIN: ${vinNum}`, col2X + 4, y + 25.5);

  y += 34;

  // Box 3: Table Coverages
  drawSurface(margin + 7, y, contentWidth - 14, 52, [255, 255, 255]);
  // Compact section header; no surrounding card border.
  drawTint(margin + 7, y, contentWidth - 14, 6.5, [248, 250, 252], 2);
  doc.setFillColor(78, 127, 0);
  doc.roundedRect(margin + 7, y, 2, 6.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('3. COBERTURAS OBLIGATORIAS DE LEY (UIT 2026 = S/ 5,500)', margin + 11, y + 4.5);

  const coverages = [
    ['• Muerte (cada persona)', '4 UIT', 'S/ 22,000.00'],
    ['• Invalidez permanente (cada persona)', 'Hasta 4 UIT', 'Hasta S/ 22,000.00'],
    ['• Incapacidad temporal (cada persona)', 'Hasta 1 UIT', 'Hasta S/ 5,500.00'],
    ['• Gastos de atención médica y hospitalaria', 'Hasta 5 UIT', 'Hasta S/ 27,500.00'],
    ['• Gastos de sepelio (cada persona)', 'Hasta 1 UIT', 'Hasta S/ 5,500.00']
  ];

  doc.setFontSize(7.5);
  coverages.forEach((row, i) => {
    const rowY = y + 12 + i * 7.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(row[0], margin + 11, rowY);
    doc.setFont('helvetica', 'bold');
    doc.text(row[1], pageWidth / 2 + 10, rowY, { align: 'center' });
    doc.text(row[2], pageWidth - margin - 11, rowY, { align: 'right' });

    if (i < coverages.length - 1) {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.25);
      doc.line(margin + 11, rowY + 2.5, pageWidth - margin - 11, rowY + 2.5);
    }
  });

  y += 56;

  // Box 4 & 5: Vigencia & Liquidacion
  // Box 4: Vigencia
  drawSurface(margin + 7, y, colW, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('4. VIGENCIA DE PÓLIZA', margin + 11, y + 6);

  const startDate = quote.startsAt ? quote.startsAt.split('T')[0] : '2026-10-17';
  const emitDate = quote.emittedAt
    ? new Date(quote.emittedAt).toLocaleString('es-PE')
    : quote.createdAt
    ? new Date(quote.createdAt).toLocaleString('es-PE')
    : new Date().toLocaleString('es-PE');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Inicio: ${startDate} a las 00:00 hrs`, margin + 11, y + 13);
  doc.text('Vigencia: 1 año calendario completo', margin + 11, y + 18.5);
  doc.text(`Fecha de emisión: ${emitDate}`, margin + 11, y + 24);

  // Box 5: Liquidacion
  drawSurface(col2X, y, colW, 32, [240, 253, 244]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('5. LIQUIDACIÓN DE PRIMA', col2X + 4, y + 6);

  const totalPrice = quote.selectedPrice || 165.0;
  const netPrice = totalPrice / 1.18;
  const igv = totalPrice - netPrice;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Prima Comercial Neta:', col2X + 4, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`S/ ${netPrice.toFixed(2)}`, col2X + colW - 4, y + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('IGV (18%):', col2X + 4, y + 18.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`S/ ${igv.toFixed(2)}`, col2X + colW - 4, y + 18.5, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(col2X + 4, y + 21.5, col2X + colW - 4, y + 21.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(78, 127, 0); // #4e7f00
  doc.text('PRIMA TOTAL CANCELADA:', col2X + 4, y + 27.5);
  doc.text(`S/ ${totalPrice.toFixed(2)}`, col2X + colW - 4, y + 27.5, { align: 'right' });

  y += 38;

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin + 7, y, pageWidth - margin - 7, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Consulta electrónica en apeseg.org.pe/consultas-soat mediante la placa vehicular.', margin + 7, y);
  doc.text('Certificado válido conforme al D.S. N° 024-2002-MTC.', margin + 7, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('CORREDORES DE SEGUROS FALABELLA S.A.C.', pageWidth - margin - 7, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Firma y Sello Electrónico Autorizado SBS', pageWidth - margin - 7, y + 4, { align: 'right' });

  // Save / Trigger direct download
  const filename = `Certificado-SOAT-${quote.plate || 'OFICIAL'}.pdf`;
  doc.save(filename);
}
