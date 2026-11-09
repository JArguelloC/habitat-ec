import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Building2,
  Copy,
  Check,
  UploadCloud,
  X,
  Lock,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { InputControl } from '../components/common/FormField';
import { focusFirstInvalidInput } from '../utils/inputFilters';
import { validateName, validateEmail } from '../utils/validators';
import { formatDateToLatam } from '../utils/dateUtils';
import { useCheckoutTimer } from '../hooks/useCheckoutTimer';
import { InteractiveCreditCard } from '../components/checkout/InteractiveCreditCard';

export interface CuentaBancariaItem {
  id?: number;
  cuenta_bancaria_id?: number;
  banco:
    | 'BANCO_PICHINCHA'
    | 'BANCO_GUAYAQUIL'
    | 'BANCO_PACIFICO'
    | 'PRODUBANCO'
    | 'BANCO_INTERNACIONAL'
    | string;
  tipo_cuenta?: 'AHORROS' | 'CORRIENTE' | string;
  tipoCuenta?: 'AHORROS' | 'CORRIENTE' | string;
  numero_cuenta?: string;
  numeroCuenta?: string;
  nombre_titular?: string;
  nombreTitular?: string;
  identificacion_titular?: string;
  identificacionTitular?: string;
}

interface CheckoutState {
  preview: {
    orderPreviewId: string;
    subtotal?: number;
    iva?: number;
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
  ninos?: number;
  cuartos: number;
  contrato5FN?: {
    canalProtocolo: string;
    politicaCodigo: string;
    porcentajeReembolso: number;
    horasAnticipacion: number;
  } | null;
  portadaUrl?: string;
  cuentasBancarias?: CuentaBancariaItem[];
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
  autorizacionCodigo: string;
  comprobanteUrl?: string | null;
}

interface BankVisualMeta {
  nombre: string;
  siglas: string;
  logoPath: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  accentBg: string;
}

const BANK_META_MAP: Record<string, BankVisualMeta> = {
  BANCO_PICHINCHA: {
    nombre: 'Banco Pichincha',
    siglas: 'BP',
    logoPath: '/banks/pichincha.svg',
    bgClass: 'bg-[#FFDD00]',
    textClass: 'text-[#0F265C]',
    borderClass: 'border-[#E6C700]',
    accentBg: 'bg-[#FFFDF0]',
  },
  BANCO_GUAYAQUIL: {
    nombre: 'Banco Guayaquil',
    siglas: 'BG',
    logoPath: '/banks/guayaquil.svg',
    bgClass: 'bg-[#D5006D]',
    textClass: 'text-white',
    borderClass: 'border-[#D5006D]/30',
    accentBg: 'bg-[#FDF2F7]',
  },
  BANCO_PACIFICO: {
    nombre: 'Banco del Pacífico',
    siglas: 'BP',
    logoPath: '/banks/pacifico.svg',
    bgClass: 'bg-[#005EB8]',
    textClass: 'text-white',
    borderClass: 'border-[#005EB8]/30',
    accentBg: 'bg-[#F0F7FF]',
  },
  PRODUBANCO: {
    nombre: 'Produbanco',
    siglas: 'PR',
    logoPath: '/banks/produbanco.svg',
    bgClass: 'bg-[#00693C]',
    textClass: 'text-white',
    borderClass: 'border-[#00693C]/30',
    accentBg: 'bg-[#F2FBF6]',
  },
  BANCO_INTERNACIONAL: {
    nombre: 'Banco Internacional',
    siglas: 'BI',
    logoPath: '/banks/internacional.svg',
    bgClass: 'bg-[#E65100]',
    textClass: 'text-white',
    borderClass: 'border-[#E65100]/30',
    accentBg: 'bg-[#FFF6F0]',
  },
};

function detectCardBrand(rawDigits: string): 'VISA' | 'MASTERCARD' | 'DINERS_AMEX' | null {
  if (!rawDigits) return null;
  if (rawDigits.startsWith('4')) return 'VISA';
  const firstTwo = Number(rawDigits.slice(0, 2));
  const firstFour = Number(rawDigits.slice(0, 4));
  if (
    rawDigits.startsWith('5') ||
    (firstTwo >= 51 && firstTwo <= 55) ||
    (firstFour >= 2221 && firstFour <= 2720)
  ) {
    return 'MASTERCARD';
  }
  if (rawDigits.startsWith('3')) return 'DINERS_AMEX';
  return null;
}

function formatCardNumberDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiryDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

interface ExpiryValidationResult {
  valid: boolean;
  error: string | null;
}

function validateCardExpiry(expiry: string): ExpiryValidationResult {
  if (!expiry || expiry.trim() === '') {
    return { valid: false, error: null };
  }

  // Mientras el usuario escribe los primeros caracteres
  if (expiry.length < 5) {
    return { valid: false, error: 'Ingresa la fecha completa (MM/AA).' };
  }

  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) {
    return { valid: false, error: 'Formato inválido. Usa MM/AA (ej. 08/28).' };
  }

