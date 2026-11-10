import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Baby,
  Star,
  Sparkles,
  Leaf,
  Building2,
  Home,
  Tent,
  RotateCcw,
  BedDouble,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { allowOnlyNumbersKey } from '../utils/inputFilters';
import { formatDateToLatam, getMinCheckoutDate } from '../utils/dateUtils';
import { TipologiaDropdown } from '../components/marketplace/TipologiaDropdown';

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
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaultCheckin(): string {
  return getTodayIso();
}

function getDefaultCheckout(): string {
  return getMinCheckoutDate('');
}

export const HomeMarketplace: React.FC = () => {
  const { notify, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = getTodayIso();

  const [ciudades, setCiudades] = useState<CiudadCatalogo[]>([]);
  const [tipos, setTipos] = useState<TipoAlojamientoCatalogo[]>([]);
  const [alojamientos, setAlojamientos] = useState<AlojamientoCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search Filters
  const [ciudadId, setCiudadId] = useState<string>(() => searchParams.get('ciudadId') || '');
  const [selectedTipoId, setSelectedTipoId] = useState<number | null>(() => {
    const t = searchParams.get('tipoId');
    return t ? Number(t) : null;
  });
  const [checkin, setCheckin] = useState<string>(() => searchParams.get('checkin') || getDefaultCheckin());
  const [checkout, setCheckout] = useState<string>(() => searchParams.get('checkout') || getDefaultCheckout());
  const [adultos, setAdultos] = useState<number | ''>(() => {
    const val = Number(searchParams.get('adultos'));
    return val > 0 ? val : 2;
  });
  const [ninos, setNinos] = useState<number | ''>(() => {
    const raw = searchParams.get('ninos');
    return raw !== null && !isNaN(Number(raw)) ? Number(raw) : 0;
  });
  const [habitaciones, setHabitaciones] = useState<number | ''>(() => {
    const val = Number(searchParams.get('habitaciones'));
    return val > 0 ? val : 1;
  });
  const [activeFilterApplied, setActiveFilterApplied] = useState<boolean>(false);

  // Referencias a los inputs nativos de tipo date para invocar .showPicker()
  const checkinInputRef = useRef<HTMLInputElement>(null);
  const checkoutInputRef = useRef<HTMLInputElement>(null);

  const triggerDatePicker = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (!inputRef.current) return;
    try {
      if (typeof inputRef.current.showPicker === 'function') {
        inputRef.current.showPicker();
      } else {
        inputRef.current.focus();
      }
    } catch {
      inputRef.current.focus();
    }
  };

  const handleCheckinChange = (newVal: string) => {
    if (!newVal) return;
    setCheckin(newVal);
    const nextMinCheckout = getMinCheckoutDate(newVal);
    if (!checkout || checkout <= newVal) {
      setCheckout(nextMinCheckout);
    }
  };

  const handleCheckoutChange = (newVal: string) => {
    if (!newVal) return;
    if (checkin && newVal <= checkin) {
      setCheckout(getMinCheckoutDate(checkin));
      notify('info', 'Fecha ajustada', 'El Check-out debe ser al menos un día posterior al Check-in.');
    } else {
      setCheckout(newVal);
    }
  };

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
          payload.adultos = typeof adultos === 'number' && adultos > 0 ? adultos : 2;
          payload.ninos = typeof ninos === 'number' && ninos >= 0 ? ninos : 0;
          payload.habitaciones = typeof habitaciones === 'number' && habitaciones > 0 ? habitaciones : 1;
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
    [ciudadId, selectedTipoId, checkin, checkout, adultos, ninos, habitaciones, activeFilterApplied, notify],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCatalogs();
    void executeSearch({ customCiudadId: '', customTipoId: null, useDates: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDateRangeValid = !checkin || !checkout || checkout > checkin;
  const isGuestsInvalid =
    adultos === '' ||
    adultos < 1 ||
    ninos === '' ||
    ninos < 0 ||
    habitaciones === '' ||
    habitaciones < 1;
  const isSearchDisabled = !isDateRangeValid || loading || isGuestsInvalid;

  const handleFormSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDateRangeValid) {
      notify(
        'warning',
        'Rango de fechas inválido',
        'La fecha de Check-out debe ser posterior a la fecha de Check-in.',
      );
      return;
    }
    if (isGuestsInvalid) {
      notify(
        'warning',
        'Campos incompletos',
        'Ingresa un número válido de adultos (mínimo 1), niños (mínimo 0) y cuartos (mínimo 1).',
      );
      return;
    }
    setActiveFilterApplied(true);
    const params: Record<string, string> = {
      checkin,
      checkout,
      adultos: String(adultos),
      ninos: String(ninos),
      habitaciones: String(habitaciones),
    };
    if (ciudadId) params.ciudadId = ciudadId;
    if (selectedTipoId) params.tipoId = String(selectedTipoId);
    setSearchParams(params);
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
    setNinos(0);
    setHabitaciones(1);
    setActiveFilterApplied(false);
    setSearchParams({});
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
            Alojamientos únicos • Reservas seguras
          </div>

          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Hospédate donde la naturaleza y el confort convergen
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-white/90">
            Descubre Eco-Lodges, cabañas de montaña y hoteles boutique únicos. Reserva tu próxima escapada a la naturaleza con confirmación inmediata y total seguridad.
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
              <div
                role="button"
                tabIndex={0}
                onClick={() => triggerDatePicker(checkinInputRef)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerDatePicker(checkinInputRef);
                  }
                }}
                className="md:col-span-2 flex flex-col text-left px-3 py-1.5 rounded-2xl hover:bg-brand-bg transition-colors md:border-l md:border-brand-border cursor-pointer group select-none"
                title="Haz clic para abrir el calendario de Check-in"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                    <Calendar className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                    Check-in
                  </span>
                  <span className="text-[10px] text-brand-text/40 group-hover:text-brand-accent transition-colors font-medium">
                    Cambiar
                  </span>
                </div>
                <div className="relative mt-1">
                  <div className="text-xs sm:text-sm font-semibold text-brand-text">
                    {formatDateToLatam(checkin)}
                  </div>
                  <input
                    ref={checkinInputRef}
                    type="date"
                    min={todayIso}
                    value={checkin}
                    onChange={(e) => handleCheckinChange(e.target.value)}
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {
                        // Error ignorado intencionalmente: navegador sin soporte para showPicker
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    tabIndex={-1}
                    aria-label="Seleccionar fecha de Check-in"
                  />
                </div>
              </div>

              {/* Check-out */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => triggerDatePicker(checkoutInputRef)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerDatePicker(checkoutInputRef);
                  }
                }}
                className={`md:col-span-2 flex flex-col text-left px-3 py-1.5 rounded-2xl transition-colors md:border-l md:border-brand-border cursor-pointer group select-none ${
                  !isDateRangeValid
                    ? 'bg-red-50/50 dark:bg-red-950/20 border border-red-500'
                    : 'hover:bg-brand-bg'
                }`}
                title="Haz clic para abrir el calendario de Check-out"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                    <Calendar className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                    Check-out
                  </span>
                  {!isDateRangeValid ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <span className="text-[10px] text-brand-text/40 group-hover:text-brand-accent transition-colors font-medium">
                      Cambiar
                    </span>
                  )}
                </div>
                <div className="relative mt-1">
                  <div
                    className={`text-xs sm:text-sm font-semibold ${
                      !isDateRangeValid ? 'text-red-600 dark:text-red-400 font-bold' : 'text-brand-text'
                    }`}
                  >
                    {formatDateToLatam(checkout)}
                  </div>
                  <input
                    ref={checkoutInputRef}
                    type="date"
                    min={getMinCheckoutDate(checkin)}
                    value={checkout}
                    onChange={(e) => handleCheckoutChange(e.target.value)}
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {
                        // Error ignorado intencionalmente: navegador sin soporte para showPicker
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    tabIndex={-1}
                    aria-label="Seleccionar fecha de Check-out"
                  />
                </div>
                {!isDateRangeValid && (
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-medium leading-tight mt-0.5">
                    Debe ser posterior a Check-in
                  </span>
                )}
              </div>

              {/* Guests & Rooms */}
              <div className="md:col-span-3 grid grid-cols-3 gap-1.5 px-2.5 py-1.5 rounded-2xl hover:bg-brand-bg transition-colors md:border-l md:border-brand-border text-left">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-accent truncate">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    Adultos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
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
                        setAdultos(Math.min(50, Math.max(0, n)));
                      }
                    }}
                    onBlur={() => {
                      if (adultos === '' || adultos < 1) {
                        setAdultos(1);
                      }
                    }}
                    className="mt-1 w-full bg-transparent text-xs sm:text-sm font-semibold text-brand-text focus:outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-accent truncate">
                    <Baby className="h-3.5 w-3.5 shrink-0" />
                    Niños
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={ninos}
                    onKeyDown={allowOnlyNumbersKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setNinos('');
                        return;
                      }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) {
                        setNinos(Math.min(20, Math.max(0, n)));
                      }
                    }}
                    onBlur={() => {
                      if (ninos === '' || ninos < 0) {
                        setNinos(0);
                      }
                    }}
                    className="mt-1 w-full bg-transparent text-xs sm:text-sm font-semibold text-brand-text focus:outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-accent truncate">
                    <BedDouble className="h-3.5 w-3.5 shrink-0" />
                    Cuartos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={habitaciones}
                    onKeyDown={allowOnlyNumbersKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setHabitaciones('');
                        return;
                      }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) {
                        setHabitaciones(Math.min(20, Math.max(0, n)));
                      }
                    }}
                    onBlur={() => {
                      if (habitaciones === '' || habitaciones < 1) {
                        setHabitaciones(1);
                      }
                    }}
                    className="mt-1 w-full bg-transparent text-xs sm:text-sm font-semibold text-brand-text focus:outline-none"
                  />
                </div>
              </div>

              {/* Search CTA */}
              <div className="md:col-span-2 flex items-center justify-end gap-1.5">
                <button
                  type="submit"
                  disabled={isSearchDisabled}
                  className="btn-primary w-full py-3.5 rounded-2xl text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="flex items-center gap-3">
            <TipologiaDropdown
              tipos={tipos}
              selectedTipoId={selectedTipoId}
              onSelectTipo={handleSelectTipo}
              getTipoIcon={getTipoIcon}
            />
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
                    to={`/alojamientos/${item.alojamientoId}?checkin=${checkin}&checkout=${checkout}&adultos=${adultos}&ninos=${ninos}&habitaciones=${habitaciones}`}
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
                            {Number(item.calificacionPromedio || 0) > 0
                              ? Number(item.calificacionPromedio || 0).toFixed(2)
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
