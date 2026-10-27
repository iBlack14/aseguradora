'use client';

import { FormEvent, useEffect, useState } from 'react';

type User = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string };
const roleNames: Record<string, string> = { ADMIN: 'Administrador', SALES: 'Vendedor', OPERATIONS: 'Operaciones', SUPPORT: 'Soporte', AUDITOR: 'Auditoría' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SALES' });

  async function loadUsers() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/backend/v1/admin/users', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar la lista.');
      setUsers(result.data || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cargar la lista.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadUsers(); }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/backend/v1/admin/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === 'EMAIL_ALREADY_EXISTS' ? 'Ese correo ya está registrado.' : result.error === 'VALIDATION_ERROR' ? 'Revisa los datos y usa una contraseña de al menos 8 caracteres.' : 'No se pudo crear el usuario.');
      setForm({ name: '', email: '', password: '', role: 'SALES' }); setSuccess('Vendedor creado correctamente. Ya puede ingresar con su correo y contraseña.'); await loadUsers();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear el usuario.'); }
    finally { setSaving(false); }
  }

  async function toggleUser(user: User) {
    setError('');
    const response = await fetch(`/api/backend/v1/admin/users/${user.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: !user.active }) });
    if (!response.ok) { setError('No se pudo actualizar el estado del usuario.'); return; }
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active: !item.active } : item));
  }

  return <>
    <header className="topbar"><div><p className="muted">Accesos del equipo comercial y operativo</p><h1>Usuarios y roles</h1></div><button className="button" onClick={loadUsers}>Actualizar lista</button></header>
    {error && <div className="user-alert error" role="alert">{error}</div>}
    {success && <div className="user-alert success" role="status">{success}</div>}
    <section className="users-layout">
      <form className="card user-form" onSubmit={createUser}><h2>Crear vendedor</h2><p className="muted">Crea un acceso para que pueda gestionar cotizaciones y ventas.</p><label>Nombre completo<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Ej. María López" /></label><label>Correo corporativo<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required placeholder="maria@segurosfalabella.com.pe" /></label><label>Contraseña temporal<input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required placeholder="Mínimo 8 caracteres" /></label><label>Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="SALES">Vendedor</option><option value="OPERATIONS">Operaciones</option><option value="SUPPORT">Soporte</option><option value="AUDITOR">Auditoría</option></select></label><button className="button" disabled={saving}>{saving ? 'Creando…' : 'Crear usuario'}</button></form>
      <section className="card"><div className="users-heading"><div><h2>Usuarios registrados</h2><p className="muted">{users.length} acceso{users.length === 1 ? '' : 's'} en el sistema.</p></div></div>{loading ? <div className="empty-state">Cargando usuarios…</div> : users.length === 0 ? <div className="empty-state"><strong>Aún no hay usuarios</strong><span>Crea el primer vendedor desde el formulario.</span></div> : <div className="table-scroll"><table className="users-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td data-label="Usuario"><strong>{user.name}</strong><small>{user.email}</small></td><td data-label="Rol">{roleNames[user.role] || user.role}</td><td data-label="Estado"><span className={`status ${user.active ? '' : 'inactive'}`}>{user.active ? 'Activo' : 'Inactivo'}</span></td><td data-label="Acción">{user.role === 'ADMIN' ? <span className="muted">Cuenta principal</span> : <button className="button ghost small-button" onClick={() => toggleUser(user)}>{user.active ? 'Desactivar' : 'Activar'}</button>}</td></tr>)}</tbody></table></div>}</section>
    </section>
  </>;
}
