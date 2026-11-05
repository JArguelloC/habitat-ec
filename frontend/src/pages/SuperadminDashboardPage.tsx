import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  UserPlus,
  Users,
  Database,
  FileSearch,
  Webhook,
  PlusCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import {
  sanitizeOnlyLetters,
  validateEmail,
  sanitizeCedulaRuc,
  validateEcuadorianCedulaRuc,
  evaluatePasswordStrength,
} from '../utils/validators';

interface UserRoleItem {
  rolId?: number;
  rol_id?: number;
  codigo?: string;
  nombre?: string;
  descripcion?: string;
}

interface GlobalUserItem {
  usuario_id: string;
  cedula_ruc: string | null;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  activo: boolean;
  roles: Array<UserRoleItem | string>;
}

interface RoleDefItem {
  rol_id: number;
  codigo?: string;
  codigo_rol?: string;
  nombre?: string;
  nombre_rol?: string;
  descripcion?: string;
}

interface AuditoriaForenseItem {
  auditoria_id: number;
  nombre_tabla: string;
  operacion: string;
  registro_id: string;
  correlation_id: string;
  ejecutado_en: string;
}

interface OutboxEventItem {
  event_id: string;
  correlation_id: string;
  event_type: string;
  resource_id: string;
  protocolo_origen: string;
  estado_despacho: string;
  timestamp: string;
}

interface WebhookSubItem {
  id: number;
  url: string;
  eventos: string[];
  activo: boolean;
  creado_en: string;
}

