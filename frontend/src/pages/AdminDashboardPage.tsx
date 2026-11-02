import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  PlusCircle,
  DollarSign,
  Star,
  BedDouble,
  CheckCircle2,
  Image as ImageIcon,
  Leaf,
  FileCheck2,
  ArrowRight,
  Loader2,
  Eye,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';

interface HostPropertyItem {
  alojamientoId: number;
  titulo: string;
  descripcion: string;
  direccion: string;
  estadoOperativo: string;
  calificacionPromedio: number;
  totalResenas: number;
  ciudad: string;
  tipo: string;
  productoId: string;
  precioBaseNoche: number;
  totalCuartos: number;
  portadaUrl: string;
}

interface LiquidacionItem {
  liquidacion_id: number;
  order_id: string;
  monto_bruto: number;
  comision_plataforma: number;
  monto_neto_pagar: number;
  estado_liquidacion: string;
  fecha_liquidacion: string;
  orden_localizador: string;
  alojamiento_titulo: string;
  anfitrion_nombre: string;
}

interface CiudadOpt {
  ciudad_id: number;
  nombre: string;
  latitud: number;
  longitud: number;
}

interface TipoOpt {
  tipo_id: number;
  codigo: string;
  nombre: string;
}

interface FacilidadOpt {
  facilidad_id: number;
  codigo: string;
  nombre: string;
  es_sostenible: boolean;
}

interface ReglaOpt {
  regla_id: number;
  codigo: string;
  descripcion: string;
}

interface PlanAlimenticioOpt {
  plan_id: number;
  codigo_meal_plan: string;
  nombre: string;
}

