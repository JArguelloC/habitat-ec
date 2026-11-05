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
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';

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
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [checkout, setCheckout] = useState<string>(() => {
    const q = searchParams.get('checkout');
    if (q) return q;
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [adultos, setAdultos] = useState<number>(() => Number(searchParams.get('adultos')) || 2);
  const [cuartos, setCuartos] = useState<number>(
    () => Number(searchParams.get('habitaciones')) || 1,
  );
  const [selectedProductoId, setSelectedProductoId] = useState<string>('');
  const [selectedContractIdx, setSelectedContractIdx] = useState<number>(0);

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

  const mosaicUrls = useMemo(() => {
    const uploaded = (detail?.fotos || []).map((f) => f.url_imagen || f.url_foto || '');
    const result: string[] = [];
    for (let i = 0; i < 5; i++) {
      result.push(uploaded[i] || MOSAIC_FALLBACKS[i]);
    }
    return result;
  }, [detail]);

  const selectedProduct = useMemo(() => {
    return (
      productosNormalized.find((p) => p.productoId === selectedProductoId) ||
      productosNormalized[0] ||
      null
    );
  }, [productosNormalized, selectedProductoId]);

  const nightsCount = useMemo(() => {
    if (!checkin || !checkout) return 1;
    const d1 = new Date(checkin);
    const d2 = new Date(checkout);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [checkin, checkout]);

  const estimatedTotal = useMemo(() => {
    const unitPrice = selectedProduct
      ? selectedProduct.precioBaseNocheUsd
      : Number(detail?.alojamiento.precio_base_noche || 85);
    return unitPrice * nightsCount * cuartos;
  }, [selectedProduct, detail, nightsCount, cuartos]);

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

    if (cuartos > selectedProduct.stockTotal) {
      notify(
        'error',
        'Stock insuficiente',
        `Esta habitación solo cuenta con ${selectedProduct.stockTotal} unidad(es) en inventario.`,
      );
      return;
    }

    setSubmittingHold(true);
    try {
      const { data: preview } = await httpClient.post<{
        orderPreviewId: string;
        totalPrice: number;
        currency: string;
        expiresAt: string;
      }>('/ordenes/preview', {
        alojamientoId: Number(detail.alojamiento.alojamiento_id),
        productoId: selectedProduct.productoId,
        checkin,
        checkout,
        adultos: Number(adultos),
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
        'Hold Temporal Activado (15:00 min)',
        'Hemos bloqueado tu inventario. Completa tus datos antes de que expire el temporizador.',
      );

      navigate('/checkout', {
        state: {
          preview,
          alojamiento: detail.alojamiento,
          producto: selectedProduct,
          checkin,
          checkout,
          nightsCount,
          adultos,
          cuartos,
          contrato5FN: chosenContract,
          portadaUrl: mosaicUrls[0],
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
              {alojamiento.ciudad} — {alojamiento.direccion || 'Ubicación verificada PostGIS'}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-brand-text">
              <Star className="h-4 w-4 fill-brand-primary text-brand-primary" />
              {Number(alojamiento.calificacion_promedio || 0).toFixed(2)} (
              {alojamiento.total_resenas} reseñas)
            </span>
          </div>
        </div>
      </div>

      {/* 5-PHOTO MOSAIC */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4 md:grid-rows-2 h-[340px] sm:h-[440px] rounded-3xl overflow-hidden border border-brand-border shadow-soft">
        <div className="md:col-span-2 md:row-span-2 relative overflow-hidden group">
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
          <div key={idx} className="hidden md:block relative overflow-hidden group">
            <img
              src={url}
              alt={`${alojamiento.titulo} galería ${idx + 2}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ))}
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
                <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-brand-text">
                  <Clock className="h-4 w-4 text-brand-secondary" />
                  15:00
                </span>
              </div>
              <div className="rounded-xl bg-brand-bg p-3 border border-brand-border">
                <span className="text-[11px] text-brand-text/60 block">Check-out</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-brand-text">
                  <Clock className="h-4 w-4 text-brand-secondary" />
                  11:00
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
                  Habitaciones y Control de Stock Numérico
                </h2>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Selecciona la tipología de habitación para tu cotización y bloqueo de 15 minutos
                </p>
              </div>
              <span className="chip-gold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Control Concurrente ACID
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
                              ${prod.precioBaseNocheUsd.toFixed(2)}
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

          {/* Reglas de Convivencia & Contratos 5FN */}
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
                Políticas de Cancelación (5FN)
              </h3>
              <p className="mt-1 text-[11px] text-brand-text/65">
                Proyección sin pérdida (Lossless-Join Decomposition) entre Canal y Política:
              </p>
              {contratosNormalized.length === 0 ? (
                <p className="mt-3 text-xs text-brand-text/60">
                  Política FREE_CANCELLATION estándar aplicada.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-xs">
                  {contratosNormalized.map((c, idx) => (
                    <li
                      key={`${c.canalProtocolo}-${c.politicaCodigo}-${idx}`}
                      className="rounded-xl border border-brand-border bg-brand-bg px-3 py-2 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-brand-text">{c.politicaCodigo}</span>
                        <span className="ml-2 text-[11px] text-brand-text/65">
                          Canal: {c.canalProtocolo}
                        </span>
                      </div>
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
                  Calificaciones auditadas con recálculo automático por trigger PostgreSQL
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
                  ${selectedProduct ? selectedProduct.precioBaseNocheUsd.toFixed(2) : '85.00'}
                </span>
                <span className="text-xs text-brand-text/65"> USD</span>
              </div>
              <span className="chip-sage">Hold 15:00 min</span>
            </div>

            <form onSubmit={handleCreateHoldPreview} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    Check-in
                  </label>
                  <input
                    type="date"
                    required
                    min={todayIso}
                    value={checkin}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCheckin(val);
                      if (checkout <= val) {
                        const next = new Date(val);
                        next.setDate(next.getDate() + 1);
                        setCheckout(next.toISOString().split('T')[0]);
                      }
                    }}
                    className="input-field text-xs py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    Check-out
                  </label>
                  <input
                    type="date"
                    required
                    min={checkin || todayIso}
                    value={checkout}
                    onChange={(e) => setCheckout(e.target.value)}
                    className="input-field text-xs py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                  Habitación Seleccionada
                </label>
                <select
                  value={selectedProductoId}
                  onChange={(e) => setSelectedProductoId(e.target.value)}
                  className="input-field text-xs"
                >
                  {productosNormalized.map((p) => (
                    <option key={p.productoId} value={p.productoId}>
                      {p.nombreProducto} — ${p.precioBaseNocheUsd.toFixed(2)} (Stock: {p.stockTotal}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    Adultos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedProduct ? selectedProduct.capacidadAdultos : 20}
                    value={adultos}
                    onChange={(e) => setAdultos(Math.max(1, Number(e.target.value)))}
                    className="input-field text-xs py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    N.º Habitaciones
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedProduct ? selectedProduct.stockTotal : 10}
                    value={cuartos}
                    onChange={(e) => setCuartos(Math.max(1, Number(e.target.value)))}
                    className="input-field text-xs py-2"
                  />
                </div>
              </div>

              {contratosNormalized.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-text/70 mb-1">
                    Política 5FN Aplicable
                  </label>
                  <select
                    value={selectedContractIdx}
                    onChange={(e) => setSelectedContractIdx(Number(e.target.value))}
                    className="input-field text-xs"
                  >
                    {contratosNormalized.map((c, idx) => (
                      <option key={idx} value={idx}>
                        {c.politicaCodigo} ({c.porcentajeReembolso}% reembolso) •{' '}
                        {c.canalProtocolo}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Financial breakdown */}
              <div className="rounded-2xl bg-brand-bg p-4 border border-brand-border space-y-2 text-xs">
                <div className="flex justify-between text-brand-text/75">
                  <span>
                    ${selectedProduct ? selectedProduct.precioBaseNocheUsd.toFixed(2) : '85.00'} x{' '}
                    {nightsCount} noche(s) x {cuartos} hab.
                  </span>
                  <span className="font-semibold text-brand-text">
                    ${estimatedTotal.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-brand-secondary">
                  <span>Comisión de servicio al viajero</span>
                  <span className="font-semibold">$0.00 USD</span>
                </div>
                <div className="border-t border-brand-border pt-2 flex justify-between text-sm font-bold text-brand-text">
                  <span>Total Estimado</span>
                  <span>${estimatedTotal.toFixed(2)} USD</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingHold || productosNormalized.length === 0}
                className="btn-primary w-full py-3.5 text-sm font-bold shadow-md"
              >
                {submittingHold ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Activando Hold Transaccional...
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
    </div>
  );
};
