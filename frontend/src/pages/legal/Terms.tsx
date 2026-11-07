import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, CheckCircle2, AlertCircle } from 'lucide-react';

export const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-bg py-10 transition-colors duration-200">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb / Regreso */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-brand-secondary hover:text-brand-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Marketplace
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-brand-border pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                Términos y Condiciones
              </h1>
              <p className="mt-1 text-sm text-brand-text/70">
                Última actualización: Noviembre 2026. Marco legal aplicable al uso de Hábitat EC.
              </p>
            </div>
          </div>
        </div>

        {/* Contenido Legal */}
        <div className="mt-8 space-y-6 text-brand-text/80 text-sm leading-relaxed">
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <Scale className="h-5 w-5" />
              1. Aceptación del Contrato de Servicios
            </h2>
            <p>
              Al acceder, navegar o utilizar la plataforma web de <strong>Hábitat EC</strong>, usted acepta
              quedar legalmente vinculado por estos Términos y Condiciones, así como por nuestra Política
              de Privacidad y Cancelación. Si no está de acuerdo con alguno de los términos aquí estipulados,
              deberá abstenerse de utilizar el servicio.
            </p>
            <p>
              Hábitat EC opera como un intermediario tecnológico seguro que conecta anfitriones de alojamientos
              turísticos sostenibles en la República del Ecuador con viajeros nacionales e internacionales.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <CheckCircle2 className="h-5 w-5" />
              2. Obligaciones y Responsabilidades del Huésped
            </h2>
            <p>
              El huésped se compromete a proporcionar información verídica al momento del registro y la confirmación
              de reservas. Queda estrictamente prohibido realizar reservas fraudulentas, duplicadas o especulativas.
            </p>
            <p>
              El huésped deberá respetar las normas internas del establecimiento, cuidar las instalaciones, cumplir
              con los horarios pactados de check-in y check-out, y preservar los entornos naturales protegidos en
              casos de Eco-Lodges y Reservas Comunitarias.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <AlertCircle className="h-5 w-5" />
              3. Obligaciones del Anfitrión y Reglas de Inventario
            </h2>
            <p>
              Los anfitriones garantizan que las propiedades publicadas cumplen con los permisos turísticos,
              licencias cantonales y normativas de seguridad de la República del Ecuador. El inventario
              publicado en la plataforma es de cumplimiento obligatorio: las reservas confirmadas mediante
              pago no podrán ser canceladas unilateralmente sin causa de fuerza mayor debidamente justificada.
            </p>
            <p>
              Las tarifas publicadas incluyen los impuestos de ley aplicables y la comisión de servicio
              transaccional acordada con la plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Terms;

