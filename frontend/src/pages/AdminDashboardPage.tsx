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
  ImagePlus,
  LogOut,
  RotateCcw,
  Ban,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { InputControl, TextAreaControl, SelectControl } from '../components/common/FormField';
import { AddressMapPicker } from '../components/common/AddressMapPicker';
import { focusFirstInvalidInput } from '../utils/inputFilters';
import { formatTimeForPayload } from '../utils/timeUtils';


export interface RoomUnitItem {
  unitId: string;
  unitIndex: number;
  unitNumber: string;
  estadoLimpieza: 'DISPONIBLE' | 'EN_RESERVA' | 'EN_LIMPIEZA' | 'MANTENIMIENTO';
  reservaActual?: {
    orderId: string;
    locator: string;
    rawLocator?: string;
    externalOrderId?: string | null;
    status: string;
    checkin: string;
    checkout: string;
    huesped: string;
    correo?: string;
  } | null;
  ultimaLimpiezaAt?: string | null;
}

export interface RoomStatusItem {
  productoId: string;
  nombreProducto: string;
  descripcion?: string;
  capacidadAdultos: number;
  capacidadNinos: number;
  precioBaseNoche: number | string;
  moneda: string;
  camas: string;
  stockTotal: number;
  disponiblesCount?: number;
  enReservaCount?: number;
  enLimpiezaCount?: number;
  mantenimientoCount?: number;
  unidades?: RoomUnitItem[];
  estadoOperativo: string;
  activo?: boolean;
  estadoLimpieza: 'DISPONIBLE' | 'EN_RESERVA' | 'EN_LIMPIEZA' | 'MANTENIMIENTO';
  ultimaLimpiezaAt?: string;
  reservaActual?: {
    orderId: string;
    locator: string;
    status: string;
    checkin: string;
    checkout: string;
    huesped: string;
  } | null;
}

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
  activo?: boolean;
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
  orden_estado?: string;
  comprobante_url?: string | null;
  metodo_pago?: string | null;
  estado_pago?: string | null;
  alojamiento_titulo: string;
  anfitrion_nombre: string;
}

interface CuentaBancariaAdminItem {
  id: number;
  alojamiento_id?: number;
  alojamientoId?: number;
  banco: string;
  tipo_cuenta?: string;
  tipoCuenta?: string;
  numero_cuenta?: string;
  numeroCuenta?: string;
  nombre_titular?: string;
  nombreTitular?: string;
  identificacion_titular?: string;
  identificacionTitular?: string;
}

const ECUADOR_BANKS_CATALOG: Array<{ code: string; label: string }> = [
  { code: 'BANCO_PICHINCHA', label: 'Banco Pichincha' },
  { code: 'BANCO_GUAYAQUIL', label: 'Banco Guayaquil' },
  { code: 'BANCO_PACIFICO', label: 'Banco del Pacífico' },
  { code: 'PRODUBANCO', label: 'Produbanco' },
  { code: 'BANCO_INTERNACIONAL', label: 'Banco Internacional' },
];

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

interface HostStatsData {
  totalResenas: number;
  avgRating: number;
  limpiezaScore: number;
  sostenibilidadScore: number;
}

interface ReceptionOrderItem {
  order_id: string;
  locator: string;
  external_order_id?: string | null;
  status: string;
  checkin: string;
  checkout: string;
  noches: number;
  number_of_adults: number;
  number_of_rooms: number;
  total_price: number;
  currency: string;
  checked_in_at?: string | null;
  checkin_observaciones?: string | null;
  alojamiento_id: number;
  alojamiento_titulo: string;
  producto_id: string;
  habitacion_nombre: string;
  client_id?: string;
  huesped_nombre?: string;
  huesped_correo?: string;
  huesped_identificacion?: string | null;
  huesped_telefono?: string | null;
  motivo_cancelacion?: string | null;
  solicitado_por_cancelacion?: string | null;
  cancelled_at?: string | null;
}