export const SuperadminDashboardPage: React.FC = () => {
  const { notify } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'catalogs' | 'audit'>('users');
  const [loading, setLoading] = useState(true);

  // Tab 1 State
  const [usuarios, setUsuarios] = useState<GlobalUserItem[]>([]);
  const [rolesList, setRolesList] = useState<RoleDefItem[]>([]);
  const [admNombre, setAdmNombre] = useState('');
  const [admApellido, setAdmApellido] = useState('');
  const [admCorreo, setAdmCorreo] = useState('');
  const [admPassword, setAdmPassword] = useState('');
  const [admCedula, setAdmCedula] = useState('');
  const [admTelefono, setAdmTelefono] = useState('');
  const [admScope, setAdmScope] = useState('TENANT_ALL');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Tab 2 State
  const [ciudades, setCiudades] = useState<Array<Record<string, unknown>>>([]);
  const [tipos, setTipos] = useState<Array<Record<string, unknown>>>([]);
  const [facilidades, setFacilidades] = useState<Array<Record<string, unknown>>>([]);
  const [reglas, setReglas] = useState<Array<Record<string, unknown>>>([]);
  const [cadenas, setCadenas] = useState<Array<Record<string, unknown>>>([]);
  const [matriz5fn, setMatriz5fn] = useState<{
    proyeccionCanalPoliticas?: Array<{
      canal_id: number;
      codigo_protocolo: string;
      politica_id: number;
      codigo_politica: string;
    }>;
  } | null>(null);

  // Catalog Creation Mini-Forms
  const [newCiudadNombre, setNewCiudadNombre] = useState('');
  const [newCiudadProvinciaId, setNewCiudadProvinciaId] = useState<number>(1);
  const [provinciasList, setProvinciasList] = useState<Array<{ provinciaId: number; nombre: string }>>([
    { provinciaId: 1, nombre: 'Azuay' },
    { provinciaId: 2, nombre: 'Bolívar' },
    { provinciaId: 3, nombre: 'Cañar' },
    { provinciaId: 4, nombre: 'Carchi' },
    { provinciaId: 5, nombre: 'Chimborazo' },
    { provinciaId: 6, nombre: 'Cotopaxi' },
    { provinciaId: 7, nombre: 'El Oro' },
    { provinciaId: 8, nombre: 'Esmeraldas' },
    { provinciaId: 9, nombre: 'Galápagos' },
    { provinciaId: 10, nombre: 'Guayas' },
    { provinciaId: 11, nombre: 'Imbabura' },
    { provinciaId: 12, nombre: 'Loja' },
    { provinciaId: 13, nombre: 'Los Ríos' },
    { provinciaId: 14, nombre: 'Manabí' },
    { provinciaId: 15, nombre: 'Morona Santiago' },
    { provinciaId: 16, nombre: 'Napo' },
    { provinciaId: 17, nombre: 'Orellana' },
    { provinciaId: 18, nombre: 'Pastaza' },
    { provinciaId: 19, nombre: 'Pichincha' },
    { provinciaId: 20, nombre: 'Santa Elena' },
    { provinciaId: 21, nombre: 'Santo Domingo de los Tsáchilas' },
    { provinciaId: 22, nombre: 'Sucumbíos' },
    { provinciaId: 23, nombre: 'Tungurahua' },
    { provinciaId: 24, nombre: 'Zamora Chinchipe' },
  ]);
  const [newCiudadLat, setNewCiudadLat] = useState(-0.1807);
  const [newCiudadLng, setNewCiudadLng] = useState(-78.4678);

  const [newTipoCodigo, setNewTipoCodigo] = useState('');
  const [newTipoNombre, setNewTipoNombre] = useState('');

  const [newFacCodigo, setNewFacCodigo] = useState('');
  const [newFacNombre, setNewFacNombre] = useState('');
  const [newFacEco, setNewFacEco] = useState(true);

  const [newReglaCodigo, setNewReglaCodigo] = useState('');
  const [newReglaDesc, setNewReglaDesc] = useState('');

  const [newCadenaNombre, setNewCadenaNombre] = useState('');

  const [canalId5fn, setCanalId5fn] = useState<number>(1);
  const [politicaId5fn, setPoliticaId5fn] = useState<number>(1);

  // Tab 3 State
  const [forenseLogs, setForenseLogs] = useState<AuditoriaForenseItem[]>([]);
  const [outboxLogs, setOutboxLogs] = useState<OutboxEventItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubItem[]>([]);
  const [whUrl, setWhUrl] = useState('');
  const [whSecret, setWhSecret] = useState('');
  const [submittingWh, setSubmittingWh] = useState(false);
  const [dispatchingOutbox, setDispatchingOutbox] = useState(false);

  const loadAllSuperadminData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        uRes,
        rRes,
        cRes,
        tRes,
        fRes,
        regRes,
        cadRes,
        m5Res,
        forRes,
        outRes,
        whRes,
      ] = await Promise.all([
        httpClient.get<GlobalUserItem[]>('/usuarios'),
        httpClient.get<unknown>('/usuarios/roles'),
        httpClient.get<Array<Record<string, unknown>>>('/catalogos/ciudades'),
        httpClient.get<Array<Record<string, unknown>>>('/catalogos/tipos-alojamiento'),
        httpClient.get<Array<Record<string, unknown>>>('/catalogos/facilidades'),
        httpClient.get<Array<Record<string, unknown>>>('/catalogos/reglas-convivencia'),
        httpClient.get<Array<Record<string, unknown>>>('/catalogos/cadenas-marcas'),
        httpClient.get('/catalogos/matriz-5fn'),
        httpClient.get<AuditoriaForenseItem[]>('/auditoria/forense?limite=25'),
        httpClient.get<OutboxEventItem[]>('/auditoria/outbox?limite=25'),
        httpClient.get<WebhookSubItem[]>('/webhooks'),
      ]);

      const rawRoles = rRes.data as { roles?: RoleDefItem[] } | RoleDefItem[] | undefined;
      const parsedRoles: RoleDefItem[] = Array.isArray(rawRoles)
        ? rawRoles
        : rawRoles?.roles && Array.isArray(rawRoles.roles)
        ? rawRoles.roles
        : [];

      setUsuarios(Array.isArray(uRes.data) ? uRes.data : []);
      setRolesList(parsedRoles);
      setCiudades(Array.isArray(cRes.data) ? cRes.data : []);
      setTipos(Array.isArray(tRes.data) ? tRes.data : []);
      setFacilidades(Array.isArray(fRes.data) ? fRes.data : []);
      setReglas(Array.isArray(regRes.data) ? regRes.data : []);
      setCadenas(Array.isArray(cadRes.data) ? cadRes.data : []);
      setMatriz5fn(m5Res.data || null);
      setForenseLogs(Array.isArray(forRes.data) ? forRes.data : []);
      setOutboxLogs(Array.isArray(outRes.data) ? outRes.data : []);
      setWebhooks(Array.isArray(whRes.data) ? whRes.data : []);

      try {
        const provRes = await httpClient.get<Array<{ provinciaId: number; nombre: string }>>('/catalogos/provincias');
        if (Array.isArray(provRes.data) && provRes.data.length > 0) {
          setProvinciasList(provRes.data);
          setNewCiudadProvinciaId((curr) => {
            const exists = provRes.data.some((p) => p.provinciaId === curr);
            return exists ? curr : provRes.data[0].provinciaId;
          });
        }
      } catch {
        // Fallback a provincias principales
      }
    } catch (err: unknown) {
      notify('error', 'Error cargando consola Superadmin', extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAllSuperadminData();
  }, [loadAllSuperadminData]);

  // Create ADMIN Account (`POST /superadmin/crear-admin`)
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);
    try {
      await httpClient.post('/superadmin/crear-admin', {
        nombre: admNombre.trim(),
        apellido: admApellido.trim(),
        correo: admCorreo.trim(),
        password: admPassword,
        cedulaRuc: admCedula.trim() || undefined,
        telefono: admTelefono.trim() || undefined,
        scopeRecursoCodigo: admScope.trim() || 'TENANT_ALL',
      });

      notify(
        'success',
        'Cuenta ADMIN Creada',
        `El usuario ${admCorreo} ahora cuenta con privilegios de Anfitrión (ADMIN).`,
      );
      setAdmNombre('');
      setAdmApellido('');
      setAdmCorreo('');
      setAdmPassword('');
      setAdmCedula('');
      setAdmTelefono('');
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'No se pudo crear el ADMIN', extractErrorMessage(err));
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Catalog Creators
  const handleCreateCiudad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.post('/catalogos/ciudades', {
        provinciaId: Number(newCiudadProvinciaId) || 1,
        nombre: newCiudadNombre.trim(),
        latitud: Number(newCiudadLat),
        longitud: Number(newCiudadLng),
      });
      notify('success', 'Ciudad creada', `Se registró ${newCiudadNombre} con coordenadas PostGIS.`);
      setNewCiudadNombre('');
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error creando ciudad', extractErrorMessage(err));
    }
  };

  const handleDeleteCiudad = async (ciudadId: number, nombre: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la ciudad "${nombre}"?`)) return;
    try {
      await httpClient.delete(`/catalogos/ciudades/${ciudadId}`);
      notify('success', 'Ciudad eliminada', `Se eliminó ${nombre} del catálogo.`);
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error eliminando ciudad', extractErrorMessage(err));
    }
  };

  const handleCreateTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.post('/catalogos/tipos-alojamiento', {
        codigo: newTipoCodigo.trim().toUpperCase(),
        nombre: newTipoNombre.trim(),
      });
      notify('success', 'Tipo de alojamiento creado', newTipoNombre);
      setNewTipoCodigo('');
      setNewTipoNombre('');
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error creando tipo', extractErrorMessage(err));
    }
  };

  const handleCreateFacilidad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.post('/catalogos/facilidades', {
        codigo: newFacCodigo.trim().toUpperCase(),
        nombre: newFacNombre.trim(),
        esSostenible: newFacEco,
      });
      notify('success', 'Facilidad registrada', newFacNombre);
      setNewFacCodigo('');
      setNewFacNombre('');
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error creando facilidad', extractErrorMessage(err));
    }
  };

  const handleCreateRegla = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.post('/catalogos/reglas-convivencia', {
        codigo: newReglaCodigo.trim().toUpperCase(),
        descripcion: newReglaDesc.trim(),
      });
      notify('success', 'Regla de convivencia creada', newReglaCodigo);
      setNewReglaCodigo('');
      setNewReglaDesc('');
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error creando regla', extractErrorMessage(err));
    }
  };

  const handleCreateCadena = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await httpClient.post('/catalogos/cadenas-hoteleras', {
        nombre: newCadenaNombre.trim(),
      });
      notify('success', 'Cadena hotelera registrada', newCadenaNombre);
      setNewCadenaNombre('');
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error creando cadena', extractErrorMessage(err));
    }
  };

  const handleEnable5fnPair = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await httpClient.post<{ yaExistia?: boolean; mensaje?: string }>(
        '/catalogos/canal-politicas',
        {
          canalId: Number(canalId5fn),
          politicaId: Number(politicaId5fn),
        },
      );

      if (data?.yaExistia) {
        notify(
          'info',
          'Matriz 5FN ya activa',
          `El par (Canal #${canalId5fn} × Política #${politicaId5fn}) ya se encuentra habilitado en el catálogo.`,
        );
      } else {
        notify(
          'success',
          'Matriz 5FN actualizada',
          `Par (Canal #${canalId5fn} × Política #${politicaId5fn}) habilitado en canal_politicas.`,
        );
      }
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error actualizando Matriz 5FN', extractErrorMessage(err));
    }
  };

  const handleSubscribeWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWh(true);
    try {
      await httpClient.post('/webhooks/subscribe', {
        url: whUrl.trim(),
        secret: whSecret.trim(),
        eventTypes: ['ORDER_CONFIRMED', 'ORDER_CANCELLED', 'ACCOMMODATION_UPDATED'],
      });
      notify('success', 'Webhook B2B suscrito', `Endpoint registrado: ${whUrl}`);
      setWhUrl('');
      setWhSecret('');
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error registrando Webhook', extractErrorMessage(err));
    } finally {
      setSubmittingWh(false);
    }
  };

  const handleDispatchOutbox = async () => {
    setDispatchingOutbox(true);
    try {
      const { data } = await httpClient.post<{
        mensaje: string;
        eventosProcesados: number;
      }>('/auditoria/outbox/despachar');
      notify('success', 'Worker Transactional Outbox Ejecutado', data.mensaje);
      await loadAllSuperadminData();
    } catch (err: unknown) {
      notify('error', 'Error despachando Outbox', extractErrorMessage(err));
    } finally {
      setDispatchingOutbox(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/25 border border-brand-primary/40 px-3 py-1 text-xs font-bold text-brand-primary mb-2">
            <ShieldAlert className="h-3.5 w-3.5" />
            Gobierno Global & Seguridad RBAC (Exclusivo SUPERADMIN)
          </span>
          <h1 className="font-serif text-3xl font-bold text-brand-text">
            Consola Maestra del Superadministrador
          </h1>
          <p className="mt-1 text-xs text-brand-text/65">
            Alta exclusiva de cuentas ADMIN, catálogos nacionales, matriz 5FN, bitácora forense y
            Transactional Outbox.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAllSuperadminData()}
          className="btn-secondary self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar Datos
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-brand-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'users'
              ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
              : 'bg-brand-surface text-brand-text/75 border border-brand-border hover:border-brand-accent'
          }`}
        >
          <Users className="h-4 w-4" />
          Pestaña 1: Usuarios y Creación de ADMINs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('catalogs')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'catalogs'
              ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
              : 'bg-brand-surface text-brand-text/75 border border-brand-border hover:border-brand-accent'
          }`}
        >
          <Database className="h-4 w-4" />
          Pestaña 2: Catálogos Maestros y Matriz 5FN
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'audit'
              ? 'bg-brand-secondary text-brand-bg font-bold shadow-sm'
              : 'bg-brand-surface text-brand-text/75 border border-brand-border hover:border-brand-accent'
          }`}
        >
          <FileSearch className="h-4 w-4" />
          Pestaña 3: Auditoría Forense, Outbox y Webhooks
        </button>
      </div>

      {/* TAB 1: USERS & EXCLUSIVE ADMIN PROVISIONING */}
      {activeTab === 'users' && (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Create ADMIN Form (5 cols) */}
          <div className="lg:col-span-5 card-surface p-6">
            <div className="flex items-center gap-2.5 border-b border-brand-border pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/25 text-brand-accent">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-brand-text">
                  Aprovisionar Nuevo Anfitrión (ADMIN)
                </h2>
                <p className="text-[11px] text-brand-text/65">
                  Endpoint exclusivo: <code className="font-mono">POST /superadmin/crear-admin</code>
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAdmin} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nombre * (Solo letras)</label>
                  <input
                    type="text"
                    required
                    value={admNombre}
                    onChange={(e) => setAdmNombre(sanitizeOnlyLetters(e.target.value))}
                    placeholder="Sebastián"
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Apellido * (Solo letras)</label>
                  <input
                    type="text"
                    required
                    value={admApellido}
                    onChange={(e) => setAdmApellido(sanitizeOnlyLetters(e.target.value))}
                    placeholder="Andrade"
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Correo Corporativo *</label>
                <input
                  type="email"
                  required
                  value={admCorreo}
                  onChange={(e) => setAdmCorreo(e.target.value.trim())}
                  placeholder="anfitrion@hotel-ecuador.com"
                  className="input-field text-xs"
                />
                {admCorreo.length > 0 && (
                  <p
                    className={`mt-1 text-[10px] ${
                      validateEmail(admCorreo).valid
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {validateEmail(admCorreo).message}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Contraseña Inicial *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={admPassword}
                  onChange={(e) => setAdmPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="input-field text-xs"
                />
                {admPassword.length > 0 && (
                  <p className="mt-1 text-[10px] text-brand-text/75">
                    Fortaleza: <strong>{evaluatePasswordStrength(admPassword).label}</strong> (
                    {evaluatePasswordStrength(admPassword).score}/5)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Cédula / RUC (10-13 díg.)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    value={admCedula}
                    onChange={(e) => setAdmCedula(sanitizeCedulaRuc(e.target.value))}
                    placeholder="1790012345001"
                    className="input-field text-xs"
                  />
                  {admCedula.length > 0 && (
                    <p
                      className={`mt-1 text-[10px] leading-tight ${
                        validateEcuadorianCedulaRuc(admCedula).valid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {validateEcuadorianCedulaRuc(admCedula).message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-semibold mb-1">Scope RBAC</label>
                  <input
                    type="text"
                    value={admScope}
                    onChange={(e) => setAdmScope(e.target.value)}
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingAdmin}
                className="btn-primary w-full py-2.5 text-xs font-bold mt-2"
              >
                {creatingAdmin ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando cuenta ADMIN...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Crear Cuenta ADMIN Verificada
                  </>
                )}
              </button>
            </form>

            {/* Roles Reference */}
            <div className="mt-6 border-t border-brand-border pt-4">
              <span className="text-[11px] font-bold uppercase text-brand-text/60 block mb-2">
                Catálogo de Roles RBAC (`roles`):
              </span>
              <div className="flex flex-wrap gap-2">
                {rolesList.map((r) => (
                  <span key={r.rol_id} className="chip-gold text-[11px]">
                    #{r.rol_id} {r.codigo || r.nombre || r.codigo_rol || r.nombre_rol || 'ROL'}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Global Users Table (7 cols) */}
          <div className="lg:col-span-7 card-surface overflow-hidden">
            <div className="p-5 border-b border-brand-border">
              <h2 className="font-serif text-lg font-bold text-brand-text">
                Directorio Global de Usuarios (`GET /usuarios`)
              </h2>
              <p className="text-xs text-brand-text/65">
                {usuarios.length} cuenta(s) registradas con sus asignaciones en `usuario_roles`
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bg border-b border-brand-border text-[11px] font-bold uppercase text-brand-text/70">
                  <tr>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Correo</th>
                    <th className="px-4 py-3">Roles Asignados</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {usuarios.map((u) => (
                    <tr key={u.usuario_id} className="hover:bg-brand-bg/50">
                      <td className="px-4 py-3 font-semibold text-brand-text">
                        {u.nombre} {u.apellido}
                      </td>
                      <td className="px-4 py-3 text-brand-text/80">{u.correo}</td>
                      <td className="px-4 py-3 space-x-1">
                        {(u.roles || []).map((rol, rIdx) => {
                          const rolCodigo =
                            typeof rol === 'string'
                              ? rol
                              : (rol?.codigo || rol?.nombre || 'ROL');
                          return (
                            <span
                              key={rIdx}
                              className="rounded-md bg-brand-primary/25 px-2 py-0.5 text-[10px] font-bold text-brand-accent inline-block"
                            >
                              {rolCodigo}
                            </span>
                          );
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="chip-sage text-[10px]">
                          <CheckCircle2 className="h-3 w-3" />
                          Activo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MASTER CATALOGS & 5FN MATRIX */}
      {activeTab === 'catalogs' && (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Ciudades */}
          <div className="card-surface p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold text-brand-text">
              1. Catálogo de Ciudades PostGIS ({ciudades.length})
            </h3>
            <form onSubmit={handleCreateCiudad} className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <input
                type="text"
                required
                value={newCiudadNombre}
                onChange={(e) => setNewCiudadNombre(e.target.value)}
                placeholder="Ciudad (ej. Guayaquil)"
                className="input-field text-xs"
              />
              <select
                value={newCiudadProvinciaId}
                onChange={(e) => setNewCiudadProvinciaId(Number(e.target.value))}
                className="input-field text-xs bg-brand-surface border border-brand-border"
              >
                {provinciasList.map((p) => (
                  <option key={p.provinciaId} value={p.provinciaId}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.0001"
                required
                value={newCiudadLat}
                onChange={(e) => setNewCiudadLat(Number(e.target.value))}
                placeholder="Latitud"
                className="input-field text-xs"
              />
              <input
                type="number"
                step="0.0001"
                required
                value={newCiudadLng}
                onChange={(e) => setNewCiudadLng(Number(e.target.value))}
                placeholder="Longitud"
                className="input-field text-xs"
              />
              <button type="submit" className="btn-primary text-xs py-2 flex items-center justify-center gap-1">
                <PlusCircle className="h-3.5 w-3.5" />
                Añadir
              </button>
            </form>
            <div className="max-h-36 overflow-y-auto divide-y divide-brand-border text-xs">
              {ciudades.map((c, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between">
                  <span className="font-semibold">{String(c.nombre)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-brand-text/60">{String(c.provincia || 'Ecuador')}</span>
                    {c.ciudad_id != null && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCiudad(Number(c.ciudad_id), String(c.nombre))}
                        className="text-red-500 hover:text-red-700 p-0.5 rounded transition-colors"
                        title="Eliminar ciudad"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tipos de Alojamiento */}
          <div className="card-surface p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold text-brand-text">
              2. Dominio de Tipos de Alojamiento ({tipos.length})
            </h3>
            <form onSubmit={handleCreateTipo} className="grid grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                required
                value={newTipoCodigo}
                onChange={(e) => setNewTipoCodigo(e.target.value)}
                placeholder="Código (CABANA)"
                className="input-field text-xs"
              />
              <input
                type="text"
                required
                value={newTipoNombre}
                onChange={(e) => setNewTipoNombre(e.target.value)}
                placeholder="Nombre (Cabaña)"
                className="input-field text-xs"
              />
              <button type="submit" className="btn-primary text-xs py-2">
                <PlusCircle className="h-3.5 w-3.5" />
                Añadir
              </button>
            </form>
            <div className="max-h-36 overflow-y-auto divide-y divide-brand-border text-xs">
              {tipos.map((t, idx) => (
                <div key={idx} className="py-1.5 flex justify-between">
                  <span className="font-semibold">{String(t.nombre)}</span>
                  <code className="font-mono text-[11px]">{String(t.codigo)}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Facilidades */}
          <div className="card-surface p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold text-brand-text">
              3. Facilidades y Sellos Verdes ({facilidades.length})
            </h3>
            <form onSubmit={handleCreateFacilidad} className="grid grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                required
                value={newFacCodigo}
                onChange={(e) => setNewFacCodigo(e.target.value)}
                placeholder="Código (SOLAR)"
                className="input-field text-xs"
              />
              <input
                type="text"
                required
                value={newFacNombre}
                onChange={(e) => setNewFacNombre(e.target.value)}
                placeholder="Nombre"
                className="input-field text-xs"
              />
              <button type="submit" className="btn-primary text-xs py-2">
                <PlusCircle className="h-3.5 w-3.5" />
                Crear
              </button>
            </form>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={newFacEco}
                onChange={(e) => setNewFacEco(e.target.checked)}
              />
              <span>Certificación Sostenible (`es_sostenible = true`)</span>
            </label>
            <div className="max-h-32 overflow-y-auto divide-y divide-brand-border text-xs">
              {facilidades.map((f, idx) => (
                <div key={idx} className="py-1.5 flex justify-between">
                  <span>{String(f.nombre)}</span>
                  <span className="chip-sage text-[10px]">
                    {f.es_sostenible ? 'Eco' : 'Estándar'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Reglas & Cadenas */}
          <div className="card-surface p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold text-brand-text">
              4. Reglas ({reglas.length}) y Cadenas Hoteleras ({cadenas.length})
            </h3>
            <form onSubmit={handleCreateRegla} className="grid grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                required
                value={newReglaCodigo}
                onChange={(e) => setNewReglaCodigo(e.target.value)}
                placeholder="Código Regla"
                className="input-field text-xs"
              />
              <input
                type="text"
                required
                value={newReglaDesc}
                onChange={(e) => setNewReglaDesc(e.target.value)}
                placeholder="Descripción"
                className="input-field text-xs"
              />
              <button type="submit" className="btn-secondary text-xs py-2">
                + Regla
              </button>
            </form>

            <form onSubmit={handleCreateCadena} className="grid grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                required
                value={newCadenaNombre}
                onChange={(e) => setNewCadenaNombre(e.target.value)}
                placeholder="Nombre Cadena Hotelera"
                className="input-field text-xs col-span-2"
              />
              <button type="submit" className="btn-secondary text-xs py-2">
                + Cadena
              </button>
            </form>
          </div>

          {/* Matriz 5FN */}
          <div className="md:col-span-2 card-surface p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-serif text-lg font-bold text-brand-text">
                  5. Matriz de Proyección en Quinta Forma Normal (`canal_politicas`)
                </h3>
                <p className="text-xs text-brand-text/65">
                  Gobierna las combinaciones válidas entre Protocolos de Integración y Políticas de
                  Cancelación.
                </p>
              </div>
              <form onSubmit={handleEnable5fnPair} className="flex items-center gap-2 text-xs">
                <select
                  value={canalId5fn}
                  onChange={(e) => setCanalId5fn(Number(e.target.value))}
                  className="input-field py-1.5 text-xs"
                >
                  <option value={1}>#1 WEB_REST</option>
                  <option value={2}>#2 OTA_GRAPHQL</option>
                </select>
                <select
                  value={politicaId5fn}
                  onChange={(e) => setPoliticaId5fn(Number(e.target.value))}
                  className="input-field py-1.5 text-xs"
                >
                  <option value={1}>#1 FREE_CANCELLATION</option>
                  <option value={2}>#2 PARTIAL_REFUND</option>
                  <option value={3}>#3 NON_REFUNDABLE</option>
                </select>
                <button type="submit" className="btn-primary py-1.5 px-3 text-xs">
                  Habilitar Par 5FN
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {(matriz5fn?.proyeccionCanalPoliticas || []).map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-brand-border bg-brand-bg p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold block">{item.codigo_politica}</span>
                    <span className="text-[11px] text-brand-text/60">{item.codigo_protocolo}</span>
                  </div>
                  <span className="chip-sage text-[10px]">5FN Activo</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FORENSIC AUDIT, OUTBOX & WEBHOOKS */}
      {activeTab === 'audit' && (
        <div className="mt-6 space-y-6">
          {/* Webhooks B2B */}
          <div className="card-surface p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-brand-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-brand-text flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-brand-accent" />
                  Suscripciones Webhook B2B (`POST /webhooks/subscribe`)
                </h3>
                <p className="text-xs text-brand-text/65">
                  Notificaciones firmadas con HMAC-SHA256 hacia sistemas externos
                </p>
              </div>

              <form
                onSubmit={handleSubscribeWebhook}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <input
                  type="url"
                  required
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  placeholder="https://partner.com/webhooks/habitat"
                  className="input-field w-64 py-2 text-xs"
                />
                <input
                  type="text"
                  required
                  minLength={16}
                  value={whSecret}
                  onChange={(e) => setWhSecret(e.target.value)}
                  placeholder="Secreto HMAC (mín. 16 chars)"
                  className="input-field w-52 py-2 text-xs font-mono"
                />
                <button type="submit" disabled={submittingWh} className="btn-primary py-2 text-xs">
                  Suscribir Endpoint
                </button>
              </form>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              {webhooks.length === 0 ? (
                <p className="text-brand-text/60">No hay suscripciones webhook registradas.</p>
              ) : (
                webhooks.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-bg px-4 py-2.5"
                  >
                    <span className="font-mono font-semibold">{w.url}</span>
                    <span className="chip-sage text-[10px]">HMAC-SHA256 Activo</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Forensic Audit Log */}
            <div className="card-surface overflow-hidden">
              <div className="p-5 border-b border-brand-border">
                <h3 className="font-serif text-lg font-bold text-brand-text">
                  Bitácora de Auditoría Forense (`auditoria_forense`)
                </h3>
                <p className="text-xs text-brand-text/65">
                  Capturada automáticamente mediante triggers DML en PostgreSQL
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-brand-border text-xs">
                {forenseLogs.length === 0 ? (
                  <p className="p-6 text-center text-brand-text/60">
                    Sin registros recientes en auditoría forense.
                  </p>
                ) : (
                  forenseLogs.map((log) => (
                    <div key={log.auditoria_id} className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-brand-text">
                          [{log.operacion}] {log.nombre_tabla}
                        </span>
                        <span className="ml-2 text-brand-text/60 font-mono">
                          ID: {log.registro_id}
                        </span>
                      </div>
                      <span className="text-[11px] text-brand-text/60">
                        {new Date(log.ejecutado_en).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Transactional Outbox */}
            <div className="card-surface overflow-hidden">
              <div className="p-5 border-b border-brand-border flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-bold text-brand-text">
                    Cola de Eventos (`outbox_events`)
                  </h3>
                  <p className="text-xs text-brand-text/65">
                    Eventos de dominio persistidos en la misma transacción ACID
                  </p>
                </div>
                <button
                  type="button"
                  disabled={dispatchingOutbox}
                  onClick={() => void handleDispatchOutbox()}
                  className="btn-primary py-1.5 px-3 text-xs"
                >
                  {dispatchingOutbox ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Despachar Outbox (HMAC)
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-brand-border text-xs">
                {outboxLogs.length === 0 ? (
                  <p className="p-6 text-center text-brand-text/60">
                    La cola Transactional Outbox está limpia.
                  </p>
                ) : (
                  outboxLogs.map((ev) => (
                    <div key={ev.event_id} className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-brand-accent">{ev.event_type}</span>
                        <span className="ml-2 text-brand-text/65">
                          ({ev.protocolo_origen} • #{ev.resource_id.slice(0, 8)})
                        </span>
                      </div>
                      <span
                        className={
                          ev.estado_despacho === 'ENVIADO'
                            ? 'chip-sage text-[10px]'
                            : 'chip-gold text-[10px]'
                        }
                      >
                        {ev.estado_despacho}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
