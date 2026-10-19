import type { Metadata } from 'next';
import './globals.css';
import './polish.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'SOAT Digital | Seguros Falabella Perú',
  description: 'Cotiza y compara tu SOAT digital en minutos con las 5 aseguradoras autorizadas: La Positiva, Pacífico, MAPFRE, Interseguro y Protecta Security.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="light" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-[#F6F8F4] text-[#161c22] font-sans antialiased min-h-screen flex flex-col"
        suppressHydrationWarning
      >
        <Header />
        <div className="flex-grow">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
