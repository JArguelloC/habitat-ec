import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertTriangle, CalendarX, CheckCircle } from 'lucide-react';

export const Cancellation: React.FC = () => {
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
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                Políticas de Cancelación y Reembolsos
              </h1>
              <p className="mt-1 text-sm text-brand-text/70">
                Condiciones claras y transparentes para la anulación de reservas en Hábitat EC.
              </p>
            </div>
          </div>
        </div>

        {/* Contenido Legal */}
        <div className="mt-8 space-y-6 text-brand-text/80 text-sm leading-relaxed">
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <CheckCircle className="h-5 w-5" />
              1. Cancelación Gratuita Anticipada (Más de 48 Horas)
            </h2>
            <p>
              Si cancelas tu reserva con al menos <strong>48 horas de anticipación</strong> a la hora establecida
              de check-in del alojamiento, recibirás el reembolso del 100% del valor total de la estancia pagado.
            </p>
            <p>
              La liberación del stock en el calendario de inventario es inmediata, permitiendo que la habitación
              quede disponible nuevamente para otros viajeros de forma automatizada.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <CalendarX className="h-5 w-5" />
              2. Cancelación Tardía (Menos de 48 Horas) o No-Show
            </h2>
            <p>
              En caso de cancelaciones realizadas con menos de 48 horas previas al check-in o si el huésped no se
              presenta en el establecimiento (<em>No-Show</em>), se aplicará una penalización equivalente al costo
              de la primera noche de hospedaje como compensación al anfitrión por el bloqueo de inventario.
            </p>
            <p>
              El saldo restante, en caso de estancias de múltiples noches, será acreditado al mismo método de pago
              utilizado en un plazo de 3 a 5 días laborables según la entidad bancaria emisora.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
              <AlertTriangle className="h-5 w-5" />
              3. Causas de Fuerza Mayor y Clima Extremo
            </h2>
            <p>
              Ecuador cuenta con regiones de geografía diversa (Galápagos, Amazonía, Andes y Costa). En eventos de
              fuerza mayor comprobados, tales como cierres viales por deslaves, suspensión de vuelos o emergencias
              climáticas oficiales decretadas por las autoridades nacionales, se otorgará reembolso total o
              reprogramación de fechas sin penalidad alguna, previa validación con el anfitrión.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Cancellation;

