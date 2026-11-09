import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Star,
  Leaf,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Users,
  BedDouble,
  Utensils,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  FileCheck2,
  Loader2,
  MessageSquareQuote,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  LayoutGrid,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { allowOnlyNumbersKey } from '../utils/inputFilters';
import { formatTimeForDisplay } from '../utils/timeUtils';
import { formatDateToLatam, getMinCheckoutDate } from '../utils/dateUtils';

interface AlojamientoHeader {
  alojamiento_id: number;
  titulo: string;
  descripcion: string;
  direccion: string;
  latitud: number;
  longitud: number;
  precio_base_noche?: number;
  max_adultos?: number;
  total_cuartos?: number;
  calificacion_promedio: number;
  total_resenas: number;
  hora_checkin?: string;
  hora_checkout?: string;
  horaCheckin?: string;
  horaCheckout?: string;
  tipo_alojamiento: string;
  ciudad: string;
  provincia?: string;
  anfitrion_nombre: string;
  anfitrion_apellido?: string;
}

interface FotoItem {
  foto_id: number;
  url_imagen?: string;
  url_foto?: string;
  es_portada: boolean;
  orden?: number;
}

interface FacilidadItem {
  facilidad_id: number;
  codigo: string;
  nombre: string;
  es_sostenible: boolean;
  detalle_implementacion?: string;
}

interface ReglaItem {
  regla_id: number;
  codigo: string;
  descripcion: string;
  es_obligatoria?: boolean;
}

export interface ProductoHabitacionNormalized {
  productoId: string;
  nombreProducto: string;
  capacidadAdultos: number;
  capacidadNinos: number;
  stockTotal: number;
  precioBaseNocheUsd: number;
  codigoMealPlan: string;
  planAlimenticio: string;
}

export interface Contrato5FNNormalized {
  canalProtocolo: string;
  politicaCodigo: string;
  horasAnticipacion: number;
  porcentajeReembolso: number;
}

interface DetalleAlojamientoRaw {
  alojamiento: AlojamientoHeader;
  fotos: FotoItem[];
  facilidades: FacilidadItem[];
  reglas: ReglaItem[];
  productosHabitacion: Array<Record<string, unknown>>;
  contratosValidos5FN: Array<Record<string, unknown>>;
  cuentasBancarias?: Array<Record<string, unknown>>;
}

interface ResenaItemNormalized {
  resenaId: number;
  puntuacionGeneral: number;
  comentario: string;
  creadoEn: string;
  autor: string;
  detalles: Array<{ categoria: string; codigo: string; puntaje: number }>;
}

