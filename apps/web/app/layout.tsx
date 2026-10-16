import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'SOAT Digital | Seguros Falabella Perú',
  description: 'Cotiza y compara tu SOAT digital en minutos con las 5 aseguradoras autorizadas: La Positiva, Pacífico, MAPFRE, Interseguro y Protecta Security.'
};

const tailwindConfigScript = `
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          "primary": "#486800",
          "primary-container": "#8bc500",
          "on-primary": "#ffffff",
          "on-primary-container": "#344d00",
          "secondary": "#406900",
          "secondary-container": "#baf473",
          "surface-container-lowest": "#ffffff",
          "surface-container-low": "#eff4fc",
          "surface-container": "#e9eef6",
          "surface-container-high": "#e3e9f0",
          "surface-container-highest": "#dde3eb",
          "on-surface": "#161c22",
          "on-surface-variant": "#434935",
          "surface-variant": "#dde3eb",
          "error": "#ba1a1a",
          "error-container": "#ffdad6"
        },
        fontFamily: {
          sans: ["Inter", "sans-serif"]
        }
      }
    }
  };
`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="light">
      <head>
        <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async />
        <script dangerouslySetInnerHTML={{ __html: tailwindConfigScript }} />
      </head>
      <body className="bg-[#F6F8F4] text-[#161c22] font-sans antialiased min-h-screen flex flex-col">
        <Header />
        <div className="flex-grow">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
