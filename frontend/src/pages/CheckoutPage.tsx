import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Clock,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  User,
  Mail,
  Calendar,
  BedDouble,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  FileCheck2,
  Loader2,
  Receipt,
  Globe,
  Smartphone,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { InputControl } from '../components/common/FormField';
import { focusFirstInvalidInput } from '../utils/inputFilters';
import { validateName, validateEmail } from '../utils/validators';

interface CheckoutState {
  preview: {
    orderPreviewId: string;
    totalPrice: number;
    currency: string;
    expiresAt: string;
  };
  alojamiento: {
    alojamiento_id: number;
    titulo: string;
    ciudad: string;
    tipo_alojamiento: string;
  };
  producto: {
    productoId: string;
    nombreProducto: string;
    precioBaseNocheUsd: number;
    planAlimenticio: string;
  };
  checkin: string;
  checkout: string;
  nightsCount: number;
  adultos: number;
  cuartos: number;
  contrato5FN?: {
    canalProtocolo: string;
    politicaCodigo: string;
    porcentajeReembolso: number;
    horasAnticipacion: number;
  } | null;
  portadaUrl?: string;
}

interface ConfirmedVoucher {
  orderId: string;
  locator: string;
  status: string;
  totalPrice: number;
  currency: string;
  creationDate: string;
  referenciaPasarela: string;
  metodoPago: string;
  proveedorPasarela: 'PAYPHONE_EC' | 'STRIPE' | 'SANDBOX_INTERNAL';
  modoPasarela: string;
  autorizacionCodigo: string;
}