export const AdminDashboardPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperadmin, notify } = useAuth();

  const isWizardRoute = location.pathname.includes('/nuevo');
  const [activeTab, setActiveTab] = useState<
    'properties' | 'wizard' | 'settlements' | 'reception'
  >(isWizardRoute ? 'wizard' : 'properties');

  const [properties, setProperties] = useState<HostPropertyItem[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionItem[]>([]);
  const [receptionOrders, setReceptionOrders] = useState<ReceptionOrderItem[]>([]);
  const [checkingInOrderId, setCheckingInOrderId] = useState<string | null>(null);
  const [receptionFilter, setReceptionFilter] = useState<'ALL' | 'PENDING' | 'CHECKED_IN' | 'CANCELLED'>('ALL');
  const [refreshingReception, setRefreshingReception] = useState<boolean>(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<ReceptionOrderItem | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState<string>('Cancelación solicitada por huésped en mostrador');
  const [cancellingReceptionOrder, setCancellingReceptionOrder] = useState<boolean>(false);
  // Modal de Habitaciones & Limpieza (Housekeeping)
  const [roomStatusProperty, setRoomStatusProperty] = useState<HostPropertyItem | null>(null);
  const [roomStatuses, setRoomStatuses] = useState<RoomStatusItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);
  const [confirmCleanRoom, setConfirmCleanRoom] = useState<RoomStatusItem | null>(null);
  const [cleanInspectionConfirmed, setCleanInspectionConfirmed] = useState<boolean>(false);
  const [confirmingClean, setConfirmingClean] = useState<boolean>(false);
  const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([]);

  const toggleRoomExpansion = (productoId: string) => {
    setExpandedRoomIds((prev) =>
      prev.includes(productoId) ? prev.filter((id) => id !== productoId) : [...prev, productoId],
    );
  };

  // Modal de Check-out en Recepción
  const [checkoutModalOrder, setCheckoutModalOrder] = useState<ReceptionOrderItem | null>(null);
  const [checkoutObservaciones, setCheckoutObservaciones] = useState<string>('');
  const [confirmingCheckout, setConfirmingCheckout] = useState<boolean>(false);


  // Modal de Recepción / Check-in Asistido en Mostrador
  const [receptionModalOrder, setReceptionModalOrder] = useState<ReceptionOrderItem | null>(null);
  const [modalDocumentoTitular, setModalDocumentoTitular] = useState<string>('');
  const [modalHuespedesReales, setModalHuespedesReales] = useState<number>(1);
  const [modalAdminId, setModalAdminId] = useState<string>('recepcionista-hotel');
  const [modalObservaciones, setModalObservaciones] = useState<string>('');
  const [modalVerificoDocumento, setModalVerificoDocumento] = useState<boolean>(false);
  const [hostStats, setHostStats] = useState<HostStatsData>({
    totalResenas: 0,
    avgRating: 0,
    limpiezaScore: 0,
    sostenibilidadScore: 0,
  });
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
  const [latitud, setLatitud] = useState<number>(-0.180653);
  const [longitud, setLongitud] = useState<number>(-78.467834);
  const [isDireccionMapVerified, setIsDireccionMapVerified] = useState<boolean>(false);
  const [direccionVerifyMethod, setDireccionVerifyMethod] = useState<'SEARCH' | 'PIN' | null>(null);
  const [horaCheckin, setHoraCheckin] = useState<string>('14:00');
  const [horaCheckout, setHoraCheckout] = useState<string>('11:00');

  // Step 2 Fields (Photos, Facilities, Rules)
  const [fotosUrls, setFotosUrls] = useState<string[]>([]);
  const [nuevaFotoUrlInput, setNuevaFotoUrlInput] = useState<string>('');
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);
  const [selectedFacilidades, setSelectedFacilidades] = useState<number[]>([]);
  const [selectedReglas, setSelectedReglas] = useState<number[]>([]);

  // Step 3 Fields (Habitaciones / Productos con Stock Controlado)
  const [nombreProducto, setNombreProducto] = useState('');
  const [planAlimenticioId, setPlanAlimenticioId] = useState<number>(1);
  const [capAdultosHab, setCapAdultosHab] = useState<string>('');
  const [capNinosHab, setCapNinosHab] = useState<string>('');
  const [stockTotalHab, setStockTotalHab] = useState<string>('');
  const [precioHabUsd, setPrecioHabUsd] = useState<string>('');
  const [camaPreset, setCamaPreset] = useState<string>('');
  const [camaPersonalizada, setCamaPersonalizada] = useState<string>('');
  const [addedProducts, setAddedProducts] = useState<
    Array<{ codigo: string; nombre: string; stock: number; precio: number; camas: string }>
  >([]);

  // Step 4 Fields (Contratos 5FN & Cuentas Bancarias para Transferencias)
  const [selectedCanalId, setSelectedCanalId] = useState<number>(1);
  const [selectedPoliticaId, setSelectedPoliticaId] = useState<number>(1);
  const [bancoForm, setBancoForm] = useState<string>('BANCO_PICHINCHA');
  const [tipoCuentaForm, setTipoCuentaForm] = useState<'AHORROS' | 'CORRIENTE'>('AHORROS');
  const [numeroCuentaForm, setNumeroCuentaForm] = useState<string>('');
  const [nombreTitularForm, setNombreTitularForm] = useState<string>('');
  const [identificacionTitularForm, setIdentificacionTitularForm] = useState<string>('');
  const [cuentasBancariasList, setCuentasBancariasList] = useState<CuentaBancariaAdminItem[]>([]);
  const [submittingBankAccount, setSubmittingBankAccount] = useState<boolean>(false);

  /**
   * Resetea explícitamente todo el estado del Wizard de Creación en 4 Pasos
   * evitando que fotos, reglas, facilidades, habitaciones o cuentas del alojamiento
   * anterior se filtren como estado fantasma (Stale State) a la nueva creación.
   */
  const resetWizardState = useCallback(() => {
    // 1. Control del Wizard
    setWizardStep(1);
    setCreatedAlojamientoId(null);
    setSubmittingStep(false);

    // 2. Paso 1: Información General
    setCiudadId('');
    if (tipos.length > 0) {
      setTipoId(Number(tipos[0].tipo_id));
    } else {
      setTipoId(1);
    }
    setTitulo('');
    setDescripcion('');
    setDireccion('');
    setLatitud(-0.180653);
    setLongitud(-78.467834);
    setIsDireccionMapVerified(false);
    setDireccionVerifyMethod(null);
    setHoraCheckin('14:00');
    setHoraCheckout('11:00');

    // 3. Paso 2: Fotos, Facilidades Ecológicas y Reglas de Convivencia
    setFotosUrls([]);
    setNuevaFotoUrlInput('');
    setUploadingPhotos(false);
    setSelectedFacilidades([]);
    setSelectedReglas([]);

    // 4. Paso 3: Habitaciones y Stock (Campos limpios, sin datos hardcodeados)
    setNombreProducto('');
    if (planesCat.length > 0) {
      setPlanAlimenticioId(Number(planesCat[0].plan_id));
    } else {
      setPlanAlimenticioId(1);
    }
    setCapAdultosHab('');
    setCapNinosHab('');
    setStockTotalHab('');
    setPrecioHabUsd('');
    setCamaPreset('');
    setCamaPersonalizada('');
    setAddedProducts([]);

    // 5. Paso 4: Políticas y Cuentas Bancarias
    setSelectedCanalId(1);
    setSelectedPoliticaId(1);
    setBancoForm('BANCO_PICHINCHA');
    setTipoCuentaForm('AHORROS');
    setNumeroCuentaForm('');
    setNombreTitularForm('');
    setIdentificacionTitularForm('');
    setCuentasBancariasList([]);
    setSubmittingBankAccount(false);
  }, [tipos, planesCat]);

  // Si se ingresa por la ruta /admin/nuevo, asegurar estado limpio al montar
  useEffect(() => {
    if (isWizardRoute) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetWizardState();
    }
  }, [isWizardRoute, resetWizardState]);

  // Modal de Verificación de Comprobante de Transferencia (Tab 3)
  const [inspectingReceiptLiq, setInspectingReceiptLiq] = useState<LiquidacionItem | null>(null);
  const [processingTransferAction, setProcessingTransferAction] = useState<boolean>(false);

  // Estados para CRUD: Edición de Alojamiento
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<HostPropertyItem | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editLatitud, setEditLatitud] = useState<number>(-0.180653);
  const [editLongitud, setEditLongitud] = useState<number>(-78.467834);
  const [isEditDireccionVerified, setIsEditDireccionVerified] = useState<boolean>(true);
  const [editVerifyMethod, setEditVerifyMethod] = useState<'SEARCH' | 'PIN' | null>('PIN');
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
    isEditTituloValid &&
    isEditDescripcionValid &&
    isEditDireccionValid &&
    isEditDireccionVerified &&
    isEditPrecioValid;

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
    setIsEditDireccionVerified(true);
    setEditVerifyMethod('PIN');

    // Mapear ciudadId y coordenadas iniciales
    let resolvedCityId = 1;
    if (property.ciudadId) {
      resolvedCityId = Number(property.ciudadId);
    } else {
      const matchCity = ciudades.find(
        (c) => c.nombre.toLowerCase() === (property.ciudad || '').toLowerCase(),
      );
      if (matchCity) resolvedCityId = Number(matchCity.ciudad_id);
      else if (ciudades.length > 0) resolvedCityId = Number(ciudades[0].ciudad_id);
    }
    setEditCiudadId(resolvedCityId);

    const cityObj = ciudades.find((c) => Number(c.ciudad_id) === resolvedCityId);
    const propLat = Number(property.latitud);
    const propLon = Number(property.longitud);
    setEditLatitud(
      Number.isFinite(propLat) && propLat !== 0
        ? propLat
        : Number(cityObj?.latitud || -0.180653),
    );
    setEditLongitud(
      Number.isFinite(propLon) && propLon !== 0
        ? propLon
        : Number(cityObj?.longitud || -78.467834),
    );

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
        latitud: Number(editLatitud),
        longitud: Number(editLongitud),
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
                latitud: Number(editLatitud),
                longitud: Number(editLongitud),
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
        void loadDashboardData();
      } else if (type === 'DELETE' || type === 'PAUSE') {
        const { data } = await httpClient.patch<{
          success: boolean;
          message: string;
          alojamientoId: number;
          estadoOperativo: string;
          activo: boolean;
        }>(`/admin/alojamientos/${property.alojamientoId}/baja`, {
          estadoObjetivo: 'PAUSADO',
          motivo: 'Pausado por el anfitrión desde el panel de control',
        });
        setProperties((prev) =>
          prev.map((item) =>
            item.alojamientoId === property.alojamientoId
              ? { ...item, estadoOperativo: 'PAUSADO', activo: false }
              : item,
          ),
        );
        notify(
          'success',
          'Alojamiento pausado',
          data?.message ||
            `"${property.titulo}" ha sido puesto en pausa (Soft Delete) y ya no aparecerá en las búsquedas del Marketplace.`,
        );
      } else if (type === 'ACTIVATE') {
        await httpClient.patch(`/admin/alojamientos/${property.alojamientoId}`, {
          estadoOperativo: 'PUBLICADO',
          activo: true,
        });
        setProperties((prev) =>
          prev.map((item) =>
            item.alojamientoId === property.alojamientoId
              ? { ...item, estadoOperativo: 'PUBLICADO', activo: true }
              : item,
          ),
        );
        notify(
          'success',
          'Alojamiento reactivado',
          `"${property.titulo}" vuelve a estar visible y disponible para reservas en el Marketplace.`,
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
    isDireccionMapVerified &&
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
    if (capNinosHab.trim() === '') return null;
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
  const isStockHabValid = !stockTotalHabError && stockTotalHab.trim().length > 0;
  const isCapAdultosValid = !capAdultosHabError && capAdultosHab.trim().length > 0;
  const isCapNinosValid = !capNinosHabError;
  const isPrecioHabValid = !precioHabUsdError && precioHabUsd.trim().length > 0;
  const isCamaValid =
    camaPreset.trim().length > 0 &&
    (camaPreset !== 'OTRA' || camaPersonalizada.trim().length > 0);

  const isStep3Valid =
    isNombreProdValid &&
    isStockHabValid &&
    isCapAdultosValid &&
    isCapNinosValid &&
    isPrecioHabValid &&
    isCamaValid;

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
        statsRes,
        recepRes,
      ] = await Promise.all([
        httpClient.get<HostPropertyItem[]>('/admin/alojamientos'),
        httpClient.get<LiquidacionItem[]>('/pagos/liquidaciones'),
        httpClient.get<CiudadOpt[]>('/catalogos/ciudades'),
        httpClient.get<TipoOpt[]>('/catalogos/tipos-alojamiento'),
        httpClient.get<FacilidadOpt[]>('/catalogos/facilidades'),
        httpClient.get<ReglaOpt[]>('/catalogos/reglas-convivencia'),
        httpClient.get<PlanAlimenticioOpt[]>('/catalogos/planes-alimenticios'),
        httpClient
          .get<HostStatsData>('/admin/alojamientos/estadisticas')
          .catch(() => ({
            data: {
              totalResenas: 0,
              avgRating: 0,
              limpiezaScore: 0,
              sostenibilidadScore: 0,
            },
          })),
        httpClient
          .get<ReceptionOrderItem[]>('/admin/ordenes/recepcion')
          .catch(() => ({ data: [] as ReceptionOrderItem[] })),
      ]);

      setProperties(Array.isArray(propRes.data) ? propRes.data : []);
      setLiquidaciones(Array.isArray(liqRes.data) ? liqRes.data : []);
      setReceptionOrders(Array.isArray(recepRes.data) ? recepRes.data : []);
      setCiudades(Array.isArray(ciudRes.data) ? ciudRes.data : []);
      setTipos(Array.isArray(tipRes.data) ? tipRes.data : []);
      setFacilidadesCat(Array.isArray(facRes.data) ? facRes.data : []);
      setReglasCat(Array.isArray(regRes.data) ? regRes.data : []);
      setPlanesCat(Array.isArray(planRes.data) ? planRes.data : []);
      if (statsRes?.data) {
        setHostStats({
          totalResenas: Number(statsRes.data.totalResenas || 0),
          avgRating: Number(statsRes.data.avgRating || 0),
          limpiezaScore: Number(statsRes.data.limpiezaScore || 0),
          sostenibilidadScore: Number(statsRes.data.sostenibilidadScore || 0),
        });
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

  
  const fetchRoomStatuses = useCallback(async (alojamientoId: number) => {
    try {
      setLoadingRooms(true);
      const res = await httpClient.get<{
        alojamientoId: number;
        alojamientoTitulo: string;
        totalHabitaciones: number;
        habitaciones: RoomStatusItem[];
      }>(`/admin/alojamientos/${alojamientoId}/habitaciones/estados`);
      const items = res.data.habitaciones || [];
      setRoomStatuses(items);
      setExpandedRoomIds(items.map((r) => r.productoId));
    } catch (err) {
      console.error('Error al cargar estados de habitaciones:', err);
      notify('error', 'Error al cargar habitaciones', extractErrorMessage(err));
    } finally {
      setLoadingRooms(false);
    }
  }, [notify]);

  const handleOpenRoomStatusModal = useCallback(
    (property: HostPropertyItem) => {
      setRoomStatusProperty(property);
      fetchRoomStatuses(property.alojamientoId);
    },
    [fetchRoomStatuses],
  );

  const handleOpenConfirmCleanModal = useCallback((room: RoomStatusItem) => {
    setConfirmCleanRoom(room);
    setCleanInspectionConfirmed(false);
  }, []);

  const handleExecuteConfirmClean = useCallback(async () => {
    if (!roomStatusProperty || !confirmCleanRoom) return;
    try {
      setConfirmingClean(true);
      await httpClient.patch(
        `/admin/alojamientos/${roomStatusProperty.alojamientoId}/habitaciones/${confirmCleanRoom.productoId}/limpieza`,
      );
      notify(
        'success',
        'Habitación Higienizada y Lista',
        `La habitación ${confirmCleanRoom.nombreProducto} ha sido marcada como DISPONIBLE para reservas.`,
      );
      setConfirmCleanRoom(null);
      await fetchRoomStatuses(roomStatusProperty.alojamientoId);
    } catch (err) {
      notify('error', 'Error al confirmar limpieza', extractErrorMessage(err));
    } finally {
      setConfirmingClean(false);
    }
  }, [roomStatusProperty, confirmCleanRoom, fetchRoomStatuses, notify]);

  const handleRequestCleaning = useCallback(
    async (room: RoomStatusItem) => {
      if (!roomStatusProperty) return;
      try {
        await httpClient.patch(
          `/admin/alojamientos/${roomStatusProperty.alojamientoId}/habitaciones/${room.productoId}/estado`,
          { estado: 'EN_LIMPIEZA' },
        );
        notify(
          'info',
          'Habitación en Limpieza',
          `La habitación ${room.nombreProducto} fue puesta en estado EN_LIMPIEZA.`,
        );
        await fetchRoomStatuses(roomStatusProperty.alojamientoId);
      } catch (err) {
        notify('error', 'Error al cambiar estado', extractErrorMessage(err));
      }
    },
    [roomStatusProperty, fetchRoomStatuses, notify],
  );

  const handleOpenCheckoutModal = useCallback((order: ReceptionOrderItem) => {
    setCheckoutModalOrder(order);
    setCheckoutObservaciones('Huésped finalizó estadía y entregó llaves en mostrador.');
  }, []);

  const handleExecuteConfirmCheckout = useCallback(async () => {
    if (!checkoutModalOrder) return;
    try {
      setConfirmingCheckout(true);
      await httpClient.post(`/admin/ordenes/${checkoutModalOrder.order_id}/checkout`, {
        observaciones:
          checkoutObservaciones.trim() ||
          'Check-out completado en recepción. Habitación enviada a limpieza.',
      });

      setReceptionOrders((prev) =>
        prev.map((item) =>
          item.order_id === checkoutModalOrder.order_id
            ? {
                ...item,
                status: 'CHECKED_OUT',
              }
            : item,
        ),
      );

      notify(
        'success',
        'Check-out registrado exitosamente',
        `La reserva ${checkoutModalOrder.locator} finalizó y la habitación pasó automáticamente a 'EN LIMPIEZA'.`,
      );
      setCheckoutModalOrder(null);
    } catch (err) {
      notify('error', 'Error al registrar check-out', extractErrorMessage(err));
    } finally {
      setConfirmingCheckout(false);
    }
  }, [checkoutModalOrder, checkoutObservaciones, notify]);

  const handleOpenReceptionModal = (order: ReceptionOrderItem) => {
    setReceptionModalOrder(order);
    setModalDocumentoTitular(order.huesped_identificacion || '');
    setModalHuespedesReales(Math.max(1, Number(order.number_of_adults || 1)));
    setModalAdminId('recepcionista-hotel');
    setModalObservaciones(
      order.checkin_observaciones ||
        'Huésped presentado en mostrador de recepción y habitación entregada',
    );
    setModalVerificoDocumento(false);
  };

  const handleConfirmReceptionCheckin = async () => {
    if (!receptionModalOrder) return;
    if (!modalVerificoDocumento || !modalDocumentoTitular.trim()) {
      notify(
        'warning',
        'Validación de Recepción',
        'Debes ingresar el documento del titular y marcar la verificación física en el mostrador.',
      );
      return;
    }

    setCheckingInOrderId(receptionModalOrder.order_id);
    try {
      await httpClient.post(`/admin/ordenes/${receptionModalOrder.order_id}/checkin`, {
        documento_titular: modalDocumentoTitular.trim(),
        huespedes_reales: Number(modalHuespedesReales || 1),
        admin_id: modalAdminId.trim() || 'recepcionista-hotel',
        observaciones:
          modalObservaciones.trim() ||
          'Huésped presentado en mostrador de recepción y habitación entregada',
      });

      setReceptionOrders((prev) =>
        prev.map((item) =>
          item.order_id === receptionModalOrder.order_id
            ? {
                ...item,
                status: 'CONFIRMADO_ASISTIDO',
                checked_in_at: new Date().toISOString(),
                huesped_identificacion: modalDocumentoTitular.trim(),
                checkin_observaciones:
                  modalObservaciones.trim() ||
                  'Huésped presentado en mostrador de recepción y habitación entregada',
              }
            : item,
        ),
      );

      notify(
        'success',
        'Check-in confirmado y Booking Central notificado',
        `La reserva ${receptionModalOrder.locator} pasó a CONFIRMADO_ASISTIDO y se notificó en tiempo real a Booking Central.`,
      );
      setReceptionModalOrder(null);
    } catch (err: unknown) {
      notify(
        'error',
        'Error al registrar Check-in en recepción',
        extractErrorMessage(err),
      );
    } finally {
      setCheckingInOrderId(null);
    }
  };

  const handleRefreshReception = async () => {
    try {
      setRefreshingReception(true);
      const res = await httpClient.get<ReceptionOrderItem[]>('/admin/ordenes/recepcion');
      setReceptionOrders(Array.isArray(res.data) ? res.data : []);
      const propRes = await httpClient.get<HostPropertyItem[]>('/admin/alojamientos');
      setProperties(Array.isArray(propRes.data) ? propRes.data : []);
      notify('success', 'Recepción sincronizada', 'Listado de reservas y stock de inventario actualizados.');
    } catch (err: unknown) {
      notify('error', 'Error al sincronizar recepción', extractErrorMessage(err));
    } finally {
      setRefreshingReception(false);
    }
  };

  const handleExecuteCancelReceptionOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    try {
      setCancellingReceptionOrder(true);
      await httpClient.post(`/admin/ordenes/${cancelModalOrder.order_id}/cancelar`, {
        motivo: cancelMotivo.trim() || 'Cancelación en mostrador de recepción',
      });
      notify('success', 'Reserva cancelada', `La reserva ${cancelModalOrder.locator} ha sido cancelada y el stock ha sido restaurado en inventario.`);
      setReceptionOrders((prev) =>
        prev.map((item) =>
          item.order_id === cancelModalOrder.order_id
            ? {
                ...item,
                status: 'CANCELLED',
                solicitado_por_cancelacion: 'Recepción Mostrador',
                motivo_cancelacion: cancelMotivo.trim() || 'Cancelación en mostrador de recepción',
                cancelled_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      const propRes = await httpClient.get<HostPropertyItem[]>('/admin/alojamientos');
      setProperties(Array.isArray(propRes.data) ? propRes.data : []);
      setCancelModalOrder(null);
      setCancelMotivo('Cancelación solicitada por huésped en mostrador');
    } catch (err: unknown) {
      notify('error', 'Error al cancelar reserva', extractErrorMessage(err));
    } finally {
      setCancellingReceptionOrder(false);
    }
  };

  const filteredReceptionOrders = useMemo(() => {
    return receptionOrders.filter((ord) => {
      const st = (ord.status || '').toUpperCase();
      const isCancelled = st === 'CANCELLED' || st === 'CANCELADA' || st.includes('CANCEL');
      const isCheckedIn = st === 'CONFIRMADO_ASISTIDO' || st === 'CHECKED_OUT' || st === 'CHECKED_IN';
      if (receptionFilter === 'PENDING') {
        return !isCancelled && !isCheckedIn;
      }
      if (receptionFilter === 'CHECKED_IN') {
        return isCheckedIn;
      }
      if (receptionFilter === 'CANCELLED') {
        return isCancelled;
      }
      return true;
    });
  }, [receptionOrders, receptionFilter]);

  const receptionCounts = useMemo(() => {
    let pending = 0;
    let checkedIn = 0;
    let cancelled = 0;
    for (const ord of receptionOrders) {
      const st = (ord.status || '').toUpperCase();
      if (st === 'CANCELLED' || st === 'CANCELADA' || st.includes('CANCEL')) {
        cancelled++;
      } else if (st === 'CONFIRMADO_ASISTIDO' || st === 'CHECKED_OUT' || st === 'CHECKED_IN') {
        checkedIn++;
      } else {
        pending++;
      }
    }
    return { all: receptionOrders.length, pending, checkedIn, cancelled };
  }, [receptionOrders]);

  // KPIs Calculation (05-host-dashboard mold) - Dinámico sin fallbacks estáticos
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
    const totalReviewsFromProps = properties.reduce(
      (acc, p) => acc + Number(p.totalResenas || 0),
      0,
    );
    const totalReviews = Math.max(Number(hostStats.totalResenas || 0), totalReviewsFromProps);
    const ratedProps = properties.filter(
      (p) => Number(p.calificacionPromedio) > 0 && Number(p.totalResenas || 0) > 0,
    );
    const computedAvg =
      ratedProps.length > 0
        ? ratedProps.reduce((acc, p) => acc + Number(p.calificacionPromedio), 0) /
          ratedProps.length
        : 0;
    const avgRating =
      totalReviews > 0
        ? Number(hostStats.avgRating) > 0
          ? Number(hostStats.avgRating)
          : computedAvg
        : 0;
    const limpiezaScore =
      totalReviews > 0
        ? Number(hostStats.limpiezaScore) > 0
          ? Number(hostStats.limpiezaScore)
          : avgRating
        : 0;
    const sostenibilidadScore =
      totalReviews > 0
        ? Number(hostStats.sostenibilidadScore) > 0
          ? Number(hostStats.sostenibilidadScore)
          : avgRating
        : 0;

    return {
      totalProperties,
      totalRoomsCount,
      totalOrders: liquidaciones.length,
      totalBruto,
      totalNeto,
      totalReviews,
      avgRating,
      limpiezaScore,
      sostenibilidadScore,
    };
  }, [properties, liquidaciones, hostStats]);

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
      } else if (!isDireccionMapVerified) {
        notify(
          'warning',
          'Validación en mapa requerida',
          'Valida la dirección en el mapa o coloca el PIN en la ubicación exacta del alojamiento.',
        );
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
        latitud: Number(latitud),
        longitud: Number(longitud),
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

  // Subida directa de múltiples archivos a Cloudinary (Unsigned Upload)
  const handleDirectCloudinaryFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'bjcahwd6';
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'habitat_preset';

    setUploadingPhotos(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', 'habitat-ec/alojamientos');

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: 'POST',
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(`No se pudo subir el archivo ${file.name}.`);
        }

        const data = (await response.json()) as { secure_url?: string };
        return data.secure_url || '';
      });

      const uploadedUrls = (await Promise.all(uploadPromises)).filter(Boolean);

      if (uploadedUrls.length > 0) {
        setFotosUrls((prev) => [...prev, ...uploadedUrls]);
        notify(
          'success',
          'Fotos subidas exitosamente',
          `Se agregaron ${uploadedUrls.length} fotografía(s) a la galería de tu alojamiento.`,
        );
      }
    } catch (err: unknown) {
      notify(
        'error',
        'Error al subir imágenes',
        err instanceof Error ? err.message : 'Verifica tu conexión o configuración de Cloudinary.',
      );
    } finally {
      setUploadingPhotos(false);
      e.target.value = '';
    }
  };

  // Apertura del Cloudinary Upload Widget (Unsigned Multi-Upload)
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

    let uploadedInBatchCount = 0;

    const myWidget = window.cloudinary.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        sources: ['local', 'url', 'camera'],
        multiple: true,
        maxFiles: 20,
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
              browse: 'Explorar archivos',
              dd_title_single: 'Arrastra y suelta tus fotografías aquí',
              dd_title_multi: 'Arrastra y suelta tus fotografías aquí',
            },
          },
        },
      },
      (error: unknown, result: { event: string; info?: { secure_url?: string } }) => {
        if (!error && result && result.event === 'success' && result.info?.secure_url) {
          const newUrl = result.info.secure_url;
          uploadedInBatchCount += 1;
          setFotosUrls((prev) => (prev.includes(newUrl) ? prev : [...prev, newUrl]));
        }
        if (!error && result && (result.event === 'queues-end' || result.event === 'close')) {
          if (uploadedInBatchCount > 0) {
            notify(
              'success',
              'Fotos subidas exitosamente',
              `Se cargaron ${uploadedInBatchCount} fotografía(s) en la galería.`,
            );
            uploadedInBatchCount = 0;
          }
        }
      },
    );

    myWidget.open();
  };

  const handleAddManualFotoUrl = () => {
    const trimmed = nuevaFotoUrlInput.trim();
    if (!trimmed.startsWith('http')) {
      notify('warning', 'URL inválida', 'Ingresa una dirección web válida que comience con http:// o https://');
      return;
    }
    setFotosUrls((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setNuevaFotoUrlInput('');
    notify('success', 'Fotos subidas exitosamente', 'La imagen por URL fue añadida a la galería.');
  };

  const handleRemoveFoto = (idxToRemove: number) => {
    setFotosUrls((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSetPortada = (idxToPromote: number) => {
    setFotosUrls((prev) => {
      if (idxToPromote <= 0 || idxToPromote >= prev.length) return prev;
      const chosen = prev[idxToPromote];
      const rest = prev.filter((_, idx) => idx !== idxToPromote);
      return [chosen, ...rest];
    });
  };

  // Wizard Step 2 Submit (`CrearFotoDto` múltiple, `AsignarFacilidadesDto`, `AsignarReglasDto`)
  const handleStep2SaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdAlojamientoId) return;
    if (fotosUrls.length === 0) {
      notify('warning', 'Imágenes requeridas', 'Sube al menos una fotografía para tu alojamiento antes de continuar.');
      return;
    }
    setSubmittingStep(true);
    try {
      await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/fotos`, {
        urls: fotosUrls,
      });

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
        `${fotosUrls.length} fotografía(s), facilidades ecológicas y reglas vinculadas con éxito.`,
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
      const resolvedCamas =
        camaPreset === 'OTRA'
          ? (camaPersonalizada.trim() || '1 Cama Matrimonial (2 plazas)')
          : camaPreset;

      await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/productos`, {
        productoId: generatedProdId,
        planId: Number(planAlimenticioId),
        nombreProducto: nombreProducto.trim(),
        capacidadAdultos: Number(capAdultosHab),
        capacidadNinos: Number(capNinosHab),
        cantidadCuartosInventario: Number(stockTotalHab),
        precioBaseNoche: Number(precioHabUsd),
        camas: resolvedCamas,
        activo: true,
      });

      setAddedProducts((prev) => [
        ...prev,
        {
          codigo: generatedProdId,
          nombre: nombreProducto.trim(),
          stock: Number(stockTotalHab),
          precio: Number(precioHabUsd),
          camas: resolvedCamas,
        },
      ]);

      notify(
        'success',
        'Habitación agregada al inventario',
        `Se registraron ${stockTotalHab} unidad(es) de "${nombreProducto}" (${generatedProdId}).`,
      );

      // Limpiar formulario para registrar la siguiente habitación con campos limpios
      setNombreProducto('');
      setStockTotalHab('');
      setCapAdultosHab('');
      setCapNinosHab('');
      setPrecioHabUsd('');
      setCamaPreset('');
      setCamaPersonalizada('');
    } catch (err: unknown) {
      notify('error', 'Error al registrar habitación', extractErrorMessage(err));
    } finally {
      setSubmittingStep(false);
    }
  };

  // Cargar cuentas bancarias cuando se selecciona un alojamiento en el Wizard
  useEffect(() => {
    if (!createdAlojamientoId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCuentasBancariasList([]);
      return;
    }
    const fetchCuentas = async () => {
      try {
        const { data } = await httpClient.get<unknown>(
          `/admin/alojamientos/${createdAlojamientoId}/cuentas-bancarias`,
        );
        const rawList = Array.isArray(data)
          ? data
          : Array.isArray((data as { cuentas?: unknown[] })?.cuentas)
            ? (data as { cuentas: unknown[] }).cuentas
            : [];
        const normalized: CuentaBancariaAdminItem[] = (rawList as Record<string, unknown>[]).map((item) => ({
          id: Number(item.id || item.cuenta_id || item.cuentaId),
          alojamientoId: Number(item.alojamientoId || item.alojamiento_id || createdAlojamientoId),
          banco: String(item.banco || ''),
          tipoCuenta: String(item.tipoCuenta || item.tipo_cuenta || 'AHORROS'),
          tipo_cuenta: String(item.tipo_cuenta || item.tipoCuenta || 'AHORROS'),
          numeroCuenta: String(item.numeroCuenta || item.numero_cuenta || ''),
          numero_cuenta: String(item.numero_cuenta || item.numeroCuenta || ''),
          nombreTitular: String(item.nombreTitular || item.nombre_titular || ''),
          nombre_titular: String(item.nombre_titular || item.nombreTitular || ''),
          identificacionTitular: String(item.identificacionTitular || item.identificacion_titular || ''),
          identificacion_titular: String(item.identificacion_titular || item.identificacionTitular || ''),
        }));
        setCuentasBancariasList(normalized);
      } catch {
        // Silencioso si aún no tiene cuentas
      }
    };
    void fetchCuentas();
  }, [createdAlojamientoId]);

  const handleAddBankAccount = async () => {
    if (!createdAlojamientoId) return;
    if (
      numeroCuentaForm.trim().length < 6 ||
      nombreTitularForm.trim().length < 3 ||
      identificacionTitularForm.trim().length < 10
    ) {
      notify(
        'warning',
        'Datos bancarios incompletos',
        'Ingresa un número de cuenta válido, nombre del titular y Cédula/RUC (10 a 13 dígitos).',
      );
      return;
    }

    setSubmittingBankAccount(true);
    try {
      const response = await httpClient.post<unknown>(
        `/admin/alojamientos/${createdAlojamientoId}/cuentas-bancarias`,
        {
          banco: bancoForm,
          tipoCuenta: tipoCuentaForm,
          numeroCuenta: numeroCuentaForm.trim(),
          nombreTitular: nombreTitularForm.trim(),
          identificacionTitular: identificacionTitularForm.trim(),
        },
      );
      const resData = response.data as Record<string, unknown>;
      const rawAcc = (resData?.cuenta || resData) as Record<string, unknown>;
      const normalizedAcc: CuentaBancariaAdminItem = {
        id: Number(rawAcc.id || rawAcc.cuenta_id || rawAcc.cuentaId || Date.now()),
        alojamientoId: Number(rawAcc.alojamientoId || rawAcc.alojamiento_id || createdAlojamientoId),
        banco: String(rawAcc.banco || bancoForm),
        tipoCuenta: String(rawAcc.tipoCuenta || rawAcc.tipo_cuenta || tipoCuentaForm),
        tipo_cuenta: String(rawAcc.tipo_cuenta || rawAcc.tipoCuenta || tipoCuentaForm),
        numeroCuenta: String(rawAcc.numeroCuenta || rawAcc.numero_cuenta || numeroCuentaForm.trim()),
        numero_cuenta: String(rawAcc.numero_cuenta || rawAcc.numeroCuenta || numeroCuentaForm.trim()),
        nombreTitular: String(rawAcc.nombreTitular || rawAcc.nombre_titular || nombreTitularForm.trim()),
        nombre_titular: String(rawAcc.nombre_titular || rawAcc.nombreTitular || nombreTitularForm.trim()),
        identificacionTitular: String(rawAcc.identificacionTitular || rawAcc.identificacion_titular || identificacionTitularForm.trim()),
        identificacion_titular: String(rawAcc.identificacion_titular || rawAcc.identificacionTitular || identificacionTitularForm.trim()),
      };
      setCuentasBancariasList((prev) => [...prev, normalizedAcc]);
      setNumeroCuentaForm('');
      setNombreTitularForm('');
      setIdentificacionTitularForm('');
      notify(
        'success',
        'Cuenta bancaria registrada',
        'La cuenta quedó habilitada para recibir transferencias en el checkout.',
      );
    } catch (err: unknown) {
      notify('error', 'Error al guardar cuenta bancaria', extractErrorMessage(err));
    } finally {
      setSubmittingBankAccount(false);
    }
  };

  const handleRemoveBankAccount = async (cuentaId: number) => {
    if (!createdAlojamientoId || !cuentaId) return;
    try {
      await httpClient.delete(
        `/admin/alojamientos/${createdAlojamientoId}/cuentas-bancarias/${cuentaId}`,
      );
      setCuentasBancariasList((prev) => prev.filter((c) => Number(c.id) !== Number(cuentaId)));
      notify('success', 'Cuenta bancaria eliminada', 'Se removió la cuenta del alojamiento.');
    } catch (err: unknown) {
      notify('error', 'Error al eliminar cuenta', extractErrorMessage(err));
    }
  };

  const handleApproveTransfer = async (orderId: string) => {
    setProcessingTransferAction(true);
    try {
      await httpClient.post(`/ordenes/${orderId}/aprobar-transferencia`);
      notify(
        'success',
        'Transferencia aprobada',
        'La reserva ha sido confirmada exitosamente.',
      );
      setInspectingReceiptLiq(null);
      await loadDashboardData();
    } catch (err: unknown) {
      notify('error', 'Error al aprobar transferencia', extractErrorMessage(err));
    } finally {
      setProcessingTransferAction(false);
    }
  };

  const handleRejectTransfer = async (orderId: string) => {
    setProcessingTransferAction(true);
    try {
      await httpClient.post(`/ordenes/${orderId}/rechazar-transferencia`);
      notify(
        'info',
        'Transferencia rechazada',
        'La reserva fue marcada como cancelada.',
      );
      setInspectingReceiptLiq(null);
      await loadDashboardData();
    } catch (err: unknown) {
      notify('error', 'Error al rechazar transferencia', extractErrorMessage(err));
    } finally {
      setProcessingTransferAction(false);
    }
  };

  // Wizard Step 4: Save 5FN Contract (`Contratos5FNDto`) & Finish
  const handleStep4Save5FN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdAlojamientoId) return;
    setSubmittingStep(true);
    try {
      // Si el anfitrión dejó datos bancarios escritos en el formulario sin pulsar "+ Agregar Cuenta", guardarlos automáticamente
      if (
        numeroCuentaForm.trim().length >= 6 &&
        nombreTitularForm.trim().length >= 3 &&
        identificacionTitularForm.trim().length >= 10
      ) {
        await httpClient.post(
          `/admin/alojamientos/${createdAlojamientoId}/cuentas-bancarias`,
          {
            banco: bancoForm,
            tipoCuenta: tipoCuentaForm,
            numeroCuenta: numeroCuentaForm.trim(),
            nombreTitular: nombreTitularForm.trim(),
            identificacionTitular: identificacionTitularForm.trim(),
          },
        );
      }

      await httpClient.post(`/admin/alojamientos/${createdAlojamientoId}/contratos-5fn`, {
        canalIds: [Number(selectedCanalId)],
        politicaIds: [Number(selectedPoliticaId)],
      });

      notify(
        'success',
        '¡Alojamiento Publicado al 100%!',
        'Las políticas, cuentas bancarias y acuerdos quedaron activos en el Marketplace.',
      );
      resetWizardState();
      await loadDashboardData();
      setActiveTab('properties');
      navigate('/admin');
    } catch (err: unknown) {
      notify('error', 'Error al finalizar publicación', extractErrorMessage(err));
    } finally {
      setSubmittingStep(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-left">
      {/* Header Estilo Cozy Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/70 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="chip-gold text-[11px] font-bold">
              <Building2 className="h-3.5 w-3.5" />
              {isSuperadmin ? 'Super Administrador • Hábitat EC' : 'Panel de Gestión Anfitrión • Host'}
            </span>
            <span className="chip-sage text-[10px] font-semibold">
              Nodo B2B: NODE_ALO_HAB
            </span>
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text tracking-tight">
            {isSuperadmin ? 'Supervisión Global de Alojamientos & B2B' : 'Consola de Alojamientos & Recepción'}
          </h1>
          <p className="mt-1 text-xs text-brand-text/65 max-w-2xl leading-relaxed">
            {isSuperadmin
              ? 'Auditoría integral de la red de hoteles, comisiones de plataforma del 15%, libro mayor de liquidaciones y flujo B2B con Booking Central.'
              : 'Administra tus eco-lodges, habitaciones con stock sincronizado, liquidaciones financieras del 85% y recepción con check-in en mostrador.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetWizardState();
            setActiveTab('wizard');
          }}
          className="btn-primary self-start sm:self-auto cursor-pointer shadow-xs hover:shadow-md transition-all flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Publicar Nuevo Alojamiento
        </button>
      </div>

      {/* TOP KPI CARDS — ESTILO COZY ADMIN REDISEÑADO */}
      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Alojamientos / Stock */}
        <div className="rounded-2xl border border-brand-border/80 bg-brand-surface p-5 shadow-xs transition-all hover:shadow-md hover:border-brand-accent/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
              {isSuperadmin ? 'Alojamientos Globales' : 'Mis Alojamientos'}
            </span>
            <div className="h-9 w-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-serif text-3xl font-extrabold text-brand-text tracking-tight">
            {kpis.totalProperties}
          </p>
          <p className="mt-1 text-xs font-semibold text-brand-secondary flex items-center gap-1">
            <span>{kpis.totalRoomsCount}</span> habitación(es) en inventario activo
          </p>
        </div>

        {/* Card 2: Recepción / Reservas */}
        <div className="rounded-2xl border border-brand-border/80 bg-brand-surface p-5 shadow-xs transition-all hover:shadow-md hover:border-brand-accent/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
              {isSuperadmin ? 'Reservas en Plataforma' : 'En Recepción & Check-in'}
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-serif text-3xl font-extrabold text-brand-text tracking-tight">
            {receptionOrders.length}
          </p>
          <p className="mt-1 text-xs text-brand-text/65">
            {receptionOrders.filter((o) => !o.checked_in_at && o.status !== 'CANCELLED' && o.status !== 'CANCELADA').length} pendiente(s) de check-in hoy
          </p>
        </div>

        {/* Card 3: Finanzas / Liquidaciones */}
        <div className="rounded-2xl border border-brand-border/80 bg-brand-surface p-5 shadow-xs transition-all hover:shadow-md hover:border-brand-accent/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
              {isSuperadmin ? 'Comisión Hábitat (15%)' : 'Ingresos Netos (85%)'}
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-serif text-3xl font-extrabold text-brand-secondary tracking-tight">
            ${isSuperadmin ? (Number(kpis.totalBruto || 0) - Number(kpis.totalNeto || 0)).toFixed(2) : Number(kpis.totalNeto || 0).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-brand-text/65">
            {isSuperadmin
              ? `Volumen transaccionado: $${Number(kpis.totalBruto || 0).toFixed(2)} USD`
              : 'Liquidación en libro mayor'}
          </p>
        </div>

        {/* Card 4: Reputación / Calidad */}
        <div className="rounded-2xl border border-brand-border/80 bg-brand-surface p-5 shadow-xs transition-all hover:shadow-md hover:border-brand-accent/40 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
              Calidad & Sostenibilidad
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
            </div>
          </div>

          {kpis.totalOrders === 0 || kpis.totalReviews === 0 || !kpis.avgRating || kpis.avgRating <= 0 ? (
            <div className="my-auto py-2 text-center">
              <p className="text-xs italic text-brand-text/65 leading-relaxed">
                Primeros huéspedes en proceso. ¡Las reseñas calificarán tu servicio!
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div>
                <div className="flex justify-between font-semibold">
                  <span className="text-brand-text/75">Confort & Limpieza</span>
                  <span className="font-bold text-brand-text">{Number(kpis.limpiezaScore || kpis.avgRating || 0).toFixed(1)}/5</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-brand-border/60 overflow-hidden mt-0.5">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, (Number(kpis.limpiezaScore || kpis.avgRating || 0) / 5) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-semibold">
                  <span className="text-brand-text/75">Sostenibilidad Eco</span>
                  <span className="font-bold text-brand-secondary">{Number(kpis.sostenibilidadScore || kpis.avgRating || 0).toFixed(1)}/5</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-brand-border/60 overflow-hidden mt-0.5">
                  <div
                    className="h-full rounded-full bg-brand-secondary transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, (Number(kpis.sostenibilidadScore || kpis.avgRating || 0) / 5) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TABS NAVIGATION — SEGMENTED PILL BAR */}
      <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-surface/70 p-1.5 border border-brand-border/80 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('properties')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'properties'
              ? 'bg-brand-primary text-brand-bg font-bold shadow-xs'
              : 'text-brand-text/75 hover:text-brand-text hover:bg-brand-surface'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>1. Mis Alojamientos e Inventario</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activeTab === 'properties'
                ? 'bg-brand-bg/20 text-brand-bg'
                : 'bg-brand-border/70 text-brand-text/70'
            }`}
          >
            {properties.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!createdAlojamientoId) {
              resetWizardState();
            }
            setActiveTab('wizard');
          }}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'wizard'
              ? 'bg-brand-primary text-brand-bg font-bold shadow-xs'
              : 'text-brand-text/75 hover:text-brand-text hover:bg-brand-surface'
          }`}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>2. Wizard de Creación en 4 Pasos</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settlements')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'settlements'
              ? 'bg-brand-secondary text-brand-bg font-bold shadow-xs'
              : 'text-brand-text/75 hover:text-brand-text hover:bg-brand-surface'
          }`}
        >
          <Receipt className="h-3.5 w-3.5" />
          <span>3. Liquidaciones Financieras</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activeTab === 'settlements'
                ? 'bg-brand-bg/20 text-brand-bg'
                : 'bg-brand-border/70 text-brand-text/70'
            }`}
          >
            {liquidaciones.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reception')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'reception'
              ? 'bg-brand-primary text-brand-bg font-bold shadow-xs'
              : 'text-brand-text/75 hover:text-brand-text hover:bg-brand-surface'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>4. Recepción / Check-in de Huéspedes</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activeTab === 'reception'
                ? 'bg-brand-bg/20 text-brand-bg'
                : 'bg-brand-border/70 text-brand-text/70'
            }`}
          >
            {receptionOrders.length}
          </span>
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
                  resetWizardState();
                  setActiveTab('wizard');
                }}
                className="btn-primary mt-5 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                Iniciar Wizard de 4 Pasos
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-border/80 bg-brand-surface shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-brand-bg/60 border-b border-brand-border/70 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                    <tr>
                      <th className="px-5 py-3.5">ID / Alojamiento</th>
                      <th className="px-5 py-3.5">Tipología / Ciudad</th>
                      <th className="px-5 py-3.5">Tarifa Base</th>
                      <th className="px-5 py-3.5">Stock Habitaciones</th>
                      <th className="px-5 py-3.5">Estado</th>
                      <th className="px-5 py-3.5 text-right">Acciones de Gestión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/70">
                    {properties.map((p, index) => (
                      <tr key={p.alojamientoId} className="hover:bg-brand-bg/40 transition-colors">
                        <td className="px-5 py-4 font-semibold text-brand-text">
                          <span className="font-mono text-brand-text/50 font-bold mr-1">#{index + 1}</span>
                          <span className="text-sm font-bold">{p.titulo}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="chip-gold text-[10px] mr-1.5">{p.tipo}</span>
                          <span className="text-brand-text/75">{p.ciudad}</span>
                        </td>
                        <td className="px-5 py-4 font-bold text-brand-text text-sm">
                          ${Number(p.precioBaseNoche).toFixed(2)} <span className="text-[10px] font-normal text-brand-text/60">USD</span>
                        </td>
                        <td className="px-5 py-4 text-brand-text/80 font-medium">
                          <span className="font-bold text-brand-primary dark:text-emerald-300">{p.totalCuartos}</span> unidad(es) en inventario
                        </td>
                        <td className="px-5 py-4">
                          {p.estadoOperativo === 'PAUSADO' || p.activo === false || p.estadoOperativo === 'INACTIVO' || p.estadoOperativo === 'BAJA' ? (
                            <span className="chip-gold text-[10px] inline-flex items-center gap-1">
                              <PauseCircle className="h-3 w-3" />
                              PAUSADO
                            </span>
                          ) : (
                            <span className="chip-sage text-[10px] inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              PUBLICADO
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            <button
                              type="button"
                              onClick={async () => {
                                setCreatedAlojamientoId(Number(p.alojamientoId));
                                setNombreProducto('');
                                setCapAdultosHab('');
                                setCapNinosHab('');
                                setStockTotalHab('');
                                setPrecioHabUsd('');
                                setCamaPreset('');
                                setCamaPersonalizada('');
                                setAddedProducts([]);
                                setWizardStep(3);
                                setActiveTab('wizard');
                                try {
                                  const { data } = await httpClient.get<RoomStatusItem[]>(
                                    `/admin/alojamientos/${p.alojamientoId}/habitaciones/estado-limpieza`,
                                  );
                                  if (Array.isArray(data)) {
                                    setAddedProducts(
                                      data.map((r) => ({
                                        codigo: r.productoId,
                                        nombre: r.nombreProducto,
                                        stock: r.stockTotal,
                                        precio: Number(r.precioBaseNoche),
                                        camas: r.camas || 'No especificada',
                                      })),
                                    );
                                  }
                                } catch {
                                  // Fallback silencioso si aún no tiene habitaciones registradas
                                }
                              }}
                              className="btn-secondary py-1.5 px-2.5 text-[11px] font-bold text-brand-primary dark:text-emerald-300 hover:border-brand-primary shrink-0 flex items-center gap-1 cursor-pointer"
                              title="Gestionar habitaciones y cupos de inventario"
                            >
                              <BedDouble className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                              <span>+ Habitación</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRoomStatusModal(p)}
                              className="btn-secondary py-1.5 px-2.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:border-amber-500 shrink-0 flex items-center gap-1 cursor-pointer"
                              title="Ver estado operativo y ciclo de limpieza"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span>Habitaciones & Limpieza</span>
                            </button>
                            <div className="flex items-center border border-brand-border/80 rounded-xl bg-brand-surface overflow-hidden shrink-0 shadow-2xs">
                              <Link
                                to={`/alojamientos/${p.alojamientoId}`}
                                className="p-2 text-brand-text/70 hover:text-brand-text hover:bg-brand-bg transition-colors"
                                title="Ver ficha pública del alojamiento"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="p-2 text-brand-text/70 hover:text-brand-accent hover:bg-brand-bg border-l border-brand-border/60 transition-colors cursor-pointer"
                                title="Editar datos del alojamiento"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {p.estadoOperativo === 'PUBLICADO' && p.activo !== false ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfirm('PAUSE', p)}
                                  className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 border-l border-brand-border/60 transition-colors cursor-pointer"
                                  title="Pausar alojamiento (Soft Delete)"
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfirm('ACTIVATE', p)}
                                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-l border-brand-border/60 transition-colors cursor-pointer"
                                  title="Reactivar publicación en el marketplace"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenConfirm('HARD_DELETE', p)}
                                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-l border-brand-border/60 transition-colors cursor-pointer"
                                title="Eliminar definitivamente el alojamiento y sus registros asociados"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
        <div className="mt-6 rounded-2xl border border-brand-border/80 bg-brand-surface p-6 sm:p-8 shadow-xs">
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
            <div className="mt-4 rounded-xl bg-brand-secondary/15 border border-brand-secondary/30 px-4 py-2.5 text-xs font-semibold text-brand-secondary flex flex-wrap items-center justify-between gap-2">
              <span>Configurando Alojamiento Activo ID: #{createdAlojamientoId}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetWizardState}
                  className="text-amber-800 dark:text-amber-300 hover:underline font-bold cursor-pointer"
                  title="Descartar borrador y empezar un nuevo alojamiento desde el Paso 1"
                >
                  ✕ Descartar e Iniciar Nuevo
                </button>
                <Link
                  to={`/alojamientos/${createdAlojamientoId}`}
                  className="underline font-bold"
                >
                  Ver vista previa en Marketplace →
                </Link>
              </div>
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

              <SelectControl
                label="Ciudad / Destino *"
                required
                value={ciudadId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setCiudadId(val);
                  if (val !== '') {
                    const foundCity = ciudades.find((c) => Number(c.ciudad_id) === val);
                    if (foundCity) {
                      setLatitud(Number(foundCity.latitud || -0.180653));
                      setLongitud(Number(foundCity.longitud || -78.467834));
                    }
                  }
                }}
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

              <AddressMapPicker
                label="Dirección Física y Ubicación Exacta (Google Maps / PIN) *"
                required
                direccion={direccion}
                onDireccionChange={setDireccion}
                ciudadNombre={
                  ciudades.find((c) => Number(c.ciudad_id) === Number(ciudadId))?.nombre || 'Quito'
                }
                ciudadLat={
                  ciudades.find((c) => Number(c.ciudad_id) === Number(ciudadId))?.latitud
                }
                ciudadLon={
                  ciudades.find((c) => Number(c.ciudad_id) === Number(ciudadId))?.longitud
                }
                latitud={latitud}
                longitud={longitud}
                onCoordinatesChange={(newLat, newLon) => {
                  setLatitud(newLat);
                  setLongitud(newLon);
                }}
                isVerified={isDireccionMapVerified}
                verifiedMethod={direccionVerifyMethod}
                onVerificationChange={(verified, method) => {
                  setIsDireccionMapVerified(verified);
                  setDireccionVerifyMethod(method);
                }}
                placeholder="Ej: Km 5 vía Conocoto o Av. Amazonas y Naciones Unidas"
              />

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
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-sm font-bold text-brand-text">
                      Galería Fotográfica del Alojamiento (Múltiples Imágenes) *
                    </label>
                    <p className="text-xs text-brand-text/65">
                      Sube una o varias fotos de tu propiedad. La primera imagen se mostrará como portada principal.
                    </p>
                  </div>
                  <span className="chip-sage text-xs">
                    {fotosUrls.length} foto(s) cargada(s)
                  </span>
                </div>

                {/* Zona de carga múltiple directa + Widget Cloudinary */}
                <div className="rounded-2xl border-2 border-dashed border-brand-border bg-brand-bg/50 p-5 text-center transition-colors hover:border-brand-accent/60">
                  <UploadCloud className="mx-auto h-9 w-9 text-brand-accent" />
                  <p className="mt-2 text-xs font-semibold text-brand-text">
                    Selecciona múltiples fotografías desde tu dispositivo
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand-text/60">
                    Formatos admitidos: JPG, PNG, WEBP, AVIF (Máx. 10MB por foto)
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <label
                      className={`inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary/90 cursor-pointer ${
                        uploadingPhotos ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      {uploadingPhotos ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Subiendo lote a Cloudinary...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-4 w-4" />
                          <span>Seleccionar Archivos (Múltiples)</span>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleDirectCloudinaryFilesUpload}
                        className="hidden"
                        disabled={uploadingPhotos}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleOpenCloudinaryWidget}
                      disabled={uploadingPhotos}
                      className="btn-secondary py-2.5 px-4 text-xs font-semibold cursor-pointer"
                      title="Abrir asistente interactivo de Cloudinary"
                    >
                      <ImagePlus className="h-4 w-4 text-brand-accent" />
                      <span>Usar Asistente Cloudinary</span>
                    </button>
                  </div>

                  {/* Opción auxiliar para agregar por URL directa */}
                  <div className="mt-4 pt-4 border-t border-brand-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl mx-auto">
                    <input
                      type="url"
                      value={nuevaFotoUrlInput}
                      onChange={(e) => setNuevaFotoUrlInput(e.target.value)}
                      placeholder="O pega una URL de imagen (https://...) y pulsa Añadir"
                      className="input-field text-xs py-2 flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualFotoUrl}
                      className="btn-secondary py-2 px-3.5 text-xs font-semibold shrink-0"
                    >
                      + Añadir URL
                    </button>
                  </div>
                </div>

                {/* Grilla de previsualización de las N fotografías */}
                {fotosUrls.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Aún no has subido fotografías. Carga al menos 1 imagen (recomendado: 5 o más para la galería completa).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                    {fotosUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className={`group relative aspect-square w-full rounded-2xl overflow-hidden border bg-stone-100 dark:bg-stone-800 shadow-xs transition-all ${
                          idx === 0
                            ? 'border-brand-primary ring-2 ring-brand-primary/50'
                            : 'border-brand-border hover:border-brand-accent/60'
                        }`}
                      >
                        {/* Imagen con aspect ratio uniforme y recorte centrado */}
                        <img
                          src={url}
                          alt={`Fotografía ${idx + 1}`}
                          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />

                        {/* Badge superior izquierdo de Portada Principal */}
                        {idx === 0 && (
                          <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-bold text-brand-primary shadow-sm backdrop-blur-sm">
                            <Star className="h-3 w-3 fill-brand-primary text-brand-primary" />
                            Portada
                          </span>
                        )}

                        {/* Botón superior derecho de Quitar foto */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFoto(idx)}
                          className="absolute top-2 right-2 z-10 inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/65 hover:bg-red-600 text-white transition-colors shadow-sm backdrop-blur-sm cursor-pointer"
                          title="Quitar fotografía"
                          aria-label="Quitar fotografía"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Franja inferior controlada para selección de portada y numeración */}
                        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2.5 pt-6 flex items-center justify-between text-[11px]">
                          {idx === 0 ? (
                            <span className="text-[10px] font-semibold text-white/90">
                              Foto #{idx + 1}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPortada(idx)}
                              className="rounded-lg bg-white/90 hover:bg-white text-stone-900 font-bold px-2 py-1 shadow-sm transition-all cursor-pointer text-[10px]"
                            >
                              Hacer portada
                            </button>
                          )}
                          <span className="text-[10px] font-mono text-white/70">
                            #{idx + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text mb-2">
                  Selecciona las Facilidades y Sellos Ecológicos
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
                  Selecciona las Reglas de Convivencia
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
                  disabled={submittingStep || uploadingPhotos || fotosUrls.length === 0}
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
                    placeholder="Ej. 4"
                    error={stockTotalHab.length > 0 ? stockTotalHabError : null}
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
                    placeholder="Ej. 2"
                    error={capAdultosHab.length > 0 ? capAdultosHabError : null}
                    success={capAdultosHabSuccess}
                  />

                  <InputControl
                    label="Capacidad Niños (Opcional)"
                    filterType="numbers"
                    maxLength={2}
                    value={capNinosHab}
                    onValueChange={setCapNinosHab}
                    placeholder="Ej. 0 o 1"
                    error={capNinosHab.length > 0 ? capNinosHabError : null}
                    success={capNinosHabSuccess}
                  />

                  <InputControl
                    label="Precio Base Noche (USD) *"
                    required
                    filterType="price"
                    maxLength={8}
                    value={precioHabUsd}
                    onValueChange={setPrecioHabUsd}
                    placeholder="Ej. 95.00"
                    error={precioHabUsd.length > 0 ? precioHabUsdError : null}
                    success={precioHabUsdSuccess}
                  />
                </div>

                {/* CONFIGURACIÓN DE CAMAS (Alineado a Contrato Booking v2.2.0) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectControl
                    label="Configuración de Camas por Habitación *"
                    required
                    value={camaPreset}
                    onChange={(e) => setCamaPreset(e.target.value)}
                  >
                    <option value="" disabled>-- Selecciona la distribución de camas --</option>
                    <option value="1 Cama Matrimonial (2 plazas)">1 Cama Matrimonial (2 plazas)</option>
                    <option value="1 Cama King Size">1 Cama King Size (2.00m x 2.00m)</option>
                    <option value="1 Cama Queen Size">1 Cama Queen Size (1.60m x 2.00m)</option>
                    <option value="2 Camas Individuales (Twin)">2 Camas Individuales (Twin / 1.5 plazas)</option>
                    <option value="1 Cama Matrimonial + 1 Cama Individual">1 Cama Matrimonial + 1 Cama Individual</option>
                    <option value="1 Cama Matrimonial + 1 Litera">1 Cama Matrimonial + 1 Litera (2 niveles)</option>
                    <option value="2 Literas (4 camas individuales)">2 Literas (4 camas individuales)</option>
                    <option value="1 Cama Queen + 1 Sofá Cama">1 Cama Queen + 1 Sofá Cama</option>
                    <option value="OTRA">Personalizado / Otra distribución...</option>
                  </SelectControl>

                  {camaPreset === 'OTRA' ? (
                    <InputControl
                      label="Especificar Distribución de Camas *"
                      required
                      filterType="alphanumeric"
                      allowedSymbols=" .,#-_/()'+&"
                      maxLength={100}
                      value={camaPersonalizada}
                      onValueChange={setCamaPersonalizada}
                      placeholder="Ej. 1 Cama King + 1 Cuna"
                      error={camaPersonalizada.trim().length === 0 ? 'Ingresa la descripción de las camas.' : null}
                      success={camaPersonalizada.trim().length > 0 ? 'Distribución válida.' : null}
                    />
                  ) : camaPreset ? (
                    <div className="flex flex-col justify-center rounded-xl border border-brand-border/60 bg-brand-surface/40 px-4 py-2.5 text-xs">
                      <span className="font-semibold text-brand-text flex items-center gap-1.5">
                        <BedDouble className="h-4 w-4 text-brand-accent" />
                        Distribución seleccionada:
                      </span>
                      <span className="mt-0.5 text-brand-text/80">{camaPreset}</span>
                    </div>
                  ) : (
                    <div className="flex items-center rounded-xl border border-dashed border-brand-border/70 bg-brand-bg/40 px-4 py-2.5 text-xs text-brand-text/50">
                      <BedDouble className="h-4 w-4 mr-2 text-brand-text/40 shrink-0" />
                      Selecciona la distribución de camas en el selector.
                    </div>
                  )}
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
                    Habitaciones registradas en este alojamiento ({addedProducts.length}):
                  </span>
                  <ul className="space-y-2">
                    {addedProducts.map((ap, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/40 pb-2 last:border-0 last:pb-0">
                        <div className="flex flex-col">
                          <span className="font-medium text-brand-text">
                            {ap.nombre}
                          </span>
                          <span className="text-[11px] text-brand-text/70 flex items-center gap-1">
                            <BedDouble className="h-3 w-3 text-brand-accent" />
                            {ap.camas}
                          </span>
                        </div>
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

          {/* STEP 4: POLÍTICAS Y CUENTAS BANCARIAS PARA TRANSFERENCIAS */}
          {wizardStep === 4 && (
            <form onSubmit={handleStep4Save5FN} className="mt-6 space-y-6" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectControl
                  label="Canal de Distribución Comercial"
                  required
                  value={selectedCanalId}
                  onChange={(e) => setSelectedCanalId(Number(e.target.value))}
                >
                  <option value={1}>Marketplace Oficial Hábitat EC</option>
                  <option value={2}>Canal Aliados Turísticos</option>
                </SelectControl>

                <SelectControl
                  label="Política de Cancelación"
                  required
                  value={selectedPoliticaId}
                  onChange={(e) => setSelectedPoliticaId(Number(e.target.value))}
                >
                  <option value={1}>Cancelación Gratuita (100% reembolsable)</option>
                  <option value={2}>Reembolso Parcial (50% reembolsable)</option>
                  <option value={3}>Tarifa Promocional No Reembolsable</option>
                </SelectControl>
              </div>

              {/* SECCIÓN: CUENTAS BANCARIAS PARA TRANSFERENCIAS */}
              <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border pb-3">
                  <div>
                    <h4 className="font-serif text-base font-bold text-brand-text flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-brand-accent" />
                      Cuentas Bancarias para Transferencias
                    </h4>
                    <p className="text-xs text-brand-text/65 mt-0.5">
                      Registra una o varias cuentas bancarias de Ecuador para que tus huéspedes puedan
                      pagar mediante transferencia o depósito directo.
                    </p>
                  </div>
                  <span className="chip-sage text-xs">
                    {cuentasBancariasList.length} cuenta(s) registrada(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectControl
                    label="Institución Bancaria (Ecuador) *"
                    value={bancoForm}
                    onChange={(e) => setBancoForm(e.target.value)}
                  >
                    {ECUADOR_BANKS_CATALOG.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.label}
                      </option>
                    ))}
                  </SelectControl>

                  <SelectControl
                    label="Tipo de Cuenta *"
                    value={tipoCuentaForm}
                    onChange={(e) =>
                      setTipoCuentaForm(e.target.value as 'AHORROS' | 'CORRIENTE')
                    }
                  >
                    <option value="AHORROS">Cuenta de Ahorros</option>
                    <option value="CORRIENTE">Cuenta Corriente</option>
                  </SelectControl>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <InputControl
                    label="Número de Cuenta *"
                    filterType="numbers"
                    maxLength={20}
                    value={numeroCuentaForm}
                    onValueChange={setNumeroCuentaForm}
                    placeholder="Ej. 2204859102"
                  />

                  <InputControl
                    label="Nombre del Titular / Propietario *"
                    filterType="letters"
                    maxLength={80}
                    value={nombreTitularForm}
                    onValueChange={setNombreTitularForm}
                    placeholder="Ej. Ecolodge Mindo S.A."
                  />

                  <InputControl
                    label="Cédula o RUC del Titular *"
                    filterType="numbers"
                    maxLength={13}
                    value={identificacionTitularForm}
                    onValueChange={setIdentificacionTitularForm}
                    placeholder="Ej. 1790012345001"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submittingBankAccount}
                    onClick={() => void handleAddBankAccount()}
                    className="btn-secondary text-xs font-bold cursor-pointer"
                  >
                    {submittingBankAccount ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Guardando cuenta...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4 w-4 text-brand-accent" />
                        Agregar Cuenta Bancaria
                      </>
                    )}
                  </button>
                </div>

                {cuentasBancariasList.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-brand-border pt-3">
                    <span className="text-xs font-bold text-brand-text block">
                      Cuentas bancarias vinculadas a este alojamiento:
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {cuentasBancariasList.map((c, idx) => {
                        const cuentaId = c.id;
                        const bancoCode = c.banco || '';
                        const bankLabel =
                          ECUADOR_BANKS_CATALOG.find((b) => b.code === bancoCode)?.label || bancoCode || 'Banco';
                        const tipoCuenta = c.tipoCuenta || c.tipo_cuenta || 'AHORROS';
                        const numeroCuenta = c.numeroCuenta || c.numero_cuenta || 'S/N';
                        const titular = c.nombreTitular || c.nombre_titular || 'Titular no especificado';
                        const identificacion = c.identificacionTitular || c.identificacion_titular || '';

                        return (
                          <div
                            key={cuentaId || `acc-${idx}-${bancoCode}-${numeroCuenta}`}
                            className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface p-3 text-xs shadow-xs"
                          >
                            <div>
                              <p className="font-bold text-brand-text">
                                {bankLabel} •{' '}
                                <span className="text-brand-accent">
                                  {tipoCuenta === 'CORRIENTE' ? 'Corriente' : 'Ahorros'}
                                </span>
                              </p>
                              <p className="font-mono text-brand-text/80 mt-0.5">
                                N.º {numeroCuenta}
                              </p>
                              <p className="text-[11px] text-brand-text/65">
                                {titular} {identificacion ? `(${identificacion})` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleRemoveBankAccount(cuentaId)}
                              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Eliminar cuenta bancaria"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-brand-border">
                <button type="submit" disabled={submittingStep} className="btn-primary">
                  {submittingStep ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Publicando Alojamiento...
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

      {/* TAB 3: FINANCIAL SETTLEMENTS & TRANSFER VERIFICATION TABLE */}
      {activeTab === 'settlements' && (
        <div className="mt-6 rounded-2xl border border-brand-border/80 bg-brand-surface shadow-xs overflow-hidden">
          <div className="p-5 border-b border-brand-border/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary shadow-2xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-xl font-bold text-brand-text">
                  Reservas, Comprobantes de Transferencia y Liquidaciones
                </h3>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Revisa el desglose financiero de tus reservas (85% anfitrión / 15% plataforma) y verifica los comprobantes de transferencia bancaria.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-bg px-3 py-1 text-xs font-semibold text-brand-text/75 border border-brand-border">
                <DollarSign className="h-3.5 w-3.5 text-brand-secondary" />
                {liquidaciones.length} transacciones registradas
              </span>
            </div>
          </div>

          {liquidaciones.length === 0 ? (
            <div className="p-12 text-center text-xs text-brand-text/60">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-bg text-brand-text/40 mb-3 border border-brand-border">
                <Receipt className="h-6 w-6" />
              </div>
              <p className="font-semibold text-brand-text/80 text-sm">Aún no se registran reservas o liquidaciones financieras</p>
              <p className="mt-1 text-brand-text/60">Cuando se creen reservas y pagos, aparecerán automáticamente en este libro mayor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bg/80 border-b border-brand-border/70 text-[10px] font-bold tracking-wider uppercase text-brand-text/70">
                  <tr>
                    <th className="px-5 py-3.5">Reserva / Código</th>
                    <th className="px-4 py-3.5">Alojamiento</th>
                    <th className="px-4 py-3.5">Monto Total</th>
                    <th className="px-4 py-3.5">Comisión</th>
                    <th className="px-4 py-3.5">Neto Anfitrión</th>
                    <th className="px-4 py-3.5">Estado Reserva</th>
                    <th className="px-5 py-3.5 text-right">Comprobante / Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60">
                  {liquidaciones.map((l) => {
                    const isPendingVerif = l.orden_estado === 'PENDIENTE_VERIFICACION';
                    const isCancelled = l.orden_estado === 'CANCELLED';
                    return (
                      <tr key={l.liquidacion_id} className="hover:bg-brand-bg/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-brand-text text-[13px] block">
                            #{l.liquidacion_id}
                          </span>
                          <span className="text-[11px] font-mono text-brand-text/60">
                            {l.orden_localizador}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-brand-text">
                          {l.alojamiento_titulo}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-brand-text">
                          ${Number(l.monto_bruto).toFixed(2)} USD
                        </td>
                        <td className="px-4 py-3.5 text-brand-accent font-medium">
                          -${Number(l.comision_plataforma).toFixed(2)} USD
                        </td>
                        <td className="px-4 py-3.5 font-bold text-brand-secondary">
                          ${Number(l.monto_neto_pagar).toFixed(2)} USD
                        </td>
                        <td className="px-4 py-3.5">
                          {isPendingVerif ? (
                            <span className="chip-gold text-[10px]">
                              Pendiente de Verificación
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 px-2.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                              Rechazada / Cancelada
                            </span>
                          ) : (
                            <span className="chip-sage text-[10px]">Confirmada</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {l.comprobante_url || l.metodo_pago === 'TRANSFERENCIA' ? (
                            <button
                              type="button"
                              onClick={() => setInspectingReceiptLiq(l)}
                              className="btn-secondary py-1.5 px-3 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-brand-secondary/50"
                            >
                              <Receipt className="h-3.5 w-3.5 text-brand-accent" />
                              Ver Comprobante
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-brand-text/50 font-medium">
                              <CreditCard className="h-3.5 w-3.5 text-brand-text/40" />
                              Pago con Tarjeta
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECEPCIÓN / CHECK-IN DE HUÉSPEDES (INTEGRACIÓN B2B BOOKING v2.1) */}
      {activeTab === 'reception' && (
        <div className="mt-6 rounded-2xl border border-brand-border/80 bg-brand-surface shadow-xs overflow-hidden">
          <div className="border-b border-brand-border/70 bg-brand-bg/60 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-base font-bold text-brand-text">
                Recepción / Check-in de Huéspedes
              </h3>
              <p className="text-xs text-brand-text/65 mt-0.5">
                Confirma la llegada del huésped en el mostrador. Al registrar el check-in, el estado pasa a{' '}
                <strong>CONFIRMADO_ASISTIDO</strong> y se notifica en tiempo real a{' '}
                <strong>Booking Central</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRefreshReception()}
                disabled={refreshingReception}
                className="btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Sincronizar reservas y stock en inventario"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${refreshingReception ? 'animate-spin' : ''}`} />
                {refreshingReception ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <span className="chip-sage text-[11px] font-bold">
                Nodo B2B: NODE_ALO_HAB
              </span>
            </div>
          </div>

          {/* Filtros de Estado en Recepción */}
          <div className="border-b border-brand-border bg-brand-bg/40 px-6 py-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-brand-text/60 font-medium mr-1 text-[11px]">Filtrar por:</span>
            <button
              type="button"
              onClick={() => setReceptionFilter('ALL')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                receptionFilter === 'ALL'
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs ring-1 ring-slate-900/10'
                  : 'bg-brand-surface text-brand-text/70 hover:text-brand-text border border-brand-border'
              }`}
            >
              Todas ({receptionCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setReceptionFilter('PENDING')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                receptionFilter === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-brand-surface text-brand-text/70 hover:text-brand-text border border-brand-border'
              }`}
            >
              Pendientes ({receptionCounts.pending})
            </button>
            <button
              type="button"
              onClick={() => setReceptionFilter('CHECKED_IN')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                receptionFilter === 'CHECKED_IN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-brand-surface text-brand-text/70 hover:text-brand-text border border-brand-border'
              }`}
            >
              Hospedados ({receptionCounts.checkedIn})
            </button>
            <button
              type="button"
              onClick={() => setReceptionFilter('CANCELLED')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                receptionFilter === 'CANCELLED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-brand-surface text-brand-text/70 hover:text-brand-text border border-brand-border'
              }`}
            >
              Canceladas ({receptionCounts.cancelled})
            </button>
          </div>

          {filteredReceptionOrders.length === 0 ? (
            <div className="p-10 text-center text-xs text-brand-text/60">
              {receptionFilter === 'ALL'
                ? 'No hay reservas registradas en este momento.'
                : `No hay reservas en estado "${receptionFilter}".`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bg/60 border-b border-brand-border/70 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                  <tr>
                    <th className="px-5 py-3.5">Código Reserva</th>
                    <th className="px-5 py-3.5">Huésped</th>
                    <th className="px-5 py-3.5">Alojamiento / Habitación</th>
                    <th className="px-5 py-3.5">Estancia</th>
                    <th className="px-5 py-3.5">Estado Check-in</th>
                    <th className="px-5 py-3.5 text-right">Acción en Mostrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/70">
                  {filteredReceptionOrders.map((ord) => {
                    const st = (ord.status || '').toUpperCase();
                    const isCancelled = st === 'CANCELLED' || st === 'CANCELADA' || st.includes('CANCEL');
                    const isCheckedIn = st === 'CONFIRMADO_ASISTIDO' || st === 'CHECKED_IN';
                    const isCheckedOut = st === 'CHECKED_OUT';
                    const isProcessing = checkingInOrderId === ord.order_id;
                    return (
                      <tr
                        key={ord.order_id}
                        className={`hover:bg-brand-bg/40 transition-colors ${
                          isCancelled ? 'bg-rose-50/25 dark:bg-rose-950/15' : ''
                        }`}
                      >
                        <td className="px-5 py-4 font-mono font-bold text-brand-text">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs">{ord.locator}</span>
                            {(ord.locator?.startsWith('BK') ||
                              ord.locator?.startsWith('BKG') ||
                              ord.external_order_id?.startsWith('BK') ||
                              ord.external_order_id?.startsWith('BKG') ||
                              (ord.huesped_correo && ord.huesped_correo.includes('Booking'))) && (
                              <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/30">
                                Booking B2B
                              </span>
                            )}
                          </div>
                          {ord.external_order_id && ord.external_order_id !== ord.locator && (
                            <div className="text-[10px] text-brand-text/55 font-normal">
                              Ext: {ord.external_order_id}
                            </div>
                          )}
                          {isCancelled && (
                            <div className="mt-0.5 inline-block text-[9px] font-bold text-rose-600 dark:text-rose-400">
                              [Cancelada]
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/25 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 border border-brand-primary/20 shadow-2xs">
                              {(ord.huesped_nombre || 'H R')
                                .split(' ')
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((n) => n[0]?.toUpperCase() || '')
                                .join('') || 'HR'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-brand-text truncate">
                                {ord.huesped_nombre || 'Huésped Registrado'}
                              </div>
                              <div className="text-[11px] text-brand-text/65 truncate">
                                {ord.huesped_correo || 'Sin correo registrado'}
                              </div>
                              {isCancelled ? (
                                <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                                  Cancelada por:{' '}
                                  <strong>
                                    {ord.solicitado_por_cancelacion ||
                                      (ord.external_order_id ? 'Booking Central' : 'Cliente')}
                                  </strong>
                                  {ord.motivo_cancelacion && (
                                    <span className="block text-brand-text/60 italic font-normal">
                                      &ldquo;{ord.motivo_cancelacion}&rdquo;
                                    </span>
                                  )}
                                </div>
                              ) : ord.huesped_identificacion ? (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                    Cédula: {ord.huesped_identificacion}
                                  </span>
                                </div>
                              ) : (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                    ⚠️ Sin cédula registrada
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-brand-text">
                            {ord.alojamiento_titulo}
                          </div>
                          <div className="text-[11px] text-brand-text/65">
                            {ord.habitacion_nombre} ({ord.number_of_rooms} hab. •{' '}
                            {ord.number_of_adults} ad.)
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-brand-text/80">
                          <div>Entrada: {ord.checkin}</div>
                          <div>Salida: {ord.checkout}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          {isCancelled ? (
                            <span className="chip-rose text-[10px] font-bold inline-flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              CANCELADA
                            </span>
                          ) : isCheckedIn ? (
                            <span className="chip-sage text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3" />
                              CONFIRMADO_ASISTIDO
                            </span>
                          ) : isCheckedOut ? (
                            <span className="chip-sage text-[10px] font-bold text-brand-text/75">
                              CHECK-OUT COMPLETADO
                            </span>
                          ) : (
                            <span className="chip-gold text-[10px]">
                              {ord.status === 'PENDIENTE_VERIFICACION'
                                ? 'Pendiente Verificación'
                                : 'Pendiente Check-in'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {isCancelled ? (
                            <span
                              className="chip-rose text-[10px] font-bold opacity-80 cursor-not-allowed"
                              title="Reserva cancelada. Cupo restaurado en el inventario de la propiedad."
                            >
                              No Procede Check-in
                            </span>
                          ) : isCheckedIn ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Hospedado
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenCheckoutModal(ord)}
                                className="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:border-amber-500 cursor-pointer flex items-center gap-1"
                                title="Registrar salida y enviar habitación a limpieza"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                Check-out
                              </button>
                            </div>
                          ) : isCheckedOut ? (
                            <span className="text-[11px] text-brand-text/50 font-medium">
                              Completado
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleOpenReceptionModal(ord)}
                                className="btn-primary py-1.5 px-3 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Confirmar Check-in en Recepción
                              </button>
                              {ord.external_order_id ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-lg bg-brand-surface px-2 py-1 text-[10px] font-semibold text-brand-text/60 border border-brand-border cursor-help"
                                  title="Reserva originada en Booking Central: la cancelación es unilateral y solo puede realizarse desde la plataforma de Booking."
                                >
                                  Canal Booking
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelModalOrder(ord);
                                    setCancelMotivo('Cancelación solicitada por huésped en mostrador');
                                  }}
                                  className="btn-secondary py-1.5 px-2 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:border-rose-500 cursor-pointer"
                                  title="Cancelar reserva interna y restaurar stock en inventario"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA CONFIRMAR CHECK-IN EN RECEPCIÓN (BOOKING CENTRAL & HÁBITAT EC) */}
      {receptionModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
        >
          <div className="card-surface w-full max-w-lg p-6 sm:p-8 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-brand-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-brand-text">
                  Confirmar Check-in · {receptionModalOrder.locator}
                </h3>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Recepción de Huésped • Nodo B2B:{' '}
                  <span className="font-mono font-bold text-brand-accent">NODE_ALO_HAB</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceptionModalOrder(null)}
                className="rounded-xl p-1.5 text-brand-text/60 hover:bg-brand-bg hover:text-brand-text cursor-pointer transition-colors"
                title="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Resumen de la Reserva */}
            <div className="mt-4 rounded-xl border border-brand-border bg-brand-bg/60 p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-brand-text/65 font-medium">Huésped Titular:</span>
                <span className="font-bold text-brand-text">
                  {receptionModalOrder.huesped_nombre || 'Huésped Registrado'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-brand-text/65">Correo Electrónico:</span>
                <span className="text-brand-text font-mono">
                  {receptionModalOrder.huesped_correo || 'No especificado'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-text/65 font-medium">Alojamiento:</span>
                <span className="font-semibold text-brand-text">
                  {receptionModalOrder.alojamiento_titulo}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-text/65 font-medium">Habitación:</span>
                <span className="text-brand-text">
                  {receptionModalOrder.habitacion_nombre} ({receptionModalOrder.number_of_rooms} hab. •{' '}
                  {receptionModalOrder.number_of_adults} adultos)
                </span>
              </div>
              <div className="flex justify-between items-center font-mono text-[11px] pt-1 border-t border-brand-border/60">
                <span className="text-brand-text/65">Estancia:</span>
                <span className="text-brand-text">
                  {receptionModalOrder.checkin} → {receptionModalOrder.checkout} ({receptionModalOrder.noches} noches)
                </span>
              </div>
            </div>

            {/* Formulario de Verificación */}
            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-brand-text mb-1">
                  Documento del Titular (Cédula o Pasaporte) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalDocumentoTitular}
                  onChange={(e) => setModalDocumentoTitular(e.target.value)}
                  placeholder="Ej. 1720345678 o A12345678"
                  className="input-brand w-full text-xs font-mono"
                  required
                />
                <span className="text-[10px] text-brand-text/60 mt-0.5 block">
                  Si el huésped no tenía documento registrado, se guardará en su ficha de cliente.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1">
                    Huéspedes Reales Presentes
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={modalHuespedesReales}
                    onChange={(e) =>
                      setModalHuespedesReales(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="input-brand w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-text mb-1">
                    Código Recepcionista (opcional)
                  </label>
                  <input
                    type="text"
                    value={modalAdminId}
                    onChange={(e) => setModalAdminId(e.target.value)}
                    placeholder="recepcionista-hotel"
                    className="input-brand w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-text mb-1">
                  Observaciones de Recepción (opcional)
                </label>
                <textarea
                  value={modalObservaciones}
                  onChange={(e) => setModalObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Huésped presentado en mostrador de recepción y habitación entregada"
                  className="input-brand w-full text-xs resize-none"
                />
              </div>

              {/* Checkbox de Validación Obligatoria */}
              <div className="rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-brand-text">
                  <input
                    type="checkbox"
                    checked={modalVerificoDocumento}
                    onChange={(e) => setModalVerificoDocumento(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-accent focus:ring-brand-accent cursor-pointer"
                  />
                  <span>
                    Verifiqué el documento físico (Cédula/Pasaporte) del huésped en el mostrador.
                  </span>
                </label>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-brand-border">
                <button
                  type="button"
                  disabled={checkingInOrderId === receptionModalOrder.order_id}
                  onClick={() => setReceptionModalOrder(null)}
                  className="btn-secondary text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    !modalVerificoDocumento ||
                    !modalDocumentoTitular.trim() ||
                    checkingInOrderId === receptionModalOrder.order_id
                  }
                  onClick={() => void handleConfirmReceptionCheckin()}
                  className="btn-primary text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingInOrderId === receptionModalOrder.order_id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Notificando a Booking...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirmar Check-in en Recepción
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA VER COMPROBANTE DE TRANSFERENCIA Y APROBAR / RECHAZAR */}
      {inspectingReceiptLiq && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
        >
          <div className="card-surface w-full max-w-lg p-6 sm:p-8 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-brand-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-brand-text">
                  Verificación de Transferencia Bancaria
                </h3>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Reserva <strong>{inspectingReceiptLiq.orden_localizador}</strong> • Monto:{' '}
                  <strong>${Number(inspectingReceiptLiq.monto_bruto).toFixed(2)} USD</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingReceiptLiq(null)}
                className="rounded-xl p-1.5 text-brand-text/60 hover:bg-brand-bg hover:text-brand-text cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {inspectingReceiptLiq.comprobante_url ? (
                <div className="rounded-2xl border border-brand-border bg-brand-bg p-3 text-center">
                  <img
                    src={inspectingReceiptLiq.comprobante_url}
                    alt={`Comprobante ${inspectingReceiptLiq.orden_localizador}`}
                    className="mx-auto max-h-80 rounded-xl object-contain"
                  />
                  <a
                    href={inspectingReceiptLiq.comprobante_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-bold text-brand-accent underline"
                  >
                    Abrir imagen en tamaño completo ↗
                  </a>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  Esta reserva por transferencia no adjuntó imagen de comprobante.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  disabled={processingTransferAction}
                  onClick={() => void handleRejectTransfer(inspectingReceiptLiq.order_id)}
                  className="btn-secondary text-xs text-red-600 hover:border-red-500 cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  Rechazar Reserva
                </button>
                <button
                  type="button"
                  disabled={processingTransferAction}
                  onClick={() => void handleApproveTransfer(inspectingReceiptLiq.order_id)}
                  className="btn-primary text-xs font-bold cursor-pointer"
                >
                  {processingTransferAction ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Aprobar Reserva
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
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
                  onChange={(e) => {
                    const newId = Number(e.target.value);
                    setEditCiudadId(newId);
                    const foundCity = ciudades.find((c) => Number(c.ciudad_id) === newId);
                    if (foundCity) {
                      setEditLatitud(Number(foundCity.latitud || -0.180653));
                      setEditLongitud(Number(foundCity.longitud || -78.467834));
                    }
                  }}
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

              <AddressMapPicker
                label="Dirección Física y Ubicación Exacta (Google Maps / PIN) *"
                required
                direccion={editDireccion}
                onDireccionChange={setEditDireccion}
                ciudadNombre={
                  ciudades.find((c) => Number(c.ciudad_id) === Number(editCiudadId))?.nombre || 'Quito'
                }
                ciudadLat={
                  ciudades.find((c) => Number(c.ciudad_id) === Number(editCiudadId))?.latitud
                }
                ciudadLon={
                  ciudades.find((c) => Number(c.ciudad_id) === Number(editCiudadId))?.longitud
                }
                latitud={editLatitud}
                longitud={editLongitud}
                onCoordinatesChange={(newLat, newLon) => {
                  setEditLatitud(newLat);
                  setEditLongitud(newLon);
                }}
                isVerified={isEditDireccionVerified}
                verifiedMethod={editVerifyMethod}
                onVerificationChange={(verified, method) => {
                  setIsEditDireccionVerified(verified);
                  setEditVerifyMethod(method);
                }}
                placeholder="Ej. Km 5 Vía a las Cascadas, Mindo"
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


      {/* MODAL DE GESTIÓN DE HABITACIONES & LIMPIEZA (HOUSEKEEPING) */}
      {roomStatusProperty && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs"
        >
          <div className="card-surface w-full max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 md:p-8 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150">
            {/* Encabezado */}
            <div className="flex items-start justify-between border-b border-brand-border pb-3 sm:pb-4 gap-2">
              <div className="flex items-start sm:items-center gap-2 sm:gap-2.5">
                <div className="rounded-xl p-2 bg-amber-500/10 text-amber-500 shrink-0 mt-0.5 sm:mt-0">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-brand-text leading-tight">
                    Habitaciones & Limpieza · {roomStatusProperty.titulo}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-brand-text/65 mt-0.5 line-clamp-2 sm:line-clamp-none">
                    Monitorea el estado operativo de cada habitación (Disponibilidad, Huésped actual y Ciclo de Limpieza post-checkout).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRoomStatusProperty(null)}
                className="rounded-xl p-1.5 text-brand-text/60 hover:bg-brand-bg hover:text-brand-text cursor-pointer transition-colors shrink-0"
                title="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Resumen de estados (KPIs adaptativos basados en unidades físicas reales) */}
            {(() => {
              const totalHabitacionesFisicas = roomStatuses.reduce(
                (acc, r) => acc + (r.unidades?.length ?? r.stockTotal ?? 1),
                0,
              );
              const totalDisponiblesCount = roomStatuses.reduce(
                (acc, r) =>
                  acc +
                  (r.disponiblesCount ??
                    (r.unidades
                      ? r.unidades.filter((u) => u.estadoLimpieza === 'DISPONIBLE').length
                      : r.estadoLimpieza === 'DISPONIBLE'
                        ? r.stockTotal
                        : 0)),
                0,
              );
              const totalEnReservaCount = roomStatuses.reduce(
                (acc, r) =>
                  acc +
                  (r.enReservaCount ??
                    (r.unidades
                      ? r.unidades.filter((u) => u.estadoLimpieza === 'EN_RESERVA').length
                      : r.estadoLimpieza === 'EN_RESERVA'
                        ? 1
                        : 0)),
                0,
              );
              const totalEnLimpiezaCount = roomStatuses.reduce(
                (acc, r) =>
                  acc +
                  (r.enLimpiezaCount ??
                    (r.unidades
                      ? r.unidades.filter((u) => u.estadoLimpieza === 'EN_LIMPIEZA').length
                      : r.estadoLimpieza === 'EN_LIMPIEZA'
                        ? 1
                        : 0)),
                0,
              );

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 my-3 sm:my-4">
                  <div className="rounded-xl sm:rounded-2xl border border-brand-border bg-brand-bg/40 p-2 sm:p-3 text-center">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-brand-text/70 block truncate">
                      Total Habitaciones
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-brand-text mt-0.5 block">
                      {totalHabitacionesFisicas}
                    </span>
                  </div>
                  <div className="rounded-xl sm:rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2 sm:p-3 text-center">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block truncate">
                      🟢 Disponibles
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                      {totalDisponiblesCount}
                    </span>
                  </div>
                  <div className="rounded-xl sm:rounded-2xl border border-sky-500/30 bg-sky-500/10 p-2 sm:p-3 text-center">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-sky-700 dark:text-sky-400 block truncate">
                      🔵 En Reserva
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-sky-700 dark:text-sky-400 mt-0.5 block">
                      {totalEnReservaCount}
                    </span>
                  </div>
                  <div className="rounded-xl sm:rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2 sm:p-3 text-center">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 block truncate">
                      🟡 En Limpieza
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                      {totalEnLimpiezaCount}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Contenedor de Tipologías y Desglose de Habitaciones Físicas */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 max-h-[60vh]">
              {loadingRooms ? (
                <div className="p-8 sm:p-12 text-center text-xs text-brand-text/60 border border-brand-border rounded-xl">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-accent mb-2" />
                  Cargando estado de las habitaciones...
                </div>
              ) : roomStatuses.length === 0 ? (
                <div className="p-8 sm:p-12 text-center text-xs text-brand-text/60 border border-brand-border rounded-xl">
                  No se encontraron habitaciones registradas para esta propiedad.
                </div>
              ) : (
                roomStatuses.map((room) => {
                  const isExpanded = expandedRoomIds.includes(room.productoId);
                  const units = room.unidades || [];
                  const disp =
                    room.disponiblesCount ??
                    units.filter((u) => u.estadoLimpieza === 'DISPONIBLE').length;
                  const resv =
                    room.enReservaCount ??
                    units.filter((u) => u.estadoLimpieza === 'EN_RESERVA').length;
                  const limp =
                    room.enLimpiezaCount ??
                    units.filter((u) => u.estadoLimpieza === 'EN_LIMPIEZA').length;
                  const total = room.stockTotal || units.length || 1;

                  return (
                    <div
                      key={room.productoId}
                      className="border border-brand-border/80 rounded-2xl bg-brand-surface/40 overflow-hidden shadow-2xs transition-all"
                    >
                      {/* Cabecera de la Tipología */}
                      <div className="p-3.5 sm:p-4 bg-brand-bg/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/60">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-brand-text text-sm sm:text-base">
                              {room.nombreProducto}
                            </span>
                            <span className="font-mono text-[10px] text-brand-text/60 px-2 py-0.5 rounded bg-brand-bg border border-brand-border/60">
                              {room.productoId}
                            </span>
                            <span className="inline-flex items-center gap-1 font-bold text-xs text-brand-text/80 bg-brand-surface px-2 py-0.5 rounded border border-brand-border">
                              ${room.precioBaseNoche} {room.moneda} / noche
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-brand-text/65 mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <BedDouble className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                              {room.camas || '1 Cama Matrimonial'}
                            </span>
                            <span>•</span>
                            <span>
                              Capacidad: {room.capacidadAdultos} adultos, {room.capacidadNinos} niños
                            </span>
                          </div>
                        </div>

                        {/* Badges de Inventario de la Tipología y Botón Desplegable */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                            {resv > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                                🔵 {resv} en reserva
                              </span>
                            )}
                            {limp > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                🟡 {limp} en limpieza
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              🟢 {disp} disponibles ({total} total)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleRoomExpansion(room.productoId)}
                            className="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 rounded-xl text-brand-text hover:border-brand-accent cursor-pointer transition-colors shadow-2xs shrink-0"
                            title={
                              isExpanded
                                ? 'Ocultar habitaciones físicas'
                                : 'Desplegar habitaciones físicas'
                            }
                          >
                            <span>{isExpanded ? 'Ocultar' : `Ver ${total} Habitaciones`}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-brand-text/70" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-brand-text/70" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Sección Desplegable: Habitaciones Físicas de este Tipo */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 bg-brand-surface/25 space-y-2.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60 flex items-center gap-1.5 mb-1">
                            <Building2 className="h-3.5 w-3.5 text-brand-accent" />
                            Habitaciones Físicas · {room.nombreProducto} ({units.length} unidades en inventario)
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                            {units.map((unit) => {
                              const isCleaning = unit.estadoLimpieza === 'EN_LIMPIEZA';
                              const isAvailable = unit.estadoLimpieza === 'DISPONIBLE';
                              const isReserved = unit.estadoLimpieza === 'EN_RESERVA';
                              const isMantenimiento = unit.estadoLimpieza === 'MANTENIMIENTO';

                              return (
                                <div
                                  key={unit.unitId}
                                  className={`rounded-xl border p-3 flex flex-col justify-between transition-colors shadow-2xs ${
                                    isReserved
                                      ? 'border-sky-500/35 bg-sky-500/10 dark:bg-sky-950/25'
                                      : isCleaning
                                        ? 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/25'
                                        : isMantenimiento
                                          ? 'border-zinc-500/30 bg-zinc-500/5'
                                          : 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/15'
                                  }`}
                                >
                                  <div>
                                    {/* Fila Cabecera de la Unidad */}
                                    <div className="flex items-center justify-between gap-1.5 mb-2">
                                      <span className="font-bold text-xs text-brand-text flex items-center gap-1">
                                        <Building2 className="h-3 w-3 text-brand-accent" />
                                        {unit.unitNumber}
                                      </span>
                                      {isCleaning ? (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                                          <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                                          EN LIMPIEZA
                                        </span>
                                      ) : isReserved ? (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                                          EN RESERVA
                                        </span>
                                      ) : isMantenimiento ? (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                                          MANTENIMIENTO
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                          <CheckCircle2 className="h-2.5 w-2.5" />
                                          DISPONIBLE
                                        </span>
                                      )}
                                    </div>

                                    {/* Contenido / Detalles del Huésped o Estado */}
                                    {isReserved && unit.reservaActual ? (
                                      <div className="text-[11px] space-y-1 mb-2.5 bg-brand-surface/90 p-2.5 rounded-lg border border-brand-border/60">
                                        <div
                                          className="font-bold text-brand-text truncate"
                                          title={unit.reservaActual.huesped}
                                        >
                                          👤 {unit.reservaActual.huesped}
                                        </div>
                                        <div className="font-mono text-[10px] text-sky-700 dark:text-sky-400 font-semibold flex items-center gap-1 flex-wrap">
                                          <span>Código: {unit.reservaActual.locator}</span>
                                          {(unit.reservaActual.locator?.startsWith('BK') ||
                                            unit.reservaActual.locator?.startsWith('BKG')) && (
                                            <span className="text-[8px] px-1 py-0.2 rounded bg-blue-500/15 text-blue-600 border border-blue-500/30 font-sans font-bold">
                                              Booking
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-brand-text/60">
                                          📅 {unit.reservaActual.checkin} ➔{' '}
                                          {unit.reservaActual.checkout}
                                        </div>
                                      </div>
                                    ) : isCleaning && unit.reservaActual ? (
                                      <div className="text-[11px] space-y-1 mb-2.5 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 text-amber-700 dark:text-amber-300">
                                        <div className="font-semibold text-[10px]">
                                          Check-out reciente: {unit.reservaActual.locator}
                                        </div>
                                        <div className="text-[10px] text-brand-text/70 truncate">
                                          Ex-huésped: {unit.reservaActual.huesped}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-brand-text/60 mb-2.5 py-1">
                                        {isAvailable
                                          ? '100% limpia y lista para recibir huéspedes.'
                                          : 'Fuera de servicio operativo.'}
                                      </div>
                                    )}
                                  </div>

                                  {/* Botón de Acción por Habitación Individual */}
                                  <div className="pt-1.5 border-t border-brand-border/50 mt-1">
                                    {isCleaning ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenConfirmCleanModal(room)}
                                        className="w-full btn-primary py-1.5 px-2 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-2xs flex items-center justify-center gap-1 rounded-lg"
                                      >
                                        <Sparkles className="h-3 w-3" />
                                        Confirmar Limpieza
                                      </button>
                                    ) : isAvailable ? (
                                      <button
                                        type="button"
                                        onClick={() => handleRequestCleaning(room)}
                                        className="w-full btn-secondary py-1 px-2 text-[10px] text-brand-text/70 hover:border-amber-500 hover:text-amber-600 cursor-pointer flex items-center justify-center gap-1 rounded-lg transition-colors"
                                        title="Solicitar limpieza preventiva de esta unidad"
                                      >
                                        <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                                        Solicitar Limpieza
                                      </button>
                                    ) : (
                                      <div className="text-center text-[10px] text-brand-text/40 italic py-0.5">
                                        Habitación ocupada
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer adaptativo */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-brand-border pt-3.5 mt-3">
              <span className="text-[10px] sm:text-[11px] text-brand-text/60 text-center sm:text-left">
                Al confirmar la limpieza, la habitación queda 100% disponible para futuras reservas.
              </span>
              <button
                type="button"
                onClick={() => setRoomStatusProperty(null)}
                className="btn-secondary text-xs py-2 px-5 cursor-pointer w-full sm:w-auto text-center"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN: HABITACIÓN LIMPIA Y DISPONIBLE */}
      {confirmCleanRoom && roomStatusProperty && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="card-surface w-full max-w-lg p-4 sm:p-6 md:p-8 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="rounded-2xl p-2.5 sm:p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-base sm:text-lg font-bold text-brand-text leading-tight">
                  Confirmar Habitación Limpia y Lista
                </h3>
                <p className="text-[11px] sm:text-xs text-brand-text/65 mt-0.5 truncate">
                  Alojamiento: <strong>{roomStatusProperty.titulo}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmCleanRoom(null)}
                className="rounded-xl p-1 text-brand-text/60 hover:bg-brand-bg hover:text-brand-text cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-brand-bg/50 border border-brand-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-brand-text/70">Habitación:</span>
                <span className="font-bold text-brand-text">{confirmCleanRoom.nombreProducto}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-text/70">Configuración de Camas:</span>
                <span className="font-semibold text-brand-text">{confirmCleanRoom.camas || '1 Cama Matrimonial'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-text/70">Código de Producto:</span>
                <span className="font-mono text-brand-accent text-[11px]">{confirmCleanRoom.productoId}</span>
              </div>
            </div>

            <p className="text-xs text-brand-text/80 leading-relaxed">
              ¿Confirmas que esta habitación ha sido completamente aseada, desinfectada, sábanas cambiadas y camas preparadas para recibir a los siguientes huéspedes?
            </p>

            <div className="mt-4 p-3 sm:p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanInspectionConfirmed}
                  onChange={(e) => setCleanInspectionConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-accent shrink-0"
                />
                <span className="font-medium text-[11px] sm:text-xs">
                  Confirmo la inspección física de higiene y declaro que la habitación se encuentra lista para el siguiente check-in.
                </span>
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 mt-5 pt-4 border-t border-brand-border">
              <button
                type="button"
                disabled={confirmingClean}
                onClick={() => setConfirmCleanRoom(null)}
                className="btn-secondary text-xs py-2 px-4 cursor-pointer w-full sm:w-auto text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!cleanInspectionConfirmed || confirmingClean}
                onClick={handleExecuteConfirmClean}
                className="btn-primary text-xs py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto"
              >
                {confirmingClean ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Actualizando Disponibilidad...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar Limpieza y Habilitar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CHECK-OUT EN RECEPCIÓN */}
      {checkoutModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="card-surface w-full max-w-lg p-6 sm:p-8 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <LogOut className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg font-bold text-brand-text">
                  Registrar Check-out · {checkoutModalOrder.locator}
                </h3>
                <p className="text-xs text-brand-text/65 mt-0.5">
                  Huésped: <strong>{checkoutModalOrder.huesped_nombre}</strong> • {checkoutModalOrder.alojamiento_titulo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutModalOrder(null)}
                className="rounded-xl p-1 text-brand-text/60 hover:bg-brand-bg hover:text-brand-text cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 p-4 rounded-2xl bg-brand-bg/50 border border-brand-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-brand-text/70">Habitación Ocupada:</span>
                <span className="font-bold text-brand-text">{checkoutModalOrder.habitacion_nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-text/70">Estadía:</span>
                <span className="font-semibold text-brand-text">{checkoutModalOrder.checkin} al {checkoutModalOrder.checkout} ({checkoutModalOrder.noches} noches)</span>
              </div>
            </div>

            <div className="space-y-1.5 my-3">
              <label className="text-xs font-semibold text-brand-text">Observaciones de Entrega de Habitación:</label>
              <textarea
                value={checkoutObservaciones}
                onChange={(e) => setCheckoutObservaciones(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
                placeholder="Estado de la habitación, llaves devueltas, etc."
              />
            </div>

            <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              ⚠️ Al confirmar el Check-out, la habitación <strong>{checkoutModalOrder.habitacion_nombre}</strong> pasará automáticamente al estado <strong>EN LIMPIEZA</strong> en el panel de anfitrión para su posterior desinfección.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-brand-border">
              <button
                type="button"
                disabled={confirmingCheckout}
                onClick={() => setCheckoutModalOrder(null)}
                className="btn-secondary text-xs py-2 px-4 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmingCheckout}
                onClick={handleExecuteConfirmCheckout}
                className="btn-primary text-xs py-2 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {confirmingCheckout ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando Check-out...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Confirmar Check-out & Limpieza
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELACIÓN EN MOSTRADOR DE RECEPCIÓN */}
      {cancelModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="card-surface w-full max-w-lg p-6 sm:p-8 shadow-2xl relative border border-brand-border text-left">
            <button
              type="button"
              onClick={() => setCancelModalOrder(null)}
              className="absolute top-4 right-4 text-brand-text/60 hover:text-brand-text cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 mb-2">
              <Ban className="h-5 w-5" />
              <h3 className="font-serif text-lg font-bold">
                Cancelar Reserva en Mostrador
              </h3>
            </div>

            <p className="text-xs text-brand-text/75 leading-relaxed">
              ¿Confirmas la cancelación de la reserva{' '}
              <strong className="font-mono text-brand-text">
                {cancelModalOrder.locator}
              </strong>{' '}
              a nombre de <strong>{cancelModalOrder.huesped_nombre || 'Huésped'}</strong>?
            </p>

            <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div>
                <strong>Alojamiento:</strong> {cancelModalOrder.alojamiento_titulo}
              </div>
              <div>
                <strong>Habitación:</strong> {cancelModalOrder.habitacion_nombre} (
                {cancelModalOrder.number_of_rooms} hab.)
              </div>
              <div className="text-[11px] pt-1 text-amber-700 dark:text-amber-400 font-medium">
                ⚠️ Al confirmar la cancelación, el estado de la reserva pasará a{' '}
                <strong>CANCELADA</strong> y se repondrá automáticamente{' '}
                <strong>{cancelModalOrder.number_of_rooms} habitación(es)</strong> al stock
                disponible del inventario.
              </div>
            </div>

            <form onSubmit={handleExecuteCancelReceptionOrder} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-text block mb-1">
                  Motivo de la Cancelación *
                </label>
                <textarea
                  rows={2}
                  required
                  value={cancelMotivo}
                  onChange={(e) => setCancelMotivo(e.target.value)}
                  placeholder="Ej: El huésped no se presentó, canceló en el mostrador o solicitó anulación..."
                  className="input-base text-xs w-full resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Regresar
                </button>
                <button
                  type="submit"
                  disabled={cancellingReceptionOrder}
                  className="btn-primary bg-rose-600 hover:bg-rose-700 text-white py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {cancellingReceptionOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4" />
                      Confirmar Cancelación
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