  const inputMonth = parseInt(match[1], 10);
  const inputYearTwoDigits = parseInt(match[2], 10);

  // 1. El mes (MM) debe estar entre 01 y 12.
  if (inputMonth < 1 || inputMonth > 12) {
    return { valid: false, error: 'El mes debe estar entre 01 y 12.' };
  }

  // 2. Obtener mes y año actuales del sistema usando new Date().
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 a 12

  // Convertir el año a 4 dígitos (ej. 26 -> 2026)
  const fullYear = 2000 + inputYearTwoDigits;

  // 3. Reglas de validación:
  // - El año ingresado no puede ser menor al año actual.
  if (fullYear < currentYear) {
    return { valid: false, error: 'La tarjeta ha expirado.' };
  }

  // - Si el año ingresado es igual al año actual, el mes ingresado no puede ser menor al mes actual.
  if (fullYear === currentYear && inputMonth < currentMonth) {
    return { valid: false, error: 'La tarjeta ha expirado.' };
  }

  // Validación de sensatez para tarjetas excesivamente lejanas
  if (fullYear > currentYear + 25) {
    return { valid: false, error: 'Año de expiración inválido.' };
  }

  return { valid: true, error: null };
}

export const CheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, notify } = useAuth();

  const checkoutState = (location.state as CheckoutState | null) || null;

  // Datos del Huésped
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [apellido, setApellido] = useState(user?.apellido || '');
  const [email, setEmail] = useState(user?.correo || '');

  // Método de Pago Unificado (Pasarela única transparente en backend)
  const [metodoPago, setMetodoPago] = useState<
    'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA'
  >('TARJETA_CREDITO');

  // Formulario Interactivo de Tarjeta (Crédito / Débito)
  const [cardNumberFormatted, setCardNumberFormatted] = useState('');
  const [cardHolderName, setCardHolderName] = useState(
    `${user?.nombre || ''} ${user?.apellido || ''}`.trim(),
  );
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Cuentas Bancarias del Alojamiento y Modal de Comprobante (Transferencia)
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancariaItem[]>(
    checkoutState?.cuentasBancarias || [],
  );
  const [failedBankLogos, setFailedBankLogos] = useState<Record<string, boolean>>({});
  const [copiedAccountKey, setCopiedAccountKey] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState<string>('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);

  const [processing, setProcessing] = useState(false);
  const [voucher, setVoucher] = useState<ConfirmedVoucher | null>(null);

  // Cargar cuentas bancarias del alojamiento si aún no están en el estado
  useEffect(() => {
    if (!checkoutState?.alojamiento?.alojamiento_id) return;
    const fetchCuentas = async () => {
      try {
        const { data } = await httpClient.get<CuentaBancariaItem[]>(
          `/alojamientos/${checkoutState.alojamiento.alojamiento_id}/cuentas-bancarias`,
        );
        if (Array.isArray(data) && data.length > 0) {
          setCuentasBancarias(data);
        }
      } catch {
        // Mantiene las cuentas recibidas por state
      }
    };
    void fetchCuentas();
  }, [checkoutState?.alojamiento?.alojamiento_id]);

  // Cálculos Financieros Transparentes (Subtotal Puro + IVA 15% Ecuador = Total a Pagar)
  const financialBreakdown = useMemo(() => {
    if (!checkoutState) {
      return { subtotal: 0, iva: 0, total: 0 };
    }
    const baseNightPrice = Number(checkoutState.producto?.precioBaseNocheUsd || 0);
    const nights = Math.max(1, Number(checkoutState.nightsCount || 1));
    const rooms = Math.max(1, Number(checkoutState.cuartos || 1));

    const computedSubtotal =
      checkoutState.preview?.subtotal !== undefined
        ? Number(checkoutState.preview.subtotal)
        : Math.round(baseNightPrice * nights * rooms * 100) / 100;

    const computedIva =
      checkoutState.preview?.iva !== undefined
        ? Number(checkoutState.preview.iva)
        : Math.round(computedSubtotal * 0.15 * 100) / 100;

    const computedTotal = Math.round((computedSubtotal + computedIva) * 100) / 100;

    return {
      subtotal: computedSubtotal,
      iva: computedIva,
      total: computedTotal,
    };
  }, [checkoutState]);

  // Validaciones en tiempo real
  const nombreValidation = validateName(nombre, 'El nombre del huésped');
  const apellidoValidation = validateName(apellido, 'El apellido del huésped');
  const emailValidation = validateEmail(email);

  const rawCardDigits = cardNumberFormatted.replace(/\D/g, '');
  const detectedBrand = detectCardBrand(rawCardDigits);
  const isCardNumberValid = rawCardDigits.length === 16;
  const isCardHolderValid = cardHolderName.trim().length >= 3;
  const cardExpiryValidation = useMemo(() => validateCardExpiry(cardExpiry), [cardExpiry]);
  const isCardExpiryValid = cardExpiryValidation.valid;
  const isCardCvvValid = /^\d{3,4}$/.test(cardCvv);

  const isCardFormValid =
    metodoPago === 'TRANSFERENCIA' ||
    (isCardNumberValid && isCardHolderValid && isCardExpiryValid && isCardCvvValid);

  // Temporizador regresivo persistente (15:00) sincronizado con localStorage
  const handleExpire = useCallback(() => {
    notify(
      'error',
      'Tiempo de reserva expirado',
      'Tu disponibilidad garantizada de 15 minutos ha finalizado. Redirigiendo al inicio...',
    );
    window.setTimeout(() => {
      navigate('/');
    }, 1800);
  }, [notify, navigate]);

  const {
    secondsLeft,
    formattedTimer,
    isExpired: timerExpired,
    clearTimer,
  } = useCheckoutTimer({
    isPaused: Boolean(voucher),
    onExpire: handleExpire,
    initialExpiresAt: checkoutState?.preview?.expiresAt,
  });

  const isExpired = timerExpired && !voucher;

  if (!checkoutState) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="card-surface p-10">
          <Clock className="mx-auto h-10 w-10 text-brand-accent" />
          <h2 className="mt-4 font-serif text-2xl font-bold text-brand-text">
            No tienes una reserva en curso
          </h2>
          <p className="mt-2 text-xs text-brand-text/70">
            Selecciona primero un alojamiento y una habitación en el Marketplace para garantizar tu
            tarifa por 15 minutos.
          </p>
          <Link to="/" onClick={() => clearTimer()} className="btn-primary mt-6">
            <ArrowLeft className="h-4 w-4" />
            Explorar Alojamientos
          </Link>
        </div>
      </div>
    );
  }

  const handleCopyAccount = async (numeroCuenta: string, key: string) => {
    try {
      await navigator.clipboard.writeText(numeroCuenta);
      setCopiedAccountKey(key);
      notify('success', 'Número de cuenta copiado', `Cuenta ${numeroCuenta} copiada al portapapeles.`);
      window.setTimeout(() => {
        setCopiedAccountKey((prev) => (prev === key ? null : prev));
      }, 2500);
    } catch {
      notify('info', 'Número de cuenta', numeroCuenta);
    }
  };

  const handleUploadReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cloudName =
      (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() || 'bjcahwd6';
    const uploadPreset =
      (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined)?.trim() ||
      'habitat_preset';

    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(
          errBody?.error?.message || 'Error al subir el comprobante a Cloudinary.',
        );
      }

      const data = (await response.json()) as { secure_url?: string };
      if (data.secure_url) {
        setComprobanteUrl(data.secure_url);
        notify(
          'success',
          'Comprobante cargado exitosamente',
          'Tu comprobante de transferencia está listo para enviarse.',
        );
      }
    } catch (err: unknown) {
      // Fallback a Data URL local si Cloudinary unsigned no está configurado en el entorno local
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setComprobanteUrl(reader.result);
          notify(
            'success',
            'Comprobante cargado exitosamente',
            'Imagen del comprobante lista para enviarse al anfitrión.',
          );
        }
      };
      reader.readAsDataURL(file);
      if (err instanceof Error && err.message.includes('Cloudinary')) {
        // Silencioso porque el lector local respalda el archivo
      }
    } finally {
      setUploadingReceipt(false);
      if (receiptFileInputRef.current) {
        receiptFileInputRef.current.value = '';
      }
    }
  };

  const executeOrderSubmission = async (receiptUrlToSubmit?: string) => {
    if (isExpired) {
      notify(
        'error',
        'El tiempo de reserva ha expirado',
        'Por favor regresa al alojamiento para cotizar nuevamente.',
      );
      return;
    }

    if (!nombreValidation.valid || !apellidoValidation.valid || !emailValidation.valid) {
      focusFirstInvalidInput();
      if (!nombreValidation.valid) {
        notify('warning', 'Datos de huésped incompletos', nombreValidation.message);
      } else if (!apellidoValidation.valid) {
        notify('warning', 'Datos de huésped incompletos', apellidoValidation.message);
      } else if (!emailValidation.valid) {
        notify('warning', 'Correo electrónico inválido', emailValidation.message);
      }
      return;
    }

    if (metodoPago !== 'TRANSFERENCIA' && !isCardFormValid) {
      focusFirstInvalidInput();
      if (!isCardNumberValid) {
        notify('warning', 'Número de tarjeta incompleto', 'Ingresa los 16 dígitos de tu tarjeta.');
      } else if (!isCardHolderValid) {
        notify('warning', 'Titular requerido', 'Ingresa el nombre del titular como aparece en la tarjeta.');
      } else if (!isCardExpiryValid) {
        notify(
          'warning',
          'Fecha de expiración inválida',
          cardExpiryValidation.error || 'La tarjeta está caducada o la fecha es inválida.',
        );
      } else if (!isCardCvvValid) {
        notify('warning', 'Código CVV inválido', 'Ingresa los 3 o 4 dígitos de seguridad.');
      }
      return;
    }

    const finalReceiptUrl = receiptUrlToSubmit || comprobanteUrl;
    if (metodoPago === 'TRANSFERENCIA' && !finalReceiptUrl) {
      setIsReceiptModalOpen(true);
      return;
    }

    setProcessing(true);
    try {
      const unifiedGateway = 'PAYPHONE_EC';
      const lastFourDigits =
        metodoPago === 'TRANSFERENCIA' ? undefined : rawCardDigits.slice(-4) || '4242';
      const initialPaymentRef = `${unifiedGateway}-${Date.now()}`;

      // Paso 1: Crear Orden con soporte de estado PENDIENTE_VERIFICACION para transferencias
      const { data: createdOrder } = await httpClient.post<{
        orderId: string;
        locator: string;
        status: string;
        totalPrice: number;
        currency: string;
        creationDate: string;
        comprobanteUrl?: string | null;
      }>('/ordenes/create', {
        orderPreviewId: checkoutState.preview.orderPreviewId,
        paymentReference: initialPaymentRef,
        metodoPago,
        ultimosCuatro: lastFourDigits,
        comprobanteUrl: metodoPago === 'TRANSFERENCIA' ? finalReceiptUrl : undefined,
        customer: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
        },
        canalProtocolo: checkoutState.contrato5FN?.canalProtocolo || 'WEB_REST',
        politicaCodigo: checkoutState.contrato5FN?.politicaCodigo || 'FREE_CANCELLATION',
      });

      // Paso 2: Inicializar intención en canal único interno
      const { data: intentData } = await httpClient.post<{
        proveedor: 'PAYPHONE_EC' | 'STRIPE' | 'SANDBOX_INTERNAL';
        modo: string;
        intentId: string;
        referenciaPasarela: string;
        autorizacionCodigo: string;
      }>('/pagos/intent', {
        orderId: String(createdOrder.orderId),
        proveedor: unifiedGateway,
        montoCobrado: Number(createdOrder.totalPrice),
        moneda: createdOrder.currency || 'USD',
      });

      // Paso 3: Registrar el pago / comprobante en finanzas
      await httpClient.post('/pagos/procesar', {
        orderId: String(createdOrder.orderId),
        metodoPago,
        ultimosCuatro: lastFourDigits,
        montoCobrado: Number(createdOrder.totalPrice),
        referenciaPasarela: intentData.referenciaPasarela,
        proveedorPasarela: unifiedGateway,
        comprobanteUrl: metodoPago === 'TRANSFERENCIA' ? finalReceiptUrl : undefined,
      });

      setIsReceiptModalOpen(false);
      clearTimer();
      try {
        localStorage.removeItem('checkout_expires_at');
        sessionStorage.removeItem('checkout_expires_at');
      } catch {
        // Ignorar error de acceso a storage
      }

      setVoucher({
        ...createdOrder,
        status:
          metodoPago === 'TRANSFERENCIA' ? 'PENDIENTE_VERIFICACION' : createdOrder.status,
        referenciaPasarela: intentData.referenciaPasarela,
        metodoPago,
        autorizacionCodigo: intentData.autorizacionCodigo,
        comprobanteUrl: metodoPago === 'TRANSFERENCIA' ? finalReceiptUrl : null,
      });

      if (metodoPago === 'TRANSFERENCIA') {
        notify(
          'success',
          'Comprobante enviado exitosamente',
          `Tu reserva ${createdOrder.locator} quedó en estado Pendiente de Verificación.`,
        );
      } else {
        notify(
          'success',
          '¡Pago confirmado exitosamente!',
          `Tu código de confirmación es ${createdOrder.locator}.`,
        );
      }

      // Reemplazar entrada en historial para que al presionar "Atrás" no vuelva a /checkout con el temporizador activo
      navigate('/mis-reservas', { replace: true });
    } catch (err: unknown) {
      notify(
        'error',
        'Error al procesar la reserva',
        extractErrorMessage(err, 'No se pudo completar la operación.'),
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeOrderSubmission();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 text-left">
      {/* Stepper Superior Limpio */}
      <div className="mb-8 rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-soft">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs font-semibold">
          <div className="flex items-center gap-2.5 text-brand-secondary">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-secondary text-brand-bg font-bold">
              1
            </span>
            <span>1. Reserva garantizada</span>
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

      {/* Temporizador de Reserva Garantizada */}
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
                  ? 'El tiempo para completar tu reserva ha expirado'
                  : 'Disponibilidad garantizada exclusivamente para ti'}
              </p>
              <p className="text-xs text-brand-text/75 mt-0.5">
                Completa tu pago antes de que expire el tiempo para garantizar tu tarifa.
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

      {/* VOUCHER DE CONFIRMACIÓN */}
      {voucher ? (
        <div className="card-surface p-8 sm:p-10 max-w-3xl mx-auto border-brand-secondary/40 shadow-elevated">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-brand-bg ${
                  voucher.status === 'PENDIENTE_VERIFICACION'
                    ? 'bg-amber-600'
                    : 'bg-brand-secondary'
                }`}
              >
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <span className="chip-sage mb-1">
                  {voucher.status === 'PENDIENTE_VERIFICACION'
                    ? 'Pendiente de Verificación Bancaria'
                    : 'Reserva Confirmada'}
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-brand-text">
                  Comprobante Oficial de Reserva
                </h1>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-primary bg-brand-primary/20 px-4 py-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent block">
                Código de Reserva
              </span>
              <span className="font-mono text-xl font-extrabold text-brand-text">
                {voucher.locator}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-2xl bg-brand-bg p-4 border border-brand-border space-y-1.5">
              <span className="font-bold uppercase text-brand-accent block">
                Alojamiento y Estancia
              </span>
              <p className="text-sm font-bold text-brand-text">
                {checkoutState.alojamiento.titulo}
              </p>
              <p className="text-brand-text/75">
                {checkoutState.producto.nombreProducto} ({checkoutState.cuartos} hab. •{' '}
                {checkoutState.adultos} adulto(s)
                {checkoutState.ninos ? ` • ${checkoutState.ninos} niño(s)` : ''})
              </p>
              <p className="text-brand-text/75">
                Estancia:{' '}
                <strong>
                  {formatDateToLatam(checkoutState.checkin)} —{' '}
                  {formatDateToLatam(checkoutState.checkout)}
                </strong>
              </p>
            </div>

            <div className="rounded-2xl bg-brand-bg p-4 border border-brand-border space-y-1.5">
              <span className="font-bold uppercase text-brand-accent block">
                Resumen del Pago
              </span>
              <p className="text-brand-text/80">
                Huésped titular: <strong>{nombre} {apellido}</strong> ({email})
              </p>
              <p className="text-brand-text/80">
                Método de pago:{' '}
                <strong>
                  {voucher.metodoPago === 'TRANSFERENCIA'
                    ? 'Transferencia Bancaria'
                    : voucher.metodoPago === 'TARJETA_DEBITO'
                    ? 'Tarjeta de Débito'
                    : 'Tarjeta de Crédito'}
                </strong>
              </p>
              <p className="text-brand-text/80">
                Estado:{' '}
                <strong
                  className={
                    voucher.status === 'PENDIENTE_VERIFICACION'
                      ? 'text-amber-700'
                      : 'text-brand-secondary'
                  }
                >
                  {voucher.status === 'PENDIENTE_VERIFICACION'
                    ? 'Pendiente de Verificación'
                    : 'Confirmada'}
                </strong>
              </p>
              <p className="text-sm font-bold text-brand-secondary pt-1">
                Total: ${Number(financialBreakdown.total).toFixed(2)} {voucher.currency}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-brand-border">
            <Link to="/" className="btn-secondary">
              Volver al Inicio
            </Link>
            <Link to="/mis-reservas" className="btn-primary">
              <Receipt className="h-4 w-4" />
              Ir a Mis Reservas
            </Link>
          </div>
        </div>
      ) : (
        /* LAYOUT DE 2 COLUMNAS */
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Columna Izquierda: Resumen y Desglose Financiero Real (5 cols) */}
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
                    Estancia ({checkoutState.nightsCount}{' '}
                    {checkoutState.nightsCount === 1 ? 'noche' : 'noches'}):
                  </span>
                  <span className="font-semibold text-brand-text">
                    {formatDateToLatam(checkoutState.checkin)} —{' '}
                    {formatDateToLatam(checkoutState.checkout)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-brand-text/70">
                    <User className="h-4 w-4 text-brand-accent" />
                    Ocupación:
                  </span>
                  <span className="font-semibold text-brand-text">
                    {checkoutState.adultos} adulto(s)
                    {checkoutState.ninos ? ` • ${checkoutState.ninos} niño(s)` : ''} •{' '}
                    {checkoutState.cuartos} hab.
                  </span>
                </div>
                <div className="pt-2.5 border-t border-brand-border">
                  <div className="flex items-start gap-2 text-brand-secondary">
                    <FileCheck2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-snug">
                      Política de Cancelación: Reembolso del 100% (Cancelación Gratuita)
                    </span>
                  </div>
                </div>
              </div>

              {/* Desglose Real de Costos (Ecuador IVA 15%) */}
              <div className="border-t border-brand-border pt-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-brand-text/80">
                  <span>
                    Subtotal ({checkoutState.nightsCount}{' '}
                    {checkoutState.nightsCount === 1 ? 'noche' : 'noches'} ×{' '}
                    {checkoutState.cuartos} hab.)
                  </span>
                  <span className="font-semibold text-brand-text">
                    ${financialBreakdown.subtotal.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-brand-text/80">
                  <span>IVA (15%)</span>
                  <span className="font-semibold text-brand-text">
                    ${financialBreakdown.iva.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-brand-text pt-2.5 border-t border-brand-border">
                  <span>Total a Pagar</span>
                  <span className="font-serif text-xl text-brand-accent">
                    ${financialBreakdown.total.toFixed(2)}{' '}
                    {checkoutState.preview.currency || 'USD'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Datos del Huésped y Método de Pago (7 cols) */}
          <div className="lg:col-span-7 card-surface p-6 sm:p-8">
            <h2 className="font-serif text-xl font-bold text-brand-text">
              Datos del Huésped y Método de Pago
            </h2>

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
                  error={
                    !nombreValidation.isEmpty && !nombreValidation.valid
                      ? nombreValidation.message
                      : null
                  }
                  success={nombreValidation.valid ? 'Nombre válido.' : null}
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
                  error={
                    !apellidoValidation.isEmpty && !apellidoValidation.valid
                      ? apellidoValidation.message
                      : null
                  }
                  success={apellidoValidation.valid ? 'Apellido válido.' : null}
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
                error={
                  !emailValidation.isEmpty && !emailValidation.valid
                    ? emailValidation.message
                    : null
                }
                success={emailValidation.valid ? 'Correo válido.' : null}
              />

              {/* Selector de Método de Pago (Sin selección de pasarela adquirente) */}
              <div className="border-t border-brand-border pt-5">
                <h3 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-brand-accent" />
                  Selecciona tu Método de Pago
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
                      className={`rounded-xl border p-3.5 text-xs font-bold transition-all text-left cursor-pointer ${
                        metodoPago === m.id
                          ? 'border-brand-accent bg-brand-primary/20 text-brand-text shadow-sm'
                          : 'border-brand-border bg-brand-bg text-brand-text/75 hover:border-brand-accent'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* FORMULARIO INTERACTIVO DE TARJETA DE CRÉDITO / DÉBITO */}
                {metodoPago !== 'TRANSFERENCIA' ? (
                  <div className="mt-5 rounded-2xl border border-brand-border bg-brand-bg/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-brand-secondary" />
                        Pago encriptado con tarjeta de{' '}
                        {metodoPago === 'TARJETA_CREDITO' ? 'crédito' : 'débito'}
                      </span>

                      {/* Logos / Badges de franquicia detectada por BIN */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wider border transition-all ${
                            detectedBrand === 'VISA'
                              ? 'bg-[#1A1F71] text-white border-[#1A1F71] scale-105 shadow-xs'
                              : 'bg-white/70 text-brand-text/40 border-brand-border'
                          }`}
                        >
                          VISA
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wider border transition-all ${
                            detectedBrand === 'MASTERCARD'
                              ? 'bg-[#EB001B] text-white border-[#EB001B] scale-105 shadow-xs'
                              : 'bg-white/70 text-brand-text/40 border-brand-border'
                          }`}
                        >
                          MASTERCARD
                        </span>
                        {detectedBrand === 'DINERS_AMEX' && (
                          <span className="rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wider bg-sky-800 text-white border border-sky-800">
                            DINERS / AMEX
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Representación visual interactiva 3D de la tarjeta */}
                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                      <InteractiveCreditCard
                        cardNumber={cardNumberFormatted}
                        cardHolder={cardHolderName}
                        cardExpiry={cardExpiry}
                        cardCvv={cardCvv}
                        isFlipped={isCardFlipped}
                        onFlipToggle={() => setIsCardFlipped((prev) => !prev)}
                        brand={detectedBrand}
                      />
                      <span className="mt-2 text-[11px] font-medium text-brand-text/55">
                        {isCardFlipped
                          ? 'Mostrando reverso con código CVV'
                          : 'Haz clic en la tarjeta o enfoca el CVV para voltearla'}
                      </span>
                    </div>

                    {/* Número de tarjeta (16 dígitos con espacio cada 4) */}
                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1.5">
                        Número de tarjeta *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          maxLength={19}
                          value={cardNumberFormatted}
                          onFocus={() => setIsCardFlipped(false)}
                          onChange={(e) =>
                            setCardNumberFormatted(formatCardNumberDisplay(e.target.value))
                          }
                          placeholder="4532 •••• •••• ••••"
                          className="input-field font-mono text-sm tracking-widest pr-28"
                        />
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                          {detectedBrand === 'VISA' && (
                            <span className="rounded bg-[#1A1F71] px-2 py-0.5 text-[11px] font-black italic text-white shadow-xs">
                              VISA
                            </span>
                          )}
                          {detectedBrand === 'MASTERCARD' && (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EB001B]" />
                              <span className="inline-block -ml-1.5 h-2.5 w-2.5 rounded-full bg-[#F79E1B]" />
                              MC
                            </span>
                          )}
                          {detectedBrand === 'DINERS_AMEX' && (
                            <span className="rounded bg-sky-800 px-2 py-0.5 text-[10px] font-bold text-white">
                              AMEX / DINERS
                            </span>
                          )}
                        </div>
                      </div>
                      {rawCardDigits.length > 0 && rawCardDigits.length < 16 && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Ingresa los 16 dígitos de tu tarjeta ({rawCardDigits.length}/16).
                        </p>
                      )}
                    </div>

                    {/* Nombre del titular */}
                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1.5">
                        Nombre del titular (como aparece en la tarjeta) *
                      </label>
                      <input
                        type="text"
                        autoComplete="cc-name"
                        maxLength={60}
                        value={cardHolderName}
                        onFocus={() => setIsCardFlipped(false)}
                        onChange={(e) =>
                          setCardHolderName(
                            e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').toUpperCase(),
                          )
                        }
                        placeholder="EJ. MATEO VILLALOBOS"
                        className="input-field text-xs font-semibold uppercase tracking-wide"
                      />
                    </div>

                    {/* Expiración (MM/AA) y CVV (password) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-brand-text mb-1.5">
                          Fecha de expiración (MM/AA) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          maxLength={5}
                          value={cardExpiry}
                          onFocus={() => setIsCardFlipped(false)}
                          onChange={(e) => setCardExpiry(formatExpiryDisplay(e.target.value))}
                          placeholder="MM/AA"
                          className={`input-field font-mono text-sm text-center tracking-widest transition-colors ${
                            cardExpiry.length > 0 && !isCardExpiryValid
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                              : ''
                          }`}
                        />
                        {cardExpiry.length > 0 && !isCardExpiryValid && (
                          <p className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                            {cardExpiryValidation.error}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-brand-text mb-1.5">
                          Código de seguridad (CVV/CVC) *
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          maxLength={4}
                          value={cardCvv}
                          onFocus={() => setIsCardFlipped(true)}
                          onBlur={() => setIsCardFlipped(false)}
                          onChange={(e) =>
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="•••"
                          className="input-field font-mono text-sm text-center tracking-widest"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* FLUJO DE TRANSFERENCIA BANCARIA ECUADOR */
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-brand-accent" />
                            Cuentas Bancarias Autorizadas del Alojamiento
                          </h4>
                          <p className="text-[11px] text-brand-text/65 mt-0.5">
                            Realiza la transferencia por{' '}
                            <strong>${financialBreakdown.total.toFixed(2)} USD</strong> a cualquiera
                            de las siguientes cuentas y sube tu comprobante.
                          </p>
                        </div>
                      </div>

                      {cuentasBancarias.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                          El anfitrión aún no ha publicado cuentas bancarias para este alojamiento.
                          Puedes usar pago con tarjeta de crédito o débito para confirmación
                          inmediata.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {cuentasBancarias.map((cuenta, idx) => {
                            const bankCode = String(cuenta.banco || 'BANCO_PICHINCHA');
                            const meta = BANK_META_MAP[bankCode] || {
                              nombre: bankCode.replace(/_/g, ' '),
                              siglas: 'EC',
                              logoPath: '/banks/pichincha.svg',
                              bgClass: 'bg-brand-accent',
                              textClass: 'text-white',
                              borderClass: 'border-brand-border',
                              accentBg: 'bg-brand-surface',
                            };
                            const tipoCuenta =
                              String(cuenta.tipo_cuenta || cuenta.tipoCuenta || 'AHORROS') ===
                              'CORRIENTE'
                                ? 'Cuenta Corriente'
                                : 'Cuenta de Ahorros';
                            const numeroCuenta = String(
                              cuenta.numero_cuenta || cuenta.numeroCuenta || '',
                            );
                            const nombreTitular = String(
                              cuenta.nombre_titular || cuenta.nombreTitular || '',
                            );
                            const identificacionTitular = String(
                              cuenta.identificacion_titular || cuenta.identificacionTitular || '',
                            );
                            const cardKey = `${bankCode}-${numeroCuenta}-${idx}`;
                            const logoFailed = Boolean(failedBankLogos[cardKey]);

                            return (
                              <div
                                key={cardKey}
                                className={`rounded-2xl border ${meta.borderClass} ${meta.accentBg} p-4 shadow-xs transition-all`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    {!logoFailed ? (
                                      <img
                                        src={meta.logoPath}
                                        alt={meta.nombre}
                                        onError={() =>
                                          setFailedBankLogos((prev) => ({
                                            ...prev,
                                            [cardKey]: true,
                                          }))
                                        }
                                        className="h-10 w-28 rounded-lg object-contain border border-black/5 bg-white p-1 shrink-0"
                                      />
                                    ) : (
                                      <div
                                        className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-xl font-extrabold text-xs shadow-xs ${meta.bgClass} ${meta.textClass}`}
                                      >
                                        {meta.siglas}
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-brand-text">
                                          {meta.nombre}
                                        </span>
                                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-brand-accent border border-brand-border">
                                          {tipoCuenta}
                                        </span>
                                      </div>
                                      <p className="text-xs text-brand-text/75 mt-0.5">
                                        Titular: <strong>{nombreTitular}</strong> • Cédula/RUC:{' '}
                                        <strong>{identificacionTitular}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-2 bg-white rounded-xl px-3 py-2 border border-brand-border">
                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-brand-text/50 block">
                                        N.º de Cuenta
                                      </span>
                                      <span className="font-mono text-sm font-extrabold text-brand-text">
                                        {numeroCuenta}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void handleCopyAccount(numeroCuenta, cardKey)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/35 px-2.5 py-1.5 text-[11px] font-bold text-brand-accent transition-colors cursor-pointer"
                                    >
                                      {copiedAccountKey === cardKey ? (
                                        <>
                                          <Check className="h-3.5 w-3.5 text-brand-secondary" />
                                          Copiado
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3.5 w-3.5" />
                                          Copiar
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {comprobanteUrl && (
                        <div className="mt-4 flex items-center justify-between rounded-xl border border-brand-secondary/40 bg-brand-secondary/10 p-3 text-xs">
                          <span className="font-semibold text-brand-secondary flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Comprobante de transferencia adjuntado correctamente
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsReceiptModalOpen(true)}
                            className="text-brand-accent underline font-bold cursor-pointer"
                          >
                            Ver / Cambiar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => {
                    clearTimer();
                    try {
                      localStorage.removeItem('checkout_expires_at');
                      sessionStorage.removeItem('checkout_expires_at');
                    } catch {
                      // Ignorar
                    }
                    navigate(-1);
                  }}
                  className="btn-secondary justify-center"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Modificar fechas
                </button>

                {metodoPago === 'TRANSFERENCIA' ? (
                  <button
                    type="button"
                    disabled={
                      processing ||
                      isExpired ||
                      cuentasBancarias.length === 0 ||
                      !nombreValidation.valid ||
                      !apellidoValidation.valid ||
                      !emailValidation.valid
                    }
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="btn-primary py-3.5 px-6 text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed justify-center cursor-pointer"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Subir Comprobante de Transferencia
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      processing ||
                      isExpired ||
                      !nombreValidation.valid ||
                      !apellidoValidation.valid ||
                      !emailValidation.valid ||
                      !isCardFormValid
                    }
                    className="btn-primary py-3.5 px-6 text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed justify-center cursor-pointer"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando pago seguro...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Pagar ${financialBreakdown.total.toFixed(2)} USD de forma segura
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA SUBIR COMPROBANTE DE TRANSFERENCIA BANCARIA */}
      {isReceiptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="card-surface w-full max-w-lg p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-brand-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-brand-text">
                  Subir Comprobante de Transferencia
                </h3>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Adjunta la captura o foto del comprobante por{' '}
                  <strong>${financialBreakdown.total.toFixed(2)} USD</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="rounded-xl p-1.5 text-brand-text/60 hover:bg-brand-bg hover:text-brand-text cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <input
                ref={receiptFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadReceiptFile}
                className="hidden"
              />

              <div
                onClick={() => receiptFileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-accent/40 bg-brand-bg/60 p-6 text-center hover:border-brand-accent transition-all cursor-pointer"
              >
                {uploadingReceipt ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
                    <span className="text-xs font-semibold text-brand-text">
                      Subiendo comprobante a la nube...
                    </span>
                  </div>
                ) : comprobanteUrl ? (
                  <div className="space-y-3 w-full">
                    <img
                      src={comprobanteUrl}
                      alt="Vista previa del comprobante"
                      className="mx-auto max-h-56 rounded-xl object-contain border border-brand-border shadow-sm"
                    />
                    <span className="inline-block text-xs font-bold text-brand-accent underline">
                      Hacer clic para cambiar imagen
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <UploadCloud className="mx-auto h-10 w-10 text-brand-accent" />
                    <p className="text-xs font-bold text-brand-text">
                      Haz clic aquí para seleccionar la foto o captura del comprobante
                    </p>
                    <p className="text-[11px] text-brand-text/60">
                      Formatos soportados: JPG, PNG, WEBP
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!comprobanteUrl || uploadingReceipt || processing}
                  onClick={() => void executeOrderSubmission(comprobanteUrl)}
                  className="btn-primary text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando reserva...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar y Enviar Comprobante
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
