import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Sparkles,
  Download,
  Trash2,
  AlertTriangle,
  MousePointer,
  Network,
  Gauge,
  Clock,
  Zap,
  Monitor,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import {
  observabilityService,
  type ObservabilitySnapshot,
  type ObservabilityEventType,
} from '../services/observability.service';

export const ObservabilityPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot>(() =>
    observabilityService.getSnapshot(),
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    setSnapshot(observabilityService.getSnapshot());
    setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  }, []);

  useEffect(() => {
    // Suscribirse a cambios emitidos por el servicio de observabilidad
    const unsubscribe = observabilityService.subscribe(() => {
      setSnapshot(observabilityService.getSnapshot());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleAddDemoEvent = () => {
    observabilityService.addDemoEvent(
      `Verificación interactiva de telemetría RUM #${Math.floor(Math.random() * 900 + 100)}`,
    );
    refreshData();
  };

  const handleDownloadSnapshot = () => {
    observabilityService.downloadSnapshotJson();
  };

  const handleClearStorage = () => {
    if (
      window.confirm(
        '¿Deseas purgar todas las métricas y eventos almacenados localmente en este navegador?',
      )
    ) {
      observabilityService.clearStorage();
      refreshData();
    }
  };

  const formatTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const getTypeBadge = (type: ObservabilityEventType) => {
    switch (type) {
      case 'Error':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ShieldAlert className="h-3 w-3" />
            Error
          </span>
        );
      case 'API':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Network className="h-3 w-3" />
            API
          </span>
        );
      case 'Carga':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Clock className="h-3 w-3" />
            Carga
          </span>
        );
      case 'Inicio':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-primary/15 px-2 py-0.5 text-xs font-semibold text-brand-primary dark:text-[#C5A059] border border-brand-primary/20">
            <Zap className="h-3 w-3" />
            Inicio
          </span>
        );
      case 'Visibilidad':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Radio className="h-3 w-3" />
            Visibilidad
          </span>
        );
      case 'Demo':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Sparkles className="h-3 w-3" />
            Demo
          </span>
        );
    }
  };

  const { metrics, api, session, environment, apiSupport, events } = snapshot;

  const firstByte = metrics.ttfbMs !== null ? `${metrics.ttfbMs} ms` : '—';
  const domReady = metrics.domReadyMs !== null ? `${metrics.domReadyMs} ms` : '—';
  const fcp = metrics.fcpMs !== null ? `${metrics.fcpMs} ms` : '—';
  const timingsLine = `${firstByte} / ${domReady} / ${fcp}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-left">
      {/* Encabezado y Acciones */}
      <div className="flex flex-col gap-4 border-b border-brand-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary dark:bg-[#C5A059]/15 dark:text-[#C5A059]">
              <Activity className="h-5 w-5" />
            </span>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">
              Observabilidad del navegador
            </h1>
          </div>
          <p className="mt-1.5 text-xs text-brand-text/70 sm:text-sm">
            Estos datos son locales de este navegador: se guardan en{' '}
            <code className="rounded bg-brand-text/5 px-1.5 py-0.5 font-mono text-xs text-brand-primary dark:text-[#C5A059]">
              localStorage
            </code>{' '}
            y no se envían a ningún servidor.
          </p>
        </div>

        {/* 4 Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshData}
            title="Refrescar métricas en pantalla"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-medium text-brand-text/80 shadow-xs hover:border-brand-primary hover:text-brand-text transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-primary' : ''}`} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={handleAddDemoEvent}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-xs font-semibold text-brand-primary dark:text-[#C5A059] shadow-xs hover:bg-brand-primary/20 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar evento de demostración
          </button>

          <button
            type="button"
            onClick={handleDownloadSnapshot}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-medium text-brand-text/80 shadow-xs hover:border-brand-primary hover:text-brand-text transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar snapshot JSON
          </button>

          <button
            type="button"
            onClick={handleClearStorage}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar almacenamiento
          </button>
        </div>
      </div>

      {/* Grid de 6 Tarjetas KPI Superiores */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* KPI 1: Errores */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-brand-text/70">
            <span>Errores</span>
            <AlertTriangle className={`h-4 w-4 ${session.totalErrors > 0 ? 'text-rose-500' : 'text-brand-text/40'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-brand-text">
              {session.totalErrors}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-text/50 truncate">
            JS, React, promesas, recursos
          </p>
        </div>

        {/* KPI 2: Clics Registrados */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-brand-text/70">
            <span>Clics registrados</span>
            <MousePointer className="h-4 w-4 text-brand-primary dark:text-[#C5A059]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-brand-text">
              {session.totalClicks}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-text/50 truncate">
            Interacciones del usuario
          </p>
        </div>

        {/* KPI 3: Llamadas al API */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-brand-text/70">
            <span>Llamadas al API</span>
            <Network className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-brand-text">
              {api.totalCalls}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-text/50 truncate">
            {api.errorCalls > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                {api.errorCalls} con error
              </span>
            ) : (
              '0 con error'
            )}
          </p>
        </div>

        {/* KPI 4: p95 de Latencia */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-brand-text/70">
            <span>p95 latencia API</span>
            <Gauge className="h-4 w-4 text-brand-accent dark:text-[#C5A059]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-brand-text">
              {api.p95 !== null ? `${api.p95}` : '—'}
            </span>
            {api.p95 !== null && <span className="text-xs text-brand-text/60">ms</span>}
          </div>
          <p className="mt-1 text-[11px] text-brand-text/50 truncate">
            {api.p95 !== null ? 'Percentil 95 de red' : 'No disponible'}
          </p>
        </div>

        {/* KPI 5: Tiempo de Carga */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-brand-text/70">
            <span>Tiempo de carga</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-brand-text">
              {metrics.loadTimeMs !== null ? `${metrics.loadTimeMs}` : '—'}
            </span>
            {metrics.loadTimeMs !== null && <span className="text-xs text-brand-text/60">ms</span>}
          </div>
          <p className="mt-1 text-[11px] text-brand-text/50 truncate">
            {metrics.loadTimeMs !== null ? 'loadEventEnd - start' : 'Calculando...'}
          </p>
        </div>

        {/* KPI 6: LCP (Pintura Más Grande) */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs text-brand-text/70">
            <span>LCP (Pintura grande)</span>
            <Zap className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-serif text-brand-text">
              {metrics.lcpMs !== null ? `${metrics.lcpMs}` : '—'}
            </span>
            {metrics.lcpMs !== null && <span className="text-xs text-brand-text/60">ms</span>}
          </div>
          <p className="mt-1 text-[11px] text-brand-text/50 truncate">
            {metrics.lcpMs !== null ? 'Largest Contentful Paint' : 'Calculando...'}
          </p>
        </div>
      </div>

      {/* Sección Media (2 Columnas: Entorno y Soporte de APIs) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna 1: Tarjeta Entorno */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-brand-border pb-3">
            <Monitor className="h-4 w-4 text-brand-primary dark:text-[#C5A059]" />
            <h2 className="font-serif text-base font-bold text-brand-text">
              Entorno
            </h2>
          </div>

          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-brand-border/40">
              <dt className="text-brand-text/60">Ventana</dt>
              <dd className="font-mono text-brand-text font-medium">{environment.windowSize}</dd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-brand-border/40">
              <dt className="text-brand-text/60">Conexión</dt>
              <dd className="font-mono text-brand-text font-medium">{environment.connectionType}</dd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-brand-border/40">
              <dt className="text-brand-text/60">Primer byte / DOM listo / FCP</dt>
              <dd className="font-mono text-brand-text font-medium">{timingsLine}</dd>
            </div>
            <div className="flex items-center justify-between py-1">
              <dt className="text-brand-text/60">Eventos guardados</dt>
              <dd className="font-mono text-brand-text font-medium">
                {events.length} de 200 <span className="text-brand-text/40 font-sans font-normal">(los más antiguos se descartan)</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Columna 2: Tarjeta Soporte de APIs */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-brand-border pb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h2 className="font-serif text-base font-bold text-brand-text">
              Soporte de APIs del navegador
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {apiSupport.map((apiItem) => (
              <div
                key={apiItem.id}
                className="flex items-center justify-between rounded-xl border border-brand-border/50 bg-brand-bg/50 px-3 py-2"
              >
                <span className="font-medium text-brand-text truncate mr-2" title={apiItem.description}>
                  {apiItem.name}
                </span>
                {apiItem.supported ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[11px]">✓</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[11px]">✕</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección Inferior: Tabla "Últimos eventos" */}
      <div className="mt-8 rounded-2xl border border-brand-border bg-brand-surface shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-primary dark:text-[#C5A059]" />
            <h2 className="font-serif text-base font-bold text-brand-text">
              Últimos eventos
            </h2>
          </div>
          <span className="rounded-full bg-brand-text/5 px-2.5 py-0.5 text-xs font-mono font-medium text-brand-text/70">
            {events.length} registro(s)
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-text/50">
            No se han registrado eventos todavía en esta sesión.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-brand-border/60 bg-brand-bg/40 font-semibold text-brand-text/70 uppercase tracking-wider text-[11px]">
                <tr>
                  <th scope="col" className="px-5 py-3 w-32">
                    Hora
                  </th>
                  <th scope="col" className="px-5 py-3 w-36">
                    Tipo
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40 font-mono">
                {events.map((evt) => (
                  <tr
                    key={evt.id}
                    className="hover:bg-brand-bg/30 transition-colors"
                  >
                    <td className="whitespace-nowrap px-5 py-2.5 text-brand-text/60">
                      {formatTime(evt.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 font-sans">
                      {getTypeBadge(evt.type)}
                    </td>
                    <td className="px-5 py-2.5 text-brand-text break-words font-sans">
                      {evt.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