export const AdminDashboardPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useAuth();

  const isWizardRoute = location.pathname.includes('/nuevo');
  const [activeTab, setActiveTab] = useState<'properties' | 'wizard' | 'settlements'>(
    isWizardRoute ? 'wizard' : 'properties',
  );

  const [properties, setProperties] = useState<HostPropertyItem[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Catalogs for Wizard
  const [ciudades, setCiudades] = useState<CiudadOpt[]>([]);
  const [tipos, setTipos] = useState<TipoOpt[]>([]);
  const [facilidadesCat, setFacilidadesCat] = useState<FacilidadOpt[]>([]);
  const [reglasCat, setReglasCat] = useState<ReglaOpt[]>([]);
  const [planesCat, setPlanesCat] = useState<PlanAlimenticioOpt[]>([]);

  // Wizard Step State (1..4)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [createdAlojamientoId, setCreatedAlojamientoId] = useState<number | null>(null);
  const [submittingStep, setSubmittingStep] = useState<boolean>(false);

  // Step 1 Fields
  const [ciudadId, setCiudadId] = useState<number>(1);
  const [tipoId, setTipoId] = useState<number>(1);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('Km 5 Vía a las Cascadas');
  const [precioBaseNoche, setPrecioBaseNoche] = useState<number>(95);
  const [maxAdultos, setMaxAdultos] = useState<number>(4);
  const [totalCuartos, setTotalCuartos] = useState<number>(4);

  // Step 2 Fields (Photos, Facilities, Rules)
  const [fotoUrlPortada, setFotoUrlPortada] = useState(
    'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80',
  );
  const [selectedFacilidades, setSelectedFacilidades] = useState<number[]>([]);
  const [selectedReglas, setSelectedReglas] = useState<number[]>([]);

  // Step 3 Fields (Habitaciones / Productos con Stock Controlado)
  const [nombreProducto, setNombreProducto] = useState('Suite Bosque Nublado');
  const [planAlimenticioId, setPlanAlimenticioId] = useState<number>(1);
  const [capAdultosHab, setCapAdultosHab] = useState<number>(2);
  const [capNinosHab, setCapNinosHab] = useState<number>(1);
  const [stockTotalHab, setStockTotalHab] = useState<number>(4);
  const [precioHabUsd, setPrecioHabUsd] = useState<number>(95);
  const [addedProducts, setAddedProducts] = useState<
    Array<{ codigo: string; nombre: string; stock: number; precio: number }>
  >([]);

  // Step 4 Fields (Contratos 5FN)
  const [selectedCanalId, setSelectedCanalId] = useState<number>(1);
  const [selectedPoliticaId, setSelectedPoliticaId] = useState<number>(1);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        propRes,
        liqRes,
        ciudRes,
        tipRes,
        facRes,
        regRes,
        planRes,
      ] = await Promise.all([
        httpClient.get<HostPropertyItem[]>('/admin/alojamientos'),
        httpClient.get<LiquidacionItem[]>('/pagos/liquidaciones'),
        httpClient.get<CiudadOpt[]>('/catalogos/ciudades'),
        httpClient.get<TipoOpt[]>('/catalogos/tipos-alojamiento'),
        httpClient.get<FacilidadOpt[]>('/catalogos/facilidades'),
        httpClient.get<ReglaOpt[]>('/catalogos/reglas-convivencia'),
        httpClient.get<PlanAlimenticioOpt[]>('/catalogos/planes-alimenticios'),
      ]);

      setProperties(Array.isArray(propRes.data) ? propRes.data : []);
      setLiquidaciones(Array.isArray(liqRes.data) ? liqRes.data : []);
      setCiudades(Array.isArray(ciudRes.data) ? ciudRes.data : []);
      setTipos(Array.isArray(tipRes.data) ? tipRes.data : []);
      setFacilidadesCat(Array.isArray(facRes.data) ? facRes.data : []);
      setReglasCat(Array.isArray(regRes.data) ? regRes.data : []);
      setPlanesCat(Array.isArray(planRes.data) ? planRes.data : []);

      if (Array.isArray(ciudRes.data) && ciudRes.data.length > 0) {
        setCiudadId(Number(ciudRes.data[0].ciudad_id));
      }
      if (Array.isArray(tipRes.data) && tipRes.data.length > 0) {
        setTipoId(Number(tipRes.data[0].tipo_id));
      }
      if (Array.isArray(planRes.data) && planRes.data.length > 0) {
        setPlanAlimenticioId(Number(planRes.data[0].plan_id));
      }
    } catch (err: unknown) {
      notify('error', 'Error cargando el Panel Anfitrión', extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboardData();
  }, [loadDashboardData]);

  // KPIs Calculation (05-host-dashboard mold)
  const kpis = useMemo(() => {
    const totalProperties = properties.length;
    const totalRoomsCount = properties.reduce(
      (acc, p) => acc + Number(p.totalCuartos || 1),
      0,
    );
    const totalBruto = liquidaciones.reduce(
      (acc, l) => acc + Number(l.monto_bruto || 0),
      0,
    );
    const totalNeto = liquidaciones.reduce(
      (acc, l) => acc + Number(l.monto_neto_pagar || 0),
      0,
    );
    const ratedProps = properties.filter((p) => Number(p.calificacionPromedio) > 0);
    const avgRating =
      ratedProps.length > 0
        ? ratedProps.reduce((acc, p) => acc + Number(p.calificacionPromedio), 0) /
          ratedProps.length
        : 4.9;

    return {
      totalProperties,
      totalRoomsCount,
      totalOrders: liquidaciones.length,
      totalBruto,
      totalNeto,
      avgRating,
    };
  }, [properties, liquidaciones]);

  // Wizard Step 1 Submit (`CrearAlojamientoDto`)
  const handleStep1CreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingStep(true);
    try {
      const { data } = await httpClient.post<{
        mensaje: string;
        alojamiento: { alojamientoId: number };
      }>('/admin/alojamientos', {
        ciudadId: Number(ciudadId),
        tipoId: Number(tipoId),
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        direccion: direccion.trim() || 'Sector Turístico Principal',
        precioBaseNoche: Number(precioBaseNoche),
        maxAdultos: Number(maxAdultos),
        habitaciones: Number(totalCuartos),
      });

      const newId = Number(data.alojamiento.alojamientoId);
      setCreatedAlojamientoId(newId);
      notify(
        'success',
        'Paso 1 completado',
        `Alojamiento #${newId} creado con éxito. Configura ahora fotos, facilidades y reglas.`,
      );
      setWizardStep(2);
      await loadDashboardData();
    } catch (err: unknown) {
      notify('error', 'Error al crear alojamiento', extractErrorMessage(err));
    } finally {
      setSubmittingStep(false);
    }
  };

  // Wizard Step 2 Submit (`CrearFotoDto`, `AsignarFacilidadesDto`, `AsignarReglasDto`)
  const handleStep2SaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdAlojamientoId) return;
    setSubmittingStep(true);
    try {
      if (fotoUrlPortada.trim()) {
        await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/fotos`, {
          urlImagen: fotoUrlPortada.trim(),
          esPortada: true,
          orden: 1,
        });
      }

      if (selectedFacilidades.length > 0) {
        await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/facilidades`, {
          facilidadIds: selectedFacilidades,
        });
      }

      if (selectedReglas.length > 0) {
        await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/reglas`, {
          reglaIds: selectedReglas,
        });
      }

      notify(
        'success',
        'Paso 2 completado',
        'Fotos, facilidades ecológicas y reglas vinculadas con éxito.',
      );
      setWizardStep(3);
    } catch (err: unknown) {
      notify('error', 'Error en el Paso 2', extractErrorMessage(err));
    } finally {
      setSubmittingStep(false);
    }
  };

  // Wizard Step 3: Add Room Product (`CrearProductoHabitacionDto`)
  const handleAddRoomProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdAlojamientoId) return;
    setSubmittingStep(true);
    try {
      const generatedProdId = `PROD-${createdAlojamientoId}-${Date.now().toString().slice(-4)}`;
      await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/productos`, {
        productoId: generatedProdId,
        planId: Number(planAlimenticioId),
        nombreProducto: nombreProducto.trim(),
        capacidadAdultos: Number(capAdultosHab),
        capacidadNinos: Number(capNinosHab),
        cantidadCuartosInventario: Number(stockTotalHab),
        precioBaseNoche: Number(precioHabUsd),
        activo: true,
      });

      setAddedProducts((prev) => [
        ...prev,
        {
          codigo: generatedProdId,
          nombre: nombreProducto.trim(),
          stock: Number(stockTotalHab),
          precio: Number(precioHabUsd),
        },
      ]);

      notify(
        'success',
        'Habitación agregada al inventario',
        `Se registraron ${stockTotalHab} unidad(es) de "${nombreProducto}" (${generatedProdId}).`,
      );
    } catch (err: unknown) {
      notify('error', 'Error al registrar habitación', extractErrorMessage(err));
    } finally {
      setSubmittingStep(false);
    }
  };

  // Wizard Step 4: Save 5FN Contract (`Contratos5FNDto`) & Finish
  const handleStep4Save5FN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdAlojamientoId) return;
    setSubmittingStep(true);
    try {
      await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/contratos-5fn`, {
        canalIds: [Number(selectedCanalId)],
        politicaIds: [Number(selectedPoliticaId)],
      });

      notify(
        'success',
        '¡Alojamiento Publicado al 100%!',
        'El contrato 5FN se vinculó y tu alojamiento ya está disponible en el Marketplace.',
      );
      await loadDashboardData();
      setActiveTab('properties');
      navigate('/admin');
    } catch (err: unknown) {
      notify('error', 'Error vinculando contrato 5FN', extractErrorMessage(err));
    } finally {
      setSubmittingStep(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <span className="chip-gold mb-2">
            <Building2 className="h-3.5 w-3.5" />
            Consola de Gestión Hotelera & Eco-Lodges (Rol: ADMIN)
          </span>
          <h1 className="font-serif text-3xl font-bold text-brand-text">
            Panel del Anfitrión — Estilo Lodgify
          </h1>
          <p className="mt-1 text-xs text-brand-text/65">
            Controla tus propiedades, habitaciones con stock numérico, políticas 5FN y liquidaciones
            automáticas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreatedAlojamientoId(null);
            setWizardStep(1);
            setAddedProducts([]);
            setActiveTab('wizard');
          }}
          className="btn-primary self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          Publicar Nuevo Alojamiento
        </button>
      </div>

      {/* TOP KPI CARDS + RATING BARS (05-host-dashboard mold) */}
      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text/60">
              Mis Alojamientos
            </span>
            <Building2 className="h-5 w-5 text-brand-accent" />
          </div>
          <p className="mt-3 font-serif text-3xl font-bold text-brand-text">
            {kpis.totalProperties}
          </p>
          <p className="mt-1 text-xs text-brand-secondary font-medium">
            {kpis.totalRoomsCount} habitación(es) totales en stock
          </p>
        </div>

        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text/60">
              Reservas Liquidadas
            </span>
            <Receipt className="h-5 w-5 text-brand-accent" />
          </div>
          <p className="mt-3 font-serif text-3xl font-bold text-brand-text">{kpis.totalOrders}</p>
          <p className="mt-1 text-xs text-brand-text/65">
            Volumen bruto: ${kpis.totalBruto.toFixed(2)} USD
          </p>
        </div>

        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text/60">
              Ingresos Netos Anfitrión
            </span>
            <DollarSign className="h-5 w-5 text-brand-secondary" />
          </div>
          <p className="mt-3 font-serif text-3xl font-bold text-brand-secondary">
            ${kpis.totalNeto.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-brand-text/65">
            Liquidación automática verificada en libro mayor
          </p>
        </div>

        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text/60">
              Reputación Multicriterio
            </span>
            <Star className="h-5 w-5 fill-brand-primary text-brand-primary" />
          </div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <div>
              <div className="flex justify-between font-semibold">
                <span>Limpieza & Confort</span>
                <span>{kpis.avgRating.toFixed(1)}/5</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-brand-border">
                <div className="h-full rounded-full bg-brand-primary w-[95%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-semibold">
                <span>Sostenibilidad Eco</span>
                <span>5.0/5</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-brand-border">
                <div className="h-full rounded-full bg-brand-secondary w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-brand-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('properties')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'properties'
              ? 'bg-brand-text text-white shadow-sm'
              : 'bg-brand-surface text-brand-text/75 border border-brand-border hover:border-brand-accent'
          }`}
        >
          1. Mis Alojamientos e Inventario ({properties.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wizard')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'wizard'
              ? 'bg-brand-primary text-brand-text shadow-sm'
              : 'bg-brand-surface text-brand-text/75 border border-brand-border hover:border-brand-accent'
          }`}
        >
          2. Wizard de Creación en 4 Pasos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settlements')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'settlements'
              ? 'bg-brand-secondary text-white shadow-sm'
              : 'bg-brand-surface text-brand-text/75 border border-brand-border hover:border-brand-accent'
          }`}
        >
          3. Liquidaciones Financieras ({liquidaciones.length})
        </button>
      </div>

      {/* TAB 1: HOST PROPERTIES TABLE */}
      {activeTab === 'properties' && (
        <div className="mt-6">
          {loading ? (
            <div className="card-surface p-8 text-center text-xs text-brand-text/60">
              Cargando propiedades del anfitrión...
            </div>
          ) : properties.length === 0 ? (
            <div className="card-surface p-12 text-center max-w-xl mx-auto">
              <Building2 className="mx-auto h-10 w-10 text-brand-accent" />
              <h3 className="mt-3 font-serif text-xl font-bold text-brand-text">
                Aún no has publicado alojamientos
              </h3>
              <p className="mt-1 text-xs text-brand-text/70">
                Usa el Wizard guiado de 4 pasos para registrar tu primer Hotel, Hostal o Eco-Lodge
                con habitaciones y contratos 5FN.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('wizard')}
                className="btn-primary mt-5"
              >
                <PlusCircle className="h-4 w-4" />
                Iniciar Wizard de 4 Pasos
              </button>
            </div>
          ) : (
            <div className="card-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-brand-bg border-b border-brand-border text-[11px] font-bold uppercase text-brand-text/70">
                    <tr>
                      <th className="px-4 py-3.5">ID / Alojamiento</th>
                      <th className="px-4 py-3.5">Tipología / Ciudad</th>
                      <th className="px-4 py-3.5">Tarifa Base</th>
                      <th className="px-4 py-3.5">Stock Habitaciones</th>
                      <th className="px-4 py-3.5">Estado</th>
                      <th className="px-4 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {properties.map((p) => (
                      <tr key={p.alojamientoId} className="hover:bg-brand-bg/50">
                        <td className="px-4 py-3.5 font-semibold text-brand-text">
                          #{p.alojamientoId} — {p.titulo}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="chip-gold text-[10px] mr-1.5">{p.tipo}</span>
                          <span className="text-brand-text/75">{p.ciudad}</span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-brand-text">
                          ${Number(p.precioBaseNoche).toFixed(2)} USD
                        </td>
                        <td className="px-4 py-3.5 text-brand-text/80">
                          {p.totalCuartos} unidad(es) en inventario
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="chip-sage text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            {p.estadoOperativo || 'PUBLICADO'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCreatedAlojamientoId(Number(p.alojamientoId));
                              setWizardStep(3);
                              setActiveTab('wizard');
                            }}
                            className="btn-secondary py-1.5 px-2.5 text-[11px]"
                          >
                            <BedDouble className="h-3.5 w-3.5 text-brand-accent" />
                            + Habitación / Stock
                          </button>
                          <Link
                            to={`/alojamientos/${p.alojamientoId}`}
                            className="btn-secondary py-1.5 px-2.5 text-[11px]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 4-STEP ACCOMMODATION WIZARD */}
      {activeTab === 'wizard' && (
        <div className="mt-6 card-surface p-6 sm:p-8">
          {/* Step Indicator */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 border-b border-brand-border pb-6">
            {[
              { step: 1, title: '1. Datos y PostGIS', icon: Building2 },
              { step: 2, title: '2. Fotos, Eco y Reglas', icon: ImageIcon },
              { step: 3, title: '3. Habitaciones y Stock', icon: BedDouble },
              { step: 4, title: '4. Contratos 5FN', icon: FileCheck2 },
            ].map((s) => {
              const IconComp = s.icon;
              const isCurrent = wizardStep === s.step;
              const isDone = wizardStep > s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  disabled={!createdAlojamientoId && s.step > 1}
                  onClick={() => setWizardStep(s.step)}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left text-xs font-bold transition-all ${
                    isCurrent
                      ? 'border-brand-accent bg-brand-primary/25 text-brand-text shadow-sm'
                      : isDone
                      ? 'border-brand-secondary/40 bg-brand-secondary/10 text-brand-secondary'
                      : 'border-brand-border bg-brand-bg text-brand-text/50'
                  }`}
                >
                  <IconComp className="h-4 w-4 shrink-0" />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>

          {createdAlojamientoId && (
            <div className="mt-4 rounded-xl bg-brand-secondary/15 border border-brand-secondary/30 px-4 py-2.5 text-xs font-semibold text-brand-secondary flex items-center justify-between">
              <span>Configurando Alojamiento Activo ID: #{createdAlojamientoId}</span>
              <Link
                to={`/alojamientos/${createdAlojamientoId}`}
                className="underline font-bold"
              >
                Ver vista previa en Marketplace →
              </Link>
            </div>
          )}

          {/* STEP 1: CREATE PROPERTY */}
          {wizardStep === 1 && (
            <form onSubmit={handleStep1CreateProperty} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Título Comercial del Alojamiento (mínimo 5 caracteres) *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej. Mindo CloudForest Eco-Lodge & Spa"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Tipología Oficial *
                  </label>
                  <select
                    value={tipoId}
                    onChange={(e) => setTipoId(Number(e.target.value))}
                    className="input-field"
                  >
                    {tipos.map((t) => (
                      <option key={t.tipo_id} value={t.tipo_id}>
                        {t.nombre} ({t.codigo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Descripción Detallada *
                </label>
                <textarea
                  rows={3}
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Describe la experiencia ecológica, vistas, servicios incluidos y entorno natural..."
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Ciudad (Georreferenciación PostGIS automática) *
                  </label>
                  <select
                    value={ciudadId}
                    onChange={(e) => setCiudadId(Number(e.target.value))}
                    className="input-field"
                  >
                    {ciudades.map((c) => (
                      <option key={c.ciudad_id} value={c.ciudad_id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Dirección Física *
                  </label>
                  <input
                    type="text"
                    required
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Km 4 Vía a las Cascadas"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Precio Base Noche (USD) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={precioBaseNoche}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPrecioBaseNoche(val);
                      setPrecioHabUsd(val);
                    }}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Capacidad Máx. Adultos *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={maxAdultos}
                    onChange={(e) => setMaxAdultos(Number(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Stock Inicial de Habitaciones *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalCuartos}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTotalCuartos(val);
                      setStockTotalHab(val);
                    }}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-brand-border">
                <button type="submit" disabled={submittingStep} className="btn-primary">
                  {submittingStep ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando Alojamiento...
                    </>
                  ) : (
                    <>
                      Guardar y Continuar al Paso 2
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: PHOTOS, FACILITIES & COEXISTENCE RULES */}
          {wizardStep === 2 && (
            <form onSubmit={handleStep2SaveDetails} className="mt-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  URL de Fotografía de Portada *
                </label>
                <input
                  type="url"
                  required
                  value={fotoUrlPortada}
                  onChange={(e) => setFotoUrlPortada(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text mb-2">
                  Selecciona las Facilidades y Sellos Ecológicos (`facilidadIds`)
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {facilidadesCat.map((f) => {
                    const checked = selectedFacilidades.includes(Number(f.facilidad_id));
                    return (
                      <label
                        key={f.facilidad_id}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-brand-secondary bg-brand-secondary/15 font-semibold'
                            : 'border-brand-border bg-brand-bg'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedFacilidades((prev) =>
                              checked
                                ? prev.filter((id) => id !== Number(f.facilidad_id))
                                : [...prev, Number(f.facilidad_id)],
                            )
                          }
                        />
                        <Leaf className="h-4 w-4 text-brand-secondary shrink-0" />
                        <span>{f.nombre}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text mb-2">
                  Selecciona las Reglas de Convivencia (`reglaIds`)
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {reglasCat.map((r) => {
                    const checked = selectedReglas.includes(Number(r.regla_id));
                    return (
                      <label
                        key={r.regla_id}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-brand-accent bg-brand-primary/20 font-semibold'
                            : 'border-brand-border bg-brand-bg'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedReglas((prev) =>
                              checked
                                ? prev.filter((id) => id !== Number(r.regla_id))
                                : [...prev, Number(r.regla_id)],
                            )
                          }
                        />
                        <span>{r.descripcion}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-brand-border">
                <button type="submit" disabled={submittingStep} className="btn-primary">
                  {submittingStep ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      Guardar y Pasar a Habitaciones (Paso 3)
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: ROOM PRODUCTS & NUMERIC STOCK CONTROL */}
          {wizardStep === 3 && (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-brand-primary/50 bg-brand-primary/15 p-4 text-xs">
                <p className="font-bold text-brand-text flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand-accent" />
                  Control de Stock Numérico por Tipología de Habitación
                </p>
                <p className="mt-1 text-brand-text/75">
                  En Hoteles y Hostales puedes definir cuántas unidades (`cantidadCuartosInventario`)
                  existen de cada tipo de habitación. Cuando un cliente reserva $N$ habitaciones, el
                  stock disponible se descuenta automáticamente para las fechas seleccionadas.
                </p>
              </div>

              <form onSubmit={handleAddRoomProduct} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Nombre de la Habitación / Unidad *
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreProducto}
                      onChange={(e) => setNombreProducto(e.target.value)}
                      placeholder="Ej. Habitación Doble Vista al Bosque"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Plan Alimenticio *
                    </label>
                    <select
                      value={planAlimenticioId}
                      onChange={(e) => setPlanAlimenticioId(Number(e.target.value))}
                      className="input-field"
                    >
                      {planesCat.map((pl) => (
                        <option key={pl.plan_id} value={pl.plan_id}>
                          {pl.nombre} ({pl.codigo_meal_plan})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Stock Numérico de Habitaciones *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={stockTotalHab}
                      onChange={(e) => setStockTotalHab(Number(e.target.value))}
                      className="input-field font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Capacidad Adultos *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={capAdultosHab}
                      onChange={(e) => setCapAdultosHab(Number(e.target.value))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Capacidad Niños
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={capNinosHab}
                      onChange={(e) => setCapNinosHab(Number(e.target.value))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Tarifa por Noche (USD) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      required
                      value={precioHabUsd}
                      onChange={(e) => setPrecioHabUsd(Number(e.target.value))}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-brand-border">
                  <button type="submit" disabled={submittingStep} className="btn-secondary">
                    <PlusCircle className="h-4 w-4 text-brand-accent" />
                    Agregar Habitación al Alojamiento
                  </button>

                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="btn-primary"
                  >
                    Continuar al Paso 4 (Contratos 5FN)
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>

              {addedProducts.length > 0 && (
                <div className="rounded-xl border border-brand-border bg-brand-bg p-4 text-xs">
                  <span className="font-bold text-brand-text block mb-2">
                    Habitaciones añadidas en esta sesión:
                  </span>
                  <ul className="space-y-1">
                    {addedProducts.map((ap, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          {ap.nombre} (<code className="font-mono">{ap.codigo}</code>)
                        </span>
                        <span className="font-semibold text-brand-accent">
                          Stock: {ap.stock} hab. • ${ap.precio.toFixed(2)} USD
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: 5FN CONTRACTS */}
          {wizardStep === 4 && (
            <form onSubmit={handleStep4Save5FN} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Canal de Integración (`canalIds`)
                  </label>
                  <select
                    value={selectedCanalId}
                    onChange={(e) => setSelectedCanalId(Number(e.target.value))}
                    className="input-field"
                  >
                    <option value={1}>#1 WEB_REST (Marketplace Oficial)</option>
                    <option value={2}>#2 OTA_GRAPHQL (Canal Partner)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Política de Cancelación (`politicaIds`)
                  </label>
                  <select
                    value={selectedPoliticaId}
                    onChange={(e) => setSelectedPoliticaId(Number(e.target.value))}
                    className="input-field"
                  >
                    <option value={1}>#1 FREE_CANCELLATION (100% reembolsable)</option>
                    <option value={2}>#2 PARTIAL_REFUND (50% reembolsable)</option>
                    <option value={3}>#3 NON_REFUNDABLE (Tarifa promocional)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-brand-border">
                <button type="submit" disabled={submittingStep} className="btn-primary">
                  {submittingStep ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Vinculando Contrato 5FN...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Finalizar y Publicar en Marketplace
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: FINANCIAL SETTLEMENTS TABLE */}
      {activeTab === 'settlements' && (
        <div className="mt-6 card-surface overflow-hidden">
          <div className="p-5 border-b border-brand-border flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-brand-text">
                Libro Mayor de Liquidaciones a Anfitriones (`liquidaciones_anfitrion`)
              </h3>
              <p className="text-xs text-brand-text/65">
                Desglose transparente de ingresos brutos, comisión de plataforma y monto neto a
                pagar.
              </p>
            </div>
          </div>

          {liquidaciones.length === 0 ? (
            <div className="p-10 text-center text-xs text-brand-text/60">
              Aún no se registran liquidaciones financieras completadas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bg border-b border-brand-border text-[11px] font-bold uppercase text-brand-text/70">
                  <tr>
                    <th className="px-4 py-3">Liquidación / PNR</th>
                    <th className="px-4 py-3">Alojamiento</th>
                    <th className="px-4 py-3">Monto Bruto</th>
                    <th className="px-4 py-3">Comisión Plataforma</th>
                    <th className="px-4 py-3">Neto Anfitrión</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {liquidaciones.map((l) => (
                    <tr key={l.liquidacion_id} className="hover:bg-brand-bg/50">
                      <td className="px-4 py-3 font-mono font-bold text-brand-text">
                        #{l.liquidacion_id} • {l.orden_localizador}
                      </td>
                      <td className="px-4 py-3 font-medium">{l.alojamiento_titulo}</td>
                      <td className="px-4 py-3">${Number(l.monto_bruto).toFixed(2)} USD</td>
                      <td className="px-4 py-3 text-brand-accent">
                        -${Number(l.comision_plataforma).toFixed(2)} USD
                      </td>
                      <td className="px-4 py-3 font-bold text-brand-secondary">
                        ${Number(l.monto_neto_pagar).toFixed(2)} USD
                      </td>
                      <td className="px-4 py-3">
                        <span className="chip-sage text-[10px]">{l.estado_liquidacion}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
