import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cotiza tu SOAT | La Positiva',
  description: 'Cotiza tu SOAT 100% digital en La Positiva.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
