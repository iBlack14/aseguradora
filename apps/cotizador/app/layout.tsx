import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cotiza tu SOAT | Seguros Falabella',
  description: 'Cotiza tu SOAT digital de forma rápida y segura.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
