'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Quote = {
  id: string;
  code: string;
  plate: string;
  vehicleType: string;
  source: 'WEB' | 'MANUAL';
  status: string;
  createdAt: string;
  selectedPrice?: number;
  vehicle?: { brand: string; model: string; year: number };
};

type Summary = { total: number; web: number; manual: number; pending: number };
const empty: Summary = { total: 0, web: 0, manual: 0, pending: 0 };

export default function Dashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [summary, setSummary] = useState(empty);

  useEffect(() => {
    fetch('/api/backend/v1/quotes')
      .then((r) => r.json())
      .then((result) => {
        setQuotes(result.data || []);
        setSummary(result.summary || empty);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="muted">Sistema interno de emisión SOAT</p>
          <h1>Panel de Control de Operaciones</h1>
        </div>
        <Link className="button" href="/cotizaciones?new=1">
          + Nueva cotización
        </Link>
      </header>

      <section className="grid">
        <article className="card">
          <span className="muted">Cotizaciones totales</span>
          <div className="metric">{summary.total}</div>
        </article>
        <article className="card">
          <span className="muted">Ingresadas por web</span>
          <div className="metric">{summary.web}</div>
        </article>
        <article className="card">
          <span className="muted">Cotizadas en operaciones</span>
          <div className="metric">{summary.manual}</div>
        </article>
        <article className="card">
          <span className="muted">Nuevas por atender</span>
          <div className="metric">{summary.pending}</div>
        </article>
      </section>

      <section className="card">
        <div className="topbar">
          <div>
            <h2>Actividad Reciente en Tiempo Real</h2>
            <p className="muted">Las cotizaciones realizadas en la web y en oficina se reflejan aquí de inmediato.</p>
          </div>
          <Link href="/cotizaciones" className="table-link">
            Ver todas las cotizaciones →
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div className="empty-state">
            <strong>Aún no hay cotizaciones</strong>
            <span>Cuando un usuario cotice su placa en la web o registres una en oficina, aparecerá aquí.</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Vehículo</th>
                <th>Tarifa SOAT</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {quotes.slice(0, 6).map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong>{q.code}</strong>
                  </td>
                  <td>
                    <strong style={{ fontSize: 14 }}>{q.plate}</strong>
                    <small>
                      {q.vehicle ? `${q.vehicle.brand} ${q.vehicle.model}` : q.vehicleType}
                    </small>
                  </td>
                  <td>
                    <span className="price-pill">
                      S/ {q.selectedPrice ? q.selectedPrice.toFixed(2) : '65.00'}
                    </span>
                  </td>
                  <td>
                    <span className={`source ${q.source.toLowerCase()}`}>
                      {q.source === 'WEB' ? 'Web Pública' : 'Gestión Interna'}
                    </span>
                  </td>
                  <td>
                    <span className="status">Nueva</span>
                  </td>
                  <td>{new Date(q.createdAt).toLocaleString('es-PE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
