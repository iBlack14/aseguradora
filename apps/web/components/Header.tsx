'use client';

import Image from 'next/image';
import Link from 'next/link';

export function Header() {
  return (
    <>
      {/* 1. TOPBAR ECOSISTEMA FALABELLA */}
      <section className="w-full bg-[#e3e9f0] border-b border-[#dde3eb] text-[#434935] text-[12px] py-1.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <span className="text-[11px] text-[#434935]/70 tracking-wide font-medium">GRUPO FALABELLA:</span>
            <span className="hidden sm:inline hover:text-[#486800] transition-colors cursor-pointer">Falabella.com</span>
            <span className="text-[#dde3eb] hidden sm:inline">|</span>
            <span className="hidden sm:inline hover:text-[#486800] transition-colors cursor-pointer">Banco Falabella</span>
            <span className="text-[#dde3eb] hidden sm:inline">|</span>
            <span className="hidden sm:inline hover:text-[#486800] transition-colors cursor-pointer">Viajes Falabella</span>
            <span className="text-[#dde3eb] hidden sm:inline">|</span>
            <Link className="text-[#486800] font-bold flex items-center gap-1.5" href="/">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8bc500] inline-block"></span>
              Seguros Falabella
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#dde3eb] text-[11px] font-semibold">
              <span>🇵🇪</span>
              <span>Perú</span>
            </div>
            <span className="text-[11px] text-[#434935]/80 hidden md:inline">
              Corredores de Seguros Falabella · RUC 20509608467
            </span>
          </div>
        </div>
      </section>

      {/* 2. HEADER PRINCIPAL */}
      <header className="w-full sticky top-0 z-50 bg-white/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 shadow-xs border-b border-slate-100">
        <div className="max-w-[1200px] mx-auto h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center group focus:outline-none focus:ring-2 focus:ring-[#8bc500] rounded-lg p-1"
          >
            <Image
              src="/assets/logos/seguros-falabella-header.png"
              alt="Seguros Falabella"
              width={200}
              height={55}
              className="h-12 sm:h-14 w-auto object-contain group-hover:scale-[1.02] transition-transform"
              priority
            />
          </Link>

          {/* Nav links */}
          <nav aria-label="Navegación principal" className="hidden lg:flex items-center space-x-6 text-[14px] font-semibold">
            <Link className="text-[#434935] hover:text-[#161c22] transition-colors duration-150 py-2" href="/#seguros">
              Seguros
            </Link>
            <Link className="text-[#434935] hover:text-[#161c22] transition-colors duration-150 py-2" href="/#beneficios">
              Beneficios
            </Link>
            <Link className="text-[#434935] hover:text-[#161c22] transition-colors duration-150 py-2" href="/#faq">
              Centro de ayuda
            </Link>
            <Link className="text-[#486800] font-bold border-b-2 border-[#486800] pb-0.5" href="/">
              SOAT Digital
            </Link>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {process.env.NODE_ENV !== 'production' && (
              <a
                href="http://localhost:3001"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 h-11 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[#486800]">admin_panel_settings</span>
                <span>Panel Asesor</span>
              </a>
            )}
            <Link
              href="/#cotizador"
              className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-lg bg-[#8bc500] hover:bg-[#7ab000] text-[#344d00] font-bold text-[14px] shadow-sm active:scale-[0.98] transition-all"
            >
              <span>Cotizar SOAT</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