export const CheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, notify } = useAuth();

  const checkoutState = (location.state as CheckoutState | null) || null;

  // Guest & Payment Gateway Form
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [apellido, setApellido] = useState(user?.apellido || '');
  const [email, setEmail] = useState(user?.correo || '');
  const [proveedorPasarela, setProveedorPasarela] = useState<
    'PAYPHONE_EC' | 'STRIPE' | 'SANDBOX_INTERNAL'
  >('PAYPHONE_EC');
  const [metodoPago, setMetodoPago] = useState<
    'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA'
  >('TARJETA_CREDITO');
  const [ultimosCuatro, setUltimosCuatro] = useState('4242');
  const [processing, setProcessing] = useState(false);
  const [voucher, setVoucher] = useState<ConfirmedVoucher | null>(null);

  // Validaciones en tiempo real (Heurísticas IHC)
  const nombreValidation = validateName(nombre, 'El nombre del huésped');
  const apellidoValidation = validateName(apellido, 'El apellido del huésped');
  const emailValidation = validateEmail(email);
  const isUltimosCuatroValid = metodoPago === 'TRANSFERENCIA' || /^\d{4}$/.test(ultimosCuatro);

  // 15:00 Countdown Timer
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!checkoutState?.preview?.expiresAt) return 900;
    const diff = Math.floor(
      (new Date(checkoutState.preview.expiresAt).getTime() - Date.now()) / 1000,
    );
    return diff > 0 && diff <= 900 ? diff : 900;
  });

  useEffect(() => {
    if (!checkoutState || voucher) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [checkoutState, voucher]);

  if (!checkoutState) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="card-surface p-10">
          <Clock className="mx-auto h-10 w-10 text-brand-accent" />
          <h2 className="mt-4 font-serif text-2xl font-bold text-brand-text">
            No hay ningún bloqueo temporal (Hold) activo
          </h2>
          <p className="mt-2 text-xs text-brand-text/70">
            Selecciona primero un alojamiento y una habitación en el Marketplace para activar tu
            reserva protegida de 15 minutos.
          </p>
          <Link to="/" className="btn-primary mt-6">
            <ArrowLeft className="h-4 w-4" />
            Explorar Alojamientos
          </Link>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpired = secondsLeft <= 0 && !voucher;

  const handleConfirmAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExpired) {
      notify(
        'error',
        'El Hold de 15 minutos ha expirado',
        'Por favor regresa al alojamiento para generar un nuevo bloqueo de inventario.',
      );
      return;
    }

    if (!nombreValidation.valid || !apellidoValidation.valid || !emailValidation.valid || !isUltimosCuatroValid) {
      focusFirstInvalidInput();
      if (!nombreValidation.valid) {
        notify('warning', 'Datos de huésped inválidos', nombreValidation.message);
      } else if (!apellidoValidation.valid) {
        notify('warning', 'Datos de huésped inválidos', apellidoValidation.message);
      } else if (!emailValidation.valid) {
        notify('warning', 'Correo electrónico inválido', emailValidation.message);
      } else if (!isUltimosCuatroValid) {
        notify('warning', 'Tarjeta requerida', 'Ingresa los 4 dígitos numéricos de tu tarjeta.');
      }
      return;
    }
    setProcessing(true);
    try {
      const initialPaymentRef = `${proveedorPasarela}-${Date.now()}`;

      // Step 1: Create Order (`POST /ordenes/create`) - httpClient injects Idempotency-Key
      const { data: createdOrder } = await httpClient.post<{
        orderId: string;
        locator: string;
        status: string;
        totalPrice: number;
        currency: string;
        creationDate: string;
      }>('/ordenes/create', {
        orderPreviewId: checkoutState.preview.orderPreviewId,
        paymentReference: initialPaymentRef,
        customer: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
        },
        canalProtocolo: checkoutState.contrato5FN?.canalProtocolo || 'WEB_REST',
        politicaCodigo: checkoutState.contrato5FN?.politicaCodigo || 'FREE_CANCELLATION',
      });

      // Step 2: Initialize Payment Intent with Gateway Adapter (`POST /pagos/intent`)
      const { data: intentData } = await httpClient.post<{
        proveedor: 'PAYPHONE_EC' | 'STRIPE' | 'SANDBOX_INTERNAL';
        modo: string;
        intentId: string;
        referenciaPasarela: string;
        autorizacionCodigo: string;
      }>('/pagos/intent', {
        orderId: String(createdOrder.orderId),
        proveedor: proveedorPasarela,
        montoCobrado: Number(createdOrder.totalPrice),
        moneda: createdOrder.currency || 'USD',
      });

      // Step 3: Process Payment & Host Settlement + Emit Outbox Event (`POST /pagos/procesar`)
      await httpClient.post('/pagos/procesar', {
        orderId: String(createdOrder.orderId),
        metodoPago,
        ultimosCuatro:
          metodoPago === 'TRANSFERENCIA' ? undefined : ultimosCuatro.slice(0, 4) || '4242',
        montoCobrado: Number(createdOrder.totalPrice),
        referenciaPasarela: intentData.referenciaPasarela,
        proveedorPasarela,
      });

      setVoucher({
        ...createdOrder,
        referenciaPasarela: intentData.referenciaPasarela,
        metodoPago,
        proveedorPasarela,
        modoPasarela: intentData.modo,
        autorizacionCodigo: intentData.autorizacionCodigo,
      });

      notify(
        'success',
        `¡Pago Aprobado vía ${proveedorPasarela}!`,
        `Tu código localizador PNR es ${createdOrder.locator} (Auth: ${intentData.autorizacionCodigo}).`,
      );
    } catch (err: unknown) {
      notify(
        'error',
        'Error al confirmar la reserva',
        extractErrorMessage(err, 'No se pudo completar la transacción.'),
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 text-left">
      {/* Top Progress Bar */}
      <div className="mb-8 rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-soft">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs font-semibold">
          <div className="flex items-center gap-2.5 text-brand-secondary">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-secondary text-brand-bg font-bold">
              1
            </span>
            <span>1. Reserva</span>
          </div>
          <div
            className={`flex items-center gap-2.5 ${
              voucher ? 'text-brand-secondary' : 'text-brand-accent font-bold'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                voucher
                  ? 'bg-brand-secondary text-brand-bg font-bold'
                  : 'bg-brand-primary text-brand-bg font-bold'
              }`}
            >
              2
            </span>
            <span>2. Datos y Pago</span>
          </div>
          <div
            className={`flex items-center gap-2.5 ${
              voucher ? 'text-brand-accent font-bold' : 'text-brand-text/45'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                voucher
                  ? 'bg-brand-primary text-brand-text'
                  : 'bg-brand-border text-brand-text/60'
              }`}
            >
              3
            </span>
            <span>3. Confirmación</span>
          </div>
        </div>
      </div>

      {/* Live 15:00 Countdown Banner */}
      {!voucher && (
        <div
          className={`mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border p-4 shadow-soft ${
            isExpired
              ? 'border-red-300 bg-red-50 text-red-900'
              : secondsLeft < 180
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-brand-primary/60 bg-brand-primary/15 text-brand-text'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface shadow-sm text-brand-accent">
              {isExpired ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <Clock className="h-5 w-5 animate-pulse" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold">
                {isExpired
                  ? 'Tu bloqueo temporal de disponibilidad ha expirado'
                  : 'Disponibilidad bloqueada exclusivamente para ti'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-brand-surface px-4 py-2 border border-brand-border shadow-sm">
            <span className="text-xs font-medium text-brand-text/70">Tiempo restante:</span>
            <span className="font-mono text-xl font-extrabold text-brand-accent">
              {formattedTimer}
            </span>
          </div>
        </div>
      )}

      {/* VOUCHER VIEW IF CONFIRMED */}
      {voucher ? (
        <div className="card-surface p-8 sm:p-10 max-w-3xl mx-auto border-brand-secondary/40 shadow-elevated">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-secondary text-brand-bg">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <span className="chip-sage mb-1">
                  Orden Confirmada • {voucher.proveedorPasarela} ({voucher.modoPasarela})
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-brand-text">
                  Voucher Oficial de Reserva
                </h1>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-primary bg-brand-primary/20 px-4 py-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent block">
                Localizador PNR
              </span>
              <span className="font-mono text-xl font-extrabold text-brand-text">
                {voucher.locator}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-2xl bg-brand-bg p-4 border border-brand-border space-y-1.5">
              <span className="font-bold uppercase text-brand-accent block">
                Alojamiento y Habitación
              </span>
              <p className="text-sm font-bold text-brand-text">
                {checkoutState.alojamiento.titulo}
              </p>
              <p className="text-brand-text/75">
                {checkoutState.producto.nombreProducto} ({checkoutState.cuartos} hab. •{' '}
                {checkoutState.adultos} adultos)
              </p>
              <p className="text-brand-text/75">
                Check-in: <strong>{checkoutState.checkin}</strong> → Check-out:{' '}
                <strong>{checkoutState.checkout}</strong>
              </p>
            </div>

            <div className="rounded-2xl bg-brand-bg p-4 border border-brand-border space-y-1.5">
              <span className="font-bold uppercase text-brand-accent block">
                Trazabilidad Financiera & Adquirente
              </span>
              <p className="text-brand-text/80">
                Huésped titular: <strong>{nombre} {apellido}</strong> ({email})
              </p>
              <p className="text-brand-text/80">
                Pasarela: <strong>{voucher.proveedorPasarela}</strong> ({voucher.metodoPago})
              </p>
              <p className="text-brand-text/80">
                Código Autorización: <code className="font-mono">{voucher.autorizacionCodigo}</code>
              </p>
              <p className="text-brand-text/80">
                Referencia TX: <code className="font-mono">{voucher.referenciaPasarela}</code>
              </p>
              <p className="text-sm font-bold text-brand-secondary pt-1">
                Total Pagado: ${Number(voucher.totalPrice).toFixed(2)} {voucher.currency}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-brand-border">
            <Link to="/" className="btn-secondary">
              Volver al Marketplace
            </Link>
            <Link to="/mis-reservas" className="btn-primary">
              <Receipt className="h-4 w-4" />
              Gestionar en Mis Reservas
            </Link>
          </div>
        </div>
      ) : (
        /* 2-COLUMN CHECKOUT LAYOUT */
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: Financial Summary (5 cols) */}
          <div className="lg:col-span-5 card-surface overflow-hidden">
            {checkoutState.portadaUrl && (
              <div className="h-44 w-full overflow-hidden">
                <img
                  src={checkoutState.portadaUrl}
                  alt={checkoutState.alojamiento.titulo}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="p-6 space-y-4">
              <div>
                <span className="chip-gold text-[11px]">
                  <Sparkles className="h-3 w-3" />
                  {checkoutState.alojamiento.tipo_alojamiento}
                </span>
                <h2 className="mt-2 font-serif text-xl font-bold text-brand-text">
                  {checkoutState.alojamiento.titulo}
                </h2>
                <p className="text-xs text-brand-text/65">{checkoutState.alojamiento.ciudad}</p>
              </div>

              <div className="rounded-2xl bg-brand-bg p-4 border border-brand-border space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-brand-text/70">
                    <BedDouble className="h-4 w-4 text-brand-accent" />
                    Habitación:
                  </span>
                  <span className="font-bold text-brand-text">
                    {checkoutState.producto.nombreProducto}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-brand-text/70">
                    <Calendar className="h-4 w-4 text-brand-accent" />
                    Estancia ({checkoutState.nightsCount} noches):
                  </span>
                  <span className="font-semibold text-brand-text">
                    {checkoutState.checkin} → {checkoutState.checkout}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-brand-text/70">
                    <User className="h-4 w-4 text-brand-accent" />
                    Ocupación:
                  </span>
                  <span className="font-semibold text-brand-text">
                    {checkoutState.adultos} adulto(s) • {checkoutState.cuartos} cuarto(s)
                  </span>
                </div>
                {checkoutState.contrato5FN && (
                  <div className="flex items-center justify-between pt-2 border-t border-brand-border">
                    <span className="inline-flex items-center gap-1.5 text-brand-text/70">
                      <FileCheck2 className="h-4 w-4 text-brand-secondary" />
                      Política:
                    </span>
                    <span className="font-semibold text-brand-secondary">
                      Cancelación Gratuita
                    </span>
                  </div>
                )}
              </div>

              {/* Total Breakdown */}
              <div className="border-t border-brand-border pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-brand-text/75">
                  <span>Subtotal alojamientos ({checkoutState.nightsCount} noches)</span>
                  <span>${Number(checkoutState.preview.totalPrice).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-brand-secondary">
                  <span>Impuestos y protección de reserva</span>
                  <span>Incluidos</span>
                </div>
                <div className="flex justify-between text-base font-bold text-brand-text pt-2 border-t border-brand-border">
                  <span>Total a Pagar</span>
                  <span className="font-serif text-xl text-brand-accent">
                    ${Number(checkoutState.preview.totalPrice).toFixed(2)}{' '}
                    {checkoutState.preview.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Guest Details & Payment Gateway (7 cols) */}
          <div className="lg:col-span-7 card-surface p-6 sm:p-8">
            <h2 className="font-serif text-xl font-bold text-brand-text">
              Datos del Huésped y Pago Seguro
            </h2>
            <p className="mt-1 text-xs text-brand-text/65">
              Completa tus datos de contacto y elige tu método de pago preferido para confirmar tu reserva.
            </p>

            <form onSubmit={handleConfirmAndPay} className="mt-6 space-y-5" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputControl
                  label="Nombres del Huésped *"
                  required
                  filterType="letters"
                  maxLength={60}
                  icon={User}
                  value={nombre}
                  onValueChange={setNombre}
                  placeholder="Ej. Mateo"
                  error={!nombreValidation.isEmpty && !nombreValidation.valid ? nombreValidation.message : null}
                  success={nombreValidation.valid ? 'Nombre verificado.' : null}
                />
                <InputControl
                  label="Apellidos del Huésped *"
                  required
                  filterType="letters"
                  maxLength={60}
                  icon={User}
                  value={apellido}
                  onValueChange={setApellido}
                  placeholder="Ej. Villalobos"
                  error={!apellidoValidation.isEmpty && !apellidoValidation.valid ? apellidoValidation.message : null}
                  success={apellidoValidation.valid ? 'Apellido verificado.' : null}
                />
              </div>

              <InputControl
                label="Correo Electrónico para Confirmación *"
                required
                type="email"
                icon={Mail}
                value={email}
                onValueChange={(val) => setEmail(val.trim())}
                placeholder="nombre@correo.ec"
                error={!emailValidation.isEmpty && !emailValidation.valid ? emailValidation.message : null}
                success={emailValidation.valid ? 'Correo verificado.' : null}
              />

              {/* Payment Method Selector */}
              <div className="border-t border-brand-border pt-5">
                <h3 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-brand-accent" />
                  1. Método de Pago
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setProveedorPasarela('PAYPHONE_EC')}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      proveedorPasarela === 'PAYPHONE_EC'
                        ? 'border-brand-accent bg-brand-primary/25 shadow-sm'
                        : 'border-brand-border bg-brand-bg hover:border-brand-accent/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-text">Payphone Ecuador</span>
                      <Smartphone className="h-4 w-4 text-brand-accent" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProveedorPasarela('STRIPE')}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      proveedorPasarela === 'STRIPE'
                        ? 'border-brand-accent bg-brand-primary/25 shadow-sm'
                        : 'border-brand-border bg-brand-bg hover:border-brand-accent/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-text">Stripe Global</span>
                      <CreditCard className="h-4 w-4 text-brand-accent" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProveedorPasarela('SANDBOX_INTERNAL')}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      proveedorPasarela === 'SANDBOX_INTERNAL'
                        ? 'border-brand-accent bg-brand-primary/25 shadow-sm'
                        : 'border-brand-border bg-brand-bg hover:border-brand-accent/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-text">Cámara Directa</span>
                      <ShieldCheck className="h-4 w-4 text-brand-secondary" />
                    </div>
                  </button>
                </div>
              </div>

              <div className="border-t border-brand-border pt-4">
                <h3 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-brand-accent" />
                  2. Instrumento de Cobro
                </h3>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      { id: 'TARJETA_CREDITO', label: 'Tarjeta de Crédito' },
                      { id: 'TARJETA_DEBITO', label: 'Tarjeta de Débito' },
                      { id: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoPago(m.id)}
                      className={`rounded-xl border p-3 text-xs font-semibold transition-all text-left ${
                        metodoPago === m.id
                          ? 'border-brand-accent bg-brand-primary/20 text-brand-text shadow-sm'
                          : 'border-brand-border bg-brand-bg text-brand-text/75 hover:border-brand-accent'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {metodoPago !== 'TRANSFERENCIA' && (
                  <div className="mt-4">
                    <InputControl
                      label="Últimos 4 dígitos de la tarjeta (Tokenizado PCI-DSS) *"
                      required
                      filterType="numbers"
                      maxLength={4}
                      value={ultimosCuatro}
                      onValueChange={setUltimosCuatro}
                      placeholder="4242"
                      wrapperClassName="max-w-[240px]"
                      className="font-mono text-center tracking-widest"
                      error={
                        ultimosCuatro.length > 0 && ultimosCuatro.length < 4
                          ? 'Ingresa los 4 dígitos exactos.'
                          : null
                      }
                      success={ultimosCuatro.length === 4 ? 'Tarjeta tokenizada.' : null}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="btn-secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Modificar fechas
                </button>

                <button
                  type="submit"
                  disabled={
                    processing ||
                    isExpired ||
                    !nombreValidation.valid ||
                    !apellidoValidation.valid ||
                    !emailValidation.valid ||
                    !isUltimosCuatroValid
                  }
                  className="btn-primary py-3.5 px-6 text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Autorizando con {proveedorPasarela}...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Pagar ${Number(checkoutState.preview.totalPrice).toFixed(2)} USD con{' '}
                      {proveedorPasarela === 'PAYPHONE_EC'
                        ? 'Payphone'
                        : proveedorPasarela === 'STRIPE'
                        ? 'Stripe'
                        : 'Cámara Directa'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
