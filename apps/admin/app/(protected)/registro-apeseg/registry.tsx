'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type Field = { key: string; label: string; type?: 'date' | 'datetime-local' | 'number'; required?: boolean; placeholder?: string; max?: number; options?: string[] };
const groups: { title: string; description: string; fields: Field[] }[] = [
  { title: 'Certificado y vigencia', description: 'Identificación de la póliza y periodo de cobertura.', fields: [
    { key: 'Placa', label: 'Placa', required: true, placeholder: 'ABC-123', max: 9 },
    { key: 'NombreCompania', label: 'Compañía aseguradora', required: true, placeholder: 'Ej. Pacifico Seguros', max: 100 },
    { key: 'NumeroPoliza', label: 'Número de póliza / certificado', required: true, placeholder: 'Conserva los ceros iniciales', max: 100 },
    { key: 'Estado', label: 'Estado', required: true, options: ['VIGENTE', 'VENCIDO', 'AUN_NO_VIGENTE', 'ANULADO'] },
    { key: 'FechaInicio', label: 'Inicio de vigencia', type: 'date', required: true },
    { key: 'FechaFin', label: 'Fin de vigencia', type: 'date', required: true },
    { key: 'TipoCertificado', label: 'Tipo de certificado', required: true, options: ['DIGITAL', 'FISICO'] },
    { key: 'CodigoUnicoPoliza', label: 'Código único de póliza' },
    { key: 'CodigoSBSAseguradora', label: 'Código SBS de aseguradora', max: 20 }
  ] },
  { title: 'Datos del vehículo', description: 'Información que acompaña al certificado en la consulta.', fields: [
    { key: 'NombreUsoVehiculo', label: 'Uso del vehículo', required: true, placeholder: 'PARTICULAR', max: 80 },
    { key: 'NombreClaseVehiculo', label: 'Clase del vehículo', required: true, placeholder: 'AUTOMOVIL', max: 80 },
    { key: 'Marca', label: 'Marca', placeholder: 'Ej. Toyota', max: 80 },
    { key: 'ModeloVehiculo', label: 'Modelo del vehículo', placeholder: 'Ej. Yaris' },
    { key: 'NumeroAsientos', label: 'Número de asientos', type: 'number' },
    { key: 'NumeroSerieMotor', label: 'Número de serie del motor' },
    { key: 'NumeroSerieChasis', label: 'Número de serie del chasis / VIN' },
    { key: 'NombreUbigeo', label: 'Ubigeo / localidad', placeholder: 'Departamento, provincia y distrito', max: 150 }
  ] },
  { title: 'Contratante y control', description: 'Completa únicamente los datos que figuran en el documento.', fields: [
    { key: 'NombreContratante', label: 'Nombre del contratante', max: 200 },
    { key: 'NumeroAseguradora', label: 'Número de aseguradora', max: 40 },
    { key: 'FechaCreacion', label: 'Fecha y hora de creación del certificado', type: 'datetime-local' },
    { key: 'FechaControlPolicial', label: 'Fecha de control policial', type: 'date' },
    { key: 'FechaAnulacion', label: 'Fecha de anulación', type: 'date' }
  ] }
];
const fields = groups.flatMap(group => group.fields);
const names: Record<string, string> = { VIGENTE: 'Vigente', VENCIDO: 'Vencido', ANULADO: 'Anulado', AUN_NO_VIGENTE: 'Aún no vigente', DIGITAL: 'Digital', FISICO: 'Físico' };
type Certificate = Record<string, string | number | null> & { id: string; Placa: string; NombreCompania: string; NumeroPoliza: string; FechaInicio: string; FechaFin: string; Estado: string };
function emptyForm(): Record<string, string> {
  return { ...Object.fromEntries(fields.map(field => [field.key, ''])), Estado: 'VIGENTE', TipoCertificado: 'DIGITAL', NombreUsoVehiculo: 'PARTICULAR', NombreClaseVehiculo: 'AUTOMOVIL' };
}
function dateLabel(date: string) { return date ? date.split('-').reverse().join('/') : '—'; }

