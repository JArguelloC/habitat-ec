/**
 * Módulo de Observabilidad Client-Side RUM (Real User Monitoring)
 * Hábitat EC - Plataforma de Hospitalidad Sostenible
 *
 * Captura y persiste métricas de rendimiento (Web Vitals), contadores de sesión,
 * latencia de API (p95) y bitácora circular en localStorage (clave: habitat_observability_events).
 */

export type ObservabilityEventType =
  | 'Carga'
  | 'Inicio'
  | 'Visibilidad'
  | 'API'
  | 'Error'
  | 'Demo';

export interface ObservabilityEvent {
  id: string;
  timestamp: string; // ISO 8601
  type: ObservabilityEventType;
  detail: string;
}

export interface ApiMetrics {
  totalCalls: number;
  errorCalls: number;
  durations: number[]; // Milisegundos de cada llamada
  p95: number | null;
}

export interface PerformanceMetrics {
  loadTimeMs: number | null;
  ttfbMs: number | null;
  domReadyMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
}

export interface SessionCounters {
  totalErrors: number;
  totalClicks: number;
}

export interface ApiSupportItem {
  id: string;
  name: string;
  supported: boolean;
  description: string;
}

export interface EnvironmentSnapshot {
  windowSize: string;
  devicePixelRatio: number;
  connectionType: string;
  effectiveType: string;
  downlinkSpeed: string;
  rtt: string;
  userAgent: string;
  platform: string;
  language: string;
}

export interface ObservabilitySnapshot {
  timestamp: string;
  metrics: PerformanceMetrics;
  api: ApiMetrics;
  session: SessionCounters;
  environment: EnvironmentSnapshot;
  apiSupport: ApiSupportItem[];
  events: ObservabilityEvent[];
}

const STORAGE_KEY_EVENTS = 'habitat_observability_events';
const STORAGE_KEY_API_METRICS = 'habitat_observability_api_metrics';
const STORAGE_KEY_SESSION = 'habitat_observability_session_counters';
const MAX_EVENTS_BUFFER = 200;

class ObservabilityService {
  private static instance: ObservabilityService;
  private isInitialized = false;

  private events: ObservabilityEvent[] = [];
  private apiMetrics: ApiMetrics = {
    totalCalls: 0,
    errorCalls: 0,
    durations: [],
    p95: null,
  };
  private sessionCounters: SessionCounters = {
    totalErrors: 0,
    totalClicks: 0,
  };
  private perfMetrics: PerformanceMetrics = {
    loadTimeMs: null,
    ttfbMs: null,
    domReadyMs: null,
    fcpMs: null,
    lcpMs: null,
  };

  private lcpObserver: PerformanceObserver | null = null;
  private fcpObserver: PerformanceObserver | null = null;
  private subscribers: Array<() => void> = [];

  private constructor() {
    this.loadPersistedState();
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): ObservabilityService {
    if (!ObservabilityService.instance) {
      ObservabilityService.instance = new ObservabilityService();
    }
    return ObservabilityService.instance;
  }

  /**
   * Inicializa los listeners del navegador y observadores de rendimiento
   */
  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Evento de inicio
    this.recordEvent('Inicio', 'Aplicación iniciada en el navegador');

    // 2. Medición de tiempos de carga y Navigation Timing
    this.captureNavigationMetrics();

    // 3. PerformanceObserver para LCP y FCP
    this.setupPerformanceObservers();

    // 4. Listeners globales de errores
    this.setupErrorListeners();

    // 5. Listener de clics globales
    this.setupClickListeners();

