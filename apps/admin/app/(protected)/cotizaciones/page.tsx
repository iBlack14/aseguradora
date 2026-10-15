'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';

type Quote={id:string;code:string;plate:string;vehicleType:string;department:string;documentType:string;documentNumber:string;source:'WEB'|'MANUAL';status:string;createdAt:string};

export default function Quotes(){
  const[quotes,setQuotes]=useState<Quote[]>([]);
  const[showForm,setShowForm]=useState(false);
  const[loading,setLoading]=useState(true);
  const load=useCallback(()=>{setLoading(true);fetch('http://localhost:4000/v1/quotes').then(r=>r.json()).then(result=>setQuotes(result.data)).finally(()=>setLoading(false))},[]);
  useEffect(()=>{load();setShowForm(new URLSearchParams(location.search).get('new')==='1')},[load]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const response=await fetch('http://localhost:4000/v1/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))});
    if(!response.ok){alert('Revisa los datos ingresados.');return}
    formElement.reset();setShowForm(false);load();
  }
  return <><header className="topbar"><div><p className="muted">Operaciones</p><h1>Cotizaciones</h1></div><button className="button" onClick={()=>setShowForm(value=>!value)}>{showForm?'Cerrar formulario':'Nueva cotización manual'}</button></header>{showForm&&<form className="card manual-form" onSubmit={submit}><div className="form-heading"><div><h2>Nueva cotización manual</h2><p className="muted">Se identificará con la etiqueta Manual.</p></div><span className="source manual">Manual</span></div><div className="admin-form-grid"><label>Placa<input name="plate" required maxLength={8} placeholder="ABC-123"/></label><label>Vehículo<select name="vehicleType"><option value="AUTO">Auto / camioneta</option><option value="MOTO">Moto</option><option value="MOTOTAXI">Mototaxi</option><option value="VAN">Van</option><option value="CARGO">Carga / pesado</option></select></label><label>Departamento<input name="department" required defaultValue="Lima"/></label><label>Tipo de documento<select name="documentType"><option>DNI</option><option>CE</option><option>RUC</option></select></label><label>Número de documento<input name="documentNumber" required minLength={8} maxLength={11}/></label><label>Inicio de vigencia<input name="startsAt" required type="date"/></label></div><input type="hidden" name="source" value="MANUAL"/><div className="form-actions"><button type="button" className="button ghost" onClick={()=>setShowForm(false)}>Cancelar</button><button className="button" type="submit">Guardar cotización</button></div></form>}<section className="card"><div className="topbar"><div><h2>Bandeja de cotizaciones</h2><p className="muted">Origen visible para distinguir solicitudes web y registros del equipo.</p></div><button className="button ghost" onClick={load}>Actualizar</button></div>{loading?<div className="empty-state"><span>Cargando cotizaciones…</span></div>:quotes.length===0?<div className="empty-state"><strong>0 cotizaciones</strong><span>La bandeja está vacía. Puedes crear una manual o esperar una solicitud desde la web.</span></div>:<div className="table-scroll"><table><thead><tr><th>Código</th><th>Placa</th><th>Documento</th><th>Origen</th><th>Estado</th><th>Registro</th></tr></thead><tbody>{quotes.map(q=><tr key={q.id}><td>{q.code}</td><td><strong>{q.plate}</strong><small>{q.vehicleType}</small></td><td>{q.documentType} {q.documentNumber.replace(/.(?=.{3})/g,'•')}</td><td><span className={`source ${q.source.toLowerCase()}`}>{q.source==='WEB'?'Web':'Manual'}</span></td><td><span className="status">Nueva</span></td><td>{new Date(q.createdAt).toLocaleString('es-PE')}</td></tr>)}</tbody></table></div>}</section></>
}
