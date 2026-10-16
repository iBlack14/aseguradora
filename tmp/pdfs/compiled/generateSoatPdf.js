"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAndDownloadSoatPdf = generateAndDownloadSoatPdf;
const jspdf_1 = require("jspdf");
const PURPLE = [89, 43, 145];
const MUTED = [158, 151, 174];
const LIGHT = [167, 174, 178];
const LINE = [216, 216, 222];
function loadImageDataUrl(url) {
    return fetch(url)
        .then((response) => {
        if (!response.ok)
            throw new Error(`No se pudo cargar ${url}`);
        return response.blob();
    })
        .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    }));
}
async function generateAndDownloadSoatPdf(quote) {
    // Same compact vertical proportion as the official electronic certificate model.
    const pageWidth = 65.26;
    const pageHeight = 120.30;
    const doc = new jspdf_1.jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageWidth, pageHeight] });
    const margin = 2.2;
    const usable = pageWidth - margin * 2;
    const setColor = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    const divider = (y) => {
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(0.18);
        doc.line(margin, y, pageWidth - margin, y);
    };
    const heading = (text, x, y, size = 7) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(size);
        setColor(MUTED);
        doc.text(text, x, y);
    };
    const label = (text, x, y) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.2);
        setColor(LIGHT);
        doc.text(text, x, y);
    };
    const value = (text, x, y, size = 7.1, maxWidth) => {
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
    const parseDate = (raw) => {
        const date = raw ? new Date(raw) : new Date();
        return Number.isNaN(date.getTime()) ? new Date() : date;
    };
    const formatDate = (date) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
    const start = parseDate(quote.startsAt);
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    const emitted = parseDate(quote.emittedAt || quote.createdAt);
    const policy = quote.policyNumber || quote.code || 'SIN-NÚMERO';
    const insurerKey = (quote.selectedOfferId || 'la-positiva').toLowerCase();
    const insurerNames = {
        'la-positiva': 'LA POSITIVA SEGUROS Y REASEGUROS',
        pacifico: 'PACÍFICO COMPAÑÍA DE SEGUROS',
        mapfre: 'MAPFRE PERÚ',
        interseguro: 'INTERSEGURO',
        protecta: 'PROTECTA SECURITY'
    };
    const emergencyPhones = {
        'la-positiva': '211 0211 LIMA Y/O PROVINCIAS',
        pacifico: '(01) 415 1515',
        mapfre: '213 3333',
        interseguro: '500 0000',
        protecta: '391 3000'
    };
    const insurer = insurerNames[insurerKey] || insurerKey.replace(/-/g, ' ').toUpperCase();
    const emergency = emergencyPhones[insurerKey] || 'CONSULTAR A LA ASEGURADORA';
    const vin = quote.vehicle?.vin || quote.vehicle?.chassisNumber || 'NO INFORMADO';
    const vehicleClass = quote.vehicleType || 'Vehículo Menor';
    const holder = quote.holderName?.trim() || `TITULAR ${quote.documentType || 'DNI'} ${quote.documentNumber}`;
    const price = quote.selectedPrice || 0;
    // Official government/MTC image supplied in the admin public assets.
    try {
        const mtcLogo = await loadImageDataUrl('/assets/logos/mtc.png');
        doc.addImage(mtcLogo, 'PNG', 2.2, 0.15, 28.5, 9.5, undefined, 'FAST');
    }
    catch {
        // Minimal fallback keeps the certificate usable if the public asset is unavailable.
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
    heading('COMPAÑÍA DE SEGUROS', 3.5, 22.4, 5.5);
    heading('EN CASO DE EMERGENCIAS', 34.8, 22.4, 5.2);
    const insurerLines = doc.splitTextToSize(insurer, 27.5).slice(0, 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    setColor(PURPLE);
    doc.text(insurerLines, 3.5, 26.7, { lineHeightFactor: 1.18 });
    const emergencyLines = doc.splitTextToSize(emergency, 27.2).slice(0, 2);
    doc.text(emergencyLines, 34.8, 26.7, { lineHeightFactor: 1.18 });
    // Diagonal security band from the model.
    doc.setDrawColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    doc.setLineWidth(0.55);
    for (let x = margin; x < pageWidth - margin; x += 1.25)
        doc.line(x, 33.7, x + 0.75, 35.0);
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