    // 6. Listener de cambios de visibilidad
    this.setupVisibilityListener();
  }

  /**
   * Suscribe a componentes UI para re-renderizado reactivo cuando cambian las métricas
   */
  public subscribe(callback: () => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      try {
        callback();
      } catch {
        // Silenciar errores en suscriptores para no desestabilizar la UI
      }
    }
  }

  /**
   * Carga métricas y eventos almacenados previamente en localStorage
   */
  private loadPersistedState(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      const rawEvents = localStorage.getItem(STORAGE_KEY_EVENTS);
      if (rawEvents) {
        const parsed = JSON.parse(rawEvents);
        if (Array.isArray(parsed)) {
          this.events = parsed.slice(-MAX_EVENTS_BUFFER);
        }
      }

      const rawApi = localStorage.getItem(STORAGE_KEY_API_METRICS);
      if (rawApi) {
        const parsed = JSON.parse(rawApi);
        if (parsed && typeof parsed.totalCalls === 'number') {
          this.apiMetrics = {
            totalCalls: parsed.totalCalls || 0,
            errorCalls: parsed.errorCalls || 0,
            durations: Array.isArray(parsed.durations) ? parsed.durations.slice(-200) : [],
            p95: typeof parsed.p95 === 'number' ? parsed.p95 : null,
          };
          this.recalculateP95();
        }
      }

      const rawSession = localStorage.getItem(STORAGE_KEY_SESSION);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed && typeof parsed.totalErrors === 'number') {
          this.sessionCounters = {
            totalErrors: parsed.totalErrors || 0,
            totalClicks: parsed.totalClicks || 0,
          };
        }
      }
    } catch {
      // Ignorar fallos de lectura de localStorage
    }
  }

  /**
   * Persiste eventos en buffer circular de 200 en localStorage
   */
  private persistEvents(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events.slice(-MAX_EVENTS_BUFFER)));
    } catch {
      // Buffer lleno o quota excedida
    }
  }

  private persistApiMetrics(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY_API_METRICS, JSON.stringify(this.apiMetrics));
    } catch {
      // Ignore
    }
  }

  private persistSessionCounters(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(this.sessionCounters));
    } catch {
      // Ignore
    }
  }

  /**
   * Registra un nuevo evento en el buffer circular
   */
  public recordEvent(type: ObservabilityEventType, detail: string): void {
    const newEvent: ObservabilityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      detail,
    };

    this.events.push(newEvent);
    if (this.events.length > MAX_EVENTS_BUFFER) {
      this.events = this.events.slice(-MAX_EVENTS_BUFFER);
    }

    this.persistEvents();
    this.notifySubscribers();
  }

  /**
   * Registra la duración y estado de una llamada a la API
   */
  public recordApiCall(durationMs: number, isError: boolean, endpoint = ''): void {
    const validDuration = Math.max(1, Math.round(durationMs));
    this.apiMetrics.totalCalls += 1;
    if (isError) {
      this.apiMetrics.errorCalls += 1;
    }

    this.apiMetrics.durations.push(validDuration);
    if (this.apiMetrics.durations.length > 300) {
      this.apiMetrics.durations = this.apiMetrics.durations.slice(-300);
    }

    this.recalculateP95();
    this.persistApiMetrics();

    if (isError) {
      this.sessionCounters.totalErrors += 1;
      this.persistSessionCounters();
      this.recordEvent('Error', `Llamada API fallida${endpoint ? ` [${endpoint}]` : ''} (${validDuration} ms)`);
    } else {
      this.recordEvent('API', `Llamada API completada${endpoint ? ` [${endpoint}]` : ''} (${validDuration} ms)`);
    }

    this.notifySubscribers();
  }

  /**
   * Recalcula el percentil 95 de latencia de red
   */
  private recalculateP95(): void {
    const list = this.apiMetrics.durations;
    if (list.length === 0) {
      this.apiMetrics.p95 = null;
      return;
    }

    const sorted = [...list].sort((a, b) => a - b);
    const index = Math.floor(0.95 * (sorted.length - 1));
    this.apiMetrics.p95 = sorted[index] ?? sorted[sorted.length - 1];
  }

  /**
   * Navigation Timing Metrics: Page Load, TTFB, DOMContentLoaded
   */
  private captureNavigationMetrics(): void {
    const compute = () => {
      try {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const nav = navEntries[0] as PerformanceNavigationTiming;
          const loadTime = Math.round(nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : performance.now());
          const ttfb = Math.round(nav.responseStart - nav.requestStart);
          const domReady = Math.round(nav.domContentLoadedEventEnd - nav.startTime);

          this.perfMetrics.loadTimeMs = loadTime > 0 ? loadTime : null;
          this.perfMetrics.ttfbMs = ttfb >= 0 ? ttfb : null;
          this.perfMetrics.domReadyMs = domReady > 0 ? domReady : null;

          this.recordEvent(
            'Carga',
            `Tiempos de carga de la página: Load=${loadTime} ms, TTFB=${ttfb} ms, DOMContentLoaded=${domReady} ms`,
          );
        } else if (window.performance && window.performance.timing) {
          const t = window.performance.timing;
          const loadTime = t.loadEventEnd > 0 ? t.loadEventEnd - t.navigationStart : null;
          const ttfb = t.responseStart > 0 ? t.responseStart - t.requestStart : null;
          const domReady = t.domContentLoadedEventEnd > 0 ? t.domContentLoadedEventEnd - t.navigationStart : null;

          this.perfMetrics.loadTimeMs = loadTime && loadTime > 0 ? loadTime : null;
          this.perfMetrics.ttfbMs = ttfb && ttfb >= 0 ? ttfb : null;
          this.perfMetrics.domReadyMs = domReady && domReady > 0 ? domReady : null;

          if (loadTime) {
            this.recordEvent('Carga', `Tiempos de carga de la página: Load=${loadTime} ms`);
          }
        }
      } catch {
        // Ignore navigation error
      }
      this.notifySubscribers();
    };

    if (document.readyState === 'complete') {
      setTimeout(compute, 100);
    } else {
      window.addEventListener('load', () => {
        setTimeout(compute, 100);
      });
    }
  }

  /**
   * PerformanceObserver para LCP y FCP
   */
  private setupPerformanceObservers(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    // LCP (Largest Contentful Paint)
    try {
      this.lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.perfMetrics.lcpMs = Math.round(lastEntry.startTime);
          this.notifySubscribers();
        }
      });
      this.lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Type unsupported
    }

    // FCP (First Contentful Paint)
    try {
      this.fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        for (const entry of entries) {
          if (entry.name === 'first-contentful-paint') {
            this.perfMetrics.fcpMs = Math.round(entry.startTime);
            this.notifySubscribers();
            break;
          }
        }
      });
      this.fcpObserver.observe({ type: 'paint', buffered: true });
    } catch {
      // Type unsupported
    }
  }

  /**
   * Listeners de errores de ventana y promesas no capturadas
   */
  private setupErrorListeners(): void {
    window.addEventListener('error', (event) => {
      this.sessionCounters.totalErrors += 1;
      this.persistSessionCounters();
      const message = event.message || 'Error no especificado en script o recurso';
      const source = event.filename ? ` (${event.filename}:${event.lineno || 0})` : '';
      this.recordEvent('Error', `Excepción capturada: ${message}${source}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.sessionCounters.totalErrors += 1;
      this.persistSessionCounters();
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === 'string'
            ? event.reason
            : 'Promesa rechazada sin control';
      this.recordEvent('Error', `Unhandled Promise Rejection: ${reason}`);
    });
  }

  /**
   * Listener global de clics en documento
   */
  private setupClickListeners(): void {
    document.addEventListener(
      'click',
      () => {
        this.sessionCounters.totalClicks += 1;
        this.persistSessionCounters();
        this.notifySubscribers();
      },
      { passive: true },
    );
  }

  /**
   * Listener de Visibilidad de Pestaña (Page Visibility API)
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.recordEvent('Visibilidad', 'Pestaña oculta (usuario cambió de ventana o minimizó)');
      } else if (document.visibilityState === 'visible') {
        this.recordEvent('Visibilidad', 'Pestaña visible (usuario regresó a la aplicación)');
      }
    });
  }

  /**
   * Genera un evento de demostración para probar la reactividad
   */
  public addDemoEvent(detail = 'Evento de demostración generado manualmente'): void {
    this.recordEvent('Demo', detail);
  }

  /**
   * Purga el almacenamiento local y resetea las métricas
   */
  public clearStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY_EVENTS);
        localStorage.removeItem(STORAGE_KEY_API_METRICS);
        localStorage.removeItem(STORAGE_KEY_SESSION);
      } catch {
        // Ignore
      }
    }

    this.events = [];
    this.apiMetrics = {
      totalCalls: 0,
      errorCalls: 0,
      durations: [],
      p95: null,
    };
    this.sessionCounters = {
      totalErrors: 0,
      totalClicks: 0,
    };

    this.recordEvent('Inicio', 'Almacenamiento de observabilidad reiniciado por el usuario');
    this.notifySubscribers();
  }

  /**
   * Auditoría en vivo de soporte de 10 APIs del navegador
   */
  public auditApiSupport(): ApiSupportItem[] {
    const hasWindow = typeof window !== 'undefined';
    const hasNav = typeof navigator !== 'undefined';

    type NavigatorWithConnection = Navigator & {
      connection?: {
        effectiveType?: string;
        type?: string;
        downlink?: number;
        rtt?: number;
      };
    };

    const navConn = hasNav ? (navigator as NavigatorWithConnection).connection : undefined;

    return [
      {
        id: 'perf',
        name: 'Performance API',
        supported: hasWindow && 'performance' in window,
        description: 'Medición de marcas temporales de alta precisión y Navigation Timing',
      },
      {
        id: 'perf-obs',
        name: 'PerformanceObserver',
        supported: hasWindow && 'PerformanceObserver' in window,
        description: 'Supervisión en tiempo real de Core Web Vitals (LCP, FID, CLS)',
      },
      {
        id: 'local-storage',
        name: 'localStorage',
        supported: hasWindow && 'localStorage' in window,
        description: 'Persistencia síncrona clave-valor del buffer circular de eventos',
      },
      {
        id: 'session-storage',
        name: 'sessionStorage',
        supported: hasWindow && 'sessionStorage' in window,
        description: 'Almacenamiento volátil aislado por ciclo de vida de pestaña',
      },
      {
        id: 'clipboard',
        name: 'Portapapeles (Clipboard API)',
        supported: hasNav && 'clipboard' in navigator,
        description: 'Lectura y escritura programática asíncrona del portapapeles',
      },
      {
        id: 'fetch',
        name: 'Fetch API',
        supported: hasWindow && 'fetch' in window,
        description: 'Cliente HTTP nativo estándar basado en promesas asíncronas',
      },
      {
        id: 'intersection-obs',
        name: 'IntersectionObserver',
        supported: hasWindow && 'IntersectionObserver' in window,
        description: 'Detección eficiente de visibilidad de elementos (Lazy Loading)',
      },
      {
        id: 'dialog',
        name: 'Diálogo <dialog>',
        supported: typeof HTMLDialogElement !== 'undefined',
        description: 'Soporte nativo para modales semánticos accesibles del DOM',
      },
      {
        id: 'service-worker',
        name: 'Service Worker',
        supported: hasNav && 'serviceWorker' in navigator,
        description: 'Intercepción de red en segundo plano y capacidades PWA offline',
      },
      {
        id: 'net-info',
        name: 'Network Information',
        supported: Boolean(navConn),
        description: 'Información del tipo de conexión de red y ancho de banda estimado',
      },
    ];
  }

  /**
   * Obtiene la información del entorno actual del cliente
   */
  public getEnvironmentSnapshot(): EnvironmentSnapshot {
    if (typeof window === 'undefined') {
      return {
        windowSize: '0 × 0 px (escala 1)',
        devicePixelRatio: 1,
        connectionType: 'No disponible',
        effectiveType: 'No disponible',
        downlinkSpeed: 'No disponible',
        rtt: 'No disponible',
        userAgent: 'Servidor / SSR',
        platform: 'Desconocido',
        language: 'es-EC',
      };
    }

    type NavigatorWithConnection = Navigator & {
      connection?: {
        effectiveType?: string;
        type?: string;
        downlink?: number;
        rtt?: number;
      };
    };

    const navConn = (navigator as NavigatorWithConnection).connection;

    return {
      windowSize: `${window.innerWidth} × ${window.innerHeight} px (escala ${window.devicePixelRatio || 1})`,
      devicePixelRatio: window.devicePixelRatio || 1,
      connectionType: navConn?.type || (navConn?.effectiveType ? `Celular (${navConn.effectiveType})` : 'No disponible'),
      effectiveType: navConn?.effectiveType ? navConn.effectiveType.toUpperCase() : 'No disponible',
      downlinkSpeed: navConn?.downlink ? `${navConn.downlink} Mbps` : 'No disponible',
      rtt: navConn?.rtt ? `${navConn.rtt} ms` : 'No disponible',
      userAgent: navigator.userAgent || 'Desconocido',
      platform: navigator.platform || 'Desconocido',
      language: navigator.language || 'es-EC',
    };
  }

  /**
   * Genera el snapshot completo actual de la observabilidad
   */
  public getSnapshot(): ObservabilitySnapshot {
    return {
      timestamp: new Date().toISOString(),
      metrics: { ...this.perfMetrics },
      api: { ...this.apiMetrics },
      session: { ...this.sessionCounters },
      environment: this.getEnvironmentSnapshot(),
      apiSupport: this.auditApiSupport(),
      events: [...this.events].reverse(), // Orden descendente (más reciente arriba)
    };
  }

  /**
   * Descarga un snapshot en formato JSON en el navegador del usuario
   */
  public downloadSnapshotJson(): void {
    if (typeof window === 'undefined') return;
    const snapshot = this.getSnapshot();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `habitat-ec-observabilidad-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

export const observabilityService = ObservabilityService.getInstance();