export default function Registry({ canWrite }: { canWrite: boolean }) {
  const [form, setForm] = useState(emptyForm);
  const [records, setRecords] = useState<Certificate[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [localStorage, setLocalStorage] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const loadRecords = useCallback(async (plate = '', signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/backend/v1/soat-registry?${new URLSearchParams({ plate })}`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error('No se pudo cargar el registro de certificados.');
      const result = await response.json();
      setRecords(result.data); setTotal(result.total); setLocalStorage(result.storage === 'LOCAL_FILE');
    } catch (reason) {
      if (!(reason instanceof Error && reason.name === 'AbortError')) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el registro.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void loadRecords('', controller.signal); return () => controller.abort(); }, [loadRecords]);

  function edit(record: Certificate) {
    setEditing(record.id); setForm(Object.fromEntries(fields.map(field => [field.key, String(record[field.key] ?? '')])));
    setError(''); setSuccess(''); setErrors({});
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function reset() { setEditing(null); setForm(emptyForm()); setErrors({}); setError(''); setSuccess(''); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess(''); setErrors({});
    const payload = Object.fromEntries(fields.map(field => [field.key, field.type === 'number' ? (form[field.key] ? Number(form[field.key]) : null) : form[field.key]]));
    try {
      const response = await fetch(`/api/backend/v1/soat-registry${editing ? `/${encodeURIComponent(editing)}` : ''}`, {
        method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.details?.fieldErrors) setErrors(result.details.fieldErrors);
        throw new Error(result.message || (response.status === 400 ? 'Revisa los campos señalados.' : response.status === 403 ? 'Tu rol no permite modificar certificados.' : 'No se pudo guardar el certificado.'));
      }
      setEditing(null); setForm(emptyForm());
      setSuccess(editing ? 'Certificado actualizado correctamente.' : 'Certificado registrado correctamente.');
      await loadRecords(filter);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el certificado.'); }
    finally { setSaving(false); }
  }

  return <>
    <header className="topbar"><div><p className="muted">Certificados e historial de SOAT</p><h1>Registro APESEG</h1></div>{canWrite && <button className="button" onClick={() => { reset(); formRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>+ Nuevo certificado</button>}</header>
    <p className="apeseg-context">Registro interno de certificados con los campos de la consulta SOAT. Los datos se guardan en esta plataforma; no se envían a APESEG.</p>
    {error && <div className="user-alert error" role="alert">{error}</div>}
    {success && <div className="user-alert success" role="status">{success}</div>}
    <section className="card apeseg-register-list">
      <div className="apeseg-list-heading"><div><h2>Certificados registrados</h2><p className="muted">{total} registro{total === 1 ? '' : 's'}{total > 100 ? ' · Se muestran los 100 más recientes. Filtra por placa.' : ''}{localStorage ? ' · Guardado local de desarrollo.' : ''}</p></div>
        <form className="apeseg-search" onSubmit={event => { event.preventDefault(); setError(''); void loadRecords(filter); }}><label className="sr-only" htmlFor="registry-search">Buscar por placa</label><input id="registry-search" value={filter} onChange={event => setFilter(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))} placeholder="Buscar placa…" maxLength={9}/><button className="button ghost" disabled={loading}>Buscar</button></form>
      </div>
      {loading ? <div className="empty-state">Cargando certificados…</div> : !records.length ? <div className="empty-state"><strong>{filter ? 'No encontramos esa placa' : 'Aún no hay certificados registrados'}</strong><span>{filter ? 'Prueba con otra placa o quita el filtro.' : 'Completa el formulario para registrar el primer certificado.'}</span></div> : <div className="apeseg-table-scroll"><table className="apeseg-register-table"><thead><tr><th>Placa / compañía</th><th>Certificado</th><th>Vigencia</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td data-label="Placa / compañía"><strong>{record.Placa}</strong><small>{record.NombreCompania}</small></td><td data-label="Certificado" className="apeseg-policy-number">{record.NumeroPoliza}</td><td data-label="Vigencia">{dateLabel(record.FechaInicio)}<small>al {dateLabel(record.FechaFin)}</small></td><td data-label="Estado"><span className={`apeseg-status ${record.Estado.toLowerCase()}`}>{names[record.Estado]}</span></td><td data-label="Acción"><button className="button ghost small-button" onClick={() => edit(record)}>{canWrite ? 'Editar' : 'Ver detalle'}</button></td></tr>)}</tbody></table></div>}
    </section>
    {(canWrite || editing) && <form className="card apeseg-register-form" onSubmit={save} ref={formRef}>
      <div className="apeseg-form-heading"><div><span className="apeseg-eyebrow">{editing ? 'Detalle del registro' : 'Ingreso manual'}</span><h2>{editing ? (canWrite ? 'Editar certificado' : 'Detalle del certificado') : 'Nuevo certificado'}</h2><p className="muted">Los campos con * son obligatorios. El resto puede quedar vacío si no figura en el documento.</p></div>{editing && <button className="button ghost" type="button" onClick={reset}>Cerrar detalle</button>}</div>
      <fieldset disabled={!canWrite || saving} className="apeseg-fieldset">
        {groups.map((group, index) => <section className="apeseg-field-group" key={group.title}><div className="apeseg-group-title"><span>{index + 1}</span><div><h3>{group.title}</h3><p className="muted">{group.description}</p></div></div><div className="apeseg-fields">{group.fields.map(field => {
          const required = field.required || (field.key === 'FechaAnulacion' && form.Estado === 'ANULADO');
          return <label key={field.key} htmlFor={`apeseg-${field.key}`}>{field.label}{required && ' *'}{field.options ? <select id={`apeseg-${field.key}`} value={form[field.key]} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value, ...(field.key === 'Estado' && event.target.value !== 'ANULADO' ? { FechaAnulacion: '' } : {}) }))}>{field.options.map(value => <option key={value} value={value}>{names[value]}</option>)}</select> : <input id={`apeseg-${field.key}`} type={field.type || 'text'} required={required} maxLength={field.type ? undefined : field.max || 120} min={field.type === 'number' ? 1 : field.key === 'FechaFin' ? form.FechaInicio : undefined} max={field.type === 'number' ? 100 : undefined} step={field.type === 'number' ? 1 : undefined} placeholder={field.placeholder} value={form[field.key]} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `apeseg-error-${field.key}` : undefined} onChange={event => setForm(current => ({ ...current, [field.key]: field.key === 'Placa' ? event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') : event.target.value }))}/>} {errors[field.key] && <small className="apeseg-field-error" id={`apeseg-error-${field.key}`}>{errors[field.key].join(' ')}</small>}</label>;
        })}</div>{index === 0 && <p className="apeseg-field-help">La vigencia se calcula con las fechas. Si el certificado está anulado, selecciona «Anulado» e indica la fecha de anulación.</p>}</section>)}
      </fieldset>
      {canWrite && <div className="apeseg-form-actions"><button type="button" className="button ghost" onClick={reset} disabled={saving}>{editing ? 'Cancelar edición' : 'Limpiar'}</button><button className="button" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar certificado'}</button></div>}
    </form>}
  </>;
}
