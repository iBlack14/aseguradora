import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full bg-white border-t border-[#dde3eb] pt-12 pb-8 px-4 sm:px-6 lg:px-8 text-[#434935] text-[13px] mt-16">
      <div className="max-w-[1200px] mx-auto space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Columna Marca & Identidad */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-[16px] font-bold text-[#161c22]">Seguros Falabella Perú</h3>
            <p className="text-[13px] text-[#434935] leading-relaxed">
              Intermediario y corredor de seguros autorizado y supervisado por la Superintendencia de Banca, Seguros y AFP (SBS) bajo el Registro N° J-0723.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[12px] text-[#434935]/80">
              <span className="material-symbols-outlined text-[18px] text-[#486800]">verified_user</span>
              <span>Operaciones 100% reguladas por la SBS</span>
            </div>
          </div>

          {/* Canales de Contacto */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-[15px] font-bold text-[#161c22]">Atención al Cliente</h4>
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#486800]">call</span>
                <span>Central Telefónica y WhatsApp: <strong>(01) 615-6000</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#486800]">schedule</span>
                <span>Lunes a sábado de 9:00 a 19:00 hrs.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#486800]">mail</span>
                <span>servicioalcliente@segurosfalabella.com.pe</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#486800]">location_on</span>
                <span>Av. Paseo de la República 3220, San Isidro, Lima - Perú</span>
              </div>
            </div>
          </div>

          {/* Libro de Reclamaciones */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-[15px] font-bold text-[#161c22]">Protección al Consumidor</h4>
            <p className="text-[13px] text-[#434935] leading-relaxed">
              Conforme a lo establecido en el Código de Protección y Defensa del Consumidor, contamos con Libro de Reclamaciones virtual a tu disposición.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-2.5 bg-[#f6f8f4] border border-[#dde3eb] px-3.5 py-2.5 rounded-xl text-[#161c22] text-[12px] font-semibold">
                <span className="material-symbols-outlined text-[24px] text-[#486800]">menu_book</span>
                <span className="flex flex-col text-left">
                  <span className="font-bold">Libro de reclamaciones</span>
                  <span className="text-[11px] text-[#434935]/70">Registro virtual oficial SBS</span>
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Links Legales */}
        <div className="py-4 border-t border-b border-[#dde3eb]/70 flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-semibold text-[#434935]">
          <span className="hover:text-[#486800] cursor-pointer">Derecho de arrepentimiento</span>
          <span className="hover:text-[#486800] cursor-pointer">Términos y condiciones</span>
          <span className="hover:text-[#486800] cursor-pointer">Política de privacidad</span>
          <span className="hover:text-[#486800] cursor-pointer">Vigencia MTC / APESEG</span>
          <span className="hover:text-[#486800] cursor-pointer">Canales de atención</span>
          <Link href="/cotizar" className="text-[#486800] hover:underline">Cotizador Web</Link>
        </div>

        {/* Copyright */}
        <div className="pt-2 text-[11px] text-[#434935]/80 space-y-2 leading-relaxed">
          <p>© 2026 Corredores de Seguros Falabella S.A.C. RUC 20509608467. Todos los derechos reservados.</p>
          <p className="text-[#434935]/60">
            Seguros Falabella actúa exclusivamente en calidad de corredor de seguros según la Ley N° 26702 y las normas vigentes de la SBS. Las coberturas, exclusiones y términos definitivos corresponden a los pactados en la póliza emitida por la compañía de seguros elegida libremente por el contratante. Consulta periódicamente la vigencia de tu póliza en el Registro Nacional de SOAT del MTC.
          </p>
        </div>
      </div>
    </footer>
  );
}
