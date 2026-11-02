import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  MapPin,
  BedDouble,
  Users,
  XCircle,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';

interface ReservaItem {
  order_id: string;
  locator: string;
  status: string;
  checkin: string;
  checkout: string;
  noches: number;
  number_of_adults: number;
  number_of_rooms: number;
  total_price: number;
  currency: string;
  creation_date: string;
  alojamiento_id: number;
  alojamiento_titulo: string;
  alojamiento_direccion: string;
  nombre_producto: string;
  politica_cancelacion: string;
}

interface CategoriaScore {
  categoria_score_id: number;
  codigo: string;
  nombre: string;
}

export const MyReservationsPage: React.FC = () => {
  const { notify } = useAuth();
  const [reservas, setReservas] = useState<ReservaItem[]>([]);
  const [categorias, setCategorias] = useState<CategoriaScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Cancel Modal State
  const [cancelTarget, setCancelTarget] = useState<ReservaItem | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState(
    'Cambio de itinerario de viaje personal',
  );
  const [cancelling, setCancelling] = useState(false);

  // Review Modal State
  const [reviewTarget, setReviewTarget] = useState<ReservaItem | null>(null);
  const [puntuacionGeneral, setPuntuacionGeneral] = useState<number>(5);
  const [comentario, setComentario] = useState<string>('');
  const [scoresMap, setScoresMap] = useState<Record<number, number>>({});
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resOrdenes, resCat] = await Promise.all([
        httpClient.get<ReservaItem[]>('/ordenes/mis-reservas'),
        httpClient.get<CategoriaScore[]>('/resenas/categorias'),
      ]);
      setReservas(resOrdenes.data || []);
      const cats = resCat.data || [];
      setCategorias(cats);
      const initialScores: Record<number, number> = {};
      cats.forEach((c) => {
        initialScores[c.categoria_score_id] = 5;
      });
      setScoresMap(initialScores);
    } catch (err: unknown) {
      notify('error', 'Error al cargar reservas', extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { data } = await httpClient.post<{
        orderId: string;
        status: string;
        mensaje: string;
      }>(`/ordenes/${cancelTarget.order_id}/cancelar`, {
        motivoCancelacion: motivoCancelacion.trim() || 'Cancelación solicitada por el cliente',
      });

      notify('success', 'Reserva Cancelada (Saga Compensatoria)', data.mensaje);
      setCancelTarget(null);
      await loadData();
    } catch (err: unknown) {
      notify('error', 'No se pudo cancelar la reserva', extractErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    if (comentario.trim().length < 10) {
      notify(
        'warning',
        'Comentario demasiado corto',
        'Escribe al menos 10 caracteres describiendo tu experiencia.',
      );
      return;
    }

    setSubmittingReview(true);
    try {
      const detalles = categorias.map((c) => ({
        categoriaScoreId: Number(c.categoria_score_id),
        puntaje: Number(scoresMap[c.categoria_score_id] || 5),
      }));

      await httpClient.post('/resenas', {
        orderId: String(reviewTarget.order_id),
        puntuacionGeneral: Number(puntuacionGeneral),
        comentario: comentario.trim(),
        detalles,
      });

      notify(
        'success',
        '¡Reseña publicada!',
        'Tu calificación ha actualizado el promedio del alojamiento.',
      );
      setReviewTarget(null);
      setComentario('');
    } catch (err: unknown) {
      notify(
        'error',
        'No se pudo publicar la reseña',
        extractErrorMessage(err, 'Verifica si ya registraste una reseña para esta orden.'),
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const upper = (status || '').toUpperCase();
    if (upper === 'CONFIRMED' || upper === 'COMPLETED') {
      return (
        <span className="chip-sage">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {upper}
        </span>
      );
    }
    if (upper === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
          <XCircle className="h-3.5 w-3.5" />
          CANCELADA
        </span>
      );
    }
    return (
      <span className="chip-gold">
        <Clock className="h-3.5 w-3.5" />
        {upper}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <span className="chip-gold mb-2">
            <CalendarCheck className="h-3.5 w-3.5" />
            Historial Transaccional del Viajero
          </span>
          <h1 className="font-serif text-3xl font-bold text-brand-text">
            Mis Reservas y Vouchers PNR
          </h1>
          <p className="mt-1 text-xs text-brand-text/65">
            Gestiona tus estancias, solicita cancelaciones bajo políticas 5FN o califica tu
            experiencia.
          </p>
        </div>
        <Link to="/" className="btn-primary self-start sm:self-auto">
          <Sparkles className="h-4 w-4" />
          Nueva Reserva
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="card-surface h-40 animate-pulse p-6" />
          ))}
        </div>
      ) : reservas.length === 0 ? (
        <div className="card-surface mt-8 p-12 text-center max-w-xl mx-auto">
          <CalendarCheck className="mx-auto h-10 w-10 text-brand-accent" />
          <h2 className="mt-4 font-serif text-xl font-bold text-brand-text">
            Aún no tienes reservas registradas
          </h2>
          <p className="mt-2 text-xs text-brand-text/70">
            Explora el Marketplace de Hábitat EC para reservar tu próxima estancia sostenible.
          </p>
          <Link to="/" className="btn-primary mt-6">
            Ir al Marketplace
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {reservas.map((r) => {
            const isCancelled = (r.status || '').toUpperCase() === 'CANCELLED';
            return (
              <div
                key={r.order_id}
                className="card-surface p-6 transition-all hover:shadow-elevated"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-xl bg-brand-primary/20 border border-brand-primary/40 px-3 py-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent block">
                        Localizador PNR
                      </span>
                      <span className="font-mono text-sm font-extrabold text-brand-text">
                        {r.locator}
                      </span>
                    </div>
                    {renderStatusBadge(r.status)}
                    <span className="text-xs text-brand-text/60">
                      Política 5FN: <strong>{r.politica_cancelacion}</strong>
                    </span>
                  </div>

                  <div className="text-left md:text-right">
                    <span className="text-[11px] text-brand-text/60 block">Total Orden</span>
                    <span className="font-serif text-xl font-bold text-brand-text">
                      ${Number(r.total_price).toFixed(2)} {r.currency || 'USD'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <Link
                      to={`/alojamientos/${r.alojamiento_id}`}
                      className="font-serif text-lg font-bold text-brand-text hover:text-brand-accent transition-colors"
                    >
                      {r.alojamiento_titulo}
                    </Link>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-brand-text/75">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-brand-accent" />
                        {r.alojamiento_direccion}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5 text-brand-accent" />
                        {r.nombre_producto} ({r.number_of_rooms || 1} hab.)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-brand-accent" />
                        {r.number_of_adults} adulto(s)
                      </span>
                      <span className="rounded-lg bg-brand-bg px-2.5 py-1 font-semibold border border-brand-border">
                        Check-in: {String(r.checkin).split('T')[0]} → Check-out:{' '}
                        {String(r.checkout).split('T')[0]}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {!isCancelled && (
                      <>
                        <button
                          type="button"
                          onClick={() => setReviewTarget(r)}
                          className="btn-secondary text-xs py-2 px-3.5"
                        >
                          <Star className="h-3.5 w-3.5 text-brand-accent" />
                          Calificar Estancia
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelTarget(r)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar Reserva
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CANCEL RESERVATION (SAGA COMPENSATORIA) */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="card-surface w-full max-w-lg p-6 sm:p-8 shadow-elevated text-left">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-brand-text">
                    Confirmar Cancelación de Reserva
                  </h3>
                  <p className="text-xs text-brand-text/65">
                    PNR: <code className="font-mono">{cancelTarget.locator}</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-lg p-1 text-brand-text/60 hover:text-brand-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-brand-border bg-brand-bg p-3.5 text-xs space-y-1">
              <p>
                Alojamiento: <strong>{cancelTarget.alojamiento_titulo}</strong>
              </p>
              <p>
                Política 5FN Aplicada: <strong>{cancelTarget.politica_cancelacion}</strong> (Monto:
                ${Number(cancelTarget.total_price).toFixed(2)} USD)
              </p>
              <p className="text-brand-secondary font-medium pt-1">
                Al confirmar, la Saga Compensatoria liberará las {cancelTarget.number_of_rooms || 1}{' '}
                habitación(es) nuevamente al Marketplace.
              </p>
            </div>

            <form onSubmit={handleConfirmCancel} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Motivo de la cancelación *
                </label>
                <textarea
                  rows={3}
                  required
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="btn-secondary text-xs"
                >
                  Conservar Reserva
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ejecutando Saga...
                    </>
                  ) : (
                    'Confirmar Cancelación y Liberar Stock'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT REVIEW BY CATEGORY */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="card-surface w-full max-w-lg p-6 sm:p-8 shadow-elevated text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="chip-gold text-[10px]">Evaluación Multicriterio</span>
                <h3 className="mt-1 font-serif text-lg font-bold text-brand-text">
                  Calificar Estancia en {reviewTarget.alojamiento_titulo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="rounded-lg p-1 text-brand-text/60 hover:text-brand-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Calificación General (1 a 5 estrellas)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setPuntuacionGeneral(star)}
                      className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                        puntuacionGeneral >= star
                          ? 'border-brand-accent bg-brand-primary/30 text-brand-text'
                          : 'border-brand-border bg-brand-bg text-brand-text/50'
                      }`}
                    >
                      <Star className="h-3.5 w-3.5 fill-brand-primary text-brand-primary" />
                      {star}
                    </button>
                  ))}
                </div>
              </div>

              {categorias.length > 0 && (
                <div className="space-y-2.5 rounded-2xl border border-brand-border bg-brand-bg p-4">
                  <span className="text-xs font-bold text-brand-accent block">
                    Desglose por Categoría (resena_puntuaciones_detalle)
                  </span>
                  {categorias.map((c) => (
                    <div
                      key={c.categoria_score_id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-brand-text">{c.nombre}</span>
                      <select
                        value={scoresMap[c.categoria_score_id] || 5}
                        onChange={(e) =>
                          setScoresMap((prev) => ({
                            ...prev,
                            [c.categoria_score_id]: Number(e.target.value),
                          }))
                        }
                        className="rounded-lg border border-brand-border bg-brand-surface px-2.5 py-1 text-xs font-semibold"
                      >
                        {[5, 4, 3, 2, 1].map((v) => (
                          <option key={v} value={v}>
                            {v} ★
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Comentario sobre tu experiencia (mínimo 10 caracteres) *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Describe la atención del anfitrión, limpieza y sostenibilidad del alojamiento..."
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewTarget(null)}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn-primary text-xs"
                >
                  {submittingReview ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Publicar Reseña'
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
