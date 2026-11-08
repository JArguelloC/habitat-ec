import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  PlusCircle,
  DollarSign,
  Star,
  BedDouble,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Image as ImageIcon,
  Leaf,
  FileCheck2,
  ArrowRight,
  Loader2,
  Eye,
  Receipt,
  Sparkles,
  Pencil,
  Pause,
  Play,
  Trash2,
  AlertTriangle,
  X,
  UploadCloud,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { InputControl, TextAreaControl, SelectControl } from '../components/common/FormField';
import { focusFirstInvalidInput } from '../utils/inputFilters';
import { formatTimeForPayload } from '../utils/timeUtils';

interface HostPropertyItem {
  alojamientoId: number;
  titulo: string;
  descripcion: string;
  direccion: string;
  ciudadId?: number;
  tipoId?: number;
  latitud?: number;
  longitud?: number;
  marcaId?: number;
  estadoOperativo: string;
  calificacionPromedio: number;
  totalResenas: number;
  horaCheckin?: string;
  horaCheckout?: string;
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

  // Reglas deduplicadas para evitar redundancias de fauna/silencio y plásticos
  const reglasCatDeduplicadas = React.useMemo(() => {
    const result: ReglaOpt[] = [];
    let hasSilencio = false;
    let hasPlastico = false;

    for (const r of reglasCat) {
      const descLower = (r.descripcion || '').toLowerCase();
      const isSilencio = descLower.includes('silencio') || (r.codigo || '').includes('SILENCIO');
      const isPlastico =
        descLower.includes('plástico') ||
        descLower.includes('plastico') ||
        (r.codigo || '').includes('PLASTICO');

      if (isSilencio) {
        if (!hasSilencio) {
          hasSilencio = true;
          result.push(r);
        }
      } else if (isPlastico) {
        if (!hasPlastico) {
          hasPlastico = true;
          result.push(r);
        }
      } else {
        result.push(r);
      }
    }
    return result;
  }, [reglasCat]);

  // Wizard Step State (1..4)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [createdAlojamientoId, setCreatedAlojamientoId] = useState<number | null>(null);
  const [submittingStep, setSubmittingStep] = useState<boolean>(false);

  // Step 1 Fields (Información General)
  const [ciudadId, setCiudadId] = useState<number | ''>('');
  const [tipoId, setTipoId] = useState<number>(1);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [horaCheckin, setHoraCheckin] = useState<string>('14:00');
  const [horaCheckout, setHoraCheckout] = useState<string>('11:00');

  // Step 2 Fields (Photos, Facilities, Rules)
  const [fotoUrlPortada, setFotoUrlPortada] = useState(
    'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80',
  );
  const [selectedFacilidades, setSelectedFacilidades] = useState<number[]>([]);
  const [selectedReglas, setSelectedReglas] = useState<number[]>([]);

  // Step 3 Fields (Habitaciones / Productos con Stock Controlado)
  const [nombreProducto, setNombreProducto] = useState('Suite Bosque Nublado');
  const [planAlimenticioId, setPlanAlimenticioId] = useState<number>(1);
  const [capAdultosHab, setCapAdultosHab] = useState<string>('2');
  const [capNinosHab, setCapNinosHab] = useState<string>('1');
  const [stockTotalHab, setStockTotalHab] = useState<string>('4');
  const [precioHabUsd, setPrecioHabUsd] = useState<string>('95');
  const [addedProducts, setAddedProducts] = useState<
    Array<{ codigo: string; nombre: string; stock: number; precio: number }>
  >([]);

  // Step 4 Fields (Contratos 5FN)
  const [selectedCanalId, setSelectedCanalId] = useState<number>(1);
  const [selectedPoliticaId, setSelectedPoliticaId] = useState<number>(1);

