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
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { InputControl, TextAreaControl, SelectControl } from '../components/common/FormField';
import { AddressMapPicker } from '../components/common/AddressMapPicker';
import { focusFirstInvalidInput } from '../utils/inputFilters';
import { formatTimeForPayload } from '../utils/timeUtils';


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
}

export const AdminDashboardPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useAuth();

  const isWizardRoute = location.pathname.includes('/nuevo');
  const [activeTab, setActiveTab] = useState<
    'properties' | 'wizard' | 'settlements' | 'reception'
  >(isWizardRoute ? 'wizard' : 'properties');

  const [properties, setProperties] = useState<HostPropertyItem[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionItem[]>([]);
  const [receptionOrders, setReceptionOrders] = useState<ReceptionOrderItem[]>([]);
  const [checkingInOrderId, setCheckingInOrderId] = useState<string | null>(null);
  // Modal de Habitaciones & Limpieza (Housekeeping)
  const [roomStatusProperty, setRoomStatusProperty] = useState<HostPropertyItem | null>(null);
  const [roomStatuses, setRoomStatuses] = useState<RoomStatusItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);
  const [confirmCleanRoom, setConfirmCleanRoom] = useState<RoomStatusItem | null>(null);
  const [cleanInspectionConfirmed, setCleanInspectionConfirmed] = useState<boolean>(false);
  const [confirmingClean, setConfirmingClean] = useState<boolean>(false);

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
  const [nombreProducto, setNombreProducto] = useState('Suite Bosque Nublado');
  const [planAlimenticioId, setPlanAlimenticioId] = useState<number>(1);
  const [capAdultosHab, setCapAdultosHab] = useState<string>('2');
  const [capNinosHab, setCapNinosHab] = useState<string>('1');
  const [stockTotalHab, setStockTotalHab] = useState<string>('4');
  const [precioHabUsd, setPrecioHabUsd] = useState<string>('95');
  const [camaPreset, setCamaPreset] = useState<string>('1 Cama King Size');
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

    // 4. Paso 3: Habitaciones y Stock
    setNombreProducto('Suite Bosque Nublado');
    if (planesCat.length > 0) {
      setPlanAlimenticioId(Number(planesCat[0].plan_id));
    } else {
      setPlanAlimenticioId(1);
    }
    setCapAdultosHab('2');
    setCapNinosHab('1');
    setStockTotalHab('4');
    setPrecioHabUsd('95');
    setCamaPreset('1 Cama King Size');
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
  const isCamaValid =
    camaPreset !== 'OTRA' || camaPersonalizada.trim().length > 0;

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
      setRoomStatuses(res.data.habitaciones || []);
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
            resetWizardState();
            setActiveTab('wizard');
          }}
          className="btn-primary self-start sm:self-auto cursor-pointer"
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

        <div className="card-surface p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text/60">
              Reputación Multicriterio
            </span>
            <Star className="h-5 w-5 fill-brand-primary text-brand-primary" />
          </div>

          {kpis.totalOrders === 0 || kpis.totalReviews === 0 || !kpis.avgRating || kpis.avgRating <= 0 ? (
            <div className="my-auto py-3 text-center">
              <p className="text-xs italic text-brand-text/65 leading-relaxed">
                Aún no tienes reseñas. ¡Tus primeros huéspedes te calificarán pronto!
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div>
                <div className="flex justify-between font-semibold">
                  <span>Limpieza & Confort</span>
                  <span>{Number(kpis.limpiezaScore || kpis.avgRating || 0).toFixed(1)}/5</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-brand-border overflow-hidden">
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
                  <span>Sostenibilidad Eco</span>
                  <span>{Number(kpis.sostenibilidadScore || kpis.avgRating || 0).toFixed(1)}/5</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-brand-border overflow-hidden">
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
          onClick={() => {
            if (!createdAlojamientoId) {
              resetWizardState();
            }
            setActiveTab('wizard');
          }}
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
        <button
          type="button"
          onClick={() => setActiveTab('reception')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'reception'
              ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
              : 'bg-brand-surface text-brand-text/75 border border-brand-border hover:border-brand-accent'
          }`}
        >
          4. Recepción / Check-in de Huéspedes ({receptionOrders.length})
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
                          {p.estadoOperativo === 'PAUSADO' || p.activo === false || p.estadoOperativo === 'INACTIVO' || p.estadoOperativo === 'BAJA' ? (
                            <span className="chip-gold text-[10px]">
                              <PauseCircle className="h-3 w-3" />
                              PAUSADO
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
                            <button
                              type="button"
                              onClick={() => handleOpenRoomStatusModal(p)}
                              className="btn-secondary py-1.5 px-2.5 text-[11px] text-amber-600 dark:text-amber-400 hover:border-amber-500"
                              title="Ver estado de habitaciones y housekeeping"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              Habitaciones & Limpieza
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
                            {p.estadoOperativo === 'PUBLICADO' && p.activo !== false ? (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirm('PAUSE', p)}
                                className="btn-secondary py-1.5 px-2.5 text-[11px] text-amber-600 dark:text-amber-400 hover:border-amber-500"
                                title="Pausar alojamiento (Soft Delete)"
                              >
                                <Pause className="h-3.5 w-3.5" />
                                Pausar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirm('ACTIVATE', p)}
                                className="btn-secondary py-1.5 px-2.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:border-emerald-500"
                                title="Reactivar publicación en el marketplace"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Activar
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

                {/* CONFIGURACIÓN DE CAMAS (Alineado a Contrato Booking v2.2.0) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectControl
                    label="Configuración de Camas por Habitación *"
                    required
                    value={camaPreset}
                    onChange={(e) => setCamaPreset(e.target.value)}
                  >
                    <option value="1 Cama King Size">1 Cama King Size (2.00m x 2.00m)</option>
                    <option value="1 Cama Queen Size">1 Cama Queen Size (1.60m x 2.00m)</option>
                    <option value="1 Cama Matrimonial (2 plazas)">1 Cama Matrimonial (2 plazas)</option>
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
                  ) : (
                    <div className="flex flex-col justify-center rounded-xl border border-brand-border/60 bg-brand-surface/40 px-4 py-2.5 text-xs">
                      <span className="font-semibold text-brand-text flex items-center gap-1.5">
                        <BedDouble className="h-4 w-4 text-brand-accent" />
                        Distribución seleccionada:
                      </span>
                      <span className="mt-0.5 text-brand-text/80">{camaPreset}</span>
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
                    Habitaciones añadidas en esta sesión:
                  </span>
                  <ul className="space-y-2">
                    {addedProducts.map((ap, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/40 pb-2 last:border-0 last:pb-0">
                        <div className="flex flex-col">
                          <span className="font-medium text-brand-text">
                            {ap.nombre} (<code className="font-mono text-brand-text/75">{ap.codigo}</code>)
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
        <div className="mt-6 card-surface overflow-hidden">
          <div className="p-5 border-b border-brand-border flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-brand-text">
                Reservas, Comprobantes de Transferencia y Liquidaciones
              </h3>
              <p className="text-xs text-brand-text/65">
                Revisa el desglose financiero de tus reservas y verifica los comprobantes de
                transferencia bancaria enviados por tus huéspedes.
              </p>
            </div>
          </div>

          {liquidaciones.length === 0 ? (
            <div className="p-10 text-center text-xs text-brand-text/60">
              Aún no se registran reservas o liquidaciones financieras.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bg border-b border-brand-border text-[11px] font-bold uppercase text-brand-text/70">
                  <tr>
                    <th className="px-4 py-3">Reserva / Código</th>
                    <th className="px-4 py-3">Alojamiento</th>
                    <th className="px-4 py-3">Monto Total</th>
                    <th className="px-4 py-3">Comisión</th>
                    <th className="px-4 py-3">Neto Anfitrión</th>
                    <th className="px-4 py-3">Estado Reserva</th>
                    <th className="px-4 py-3 text-right">Comprobante / Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {liquidaciones.map((l) => {
                    const isPendingVerif = l.orden_estado === 'PENDIENTE_VERIFICACION';
                    const isCancelled = l.orden_estado === 'CANCELLED';
                    return (
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
                          {isPendingVerif ? (
                            <span className="chip-gold text-[10px]">
                              Pendiente de Verificación
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-700">
                              Rechazada / Cancelada
                            </span>
                          ) : (
                            <span className="chip-sage text-[10px]">Confirmada</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {l.comprobante_url || l.metodo_pago === 'TRANSFERENCIA' ? (
                            <button
                              type="button"
                              onClick={() => setInspectingReceiptLiq(l)}
                              className="btn-secondary py-1.5 px-3 text-[11px] font-bold cursor-pointer"
                            >
                              <Receipt className="h-3.5 w-3.5 text-brand-accent" />
                              Ver Comprobante
                            </button>
                          ) : (
                            <span className="text-[11px] text-brand-text/50">
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
        <div className="mt-6 card-surface overflow-hidden">
          <div className="border-b border-brand-border bg-brand-bg px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-base font-bold text-brand-text">
                Recepción / Check-in de Huéspedes
              </h3>
              <p className="text-xs text-brand-text/65 mt-0.5">
                Confirma la llegada del huésped en el mostrador. Al registrar el check-in, el estado pasa a{' '}
                <strong>CONFIRMADO_ASISTIDO</strong> y se envía una notificación push automática a{' '}
                <strong>Booking Central</strong>.
              </p>
            </div>
            <span className="chip-sage text-[11px] font-bold">
              Nodo B2B: NODE_ALO_HAB
            </span>
          </div>

          {receptionOrders.length === 0 ? (
            <div className="p-10 text-center text-xs text-brand-text/60">
              No hay reservas activas pendientes de check-in en este momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bg/50 border-b border-brand-border text-[11px] font-bold uppercase text-brand-text/70">
                  <tr>
                    <th className="px-4 py-3">Código Reserva</th>
                    <th className="px-4 py-3">Huésped</th>
                    <th className="px-4 py-3">Alojamiento / Habitación</th>
                    <th className="px-4 py-3">Estancia</th>
                    <th className="px-4 py-3">Estado Check-in</th>
                    <th className="px-4 py-3 text-right">Acción en Mostrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {receptionOrders.map((ord) => {
                    const isCheckedIn = ord.status === 'CONFIRMADO_ASISTIDO';
                    const isProcessing = checkingInOrderId === ord.order_id;
                    return (
                      <tr key={ord.order_id} className="hover:bg-brand-bg/50">
                        <td className="px-4 py-3.5 font-mono font-bold text-brand-text">
                          <div>{ord.locator}</div>
                          {ord.external_order_id && (
                            <div className="text-[10px] text-brand-text/55 font-normal">
                              Ext: {ord.external_order_id}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-brand-text">
                            {ord.huesped_nombre || 'Huésped Registrado'}
                          </div>
                          <div className="text-[11px] text-brand-text/65">
                            {ord.huesped_correo || 'Sin correo'}
                          </div>
                          {ord.huesped_identificacion ? (
                            <div className="text-[10px] font-mono text-brand-accent mt-0.5">
                              ID / Cédula: {ord.huesped_identificacion}
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              ⚠️ Sin identificación registrada
                            </div>
                          )}
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
                          {isCheckedIn ? (
                            <span className="chip-sage text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3" />
                              CONFIRMADO_ASISTIDO
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
                          {isCheckedIn ? (
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
                          ) : ord.status === 'CHECKED_OUT' ? (
                            <span className="chip-sage text-[10px] font-bold text-brand-text/75">
                              CHECK-OUT COMPLETADO
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleOpenReceptionModal(ord)}
                              className="btn-primary py-1.5 px-3 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Confirmar Check-in en Recepción
                            </button>
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

            {/* Resumen de estados (KPIs adaptativos) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 my-3 sm:my-4">
              <div className="rounded-xl sm:rounded-2xl border border-brand-border bg-brand-bg/40 p-2 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-brand-text/70 block truncate">Total Habitaciones</span>
                <span className="text-lg sm:text-xl font-bold text-brand-text mt-0.5 block">{roomStatuses.length}</span>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block truncate">🟢 Disponibles</span>
                <span className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                  {roomStatuses.filter((r) => r.estadoLimpieza === 'DISPONIBLE').length}
                </span>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-sky-500/30 bg-sky-500/10 p-2 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-sky-700 dark:text-sky-400 block truncate">🔵 En Reserva</span>
                <span className="text-lg sm:text-xl font-bold text-sky-700 dark:text-sky-400 mt-0.5 block">
                  {roomStatuses.filter((r) => r.estadoLimpieza === 'EN_RESERVA').length}
                </span>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2 sm:p-3 text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 block truncate">🟡 En Limpieza</span>
                <span className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                  {roomStatuses.filter((r) => r.estadoLimpieza === 'EN_LIMPIEZA').length}
                </span>
              </div>
            </div>

            {/* Contenedor de Habitaciones: Adaptativo Móvil (Cards) y Desktop (Tabla) */}
            <div className="flex-1 overflow-y-auto border border-brand-border rounded-xl sm:rounded-2xl">
              {loadingRooms ? (
                <div className="p-8 sm:p-12 text-center text-xs text-brand-text/60">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-accent mb-2" />
                  Cargando estado de las habitaciones...
                </div>
              ) : roomStatuses.length === 0 ? (
                <div className="p-8 sm:p-12 text-center text-xs text-brand-text/60">
                  No se encontraron habitaciones registradas para esta propiedad.
                </div>
              ) : (
                <>
                  {/* VISTA MÓVIL: Tarjetas táctiles apiladas (pantallas < 640px) */}
                  <div className="divide-y divide-brand-border block sm:hidden">
                    {roomStatuses.map((room) => {
                      const isCleaning = room.estadoLimpieza === 'EN_LIMPIEZA';
                      const isAvailable = room.estadoLimpieza === 'DISPONIBLE';
                      const isReserved = room.estadoLimpieza === 'EN_RESERVA';
                      const isMantenimiento = room.estadoLimpieza === 'MANTENIMIENTO';

                      return (
                        <div key={room.productoId} className="p-3 space-y-2.5 bg-brand-surface/40 hover:bg-brand-bg/40 transition-colors">
                          {/* Fila 1: Título, ID y Estado Operativo */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-brand-text text-xs block truncate">{room.nombreProducto}</span>
                              <span className="font-mono text-[10px] text-brand-text/60">{room.productoId}</span>
                            </div>
                            <div className="shrink-0 text-right">
                              {isCleaning ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                                  <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                                  EN LIMPIEZA
                                </span>
                              ) : isReserved ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                                  EN RESERVA
                                </span>
                              ) : isMantenimiento ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                                  MANTENIMIENTO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  DISPONIBLE
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Fila 2: Camas, Capacidad, Tarifa y Stock */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-brand-bg/50 p-2.5 rounded-lg border border-brand-border/60">
                            <div>
                              <span className="inline-flex items-center gap-1 font-semibold text-brand-text text-[11px] truncate w-full">
                                <BedDouble className="h-3 w-3 text-brand-accent shrink-0" />
                                {room.camas || '1 Cama Matrimonial'}
                              </span>
                              <span className="block text-[10px] text-brand-text/60 mt-0.5">
                                Capacidad: {room.capacidadAdultos} ad. / {room.capacidadNinos} niñ.
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-brand-text block">${room.precioBaseNoche} {room.moneda}</span>
                              <span className="text-[10px] text-brand-text/60 block">{room.stockTotal} unid. en stock</span>
                            </div>
                          </div>

                          {/* Info adicional de huésped o checkout */}
                          {isCleaning && room.reservaActual && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                              Check-out reciente: <strong>{room.reservaActual.locator}</strong> ({room.reservaActual.huesped})
                            </div>
                          )}
                          {isReserved && room.reservaActual && (
                            <div className="text-[10px] text-sky-700 dark:text-sky-300 bg-sky-500/10 px-2 py-1 rounded border border-sky-500/20 truncate">
                              Huésped: <strong>{room.reservaActual.huesped}</strong> ({room.reservaActual.locator})
                            </div>
                          )}

                          {/* Fila 3: Botones de Acción Adaptados al Toque */}
                          <div className="pt-0.5">
                            {isCleaning ? (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirmCleanModal(room)}
                                className="w-full btn-primary py-2 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-sm flex items-center justify-center gap-1.5 rounded-xl"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Confirmar Limpieza
                              </button>
                            ) : isAvailable ? (
                              <button
                                type="button"
                                onClick={() => handleRequestCleaning(room)}
                                className="w-full btn-secondary py-1.5 px-3 text-[11px] text-brand-text/75 hover:border-amber-500 hover:text-amber-500 cursor-pointer flex items-center justify-center gap-1.5 rounded-xl"
                                title="Enviar habitación a limpieza preventiva"
                              >
                                <Sparkles className="h-3 w-3 text-amber-500" />
                                Solicitar Limpieza Preventiva
                              </button>
                            ) : (
                              <div className="text-center text-[11px] text-brand-text/40 italic py-1">
                                Habitación actualmente ocupada
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* VISTA DESKTOP / TABLET: Tabla con cabecera fija y scroll horizontal seguro */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="bg-brand-bg/70 border-b border-brand-border text-[11px] font-bold uppercase text-brand-text/70 sticky top-0">
                        <tr>
                          <th className="px-4 py-3">Habitación & Código</th>
                          <th className="px-4 py-3">Camas & Capacidad</th>
                          <th className="px-4 py-3">Stock & Tarifa</th>
                          <th className="px-4 py-3">Estado Operativo</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border">
                        {roomStatuses.map((room) => {
                          const isCleaning = room.estadoLimpieza === 'EN_LIMPIEZA';
                          const isAvailable = room.estadoLimpieza === 'DISPONIBLE';
                          const isReserved = room.estadoLimpieza === 'EN_RESERVA';
                          const isMantenimiento = room.estadoLimpieza === 'MANTENIMIENTO';

                          return (
                            <tr key={room.productoId} className="hover:bg-brand-bg/40 transition-colors">
                              <td className="px-4 py-3.5">
                                <span className="font-bold text-brand-text block">{room.nombreProducto}</span>
                                <span className="font-mono text-[10px] text-brand-text/60">{room.productoId}</span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1 font-semibold text-brand-text text-[11px]">
                                  <BedDouble className="h-3 w-3 text-brand-accent shrink-0" />
                                  {room.camas || '1 Cama Matrimonial'}
                                </span>
                                <span className="block text-[10px] text-brand-text/60 mt-0.5">
                                  Capacidad: {room.capacidadAdultos} adultos, {room.capacidadNinos} niños
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="font-bold text-brand-text">${room.precioBaseNoche} {room.moneda}</span>
                                <span className="block text-[10px] text-brand-text/60">
                                  {room.stockTotal} unid. en stock
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                {isCleaning ? (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenConfirmCleanModal(room)}
                                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer transition-colors"
                                      title="Clic para confirmar que ya fue limpiada"
                                    >
                                      <Sparkles className="h-3 w-3 animate-pulse" />
                                      EN LIMPIEZA
                                    </button>
                                    <span className="block text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                                      {room.reservaActual ? `Check-out: ${room.reservaActual.locator}` : 'Requiere aseo'}
                                    </span>
                                  </div>
                                ) : isReserved ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                                      EN RESERVA
                                    </span>
                                    {room.reservaActual && (
                                      <span className="block text-[10px] text-brand-text/60 mt-0.5 truncate max-w-[180px]" title={room.reservaActual.huesped}>
                                        {room.reservaActual.locator} • {room.reservaActual.huesped}
                                      </span>
                                    )}
                                  </div>
                                ) : isMantenimiento ? (
                                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                                    MANTENIMIENTO
                                  </span>
                                ) : (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                      <CheckCircle2 className="h-3 w-3" />
                                      DISPONIBLE
                                    </span>
                                    {room.ultimaLimpiezaAt && (
                                      <span className="block text-[10px] text-brand-text/50 mt-0.5">
                                        Limpia: {new Date(room.ultimaLimpiezaAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                {isCleaning ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConfirmCleanModal(room)}
                                    className="btn-primary py-1.5 px-3 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-sm"
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Confirmar Limpieza
                                  </button>
                                ) : isAvailable ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRequestCleaning(room)}
                                    className="btn-secondary py-1 px-2.5 text-[10px] text-brand-text/75 hover:border-amber-500 hover:text-amber-500 cursor-pointer"
                                    title="Enviar habitación a limpieza preventiva"
                                  >
                                    Solicitar Limpieza
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-brand-text/40 italic">Ocupada</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
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