const MOSAIC_FALLBACKS = [
  'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=900&q=80',
];

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, notify } = useAuth();

  const [detail, setDetail] = useState<DetalleAlojamientoRaw | null>(null);
  const [resenasList, setResenasList] = useState<ResenaItemNormalized[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingHold, setSubmittingHold] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayIso = getTodayIso();

  // Booking Form State
  const [checkin, setCheckin] = useState<string>(() => {
    const q = searchParams.get('checkin');
    if (q) return q;
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [checkout, setCheckout] = useState<string>(() => {
    const q = searchParams.get('checkout');
    if (q) return q;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [adultos, setAdultos] = useState<number | ''>(() => {
    const q = Number(searchParams.get('adultos'));
    return q > 0 ? q : 2;
  });
  const [ninos, setNinos] = useState<number | ''>(() => {
    const q = searchParams.get('ninos');
    return q !== null && !isNaN(Number(q)) ? Number(q) : 0;
  });
  const [cuartos, setCuartos] = useState<number | ''>(() => {
    const q = Number(searchParams.get('habitaciones'));
    return q > 0 ? q : 1;
  });
  const [selectedProductoId, setSelectedProductoId] = useState<string>('');
  const [selectedContractIdx, setSelectedContractIdx] = useState<number>(0);

  // Lightbox / Gallery Modal State (N Photos + Mobile Swipe)
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [galleryViewMode, setGalleryViewMode] = useState<'slider' | 'grid'>('slider');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const isDateRangeValid = !checkin || !checkout || checkout > checkin;

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [detRes, revRes] = await Promise.all([
          httpClient.get<DetalleAlojamientoRaw>(`/alojamientos/${id}`),
          httpClient.get<unknown>(`/resenas/alojamiento/${id}`),
        ]);
        setDetail(detRes.data);

        const rawProds = detRes.data.productosHabitacion || [];
        if (rawProds.length > 0) {
          const firstId = String(rawProds[0].productoId || rawProds[0].producto_id || '');
          setSelectedProductoId(firstId);
        }

        // Normalize reviews array
        const rawRev = revRes.data;
        const arr = Array.isArray(rawRev)
          ? rawRev
          : (rawRev as { resenas?: unknown[] })?.resenas || [];

        const normalizedRev: ResenaItemNormalized[] = arr.map((item) => {
          const r = item as Record<string, unknown>;
          return {
            resenaId: Number(r.resena_id || 0),
            puntuacionGeneral: Number(r.puntuacion_general || 5),
            comentario: String(r.comentario || ''),
            creadoEn: String(r.creado_en || ''),
            autor: String(
              r.autor ||
                `${String(r.huesped_nombre || 'Viajero')} ${String(r.huesped_apellido || '')}`.trim(),
            ),
            detalles: Array.isArray(r.detalles_por_categoria)
              ? (r.detalles_por_categoria as Array<{
                  categoria: string;
                  codigo: string;
                  puntaje: number;
                }>)
              : [],
          };
        });
        setResenasList(normalizedRev);
      } catch (err: unknown) {
        setErrorMsg(extractErrorMessage(err, 'No se pudo cargar el alojamiento.'));
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, [id]);

  const productosNormalized = useMemo<ProductoHabitacionNormalized[]>(() => {
    if (!detail?.productosHabitacion) return [];
    return detail.productosHabitacion.map((p) => ({
      productoId: String(p.productoId || p.producto_id || ''),
      nombreProducto: String(p.nombreProducto || p.nombre_producto || 'Habitación Estándar'),
      capacidadAdultos: Number(p.capacidadAdultos || p.capacidad_adultos || 2),
      capacidadNinos: Number(p.capacidadNinos || p.capacidad_ninos || 0),
      stockTotal: Number(
        p.cantidadCuartosInventario || p.stock_total || p.cantidad_cuartos_inventario || 1,
      ),
      precioBaseNocheUsd: Number(p.precioBaseNoche || p.precio_base_noche_usd || 85),
      codigoMealPlan: String(p.codigoMealPlan || p.codigo_meal_plan || 'ROOM_ONLY'),
      planAlimenticio: String(p.mealPlanNombre || p.plan_alimenticio || 'Solo Alojamiento'),
    }));
  }, [detail]);

  const contratosNormalized = useMemo<Contrato5FNNormalized[]>(() => {
    if (!detail?.contratosValidos5FN) return [];
    return detail.contratosValidos5FN.map((c) => ({
      canalProtocolo: String(c.codigo_protocolo || c.canal_protocolo || 'WEB_REST'),
      politicaCodigo: String(c.codigo_politica || c.politica_codigo || 'FREE_CANCELLATION'),
      horasAnticipacion: Number(c.horas_anticipacion ?? 24),
      porcentajeReembolso: Number(c.porcentaje_reembolso ?? 100),
    }));
  }, [detail]);

  const allPhotos = useMemo(() => {
    const uploaded = (detail?.fotos || [])
      .map((f) => f.url_imagen || f.url_foto || '')
      .filter((u) => u.startsWith('http'));
    return uploaded.length > 0 ? uploaded : MOSAIC_FALLBACKS;
  }, [detail]);

  const mosaicUrls = useMemo(() => {
    const result: string[] = [];
    for (let i = 0; i < 5; i++) {
      result.push(allPhotos[i] || allPhotos[0] || MOSAIC_FALLBACKS[i]);
    }
    return result;
  }, [allPhotos]);

  const handleOpenGallery = (index = 0, mode: 'slider' | 'grid' = 'slider') => {
    setActivePhotoIndex(index);
    setGalleryViewMode(mode);
    setIsGalleryModalOpen(true);
  };

  const handlePrevPhoto = () => {
    setActivePhotoIndex((prev) => (prev === 0 ? allPhotos.length - 1 : prev - 1));
  };

  const handleNextPhoto = () => {
    setActivePhotoIndex((prev) => (prev === allPhotos.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance) {
      handleNextPhoto();
    } else if (distance < -minSwipeDistance) {
      handlePrevPhoto();
    }
  };

  useEffect(() => {
    if (!isGalleryModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGalleryModalOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setActivePhotoIndex((prev) => (prev === 0 ? allPhotos.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActivePhotoIndex((prev) => (prev === allPhotos.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryModalOpen, allPhotos.length]);

  const selectedProduct = useMemo(() => {
    return (
      productosNormalized.find((p) => p.productoId === selectedProductoId) ||
      productosNormalized[0] ||
      null
    );
  }, [productosNormalized, selectedProductoId]);

  const effectiveRooms = typeof cuartos === 'number' && cuartos > 0 ? cuartos : 1;
  const maxRoomsAvailable = selectedProduct ? selectedProduct.stockTotal : 10;
  const maxAdultsCapacity = selectedProduct
    ? (selectedProduct.capacidadAdultos || 1) * effectiveRooms
    : 20;
  const maxNinosCapacity = selectedProduct
    ? (selectedProduct.capacidadNinos || 0) * effectiveRooms
    : 0;

  const nightsCount = useMemo(() => {
    if (!checkin || !checkout) return 1;
    const d1 = new Date(checkin);
    const d2 = new Date(checkout);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [checkin, checkout]);

  const estimatedSubtotal = useMemo(() => {
    const unitPrice = selectedProduct
      ? selectedProduct.precioBaseNocheUsd
      : Number(detail?.alojamiento.precio_base_noche || 85);
    return Math.round(unitPrice * nightsCount * effectiveRooms * 100) / 100;
  }, [selectedProduct, detail, nightsCount, effectiveRooms]);

  const estimatedIva = useMemo(() => {
    return Math.round(estimatedSubtotal * 0.15 * 100) / 100;
  }, [estimatedSubtotal]);

  const estimatedTotal = useMemo(() => {
    return Math.round((estimatedSubtotal + estimatedIva) * 100) / 100;
  }, [estimatedSubtotal, estimatedIva]);

  const isGuestsInvalid =
    adultos === '' ||
    adultos < 1 ||
    cuartos === '' ||
    cuartos < 1 ||
    ninos === '' ||
    ninos < 0 ||
    cuartos > maxRoomsAvailable ||
    adultos > maxAdultsCapacity ||
    ninos > maxNinosCapacity;

  const isHoldDisabled =
    submittingHold ||
    !isDateRangeValid ||
    productosNormalized.length === 0 ||
    isGuestsInvalid;

  const handleCreateHoldPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;

    if (!isAuthenticated) {
      notify(
        'info',
        'Inicia sesión para reservar',
        'Necesitas una cuenta activa para bloquear disponibilidad por 15 minutos.',
      );
      navigate('/login', {
        state: { from: `/alojamientos/${detail.alojamiento.alojamiento_id}` },
      });
      return;
    }

    if (!selectedProduct) {
      notify(
        'warning',
        'Selecciona una habitación',
        'Este alojamiento aún no tiene habitaciones configuradas para reserva.',
      );
      return;
    }

    if (checkout <= checkin) {
      notify(
        'warning',
        'Fechas inválidas',
        'La fecha de salida debe ser posterior a la fecha de llegada.',
      );
      return;
    }

    if (isGuestsInvalid) {
      notify(
        'warning',
        'Configuración de huéspedes inválida',
        'Por favor revisa la cantidad de adultos, niños y habitaciones seleccionadas según la capacidad de la habitación.',
      );
      return;
    }

    setSubmittingHold(true);
    try {
      const { data: preview } = await httpClient.post<{
        orderPreviewId: string;
        subtotal?: number;
        iva?: number;
        totalPrice: number;
        currency: string;
        expiresAt: string;
      }>('/ordenes/preview', {
        alojamientoId: Number(detail.alojamiento.alojamiento_id),
        productoId: selectedProduct.productoId,
        checkin,
        checkout,
        adultos: Number(adultos),
        ninos: Number(ninos) || 0,
        cuartos: Number(cuartos),
      });

      const chosenContract = contratosNormalized[selectedContractIdx] || {
        canalProtocolo: 'WEB_REST',
        politicaCodigo: 'FREE_CANCELLATION',
        porcentajeReembolso: 100,
        horasAnticipacion: 24,
      };

      notify(
        'success',
        'Reserva Garantizada (15:00 min)',
        'Hemos reservado temporalmente tu disponibilidad. Completa tu pago antes de que expire el tiempo.',
      );

      try {
        const previewExpires = preview.expiresAt
          ? new Date(preview.expiresAt).getTime()
          : Date.now() + 15 * 60 * 1000;
        localStorage.setItem('checkout_expires_at', previewExpires.toString());
      } catch {
        // Error de acceso a localStorage ignorado
      }

      navigate('/checkout', {
        state: {
          preview,
          alojamiento: detail.alojamiento,
          producto: selectedProduct,
          checkin,
          checkout,
          nightsCount,
          adultos: Number(adultos),
          ninos: Number(ninos) || 0,
          cuartos: Number(cuartos),
          contrato5FN: chosenContract,
          portadaUrl: mosaicUrls[0],
          cuentasBancarias: detail.cuentasBancarias || [],
        },
      });
    } catch (err: unknown) {
      notify(
        'error',
        'No se pudo bloquear la disponibilidad',
        extractErrorMessage(err, 'Verifica el stock disponible para las fechas seleccionadas.'),
      );
    } finally {
      setSubmittingHold(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/3 rounded-xl bg-brand-border" />
          <div className="h-96 w-full rounded-3xl bg-brand-border/70" />
        </div>
      </div>
    );
  }

  if (errorMsg || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="card-surface p-10">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
          <h2 className="mt-4 font-serif text-2xl font-bold text-brand-text">
            Alojamiento no encontrado
          </h2>
          <p className="mt-2 text-xs text-brand-text/70">{errorMsg}</p>
          <Link to="/" className="btn-primary mt-6">
            <ArrowLeft className="h-4 w-4" />
            Volver al Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { alojamiento, facilidades, reglas } = detail;
  const totalCuartosProp = productosNormalized.reduce((acc, p) => acc + p.stockTotal, 0) || 1;
  const maxAdultosProp =
    productosNormalized.reduce((acc, p) => Math.max(acc, p.capacidadAdultos), 2) || 2;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-left">
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo de alojamientos
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="chip-gold">
              <Sparkles className="h-3.5 w-3.5" />
              {alojamiento.tipo_alojamiento}
            </span>
            <span className="chip-sage">
              <Leaf className="h-3.5 w-3.5" />
              Anfitrión Verificado: {alojamiento.anfitrion_nombre}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-brand-text">
            {alojamiento.titulo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-brand-text/75">
            <span className="inline-flex items-center gap-1 font-medium">
              <MapPin className="h-4 w-4 text-brand-accent" />
              {alojamiento.ciudad} — {alojamiento.direccion || 'Ubicación verificada'}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-brand-text">
              <Star className="h-4 w-4 fill-brand-primary text-brand-primary" />
              {Number(alojamiento.calificacion_promedio || 0).toFixed(2)} (
              {alojamiento.total_resenas} reseñas)
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE-FIRST CAROUSEL (< sm) */}
      <div className="mt-6 sm:hidden relative rounded-3xl overflow-hidden border border-brand-border shadow-soft">
        <div className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth h-[300px]">
          {allPhotos.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              onClick={() => handleOpenGallery(idx, 'slider')}
              className="w-full shrink-0 snap-center relative h-full cursor-pointer"
            >
              <img
                src={url}
                alt={`${alojamiento.titulo} - Foto ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              <span className="absolute top-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                {idx + 1} / {allPhotos.length}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleOpenGallery(0, 'slider')}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-white/95 dark:bg-stone-900/95 px-3.5 py-2 text-xs font-bold text-stone-900 dark:text-stone-100 shadow-md border border-stone-200 dark:border-stone-700 backdrop-blur-sm cursor-pointer"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Mostrar todas las fotos ({allPhotos.length})
        </button>
      </div>

      {/* DESKTOP 5-PHOTO ASYMMETRIC MOSAIC (sm and up) */}
      <div className="mt-6 hidden sm:grid sm:grid-cols-4 sm:grid-rows-2 gap-3 h-[440px] rounded-3xl overflow-hidden border border-brand-border shadow-soft relative">
        <div
          onClick={() => handleOpenGallery(0, 'slider')}
          className="sm:col-span-2 sm:row-span-2 relative overflow-hidden group cursor-pointer"
        >
          <img
            src={mosaicUrls[0]}
            alt={alojamiento.titulo}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            Vista Principal
          </span>
        </div>
        {mosaicUrls.slice(1, 5).map((url, idx) => (
          <div
            key={idx}
            onClick={() => handleOpenGallery(idx + 1 < allPhotos.length ? idx + 1 : 0, 'slider')}
            className="relative overflow-hidden group cursor-pointer"
          >
            <img
              src={url}
              alt={`${alojamiento.titulo} galería ${idx + 2}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ))}

        {/* Botón estilo Airbnb: Mostrar todas las fotos */}
        <button
          type="button"
          onClick={() => handleOpenGallery(0, 'slider')}
          className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-xl bg-white/95 dark:bg-stone-900/95 px-4 py-2.5 text-xs font-bold text-stone-900 dark:text-stone-100 shadow-lg border border-stone-300 dark:border-stone-700 hover:scale-[1.02] hover:bg-white transition-all cursor-pointer"
        >
          <LayoutGrid className="h-4 w-4 text-brand-accent" />
          <span>Mostrar todas las fotos ({allPhotos.length})</span>
        </button>
      </div>

      {/* MAIN 2-COLUMN CONTENT + STICKY RESERVATION CARD */}
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-10">
          {/* Overview */}
          <section className="card-surface p-6 sm:p-8">
            <h2 className="font-serif text-xl font-bold text-brand-text">
              Acerca de este alojamiento
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-text/80">
              {alojamiento.descripcion}
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-brand-border">
              <div className="rounded-xl bg-brand-bg p-3 border border-brand-border">
                <span className="text-[11px] text-brand-text/60 block">Capacidad Máx.</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-brand-text">
                  <Users className="h-4 w-4 text-brand-accent" />
                  {maxAdultosProp} adultos
                </span>
              </div>
              <div className="rounded-xl bg-brand-bg p-3 border border-brand-border">
                <span className="text-[11px] text-brand-text/60 block">Unidades Totales</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-brand-text">
                  <BedDouble className="h-4 w-4 text-brand-accent" />
                  {totalCuartosProp} cuarto(s)
                </span>
              </div>
              <div className="rounded-xl bg-brand-bg p-3 border border-brand-border">
                <span className="text-[11px] text-brand-text/60 block">Check-in</span>
                <span
                  className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-brand-text"
                  title={formatTimeForDisplay(
                    detail?.alojamiento?.hora_checkin || detail?.alojamiento?.horaCheckin,
                    '14:00',
                    'both',
                  )}
                >
                  <Clock className="h-4 w-4 text-brand-secondary" />
                  {formatTimeForDisplay(
                    detail?.alojamiento?.hora_checkin || detail?.alojamiento?.horaCheckin,
                    '14:00',
                  )}
                </span>
              </div>
              <div className="rounded-xl bg-brand-bg p-3 border border-brand-border">
                <span className="text-[11px] text-brand-text/60 block">Check-out</span>
                <span
                  className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-brand-text"
                  title={formatTimeForDisplay(
                    detail?.alojamiento?.hora_checkout || detail?.alojamiento?.horaCheckout,
                    '11:00',
                    'both',
                  )}
                >
                  <Clock className="h-4 w-4 text-brand-secondary" />
                  {formatTimeForDisplay(
                    detail?.alojamiento?.hora_checkout || detail?.alojamiento?.horaCheckout,
                    '11:00',
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* Facilities in Sage Green */}
          <section className="card-surface p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl font-bold text-brand-text">
                  Lo que ofrece este lugar (Facilidades)
                </h2>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Amenidades certificadas y prácticas ecológicas del establecimiento
                </p>
              </div>
              <span className="chip-sage">
                <Leaf className="h-3.5 w-3.5" />
                Sello Verde Salvia
              </span>
            </div>

            {facilidades.length === 0 ? (
              <p className="mt-4 text-xs text-brand-text/60">
                El anfitrión no ha detallado facilidades adicionales.
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {facilidades.map((f) => (
                  <div
                    key={f.facilidad_id}
                    className="flex items-start gap-3 rounded-2xl border border-brand-secondary/30 bg-brand-secondary/10 p-3.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-secondary text-brand-bg">
                      {f.es_sostenible ? (
                        <Leaf className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-text">{f.nombre}</span>
                        {f.es_sostenible && (
                          <span className="rounded-full bg-brand-secondary/20 px-2 py-0.5 text-[10px] font-semibold text-brand-secondary">
                            Eco
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-brand-text/65 font-mono">{f.codigo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Room Inventory & Stock Selector */}
          <section className="card-surface p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl font-bold text-brand-text">
                  Habitaciones Disponibles
                </h2>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Selecciona la tipología de habitación para tu cotización y bloqueo de 15 minutos
                </p>
              </div>
              <span className="chip-gold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Reserva Inmediata
              </span>
            </div>

            {productosNormalized.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                Este alojamiento aún no registra habitaciones activas en inventario.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {productosNormalized.map((prod) => {
                  const isSelected = selectedProductoId === prod.productoId;
                  return (
                    <div
                      key={prod.productoId}
                      onClick={() => setSelectedProductoId(prod.productoId)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? 'border-brand-accent bg-brand-primary/15 shadow-sm'
                          : 'border-brand-border bg-brand-bg/60 hover:border-brand-accent/60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base font-bold text-brand-text">
                              {prod.nombreProducto}
                            </span>
                            <span className="rounded-lg bg-brand-surface px-2.5 py-0.5 text-[11px] font-semibold text-brand-accent border border-brand-border">
                              Stock total: {prod.stockTotal} hab.
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-brand-text/75">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 text-brand-accent" />
                              Máx. {prod.capacidadAdultos} adultos • {prod.capacidadNinos} niños
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Utensils className="h-3.5 w-3.5 text-brand-secondary" />
                              Plan: {prod.planAlimenticio} ({prod.codigoMealPlan})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                          <div>
                            <span className="font-serif text-lg font-bold text-brand-text">
                              ${Number(prod.precioBaseNocheUsd || 0).toFixed(2)}
                            </span>
                            <span className="text-[11px] text-brand-text/65"> USD / noche</span>
                          </div>
                          <span
                            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                              isSelected
                                ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
                                : 'bg-brand-surface text-brand-text border border-brand-border'
                            }`}
                          >
                            {isSelected ? 'Seleccionada' : 'Elegir habitación'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Reglas de Convivencia & Políticas de Cancelación */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="card-surface p-6">
              <h3 className="font-serif text-lg font-bold text-brand-text">
                Reglas de Convivencia
              </h3>
              {reglas.length === 0 ? (
                <p className="mt-3 text-xs text-brand-text/60">
                  Reglas estándar de respeto ambiental y silencio nocturno.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5 text-xs text-brand-text/80">
                  {reglas.map((r) => (
                    <li key={r.regla_id} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                      <span className="font-semibold">{r.descripcion}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card-surface p-6">
              <h3 className="font-serif text-lg font-bold text-brand-text flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-brand-accent" />
                Políticas de Cancelación
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-brand-text/75">
                Cancelación Gratuita. Puedes cancelar sin costo hasta 24 horas antes de tu llegada.
              </p>
              {contratosNormalized.length > 0 && (
                <ul className="mt-3 space-y-2 text-xs">
                  {contratosNormalized.map((c, idx) => (
                    <li
                      key={`${c.canalProtocolo}-${c.politicaCodigo}-${idx}`}
                      className="rounded-xl border border-brand-border bg-brand-bg px-3 py-2 flex items-center justify-between"
                    >
                      <span className="font-bold text-brand-text">Cancelación Gratuita</span>
                      <span className="chip-sage text-[11px]">
                        {c.porcentajeReembolso}% reembolso ({c.horasAnticipacion}h antes)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Reviews Section */}
          <section className="card-surface p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-brand-text flex items-center gap-2">
                  <MessageSquareQuote className="h-5 w-5 text-brand-accent" />
                  Reseñas y Calificaciones Verificadas
                </h2>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Calificaciones reales de huéspedes verificados.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-brand-primary/20 px-4 py-2 border border-brand-primary/40">
                <Star className="h-5 w-5 fill-brand-accent text-brand-accent" />
                <span className="font-serif text-xl font-bold text-brand-text">
                  {Number(alojamiento.calificacion_promedio || 0).toFixed(2)}
                </span>
                <span className="text-xs text-brand-text/70">
                  ({resenasList.length} evaluaciones)
                </span>
              </div>
            </div>

            {resenasList.length === 0 ? (
              <p className="mt-5 text-xs text-brand-text/65">
                Aún no hay reseñas publicadas para este alojamiento. ¡Sé el primero en hospedarte y
                compartir tu experiencia!
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {resenasList.map((rev) => (
                  <div
                    key={rev.resenaId}
                    className="rounded-2xl border border-brand-border bg-brand-bg/50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-text">{rev.autor}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-accent">
                        <Star className="h-3.5 w-3.5 fill-brand-primary text-brand-primary" />
                        {rev.puntuacionGeneral} / 5
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-brand-text/80 leading-relaxed">
                      “{rev.comentario}”
                    </p>
                    {rev.detalles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rev.detalles.map((d, i) => (
                          <span key={i} className="chip-sage text-[10px]">
                            {d.categoria}: {d.puntaje}/5
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Sticky Reservation Card (4 cols) */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="card-surface p-6 shadow-elevated border-brand-primary/50">
            <div className="flex items-baseline justify-between border-b border-brand-border pb-4">
              <div>
                <span className="text-xs text-brand-text/60 block">Tarifa por noche</span>
                <span className="font-serif text-2xl font-bold text-brand-text">
                  ${selectedProduct ? Number(selectedProduct.precioBaseNocheUsd || 0).toFixed(2) : '85.00'}
                </span>
                <span className="text-xs text-brand-text/65"> USD</span>
              </div>
              <span className="chip-sage">Hold 15:00 min</span>
            </div>

            <form onSubmit={handleCreateHoldPreview} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Check-in */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    <Calendar className="h-3 w-3 text-brand-accent" />
                    Check-in
                  </label>
                  <div className="relative input-field py-2 flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-brand-text select-none">
                      {formatDateToLatam(checkin)}
                    </span>
                    <Calendar className="h-3.5 w-3.5 text-brand-text/50 pointer-events-none" />
                    <input
                      type="date"
                      required
                      min={todayIso}
                      value={checkin}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCheckin(val);
                        if (checkout <= val) {
                          setCheckout(getMinCheckoutDate(val));
                        }
                      }}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker?.();
                        } catch {
                          // Error ignorado intencionalmente: navegador sin soporte para showPicker
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      title="Seleccionar fecha de Check-in"
                    />
                  </div>
                </div>

                {/* Check-out */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    <Calendar className="h-3 w-3 text-brand-accent" />
                    Check-out
                  </label>
                  <div
                    className={`relative input-field py-2 flex items-center justify-between cursor-pointer ${
                      !isDateRangeValid ? 'border-red-500 focus:ring-red-200 bg-red-50/50 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <span
                      className={`text-xs select-none ${
                        !isDateRangeValid ? 'text-red-600 dark:text-red-400 font-bold' : 'font-semibold text-brand-text'
                      }`}
                    >
                      {formatDateToLatam(checkout)}
                    </span>
                    <Calendar className="h-3.5 w-3.5 text-brand-text/50 pointer-events-none" />
                    <input
                      type="date"
                      required
                      min={getMinCheckoutDate(checkin)}
                      value={checkout}
                      onChange={(e) => setCheckout(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker?.();
                        } catch {
                          // Error ignorado intencionalmente: navegador sin soporte para showPicker
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      title="Seleccionar fecha de Check-out"
                    />
                  </div>
                  {!isDateRangeValid && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-red-600 mt-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Debe ser posterior a Check-in.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                  Habitación Seleccionada
                </label>
                <select
                  value={selectedProductoId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedProductoId(newId);
                    const newProd = productosNormalized.find((p) => p.productoId === newId);
                    if (newProd) {
                      const newMaxRooms = newProd.stockTotal;
                      const currentRooms = typeof cuartos === 'number' && cuartos > 0 ? cuartos : 1;
                      const safeRooms = Math.min(newMaxRooms, currentRooms);
                      if (typeof cuartos === 'number' && cuartos > newMaxRooms) {
                        setCuartos(newMaxRooms);
                      }
                      const newMaxAdults = (newProd.capacidadAdultos || 1) * safeRooms;
                      const newMaxNinos = (newProd.capacidadNinos || 0) * safeRooms;
                      if (typeof adultos === 'number' && adultos > newMaxAdults) {
                        setAdultos(newMaxAdults);
                      }
                      if (typeof ninos === 'number' && ninos > newMaxNinos) {
                        setNinos(newMaxNinos);
                      }
                    }
                  }}
                  className="input-field text-xs"
                >
                  {productosNormalized.map((p) => (
                    <option key={p.productoId} value={p.productoId}>
                      {p.nombreProducto} — ${Number(p.precioBaseNocheUsd || 0).toFixed(2)} (Stock: {p.stockTotal}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1 truncate">
                    Adultos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxAdultsCapacity}
                    value={adultos}
                    onKeyDown={allowOnlyNumbersKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setAdultos('');
                        return;
                      }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) {
                        setAdultos(Math.min(maxAdultsCapacity, Math.max(0, n)));
                      }
                    }}
                    onBlur={() => {
                      if (adultos === '' || adultos < 1) {
                        setAdultos(1);
                      } else if (adultos > maxAdultsCapacity) {
                        setAdultos(maxAdultsCapacity);
                      }
                    }}
                    className="input-field text-xs py-2 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1 truncate">
                    Niños
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={maxNinosCapacity}
                    value={ninos}
                    disabled={maxNinosCapacity === 0}
                    onKeyDown={allowOnlyNumbersKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setNinos('');
                        return;
                      }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) {
                        setNinos(Math.min(maxNinosCapacity, Math.max(0, n)));
                      }
                    }}
                    onBlur={() => {
                      if (ninos === '' || ninos < 0) {
                        setNinos(0);
                      } else if (ninos > maxNinosCapacity) {
                        setNinos(maxNinosCapacity);
                      }
                    }}
                    placeholder={maxNinosCapacity === 0 ? '0' : undefined}
                    title={
                      maxNinosCapacity === 0
                        ? 'Esta habitación no admite niños'
                        : `Máximo ${maxNinosCapacity} niño(s) para ${effectiveRooms} hab.`
                    }
                    className={`input-field text-xs py-2 text-center ${
                      maxNinosCapacity === 0
                        ? 'opacity-50 cursor-not-allowed bg-brand-bg/60'
                        : ''
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1 truncate">
                    N.º Habitaciones
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxRoomsAvailable}
                    value={cuartos}
                    onKeyDown={allowOnlyNumbersKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setCuartos('');
                        return;
                      }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) {
                        const clamped = Math.min(maxRoomsAvailable, Math.max(0, n));
                        setCuartos(clamped);
                        if (selectedProduct && clamped > 0) {
                          const newMaxAdults = (selectedProduct.capacidadAdultos || 1) * clamped;
                          const newMaxNinos = (selectedProduct.capacidadNinos || 0) * clamped;
                          if (typeof adultos === 'number' && adultos > newMaxAdults) {
                            setAdultos(newMaxAdults);
                          }
                          if (typeof ninos === 'number' && ninos > newMaxNinos) {
                            setNinos(newMaxNinos);
                          }
                        }
                      }
                    }}
                    onBlur={() => {
                      let finalRooms: number;
                      if (cuartos === '' || cuartos < 1) {
                        finalRooms = 1;
                        setCuartos(1);
                      } else if (cuartos > maxRoomsAvailable) {
                        finalRooms = maxRoomsAvailable;
                        setCuartos(maxRoomsAvailable);
                      } else {
                        finalRooms = cuartos;
                      }
                      if (selectedProduct) {
                        const newMaxAdults = (selectedProduct.capacidadAdultos || 1) * finalRooms;
                        const newMaxNinos = (selectedProduct.capacidadNinos || 0) * finalRooms;
                        if (typeof adultos === 'number' && adultos > newMaxAdults) {
                          setAdultos(newMaxAdults);
                        }
                        if (typeof ninos === 'number' && ninos > newMaxNinos) {
                          setNinos(newMaxNinos);
                        }
                      }
                    }}
                    className="input-field text-xs py-2 text-center"
                  />
                </div>
              </div>

              {contratosNormalized.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    Política de Cancelación
                  </label>
                  <select
                    value={selectedContractIdx}
                    onChange={(e) => setSelectedContractIdx(Number(e.target.value))}
                    className="input-field text-xs"
                  >
                    {contratosNormalized.map((c, idx) => (
                      <option key={idx} value={idx}>
                        Cancelación Gratuita ({c.porcentajeReembolso}% reembolso)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Financial breakdown */}
              <div className="rounded-2xl bg-brand-bg p-4 border border-brand-border space-y-2 text-xs">
                <div className="flex justify-between text-brand-text/75">
                  <span>
                    Subtotal ({nightsCount} {nightsCount === 1 ? 'noche' : 'noches'} × {effectiveRooms} hab.)
                  </span>
                  <span className="font-semibold text-brand-text">
                    ${Number(estimatedSubtotal || 0).toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-brand-text/75">
                  <span>IVA (15%)</span>
                  <span className="font-semibold text-brand-text">
                    ${Number(estimatedIva || 0).toFixed(2)} USD
                  </span>
                </div>
                <div className="border-t border-brand-border pt-2 flex justify-between text-sm font-bold text-brand-text">
                  <span>Total a Pagar</span>
                  <span>${Number(estimatedTotal || 0).toFixed(2)} USD</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isHoldDisabled}
                className="btn-primary w-full py-3.5 text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingHold ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reservando disponibilidad...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Reservar con Hold de 15 Minutos
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-brand-text/60">
                No se realizará ningún cargo hasta confirmar en el siguiente paso.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* LIGHTBOX / MODAL DE TODAS LAS FOTOS (N FOTOS CON SWIPE TÁCTIL Y SCROLL) */}
      {isGalleryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-stone-950/95 text-white backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Galería completa de fotos del alojamiento"
        >
          {/* Barra superior del Modal */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="font-serif text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {alojamiento.titulo}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold">
                {activePhotoIndex + 1} / {allPhotos.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setGalleryViewMode((prev) => (prev === 'slider' ? 'grid' : 'slider'))
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {galleryViewMode === 'slider' ? 'Ver cuadrícula' : 'Ver deslizador'}
              </button>
              <button
                type="button"
                onClick={() => setIsGalleryModalOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
                Cerrar
              </button>
            </div>
          </div>

          {galleryViewMode === 'slider' ? (
            /* Modo Slider / Lightbox con soporte táctil (Swipe) */
            <div
              className="relative flex-1 flex items-center justify-center overflow-hidden px-4 sm:px-16 select-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {allPhotos.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrevPhoto}
                  className="absolute left-3 sm:left-6 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-sm transition-all cursor-pointer"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              <div className="max-h-[75vh] max-w-5xl w-full flex flex-col items-center justify-center">
                <img
                  src={allPhotos[activePhotoIndex]}
                  alt={`${alojamiento.titulo} - Foto ${activePhotoIndex + 1}`}
                  className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
                />
                <p className="mt-3 text-xs text-white/60 sm:hidden">
                  Desliza hacia los lados para navegar por las fotos
                </p>
              </div>

              {allPhotos.length > 1 && (
                <button
                  type="button"
                  onClick={handleNextPhoto}
                  className="absolute right-3 sm:right-6 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-sm transition-all cursor-pointer"
                  aria-label="Siguiente foto"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>
          ) : (
            /* Modo Scroll Vertical de todas las N imágenes */
            <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-8">
              <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allPhotos.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    onClick={() => {
                      setActivePhotoIndex(idx);
                      setGalleryViewMode('slider');
                    }}
                    className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 cursor-pointer"
                  >
                    <img
                      src={url}
                      alt={`${alojamiento.titulo} - Foto ${idx + 1}`}
                      className="h-64 sm:h-72 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute bottom-3 left-3 rounded-lg bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Foto #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tira inferior de miniaturas (Thumbnails) en modo slider */}
          {galleryViewMode === 'slider' && allPhotos.length > 1 && (
            <div className="border-t border-white/10 px-4 py-3 overflow-x-auto">
              <div className="flex items-center justify-center gap-2 min-w-max mx-auto">
                {allPhotos.map((url, idx) => (
                  <button
                    key={`thumb-${idx}`}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`relative h-14 w-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      idx === activePhotoIndex
                        ? 'border-brand-primary scale-105 opacity-100'
                        : 'border-transparent opacity-50 hover:opacity-85'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Miniatura ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
