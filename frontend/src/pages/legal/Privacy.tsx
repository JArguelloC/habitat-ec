import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Database, Eye } from 'lucide-react';

export const Privacy: React.FC = () => {
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
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                Políticas de Privacidad
              </h1>
              <p className="mt-1 text-sm text-brand-text/70">
                Cumplimiento de la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador.
              </p>
            </div>
          </div>
        </div>

        {/* Contenido Legal */}
        <div className="mt-8 space-y-6 text-brand-text/80 text-sm leading-relaxed">
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <Database className="h-5 w-5" />
              1. Datos Personales Recopilados
            </h2>
            <p>
              Hábitat EC recopila la información estrictamente necesaria para la prestación del servicio de hospitalidad:
              nombres completos, dirección de correo electrónico, documento de identidad o pasaporte, número telefónico
              de contacto y preferencias de reserva.
            </p>
            <p>
              No almacenamos información completa de tarjetas de crédito en nuestros servidores; los datos financieros
              son procesados de extremo a extremo por pasarelas de pago certificadas con tokenización PCI-DSS.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <Eye className="h-5 w-5" />
              2. Finalidad del Tratamiento de Datos
            </h2>
            <p>
              Sus datos son utilizados exclusivamente para:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Generar órdenes y vouchers electrónicos de reserva (códigos PNR).</li>
              <li>Facilitar la comunicación operativa entre el anfitrión y el huésped para el check-in.</li>
              <li>Cumplir con las obligaciones tributarias y de facturación electrónica del SRI en Ecuador.</li>
              <li>Garantizar la seguridad e integridad de la plataforma frente a accesos no autorizados.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <Lock className="h-5 w-5" />
              3. Ejercicio de Derechos ARCO y Seguridad
            </h2>
            <p>
              De conformidad con la LOPDP, usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento
              de sus datos personales. Puede ejercer estos derechos enviando una solicitud formal a través del panel de
              su perfil de usuario o contactando a nuestro Oficial de Privacidad.
            </p>
            <p>
              Mantenemos medidas de seguridad técnicas, organizativas y transaccionales para prevenir la pérdida,
              alteración o acceso no autorizado a su información personal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Privacy;

