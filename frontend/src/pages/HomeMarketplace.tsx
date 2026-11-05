import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Star,
  Sparkles,
  Leaf,
  Building2,
  Home,
  Tent,
  RotateCcw,
  BedDouble,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';

interface CiudadCatalogo {
  ciudad_id: number;
  nombre: string;
  provincia: string;
  region: string;
}

interface TipoAlojamientoCatalogo {
  tipo_id: number;
  codigo: string;
  nombre: string;
}

interface AlojamientoCardItem {
  alojamientoId: number;
  titulo: string;
  descripcion: string;
  direccion: string;
  tipoId: number;
  tipoNombre: string;
  tipoCodigo: string;
  ciudadId: number;
  ciudad: string;
  precioBaseNoche: number;
  maxAdultos: number;
  totalCuartos: number;
  calificacionPromedio: number;
  totalResenas: number;
  portadaUrl: string | null;
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1000&q=80',
];

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultCheckin(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function getDefaultCheckout(): string {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString().split('T')[0];
}

export const HomeMarketplace: React.FC = () => {
  const { notify, isAdmin } = useAuth();
  const todayIso = getTodayIso();

  const [ciudades, setCiudades] = useState<CiudadCatalogo[]>([]);
  const [tipos, setTipos] = useState<TipoAlojamientoCatalogo[]>([]);
  const [alojamientos, setAlojamientos] = useState<AlojamientoCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search Filters
  const [ciudadId, setCiudadId] = useState<string>('');
  const [selectedTipoId, setSelectedTipoId] = useState<number | null>(null);
  const [checkin, setCheckin] = useState<string>(getDefaultCheckin);
  const [checkout, setCheckout] = useState<string>(getDefaultCheckout);
  const [adultos, setAdultos] = useState<number>(2);
  const [habitaciones, setHabitaciones] = useState<number>(1);
  const [activeFilterApplied, setActiveFilterApplied] = useState<boolean>(false);

  const loadCatalogs = useCallback(async () => {
    try {
      const [ciudadesRes, tiposRes] = await Promise.all([
        httpClient.get<CiudadCatalogo[]>('/catalogos/ciudades'),
        httpClient.get<TipoAlojamientoCatalogo[]>('/catalogos/tipos-alojamiento'),
      ]);
      setCiudades(ciudadesRes.data || []);
      setTipos(tiposRes.data || []);
    } catch (err: unknown) {
      notify('error', 'Error cargando catálogos', extractErrorMessage(err));
    }
  }, [notify]);

  const executeSearch = useCallback(
    async (opts?: {
      customCiudadId?: string;
      customTipoId?: number | null;
      useDates?: boolean;
    }) => {
      setLoading(true);
      try {
        const cId = opts?.customCiudadId !== undefined ? opts.customCiudadId : ciudadId;
        const tId = opts?.customTipoId !== undefined ? opts.customTipoId : selectedTipoId;
        const applyDates = opts?.useDates ?? activeFilterApplied;

        const payload: Record<string, unknown> = {};
        if (cId) payload.ciudadId = Number(cId);
        if (tId) payload.tipoId = Number(tId);
        if (applyDates && checkin && checkout) {
          payload.checkin = checkin;
          payload.checkout = checkout;
          payload.adultos = adultos;
          payload.habitaciones = habitaciones;
        }

        const { data } = await httpClient.post<AlojamientoCardItem[]>(
          '/alojamientos/search',
          payload,
        );
        setAlojamientos(data || []);
      } catch (err: unknown) {
        notify('error', 'Error en la búsqueda', extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [ciudadId, selectedTipoId, checkin, checkout, adultos, habitaciones, activeFilterApplied, notify],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCatalogs();
    void executeSearch({ customCiudadId: '', customTipoId: null, useDates: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkin && checkout && checkout <= checkin) {
      notify(
        'warning',
        'Rango de fechas inválido',
        'La fecha de Check-out debe ser posterior a la fecha de Check-in.',
      );
      return;
    }
    setActiveFilterApplied(true);
    void executeSearch({ useDates: true });
  };

  const handleSelectTipo = (tId: number | null) => {
    setSelectedTipoId(tId);
    void executeSearch({ customTipoId: tId });
  };

  const handleResetFilters = () => {
    setCiudadId('');
    setSelectedTipoId(null);
    setCheckin(getDefaultCheckin());
    setCheckout(getDefaultCheckout());
    setAdultos(2);
    setHabitaciones(1);
    setActiveFilterApplied(false);
    void executeSearch({ customCiudadId: '', customTipoId: null, useDates: false });
  };

  const getTipoIcon = (codigo: string) => {
    const upper = (codigo || '').toUpperCase();
    if (upper.includes('ECO') || upper.includes('CAB')) return <Tent className="h-4 w-4" />;
    if (upper.includes('HOT')) return <Building2 className="h-4 w-4" />;
    return <Home className="h-4 w-4" />;
  };

  return (
    <div className="pb-16">
      {/* HERO SECTION & PILL SEARCH BAR (01-navbar-hero-search mold) */}
      <section className="relative overflow-hidden border-b border-brand-border bg-gradient-to-b from-[#141A17] via-[#1C2420] to-[#141A17] text-[#F4F1EA] dark:from-[#221c13] dark:via-[#17130c] dark:to-[#110e09] dark:text-brand-text">
        <div
          className="absolute inset-0 opacity-25 bg-cover bg-center mix-blend-overlay"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1800&q=80')",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Hospitalidad Consciente • Inventario Verificado en Tiempo Real
          </div>

          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Hospédate donde la naturaleza y el confort convergen
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-white/90">
            Eco-Lodges en el Chocó Andino, cabañas de montaña y hoteles boutique con disponibilidad
            sincronizada al instante y protección anti-sobreventa.
          </p>

          {/* Central Pill Search Bar */}
          <form
            onSubmit={handleFormSearch}
            className="mx-auto mt-8 max-w-5xl rounded-3xl border border-brand-border/80 bg-brand-surface p-3 text-brand-text shadow-elevated"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-center">
              {/* Destination */}
              <div className="md:col-span-3 flex flex-col text-left px-3 py-1.5 rounded-2xl hover:bg-brand-bg transition-colors">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                  <MapPin className="h-3.5 w-3.5" />
                  Destino / Ciudad
                </label>
                <select
                  value={ciudadId}
                  onChange={(e) => setCiudadId(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm font-semibold text-brand-text focus:outline-none cursor-pointer"
                >
                  <option value="">Todo el Ecuador</option>
                  {ciudades.map((c) => (
                    <option key={c.ciudad_id} value={c.ciudad_id}>
                      {c.nombre} ({c.provincia})
                    </option>
                  ))}
                </select>
              </div>

              {/* Check-in */}
              <div className="md:col-span-2 flex flex-col text-left px-3 py-1.5 rounded-2xl hover:bg-brand-bg transition-colors md:border-l md:border-brand-border">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                  <Calendar className="h-3.5 w-3.5" />
                  Check-in
                </label>
                <input
                  type="date"
                  min={todayIso}
                  value={checkin}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCheckin(val);
                    if (checkout && val >= checkout) {
                      const nextDay = new Date(val);
                      nextDay.setDate(nextDay.getDate() + 1);
                      setCheckout(nextDay.toISOString().split('T')[0]);
                    }
                  }}
                  className="mt-1 w-full bg-transparent text-xs sm:text-sm font-semibold text-brand-text focus:outline-none"
                />
              </div>

              {/* Check-out */}
              <div className="md:col-span-2 flex flex-col text-left px-3 py-1.5 rounded-2xl hover:bg-brand-bg transition-colors md:border-l md:border-brand-border">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                  <Calendar className="h-3.5 w-3.5" />
                  Check-out
                </label>
                <input
                  type="date"
                  min={checkin || todayIso}
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                  className="mt-1 w-full bg-transparent text-xs sm:text-sm font-semibold text-brand-text focus:outline-none"
                />
              </div>

              {/* Guests & Rooms */}
              <div className="md:col-span-3 grid grid-cols-2 gap-2 px-3 py-1.5 rounded-2xl hover:bg-brand-bg transition-colors md:border-l md:border-brand-border text-left">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                    <Users className="h-3.5 w-3.5" />
                    Adultos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={adultos}
                    onChange={(e) => setAdultos(Math.max(1, Number(e.target.value)))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold text-brand-text focus:outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                    <BedDouble className="h-3.5 w-3.5" />
                    Cuartos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={habitaciones}
                    onChange={(e) => setHabitaciones(Math.max(1, Number(e.target.value)))}
                    className="mt-1 w-full bg-transparent text-sm font-semibold text-brand-text focus:outline-none"
                  />
                </div>
              </div>

              {/* Search CTA */}
              <div className="md:col-span-2 flex items-center justify-end gap-1.5">
                <button
                  type="submit"
                  className="btn-primary w-full py-3.5 rounded-2xl text-sm font-bold shadow-md"
                >
                  <Search className="h-4 w-4" />
                  Buscar
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* HORIZONTAL CATEGORY FILTER BAR */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border pb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-text/60 mr-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-brand-accent" />
              Tipología:
            </span>
            <button
              type="button"
              onClick={() => handleSelectTipo(null)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                selectedTipoId === null
                  ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
                  : 'border border-brand-border bg-brand-surface text-brand-text/80 hover:border-brand-accent'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
              Todos los Alojamientos
            </button>

            {tipos.map((t) => (
              <button
                key={t.tipo_id}
                type="button"
                onClick={() => handleSelectTipo(t.tipo_id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  selectedTipoId === t.tipo_id
                    ? 'bg-brand-primary text-brand-bg font-bold shadow-sm border border-brand-primary/40'
                    : 'border border-brand-border bg-brand-surface text-brand-text/80 hover:border-brand-accent'
                }`}
              >
                {getTipoIcon(t.codigo)}
                {t.nombre}
              </button>
            ))}
          </div>

          {(ciudadId || selectedTipoId !== null || activeFilterApplied) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-text/75 hover:border-brand-accent hover:text-brand-text"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer filtros
            </button>
          )}
        </div>

        {/* CATALOG CARDS GRID (02-catalog-cards mold) */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-left">
              <h2 className="font-serif text-2xl font-bold text-brand-text">
                Alojamientos Disponibles
              </h2>
              <p className="text-xs text-brand-text/65 mt-0.5">
                {loading
                  ? 'Consultando disponibilidad en tiempo real...'
                  : `${alojamientos.length} propiedad(es) verificadas en el catálogo`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="card-surface overflow-hidden animate-pulse h-96 flex flex-col justify-between p-4"
                >
                  <div className="h-52 w-full rounded-xl bg-brand-border/60" />
                  <div className="space-y-3">
                    <div className="h-4 w-2/3 rounded bg-brand-border" />
                    <div className="h-3 w-1/2 rounded bg-brand-border/70" />
                    <div className="h-8 w-1/3 rounded bg-brand-border" />
                  </div>
                </div>
              ))}
            </div>
          ) : alojamientos.length === 0 ? (
            <div className="card-surface p-12 text-center max-w-2xl mx-auto my-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/20 text-brand-accent">
                <Leaf className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-serif text-xl font-bold text-brand-text">
                No se encontraron alojamientos con estos criterios
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-brand-text/70 leading-relaxed">
                Prueba limpiando los filtros de búsqueda o, si eres un Anfitrión autorizado,
                publica tu primer alojamiento en el catálogo nacional.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={handleResetFilters} className="btn-secondary">
                  <RotateCcw className="h-4 w-4" />
                  Ver todo el catálogo
                </button>
                {isAdmin && (
                  <Link to="/admin/alojamientos/nuevo" className="btn-primary">
                    <Building2 className="h-4 w-4" />
                    Publicar Nuevo Alojamiento
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {alojamientos.map((item, idx) => {
                const imgUrl =
                  item.portadaUrl || FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
                const isEco =
                  (item.tipoCodigo || '').toUpperCase().includes('ECO') ||
                  (item.tipoNombre || '').toLowerCase().includes('eco');

                return (
                  <Link
                    key={item.alojamientoId}
                    to={`/alojamientos/${item.alojamientoId}?checkin=${checkin}&checkout=${checkout}&adultos=${adultos}&habitaciones=${habitaciones}`}
                    className="card-surface group overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated text-left"
                  >
                    <div>
                      {/* Image Container */}
                      <div className="relative h-60 w-full overflow-hidden bg-brand-border/40">
                        <img
                          src={imgUrl}
                          alt={item.titulo}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

                        {/* Top Badges */}
                        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface/95 px-3 py-1 text-[11px] font-bold text-brand-text shadow-sm backdrop-blur-sm">
                            {getTipoIcon(item.tipoCodigo)}
                            {item.tipoNombre || 'Alojamiento'}
                          </span>

                          {isEco ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-secondary px-3 py-1 text-[11px] font-bold text-brand-bg shadow-sm">
                              <Leaf className="h-3 w-3" />
                              Eco-Verificado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary px-3 py-1 text-[11px] font-bold text-brand-bg shadow-sm">
                              <Sparkles className="h-3 w-3" />
                              Stock Controlado
                            </span>
                          )}
                        </div>

                        {/* Bottom Location Pill */}
                        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-white">
                          <span className="inline-flex items-center gap-1 text-xs font-medium drop-shadow">
                            <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                            {item.ciudad}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-black/55 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                            <Star className="h-3.5 w-3.5 fill-brand-primary text-brand-primary" />
                            {item.calificacionPromedio > 0
                              ? item.calificacionPromedio.toFixed(2)
                              : 'Nuevo'}
                            {item.totalResenas > 0 && (
                              <span className="text-[10px] opacity-80">
                                ({item.totalResenas})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5">
                        <h3 className="font-serif text-lg font-bold text-brand-text group-hover:text-brand-accent transition-colors line-clamp-1">
                          {item.titulo}
                        </h3>
                        <p className="mt-1.5 text-xs text-brand-text/70 line-clamp-2 leading-relaxed">
                          {item.descripcion || 'Alojamiento certificado en Hábitat EC.'}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-brand-text/75">
                          <span className="rounded-lg bg-brand-bg px-2.5 py-1 font-medium border border-brand-border">
                            Hasta {item.maxAdultos} adultos
                          </span>
                          <span className="rounded-lg bg-brand-bg px-2.5 py-1 font-medium border border-brand-border">
                            {item.totalCuartos} habitación(es)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Price & CTA */}
                    <div className="border-t border-brand-border px-5 py-3.5 bg-brand-bg/50 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-brand-text/60 block">Desde</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-serif text-xl font-bold text-brand-text">
                            ${Number(item.precioBaseNoche).toFixed(2)}
                          </span>
                          <span className="text-xs text-brand-text/65">USD / noche</span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-xl bg-brand-primary/25 px-3 py-2 text-xs font-bold text-brand-accent group-hover:bg-brand-primary group-hover:text-brand-text transition-colors">
                        Ver disponibilidad
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
