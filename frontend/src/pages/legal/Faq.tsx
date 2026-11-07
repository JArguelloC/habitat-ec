import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, ShieldCheck, Clock, CreditCard, Home } from 'lucide-react';

export const Faq: React.FC = () => {
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
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                Preguntas Frecuentes (FAQ)
              </h1>
              <p className="mt-1 text-sm text-brand-text/70">
                Todo lo que necesitas saber para reservar y alojarte con Hábitat EC en Ecuador.
              </p>
            </div>
          </div>
        </div>

        {/* Contenido / Acordeones */}
        <div className="mt-8 space-y-6">
          {/* Sección 1 */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <Clock className="h-5 w-5" />
              ¿Cómo funciona el Hold temporal de 15 minutos al reservar?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-text/80">
              Cuando seleccionas las fechas de tu viaje y avanzas a la pantalla de cotización, nuestro motor
              transaccional bloquea automáticamente la habitación durante 15 minutos mediante un <em>Hold transaccional</em>.
              Esto garantiza que ningún otro usuario pueda reservar el mismo stock mientras ingresas tus datos y realizas el pago.
              Si transcurren los 15 minutos sin completar la transacción, el inventario se libera de forma automática.
            </p>
          </div>

          {/* Sección 2 */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <CreditCard className="h-5 w-5" />
              ¿Qué métodos de pago son aceptados?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-text/80">
              Aceptamos tarjetas de crédito y débito nacionales e internacionales (Visa, Mastercard, American Express)
              así como transferencias bancarias locales para liquidación directa. Todas las transacciones se procesan
              bajo estrictos estándares de encriptación y trazabilidad bancaria con comprobantes PNR inmediatos.
            </p>
          </div>

          {/* Sección 3 */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <ShieldCheck className="h-5 w-5" />
              ¿Cómo se garantizan los horarios de Check-in y Check-out?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-text/80">
              Cada anfitrión registra oficialmente sus horarios operativos de entrada y salida (por ejemplo, Check-in a partir de las 14:00 y Check-out hasta las 11:00).
              Estos horarios quedan estipulados en tu voucher digital de confirmación. Si requieres un <em>Early Check-in</em> o <em>Late Check-out</em>,
              puedes coordinarlo previamente contactando directamente al anfitrión a través de los datos provistos en tu reserva.
            </p>
          </div>

          {/* Sección 4 */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <Home className="h-5 w-5" />
              ¿Cómo puedo publicar mi propiedad y convertirme en Anfitrión?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-text/80">
              Cualquier propietario o administrador de Eco-Lodges, Hostales o Hoteles en el territorio ecuatoriano puede registrarse
              con el rol de Anfitrión desde la sección <strong>"Publica tu propiedad"</strong>. Una vez autenticado, tendrás acceso al
              Wizard de creación donde podrás configurar ubicación geográfica, tipología certificada, tarifas por noche y habitaciones disponibles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Faq;