  // Estados para CRUD: Edición de Alojamiento
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<HostPropertyItem | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editCiudadId, setEditCiudadId] = useState<number>(1);
  const [editTipoId, setEditTipoId] = useState<number>(1);
  const [editPrecioBaseNoche, setEditPrecioBaseNoche] = useState<number>(95);
  const [editEstadoOperativo, setEditEstadoOperativo] = useState<string>('PUBLICADO');
  const [editHoraCheckin, setEditHoraCheckin] = useState<string>('14:00');
  const [editHoraCheckout, setEditHoraCheckout] = useState<string>('11:00');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Estados para CRUD: Confirmación de Pausa / Eliminación
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'PAUSE' | 'ACTIVATE' | 'DELETE' | 'HARD_DELETE';
    property: HostPropertyItem;
  } | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Validaciones en tiempo real para el formulario de edición
  const isEditTituloValid = editTitulo.trim().length >= 5 && editTitulo.trim().length <= 100;
  const isEditDescripcionValid =
    editDescripcion.trim().length >= 15 && editDescripcion.trim().length <= 1000;
  const isEditDireccionValid =
    editDireccion.trim().length >= 5 && editDireccion.trim().length <= 120;
  const isEditPrecioValid =
    Number(editPrecioBaseNoche) > 0 && Number(editPrecioBaseNoche) <= 10000;

  const isEditFormValid =
    isEditTituloValid && isEditDescripcionValid && isEditDireccionValid && isEditPrecioValid;

  // Apertura del modal de edición con prefill de datos
  const handleOpenEdit = (property: HostPropertyItem) => {
    setEditingProperty(property);
    setEditTitulo(property.titulo || '');
    setEditDescripcion(property.descripcion || '');
    setEditDireccion(property.direccion || '');
    setEditPrecioBaseNoche(Number(property.precioBaseNoche || 95));
    setEditEstadoOperativo(property.estadoOperativo || 'PUBLICADO');
    setEditHoraCheckin(property.horaCheckin || '14:00');
    setEditHoraCheckout(property.horaCheckout || '11:00');

    // Mapear ciudadId
    if (property.ciudadId) {
      setEditCiudadId(Number(property.ciudadId));
    } else {
      const matchCity = ciudades.find(
        (c) => c.nombre.toLowerCase() === (property.ciudad || '').toLowerCase(),
      );
      if (matchCity) setEditCiudadId(Number(matchCity.ciudad_id));
      else if (ciudades.length > 0) setEditCiudadId(Number(ciudades[0].ciudad_id));
    }

    // Mapear tipoId
    if (property.tipoId) {
      setEditTipoId(Number(property.tipoId));
    } else {
      const matchTipo = tipos.find(
        (t) => t.nombre.toLowerCase() === (property.tipo || '').toLowerCase(),
      );
      if (matchTipo) setEditTipoId(Number(matchTipo.tipo_id));
      else if (tipos.length > 0) setEditTipoId(Number(tipos[0].tipo_id));
    }

    setEditModalOpen(true);
  };

  // Envío del formulario de edición (PATCH)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;

    if (!isEditFormValid) {
      focusFirstInvalidInput();
      return;
    }

    setSubmittingEdit(true);
    try {
      const payload = {
        titulo: editTitulo.trim(),
        descripcion: editDescripcion.trim(),
        direccion: editDireccion.trim(),
        ciudadId: Number(editCiudadId),
        tipoId: Number(editTipoId),
        precioBaseNoche: Number(editPrecioBaseNoche),
        estadoOperativo: editEstadoOperativo,
        horaCheckin: formatTimeForPayload(editHoraCheckin, '14:00'),
        horaCheckout: formatTimeForPayload(editHoraCheckout, '11:00'),
      };

      await httpClient.patch(`/admin/alojamientos/${editingProperty.alojamientoId}`, payload);

      const resolvedCityName =
        ciudades.find((c) => Number(c.ciudad_id) === Number(editCiudadId))?.nombre ||
        editingProperty.ciudad;
      const resolvedTipoName =
        tipos.find((t) => Number(t.tipo_id) === Number(editTipoId))?.nombre ||
        editingProperty.tipo;

      // Actualizar el estado local de React sin recargar la página (Heurística #1)
      setProperties((prev) =>
        prev.map((item) =>
          item.alojamientoId === editingProperty.alojamientoId
            ? {
                ...item,
                titulo: editTitulo.trim(),
                descripcion: editDescripcion.trim(),
                direccion: editDireccion.trim(),
                ciudadId: Number(editCiudadId),
                ciudad: resolvedCityName,
                tipoId: Number(editTipoId),
                tipo: resolvedTipoName,
                precioBaseNoche: Number(editPrecioBaseNoche),
                estadoOperativo: editEstadoOperativo,
              }
            : item,
        ),
      );

      notify('success', 'Alojamiento actualizado', 'Los cambios se guardaron exitosamente.');
      setEditModalOpen(false);
      setEditingProperty(null);
    } catch (err: unknown) {
      notify('error', 'Error al actualizar', extractErrorMessage(err));
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Apertura del modal de confirmación para Pausa o Eliminación
  const handleOpenConfirm = (
    type: 'PAUSE' | 'ACTIVATE' | 'DELETE' | 'HARD_DELETE',
    property: HostPropertyItem,
  ) => {
    setConfirmAction({ type, property });
    setConfirmModalOpen(true);
  };

  // Ejecución de la acción confirmada (PATCH, DELETE o HARD_DELETE)
  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;
    const { type, property } = confirmAction;

    setSubmittingAction(true);
    try {
      if (type === 'HARD_DELETE') {
        const { data } = await httpClient.delete<{ mensaje: string }>(
          `/admin/alojamientos/${property.alojamientoId}/force`,
        );
        setProperties((prev) =>
          prev.filter((item) => item.alojamientoId !== property.alojamientoId),
        );
        notify(
          'success',
          'Alojamiento eliminado definitivamente',
          data?.mensaje ||
            `Se ha eliminado permanentemente "${property.titulo}" de la base de datos.`,
        );
      } else if (type === 'DELETE') {
        await httpClient.delete(`/admin/alojamientos/${property.alojamientoId}`);
        setProperties((prev) =>
          prev.map((item) =>
            item.alojamientoId === property.alojamientoId
              ? { ...item, estadoOperativo: 'INACTIVO' }
              : item,
          ),
        );
        notify(
          'success',
          'Alojamiento dado de baja',
          'El alojamiento ha sido marcado como inactivo (Soft Delete). Se conserva el historial.',
        );
      } else {
        const nextState = type === 'ACTIVATE' ? 'PUBLICADO' : 'PAUSADO';
        await httpClient.patch(`/admin/alojamientos/${property.alojamientoId}`, {
          estadoOperativo: nextState,
        });
        setProperties((prev) =>
          prev.map((item) =>
            item.alojamientoId === property.alojamientoId
              ? { ...item, estadoOperativo: nextState }
              : item,
          ),
        );
        notify(
          'success',
          type === 'ACTIVATE' ? 'Alojamiento reactivado' : 'Alojamiento pausado',
          type === 'ACTIVATE'
            ? 'El alojamiento vuelve a estar visible en el Marketplace para los viajeros.'
            : 'El alojamiento ha sido pausado y no aparecerá temporalmente en las búsquedas.',
        );
      }
      setConfirmModalOpen(false);
      setConfirmAction(null);
    } catch (err: unknown) {
      const errTitle =
        confirmAction?.type === 'HARD_DELETE'
          ? 'No se puede eliminar'
          : 'Error en la operación';
      notify('error', errTitle, extractErrorMessage(err));
    } finally {
      setSubmittingAction(false);
    }
  };

  // Validaciones en tiempo real para el Wizard (Paso 1: Información General)
  const isTituloValid = titulo.trim().length >= 5 && titulo.trim().length <= 100;
  const isDescripcionValid = descripcion.trim().length >= 15 && descripcion.trim().length <= 500;
  const isDireccionValid = direccion.trim().length >= 5 && direccion.trim().length <= 120;

  const isStep1Valid =
    isTituloValid &&
    isDescripcionValid &&
    isDireccionValid &&
    Boolean(ciudadId) &&
    Boolean(tipoId);

  // Retroalimentación constructiva y límites para Step 3
  const stockTotalHabError = useMemo(() => {
    if (stockTotalHab.trim() === '') return 'El stock de habitaciones no puede estar vacío.';
    const num = Number(stockTotalHab);
    if (isNaN(num) || num === 0) return 'El stock no puede ser 0 unidades.';
    if (num < 1) return 'Debe haber al menos 1 habitación en inventario.';
    if (num > 100) return 'Límite excedido: El stock máximo permitido es de 100 habitaciones.';
    return null;
  }, [stockTotalHab]);

  const stockTotalHabSuccess = useMemo(() => {
    if (stockTotalHab.trim() === '') return null;
    const num = Number(stockTotalHab);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      return `Stock válido: ${num} habitación${num > 1 ? 'es' : ''}.`;
    }
    return null;
  }, [stockTotalHab]);

  const capAdultosHabError = useMemo(() => {
    if (capAdultosHab.trim() === '') return 'La capacidad de adultos no puede estar vacía.';
    const num = Number(capAdultosHab);
    if (isNaN(num) || num === 0) return 'La capacidad no puede ser 0. Debe ser al menos 1 adulto.';
    if (num < 1) return 'Debe registrar al menos 1 adulto.';
    if (num > 50) return 'Límite excedido: El máximo permitido es de 50 adultos.';
    return null;
  }, [capAdultosHab]);

  const capAdultosHabSuccess = useMemo(() => {
    if (capAdultosHab.trim() === '') return null;
    const num = Number(capAdultosHab);
    if (!isNaN(num) && num >= 1 && num <= 50) {
      return `Capacidad válida: ${num} adulto${num > 1 ? 's' : ''}.`;
    }
    return null;
  }, [capAdultosHab]);

  const capNinosHabError = useMemo(() => {
    if (capNinosHab.trim() === '') return 'Ingresa 0 o la cantidad de niños admitidos.';
    const num = Number(capNinosHab);
    if (isNaN(num) || num < 0) return 'La capacidad de niños no puede ser negativa.';
    if (num > 50) return 'Límite excedido: El máximo permitido es de 50 niños.';
    return null;
  }, [capNinosHab]);

  const capNinosHabSuccess = useMemo(() => {
    if (capNinosHab.trim() === '') return null;
    const num = Number(capNinosHab);
    if (!isNaN(num) && num >= 0 && num <= 50) {
      return num === 0 ? 'Sin cupo para niños.' : `Capacidad: ${num} niño${num > 1 ? 's' : ''}.`;
    }
    return null;
  }, [capNinosHab]);

  const precioHabUsdError = useMemo(() => {
    if (precioHabUsd.trim() === '') return 'La tarifa por noche no puede estar vacía.';
    const num = Number(precioHabUsd);
    if (isNaN(num) || num <= 0) return 'La tarifa no puede ser $0 USD.';
    if (num > 10000) return 'Límite excedido: La tarifa máxima es de $10,000 USD.';
    return null;
  }, [precioHabUsd]);

  const precioHabUsdSuccess = useMemo(() => {
    if (precioHabUsd.trim() === '') return null;
    const num = Number(precioHabUsd);
    if (!isNaN(num) && num > 0 && num <= 10000) {
      return `Tarifa válida: $${num.toFixed(2)} USD.`;
    }
    return null;
  }, [precioHabUsd]);

  const isNombreProdValid = nombreProducto.trim().length >= 3 && nombreProducto.trim().length <= 80;
  const isStockHabValid = !stockTotalHabError;
  const isCapAdultosValid = !capAdultosHabError;
  const isCapNinosValid = !capNinosHabError;
  const isPrecioHabValid = !precioHabUsdError;

  const isStep3Valid =
    isNombreProdValid &&
    isStockHabValid &&
    isCapAdultosValid &&
    isCapNinosValid &&
    isPrecioHabValid;

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
    if (!isStep1Valid) {
      focusFirstInvalidInput();
      if (!isTituloValid) {
        notify('warning', 'Título inválido', 'El título comercial debe tener entre 5 y 100 caracteres.');
      } else if (!isDescripcionValid) {
        notify('warning', 'Descripción corta', 'La descripción debe tener al menos 15 caracteres.');
      } else if (!isDireccionValid) {
        notify('warning', 'Dirección física requerida', 'Ingresa una dirección válida de entre 5 y 120 caracteres.');
      }
      return;
    }
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
        direccion: direccion.trim(),
        horaCheckin: formatTimeForPayload(horaCheckin, '14:00'),
        horaCheckout: formatTimeForPayload(horaCheckout, '11:00'),
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

  // Carga de respaldo dinámica del Cloudinary Upload Widget
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.cloudinary) {
      const scriptId = 'cloudinary-upload-widget-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://upload-widget.cloudinary.com/global/all.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, []);

  // Apertura del Cloudinary Upload Widget (Unsigned Upload)
  const handleOpenCloudinaryWidget = () => {
    const cloudName =
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'bjcahwd6';
    const uploadPreset =
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'habitat_preset';

    if (!cloudName || !uploadPreset) {
      notify(
        'warning',
        'Configuración de Cloudinary requerida',
        'Define VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en tu archivo frontend/.env.',
      );
      return;
    }

    if (!window.cloudinary) {
      notify(
        'error',
        'Widget no disponible',
        'El componente de subida de Cloudinary aún se está cargando. Intenta de nuevo en unos segundos.',
      );
      return;
    }

    const myWidget = window.cloudinary.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        sources: ['local', 'url', 'camera'],
        multiple: false,
        resourceType: 'image',
        folder: 'habitat-ec/alojamientos',
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp', 'avif'],
        maxFileSize: 10485760, // 10MB
        language: 'es',
        text: {
          es: {
            or: 'O',
            back: 'Atrás',
            menu: {
              files: 'Mis Archivos',
              web: 'Dirección Web',
              camera: 'Cámara',
            },
            local: {
              browse: 'Explorar archivo',
              dd_title_single: 'Arrastra y suelta tu fotografía aquí',
            },
          },
        },
      },
      (error: unknown, result: { event: string; info?: { secure_url?: string } }) => {
        if (!error && result && result.event === 'success' && result.info?.secure_url) {
          setFotoUrlPortada(result.info.secure_url);
          notify(
            'success',
            'Fotografía cargada',
            'La imagen de portada se ha subido con éxito a Cloudinary.',
          );
        }
      },
    );

    myWidget.open();
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
    if (!isStep3Valid) {
      focusFirstInvalidInput();
      if (!isNombreProdValid) {
        notify('warning', 'Nombre de habitación inválido', 'Debe tener entre 3 y 80 caracteres.');
      } else if (!isPrecioHabValid) {
        notify('warning', 'Tarifa por noche inválida', 'La tarifa debe ser mayor a 0 y hasta $10,000 USD.');
      }
      return;
    }
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
            setCiudadId('');
            setTitulo('');
            setDescripcion('');
            setDireccion('');
            setStockTotalHab('4');
            setCapAdultosHab('2');
            setCapNinosHab('1');
            setPrecioHabUsd('95');
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
            Volumen bruto: ${Number(kpis.totalBruto || 0).toFixed(2)} USD
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
            ${Number(kpis.totalNeto || 0).toFixed(2)}
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
                <span>{Number(kpis.avgRating || 0).toFixed(1)}/5</span>
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
              ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
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
              ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
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
              ? 'bg-brand-secondary text-brand-bg font-bold shadow-sm'
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
                onClick={() => {
                  setCreatedAlojamientoId(null);
                  setWizardStep(1);
                  setAddedProducts([]);
                  setCiudadId('');
                  setTitulo('');
                  setDescripcion('');
                  setDireccion('');
                  setStockTotalHab('4');
                  setCapAdultosHab('2');
                  setCapNinosHab('1');
                  setPrecioHabUsd('95');
                  setActiveTab('wizard');
                }}
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
                    {properties.map((p, index) => (
                      <tr key={p.alojamientoId} className="hover:bg-brand-bg/50">
                        <td className="px-4 py-3.5 font-semibold text-brand-text">
                          #{index + 1} — {p.titulo}
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
                          {p.estadoOperativo === 'PAUSADO' ? (
                            <span className="chip-gold text-[10px]">
                              <PauseCircle className="h-3 w-3" />
                              PAUSADO
                            </span>
                          ) : p.estadoOperativo === 'INACTIVO' || p.estadoOperativo === 'BAJA' ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                              <XCircle className="h-3 w-3" />
                              INACTIVO
                            </span>
                          ) : (
                            <span className="chip-sage text-[10px]">
                              <CheckCircle2 className="h-3 w-3" />
                              PUBLICADO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setCreatedAlojamientoId(Number(p.alojamientoId));
                                setWizardStep(3);
                                setActiveTab('wizard');
                              }}
                              className="btn-secondary py-1.5 px-2.5 text-[11px]"
                              title="Gestionar habitaciones y cupos"
                            >
                              <BedDouble className="h-3.5 w-3.5 text-brand-accent" />
                              + Habitación
                            </button>
                            <Link
                              to={`/alojamientos/${p.alojamientoId}`}
                              className="btn-secondary py-1.5 px-2.5 text-[11px]"
                              title="Ver ficha pública del alojamiento"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="btn-secondary py-1.5 px-2.5 text-[11px] hover:border-brand-accent hover:text-brand-accent"
                              title="Editar datos del alojamiento"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            {p.estadoOperativo === 'PUBLICADO' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirm('DELETE', p)}
                                className="btn-secondary py-1.5 px-2.5 text-[11px] text-amber-600 dark:text-amber-400 hover:border-amber-500"
                                title="Pausar alojamiento (Soft Delete)"
                              >
                                <Pause className="h-3.5 w-3.5" />
                                Pausar
                              </button>
                            ) : p.estadoOperativo === 'PAUSADO' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirm('ACTIVATE', p)}
                                className="btn-secondary py-1.5 px-2.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:border-emerald-500"
                                title="Reactivar publicación en el marketplace"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Activar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirm('ACTIVATE', p)}
                                className="btn-secondary py-1.5 px-2.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:border-emerald-500"
                                title="Reactivar alojamiento inactivo"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Reactivar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirm('HARD_DELETE', p)}
                              className="btn-secondary py-1.5 px-2.5 text-[11px] text-red-600 dark:text-red-400 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold inline-flex items-center gap-1"
                              title="Eliminar definitivamente de la base de datos (Hard Delete)"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600 shrink-0" />
                              Eliminar
                            </button>
                          </div>
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
              { step: 1, title: '1. Información General', icon: Building2 },
              { step: 2, title: '2. Fotos, Eco y Reglas', icon: ImageIcon },
              { step: 3, title: '3. Habitaciones y Stock', icon: BedDouble },
              { step: 4, title: '4. Políticas y Acuerdos', icon: FileCheck2 },
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
            <form onSubmit={handleStep1CreateProperty} className="mt-6 space-y-5" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InputControl
                  label="Título Comercial del Alojamiento *"
                  required
                  filterType="alphanumeric"
                  allowedSymbols=" .,#-_/()'"
                  maxLength={100}
                  value={titulo}
                  onValueChange={setTitulo}
                  placeholder="Ej. Mindo CloudForest Eco-Lodge & Spa"
                  wrapperClassName="sm:col-span-2"
                  error={titulo.length > 0 && !isTituloValid ? 'El título comercial debe tener entre 5 y 100 caracteres.' : null}
                  success={isTituloValid ? 'Título comercial válido.' : null}
                />
                <SelectControl
                  label="Tipología Oficial *"
                  required
                  value={tipoId}
                  onChange={(e) => setTipoId(Number(e.target.value))}
                >
                  {tipos.map((t) => (
                    <option key={t.tipo_id} value={t.tipo_id}>
                      {t.nombre} ({t.codigo})
                    </option>
                  ))}
                </SelectControl>
              </div>

              <TextAreaControl
                label="Descripción Detallada *"
                required
                rows={3}
                maxLength={500}
                value={descripcion}
                onValueChange={setDescripcion}
                placeholder="Describe la experiencia ecológica, vistas, servicios incluidos y entorno natural..."
                error={descripcion.length > 0 && !isDescripcionValid ? 'La descripción debe tener entre 15 y 500 caracteres.' : null}
                success={isDescripcionValid ? 'Descripción detallada válida.' : null}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectControl
                  label="Ciudad / Destino *"
                  required
                  value={ciudadId}
                  onChange={(e) => setCiudadId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="" disabled>
                    Seleccione una ciudad
                  </option>
                  {ciudades.map((c) => (
                    <option key={c.ciudad_id} value={c.ciudad_id}>
                      {c.nombre}
                    </option>
                  ))}
                </SelectControl>

                <InputControl
                  label="Dirección Física *"
                  required
                  filterType="alphanumeric"
                  allowedSymbols=" .,#-_/"
                  maxLength={120}
                  value={direccion}
                  onValueChange={setDireccion}
                  placeholder="Ej: Km 4 vía a las Cascadas"
                  error={direccion.length > 0 && !isDireccionValid ? 'La dirección debe tener entre 5 y 120 caracteres.' : null}
                  success={isDireccionValid ? 'Dirección válida.' : null}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-text">
                    Hora de Check-in (Entrada) *
                  </label>
                  <input
                    type="time"
                    required
                    value={horaCheckin}
                    onChange={(e) => setHoraCheckin(e.target.value)}
                    className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-text focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-stone-800"
                  />
                  <p className="text-[11px] text-brand-muted">
                    Hora oficial de ingreso del huésped (ej. 14:00).
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-text">
                    Hora de Check-out (Salida) *
                  </label>
                  <input
                    type="time"
                    required
                    value={horaCheckout}
                    onChange={(e) => setHoraCheckout(e.target.value)}
                    className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-text focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-stone-800"
                  />
                  <p className="text-[11px] text-brand-muted">
                    Hora límite para desocupar la habitación (ej. 11:00).
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-brand-border">
                <button
                  type="submit"
                  disabled={submittingStep || !isStep1Valid}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
            <form onSubmit={handleStep2SaveDetails} className="mt-6 space-y-6" noValidate>
              <div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1">
                    <InputControl
                      label="URL de Fotografía de Portada *"
                      required
                      type="url"
                      value={fotoUrlPortada}
                      onValueChange={setFotoUrlPortada}
                      placeholder="https://images.unsplash.com/photo-... o sube un archivo"
                      error={!fotoUrlPortada.trim().startsWith('http') ? 'Ingresa una URL válida o sube una imagen desde tu PC.' : null}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCloudinaryWidget}
                    className="mb-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white text-xs font-semibold rounded-xl hover:bg-brand-primary/90 transition-colors shadow-sm shrink-0 h-[42px] cursor-pointer"
                    title="Subir archivo directamente a Cloudinary"
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>Subir desde PC</span>
                  </button>
                </div>

                {/* Previsualización de la fotografía seleccionada */}
                {fotoUrlPortada.trim().startsWith('http') && (
                  <div className="mt-3 flex items-center gap-3.5 p-3 rounded-xl bg-brand-bg/60 border border-brand-border/80">
                    <img
                      src={fotoUrlPortada}
                      alt="Vista previa de portada"
                      className="w-16 h-16 rounded-lg object-cover border border-brand-border shadow-xs shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="text-xs min-w-0">
                      <p className="font-semibold text-brand-text truncate max-w-xs sm:max-w-md">
                        {fotoUrlPortada}
                      </p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Imagen de portada lista para vincular
                      </p>
                    </div>
                  </div>
                )}
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
                  {reglasCatDeduplicadas.map((r) => {
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
                <button
                  type="submit"
                  disabled={submittingStep || !fotoUrlPortada.trim().startsWith('http')}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
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

              <form onSubmit={handleAddRoomProduct} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <InputControl
                    label="Nombre de la Habitación / Unidad *"
                    required
                    filterType="alphanumeric"
                    allowedSymbols=" .,#-_/()'"
                    maxLength={80}
                    value={nombreProducto}
                    onValueChange={setNombreProducto}
                    placeholder="Ej. Habitación Doble Vista al Bosque"
                    error={nombreProducto.length > 0 && !isNombreProdValid ? 'Nombre de 3 a 80 caracteres.' : null}
                    success={isNombreProdValid ? 'Nombre válido.' : null}
                  />

                  <SelectControl
                    label="Plan Alimenticio *"
                    required
                    value={planAlimenticioId}
                    onChange={(e) => setPlanAlimenticioId(Number(e.target.value))}
                  >
                    {planesCat.map((pl) => (
                      <option key={pl.plan_id} value={pl.plan_id}>
                        {pl.nombre} ({pl.codigo_meal_plan})
                      </option>
                    ))}
                  </SelectControl>

                  <InputControl
                    label="Stock de Habitaciones *"
                    required
                    filterType="numbers"
                    maxLength={3}
                    value={stockTotalHab}
                    onValueChange={setStockTotalHab}
                    placeholder="4"
                    error={stockTotalHabError}
                    success={stockTotalHabSuccess}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <InputControl
                    label="Capacidad Máx. Adultos *"
                    required
                    filterType="numbers"
                    maxLength={2}
                    value={capAdultosHab}
                    onValueChange={setCapAdultosHab}
                    placeholder="2"
                    error={capAdultosHabError}
                    success={capAdultosHabSuccess}
                  />

                  <InputControl
                    label="Capacidad Niños"
                    filterType="numbers"
                    maxLength={2}
                    value={capNinosHab}
                    onValueChange={setCapNinosHab}
                    placeholder="1"
                    error={capNinosHabError}
                    success={capNinosHabSuccess}
                  />

                  <InputControl
                    label="Precio Base Noche (USD) *"
                    required
                    filterType="price"
                    maxLength={8}
                    value={precioHabUsd}
                    onValueChange={setPrecioHabUsd}
                    placeholder="95.00"
                    error={precioHabUsdError}
                    success={precioHabUsdSuccess}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-brand-border">
                  <button
                    type="submit"
                    disabled={submittingStep || !isStep3Valid}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusCircle className="h-4 w-4 text-brand-accent" />
                    Agregar Habitación al Alojamiento
                  </button>

                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="btn-primary"
                  >
                    Continuar al Paso 4 (Políticas y Acuerdos)
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
                          Stock: {ap.stock} hab. • ${Number(ap.precio || 0).toFixed(2)} USD
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
            <form onSubmit={handleStep4Save5FN} className="mt-6 space-y-5" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectControl
                  label="Canal de Integración (`canalIds`)"
                  required
                  value={selectedCanalId}
                  onChange={(e) => setSelectedCanalId(Number(e.target.value))}
                >
                  <option value={1}>#1 WEB_REST (Marketplace Oficial)</option>
                  <option value={2}>#2 OTA_GRAPHQL (Canal Partner)</option>
                </SelectControl>

                <SelectControl
                  label="Política de Cancelación (`politicaIds`)"
                  required
                  value={selectedPoliticaId}
                  onChange={(e) => setSelectedPoliticaId(Number(e.target.value))}
                >
                  <option value={1}>#1 FREE_CANCELLATION (100% reembolsable)</option>
                  <option value={2}>#2 PARTIAL_REFUND (50% reembolsable)</option>
                  <option value={3}>#3 NON_REFUNDABLE (Tarifa promocional)</option>
                </SelectControl>
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

      {/* MODAL RESPONSIVO: EDICIÓN DE ALOJAMIENTO */}
      {editModalOpen && editingProperty && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-property-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-brand-surface border border-brand-border p-6 sm:p-8 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-brand-border pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-brand-primary/10 p-2 text-brand-primary">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="edit-property-title" className="font-serif text-lg font-bold text-brand-text">
                    Editar Alojamiento #{editingProperty.alojamientoId}
                  </h3>
                  <p className="text-xs text-brand-text/60">
                    Modifica los datos comerciales, ubicación y estado operativo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingProperty(null);
                }}
                className="rounded-lg p-1.5 text-brand-text/60 hover:bg-brand-bg hover:text-brand-text transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-6 space-y-4">
              <InputControl
                label="Título del Alojamiento"
                required
                value={editTitulo}
                filterType="alphanumeric"
                maxLength={100}
                onChange={(e) => setEditTitulo(e.target.value)}
                placeholder="Ej. Cabaña Ecológica Mindo Cloudforest"
                error={
                  editTitulo.trim().length > 0 && !isEditTituloValid
                    ? 'El título debe tener entre 5 y 100 caracteres.'
                    : undefined
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectControl
                  label="Ciudad (PostGIS)"
                  required
                  value={editCiudadId}
                  onChange={(e) => setEditCiudadId(Number(e.target.value))}
                >
                  {ciudades.map((c) => (
                    <option key={c.ciudad_id} value={c.ciudad_id}>
                      {c.nombre} (Lat: {Number(c.latitud || 0).toFixed(2)}, Lon: {Number(c.longitud || 0).toFixed(2)})
                    </option>
                  ))}
                </SelectControl>

                <SelectControl
                  label="Tipo de Alojamiento"
                  required
                  value={editTipoId}
                  onChange={(e) => setEditTipoId(Number(e.target.value))}
                >
                  {tipos.map((t) => (
                    <option key={t.tipo_id} value={t.tipo_id}>
                      {t.nombre}
                    </option>
                  ))}
                </SelectControl>
              </div>

              <InputControl
                label="Dirección Física"
                required
                value={editDireccion}
                filterType="alphanumeric"
                maxLength={120}
                onChange={(e) => setEditDireccion(e.target.value)}
                placeholder="Ej. Km 5 Vía a las Cascadas, Mindo"
                error={
                  editDireccion.trim().length > 0 && !isEditDireccionValid
                    ? 'La dirección debe tener entre 5 y 120 caracteres.'
                    : undefined
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputControl
                  label="Tarifa Base por Noche (USD)"
                  required
                  type="text"
                  filterType="price"
                  value={editPrecioBaseNoche}
                  onChange={(e) => setEditPrecioBaseNoche(Number(e.target.value))}
                  placeholder="95.00"
                  error={
                    !isEditPrecioValid
                      ? 'La tarifa debe ser mayor a $0 y hasta $10,000 USD.'
                      : undefined
                  }
                />

                <SelectControl
                  label="Estado Operativo / Visibilidad"
                  required
                  value={editEstadoOperativo}
                  onChange={(e) => setEditEstadoOperativo(e.target.value)}
                >
                  <option value="PUBLICADO">PUBLICADO (Visible en Marketplace)</option>
                  <option value="PAUSADO">PAUSADO (Oculto temporalmente)</option>
                  <option value="INACTIVO">INACTIVO (Dado de baja)</option>
                </SelectControl>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-text">
                    Hora de Check-in (Entrada) *
                  </label>
                  <input
                    type="time"
                    required
                    value={editHoraCheckin}
                    onChange={(e) => setEditHoraCheckin(e.target.value)}
                    className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-text focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-stone-800"
                  />
                  <p className="text-[11px] text-brand-muted">
                    Hora oficial de ingreso del huésped (ej. 14:00).
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-text">
                    Hora de Check-out (Salida) *
                  </label>
                  <input
                    type="time"
                    required
                    value={editHoraCheckout}
                    onChange={(e) => setEditHoraCheckout(e.target.value)}
                    className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-text focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-stone-800"
                  />
                  <p className="text-[11px] text-brand-muted">
                    Hora límite para desocupar la habitación (ej. 11:00).
                  </p>
                </div>
              </div>

              <TextAreaControl
                label="Descripción del Alojamiento"
                required
                rows={4}
                maxLength={1000}
                value={editDescripcion}
                onChange={(e) => setEditDescripcion(e.target.value)}
                placeholder="Describe la experiencia de sostenibilidad, flora, fauna y comodidades..."
                error={
                  editDescripcion.trim().length > 0 && !isEditDescripcionValid
                    ? 'La descripción debe tener entre 15 y 1000 caracteres.'
                    : undefined
                }
              />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  disabled={submittingEdit}
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingProperty(null);
                  }}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit || !isEditFormValid}
                  className="btn-primary text-xs py-2 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando Cambios...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIÁLOGO MODAL: CONFIRMACIÓN DE PAUSA / ACTIVACIÓN / ELIMINACIÓN */}
      {confirmModalOpen && confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-brand-surface border border-brand-border p-6 shadow-2xl text-left">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-2.5 shrink-0 ${
                  confirmAction.type === 'HARD_DELETE'
                    ? 'bg-red-600 text-white shadow-md'
                    : confirmAction.type === 'DELETE'
                    ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                    : confirmAction.type === 'PAUSE'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}
              >
                {confirmAction.type === 'HARD_DELETE' ? (
                  <AlertTriangle className="h-5 w-5 animate-pulse" />
                ) : confirmAction.type === 'DELETE' ? (
                  <Trash2 className="h-5 w-5" />
                ) : confirmAction.type === 'PAUSE' ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-base font-bold text-brand-text">
                  {confirmAction.type === 'HARD_DELETE'
                    ? '⚠️ PELIGRO: ¿Eliminar definitivamente este alojamiento?'
                    : confirmAction.type === 'DELETE'
                    ? '¿Pausar este alojamiento (Soft Delete)?'
                    : confirmAction.type === 'PAUSE'
                    ? '¿Pausar publicación del alojamiento?'
                    : '¿Reactivar publicación del alojamiento?'}
                </h3>
                <div className="mt-1 text-xs text-brand-text/75 leading-relaxed">
                  {confirmAction.type === 'HARD_DELETE' ? (
                    <div className="space-y-1.5">
                      <p className="text-red-600 dark:text-red-400 font-bold">
                        Esta acción es irreversible y destructiva.
                      </p>
                      <p>
                        Se borrarán físicamente de la base de datos todas las fotos, tarifas, cupos
                        de inventario y configuraciones de{' '}
                        <strong>{confirmAction.property.titulo}</strong>.
                      </p>
                      <p className="text-[11px] text-brand-text/60 italic">
                        Nota: Si existen reservas o transacciones financieras asociadas, el sistema
                        rechazará la eliminación para preservar la contabilidad y auditoría.
                      </p>
                    </div>
                  ) : confirmAction.type === 'DELETE' ? (
                    <>
                      Se realizará un <strong>Soft Delete</strong> sobre{' '}
                      <strong>{confirmAction.property.titulo}</strong>. El alojamiento quedará
                      inactivo, pero se preservará el historial de órdenes y reseñas.
                    </>
                  ) : confirmAction.type === 'PAUSE' ? (
                    <>
                      Al pausar <strong>{confirmAction.property.titulo}</strong>, no aparecerá en
                      las búsquedas de viajeros en el Marketplace hasta que decidas reactivarlo.
                    </>
                  ) : (
                    <>
                      Al reactivar <strong>{confirmAction.property.titulo}</strong>, volverá a
                      estar disponible de inmediato para reservas en el Marketplace.
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-brand-border">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => {
                  setConfirmModalOpen(false);
                  setConfirmAction(null);
                }}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleExecuteConfirm}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 ${
                  confirmAction.type === 'HARD_DELETE'
                    ? 'bg-red-600 hover:bg-red-700 shadow-md ring-2 ring-red-500/20'
                    : confirmAction.type === 'DELETE'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmAction.type === 'PAUSE'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submittingAction ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    {confirmAction.type === 'HARD_DELETE' ? (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar Definitivamente
                      </>
                    ) : confirmAction.type === 'DELETE' ? (
                      'Sí, Pausar Alojamiento'
                    ) : confirmAction.type === 'PAUSE' ? (
                      'Sí, Pausar'
                    ) : (
                      'Sí, Reactivar'
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
