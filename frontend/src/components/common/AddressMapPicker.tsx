import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
  ExternalLink,
  Layers,
  Crosshair,
} from 'lucide-react';

export interface GeocodeResultItem {
  displayName: string;
  shortAddress: string;
  lat: number;
  lon: number;
  source: 'GOOGLE' | 'OSM';
}

export interface AddressMapPickerProps {
  label?: string;
  required?: boolean;
  direccion: string;
  onDireccionChange: (newDireccion: string) => void;
  ciudadNombre?: string;
  ciudadLat?: number;
  ciudadLon?: number;
  latitud?: number;
  longitud?: number;
  onCoordinatesChange: (lat: number, lon: number, verifiedBy: 'SEARCH' | 'PIN' | 'CITY') => void;
  isVerified?: boolean;
  verifiedMethod?: 'SEARCH' | 'PIN' | null;
  onVerificationChange?: (verified: boolean, method: 'SEARCH' | 'PIN' | null) => void;
  placeholder?: string;
}

interface LeafletLatLng {
  lat: number;
  lng: number;
}

interface LeafletMouseEvent {
  latlng: LeafletLatLng;
}

interface LeafletDragEndEvent {
  target: {
    getLatLng: () => LeafletLatLng;
  };
}

interface LeafletMarkerInstance {
  setLatLng: (coords: [number, number]) => void;
  on: (event: string, handler: (e: LeafletDragEndEvent) => void) => void;
  bindPopup: (content: string) => LeafletMarkerInstance;
  openPopup: () => void;
}

interface LeafletTileLayerInstance {
  addTo: (map: LeafletMapInstance) => LeafletTileLayerInstance;
  remove: () => void;
}

interface LeafletMapInstance {
  setView: (coords: [number, number], zoom?: number) => LeafletMapInstance;
  on: (event: string, handler: (e: LeafletMouseEvent) => void) => void;
  remove: () => void;
  invalidateSize: () => void;
}

interface LeafletGlobal {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMapInstance;
  tileLayer: (url: string, opts?: Record<string, unknown>) => LeafletTileLayerInstance;
  marker: (coords: [number, number], opts?: Record<string, unknown>) => {
    addTo: (map: LeafletMapInstance) => LeafletMarkerInstance;
  };
  divIcon: (opts: Record<string, unknown>) => unknown;
}

declare global {
  interface Window {
    L?: LeafletGlobal;
  }
}

const DEFAULT_EC_LAT = -0.180653;
const DEFAULT_EC_LON = -78.467834;

/**
 * Formatea una dirección limpia y legible de máximo 120 caracteres a partir de los detalles de Nominatim/Google
 */
function buildCleanShortAddress(
  rawDisplayName: string,
  addressDetails?: Record<string, string>,
  fallbackCity?: string,
): string {
  if (addressDetails) {
    const road =
      addressDetails.road ||
      addressDetails.pedestrian ||
      addressDetails.path ||
      addressDetails.highway ||
      addressDetails.hamlet ||
      '';
    const houseNumber = addressDetails.house_number || '';
    const suburb =
      addressDetails.suburb ||
      addressDetails.neighbourhood ||
      addressDetails.village ||
      addressDetails.town ||
      addressDetails.quarter ||
      '';
    const city =
      addressDetails.city ||
      addressDetails.county ||
      addressDetails.Municipality ||
      fallbackCity ||
      '';

    const parts: string[] = [];
    if (road) {
      parts.push(houseNumber ? `${road} ${houseNumber}` : road);
    }
    if (suburb && suburb.toLowerCase() !== road.toLowerCase()) {
      parts.push(suburb);
    }
    if (city && !parts.some((p) => p.toLowerCase().includes(city.toLowerCase()))) {
      parts.push(city);
    }

    if (parts.length > 0) {
      return parts.join(', ').slice(0, 120);
    }
  }

  // Limpiar display_name quitando código postal y país repetitivo al final
  const segments = rawDisplayName
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\d{5,6}$/.test(s) && s.toLowerCase() !== 'ecuador');

  return segments.slice(0, 3).join(', ').slice(0, 120);
}

export const AddressMapPicker: React.FC<AddressMapPickerProps> = ({
  label = 'Dirección Física y Ubicación en Mapa *',
  required = true,
  direccion,
  onDireccionChange,
  ciudadNombre = 'Quito',
  ciudadLat,
  ciudadLon,
  latitud,
  longitud,
  onCoordinatesChange,
  isVerified: externalVerified,
  verifiedMethod: externalMethod,
  onVerificationChange,
  placeholder = 'Ej: Km 5 vía Conocoto o Av. Amazonas y Naciones Unidas',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
  const markerInstanceRef = useRef<LeafletMarkerInstance | null>(null);
  const tileLayerRef = useRef<LeafletTileLayerInstance | null>(null);

  const [leafletReady, setLeafletReady] = useState<boolean>(() => Boolean(window.L));
  const [mapLayer, setMapLayer] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResultItem[]>([]);
  const [validationMessage, setValidationMessage] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [internalVerified, setInternalVerified] = useState<boolean>(Boolean(externalVerified));
  const [internalMethod, setInternalMethod] = useState<'SEARCH' | 'PIN' | null>(
    externalMethod ?? null,
  );

  const isVerified = externalVerified !== undefined ? externalVerified : internalVerified;
  const verifiedMethod = externalMethod !== undefined ? externalMethod : internalMethod;

  const setVerifiedState = useCallback(
    (verified: boolean, method: 'SEARCH' | 'PIN' | null) => {
      setInternalVerified(verified);
      setInternalMethod(method);
      if (onVerificationChange) {
        onVerificationChange(verified, method);
      }
    },
    [onVerificationChange],
  );

  const effectiveLat =
    latitud !== undefined && Number.isFinite(Number(latitud)) && Number(latitud) !== 0
      ? Number(latitud)
      : ciudadLat !== undefined && Number.isFinite(Number(ciudadLat)) && Number(ciudadLat) !== 0
        ? Number(ciudadLat)
        : DEFAULT_EC_LAT;

  const effectiveLon =
    longitud !== undefined && Number.isFinite(Number(longitud)) && Number(longitud) !== 0
      ? Number(longitud)
      : ciudadLon !== undefined && Number.isFinite(Number(ciudadLon)) && Number(ciudadLon) !== 0
        ? Number(ciudadLon)
        : DEFAULT_EC_LON;

  // 1. Cargar Leaflet CSS & JS dinámicamente si no están presentes
  useEffect(() => {
    if (window.L) {
      return;
    }

    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const scriptId = 'leaflet-js-cdn';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      const checkInterval = window.setInterval(() => {
        if (window.L) {
          setLeafletReady(true);
          window.clearInterval(checkInterval);
        }
      }, 150);
      return () => window.clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setLeafletReady(true);
    };
    document.body.appendChild(script);
  }, []);

  // 2. Geocodificación Inversa cuando el ADMIN coloca o mueve el PIN en el mapa (Opción 2)
  const handlePinPlacedOrMoved = useCallback(
    async (lat: number, lon: number) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLon = Number(lon.toFixed(6));

      onCoordinatesChange(roundedLat, roundedLon, 'PIN');
      setVerifiedState(true, 'PIN');
      setReverseLoading(true);
      setSearchResults([]);

      try {
        const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (googleApiKey) {
          const gRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${roundedLat},${roundedLon}&language=es&key=${googleApiKey}`,
          );
          const gData = (await gRes.json()) as {
            status: string;
            results?: Array<{ formatted_address: string }>;
          };
          if (gData.status === 'OK' && gData.results && gData.results.length > 0) {
            const addr = gData.results[0].formatted_address
              .replace(/, Ecuador$/i, '')
              .slice(0, 120);
            onDireccionChange(addr);
            setValidationMessage({
              type: 'success',
              text: `PIN fijado en Google Maps: "${addr}" (${roundedLat}, ${roundedLon})`,
            });
            setReverseLoading(false);
            return;
          }
        }

        // Geocodificación inversa real con Nominatim OpenStreetMap (Datos reales de calles de Ecuador)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${roundedLat}&lon=${roundedLon}&zoom=18&addressdetails=1&accept-language=es`,
          {
            headers: {
              Accept: 'application/json',
            },
          },
        );

        if (response.ok) {
          const data = (await response.json()) as {
            display_name?: string;
            address?: Record<string, string>;
          };
          if (data && data.display_name) {
            const cleanAddr = buildCleanShortAddress(
              data.display_name,
              data.address,
              ciudadNombre,
            );
            if (cleanAddr.length >= 5) {
              onDireccionChange(cleanAddr);
            }
            setValidationMessage({
              type: 'success',
              text: `Dirección obtenida del PIN: "${cleanAddr}" (Lat: ${roundedLat}, Lng: ${roundedLon})`,
            });
            setReverseLoading(false);
            return;
          }
        }

        // Fallback si el punto es rural/montaña sin calle nombrada
        if (!direccion || direccion.trim().length < 5) {
          const fallbackAddr = `Ubicación rural en ${ciudadNombre || 'Ecuador'} (${roundedLat}, ${roundedLon})`;
          onDireccionChange(fallbackAddr.slice(0, 120));
        }
        setValidationMessage({
          type: 'success',
          text: `PIN exacto fijado en coordenadas (${roundedLat}, ${roundedLon}).`,
        });
      } catch {
        setValidationMessage({
          type: 'success',
          text: `PIN fijado en coordenadas exactas (${roundedLat}, ${roundedLon}).`,
        });
      } finally {
        setReverseLoading(false);
      }
    },
    [ciudadNombre, direccion, onCoordinatesChange, onDireccionChange, setVerifiedState],
  );

  const handlePinPlacedRef = useRef(handlePinPlacedOrMoved);
  useEffect(() => {
    handlePinPlacedRef.current = handlePinPlacedOrMoved;
  }, [handlePinPlacedOrMoved]);

  // 3. Inicializar el mapa interactivo con cartografía de Google Maps y PIN arrastrable
  useEffect(() => {
    if (!leafletReady || !window.L || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const L = window.L;
    const map = L.map(mapContainerRef.current, {
      center: [effectiveLat, effectiveLon],
      zoom: 15,
      scrollWheelZoom: true,
    });

    // Capa inicial: Google Maps Calles en español
    const tileUrl =
      'https://mt1.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}';
    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution: '&copy; Google Maps & OpenStreetMap contributors',
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Icono PIN personalizado estilo Google Maps
    const customPinIcon = L.divIcon({
      className: 'custom-habitat-map-pin',
      html: `
        <div style="position: relative; width: 34px; height: 42px; transform: translate(-17px, -40px); cursor: grab;">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="#dc2626" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
          </svg>
        </div>
      `,
      iconSize: [0, 0],
    });

    const marker = L.marker([effectiveLat, effectiveLon], {
      draggable: true,
      icon: customPinIcon,
    }).addTo(map);

    // Al arrastrar y soltar el PIN
    marker.on('dragend', (event: LeafletDragEndEvent) => {
      const pos = event.target.getLatLng();
      void handlePinPlacedRef.current(pos.lat, pos.lng);
    });

    // Al hacer clic en cualquier parte del mapa
    map.on('click', (event: LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      marker.setLatLng([lat, lng]);
      void handlePinPlacedRef.current(lat, lng);
    });

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    window.setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  // 4. Alternar entre Google Maps Calles y Google Maps Satélite Híbrido
  useEffect(() => {
    if (!leafletReady || !window.L || !mapInstanceRef.current) return;
    const L = window.L;
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    const url =
      mapLayer === 'hybrid'
        ? 'https://mt1.google.com/vt/lyrs=y&hl=es&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}';
    tileLayerRef.current = L.tileLayer(url, {
      maxZoom: 20,
      attribution: '&copy; Google Maps & OpenStreetMap contributors',
    }).addTo(mapInstanceRef.current);
  }, [mapLayer, leafletReady]);

  // 5. Mover el mapa y el marcador cuando cambian las coordenadas desde afuera (ej. cambio de ciudad o selección de búsqueda)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerInstanceRef.current) return;
    markerInstanceRef.current.setLatLng([effectiveLat, effectiveLon]);
    mapInstanceRef.current.setView([effectiveLat, effectiveLon], 15);
  }, [effectiveLat, effectiveLon]);

  // 6. Opción 1: Validar la dirección escrita contra el geocodificador real de Google Maps / OSM Ecuador
  const handleValidateWrittenAddress = async () => {
    const rawQuery = direccion.trim();
    if (rawQuery.length < 4) {
      setValidationMessage({
        type: 'warning',
        text: 'Escribe al menos 4 caracteres en la dirección para validarla en el mapa, o coloca directamente el PIN.',
      });
      return;
    }

    setSearchingAddress(true);
    setSearchResults([]);
    setValidationMessage(null);

    try {
      const results: GeocodeResultItem[] = [];
      const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      // 6.1 Si hay API Key de Google Maps configurada
      if (googleApiKey) {
        const fullQuery = ciudadNombre ? `${rawQuery}, ${ciudadNombre}, Ecuador` : `${rawQuery}, Ecuador`;
        const gRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullQuery)}&components=country:EC&language=es&key=${googleApiKey}`,
        );
        const gData = (await gRes.json()) as {
          status: string;
          results?: Array<{
            formatted_address: string;
            geometry: { location: { lat: number; lng: number } };
          }>;
        };
        if (gData.status === 'OK' && gData.results) {
          for (const item of gData.results.slice(0, 4)) {
            results.push({
              displayName: item.formatted_address,
              shortAddress: item.formatted_address.replace(/, Ecuador$/i, '').slice(0, 120),
              lat: Number(item.geometry.location.lat.toFixed(6)),
              lon: Number(item.geometry.location.lng.toFixed(6)),
              source: 'GOOGLE',
            });
          }
        }
      }

      // 6.2 Búsqueda en Nominatim OpenStreetMap (restringida a Ecuador `countrycodes=ec`)
      if (results.length === 0) {
        // Limpiar prefijos como "Km 5", "Km. 4", numeración N34-12 para consultas de respaldo si la consulta exacta no halla el número de km
        const strippedQuery = rawQuery
          .replace(/\bkm\.?\s*\d+(\.\d+)?\b/gi, '')
          .replace(/\b(vía|via)\s+a?\s*/gi, '')
          .replace(/[#]\s*\d+/g, '')
          .trim();

        const candidateQueries = [
          ciudadNombre ? `${rawQuery}, ${ciudadNombre}, Ecuador` : `${rawQuery}, Ecuador`,
          rawQuery,
        ];
        if (strippedQuery.length >= 3 && strippedQuery.toLowerCase() !== rawQuery.toLowerCase()) {
          if (ciudadNombre) {
            candidateQueries.push(`${strippedQuery}, ${ciudadNombre}, Ecuador`);
          }
          candidateQueries.push(`${strippedQuery}, Ecuador`);
        }

        for (const q of candidateQueries) {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=ec&limit=5&accept-language=es&q=${encodeURIComponent(q)}`,
            {
              headers: { Accept: 'application/json' },
            },
          );
          if (nomRes.ok) {
            const nomData = (await nomRes.json()) as Array<{
              display_name: string;
              lat: string;
              lon: string;
              address?: Record<string, string>;
            }>;
            if (Array.isArray(nomData) && nomData.length > 0) {
              for (const item of nomData) {
                const shortAddr = buildCleanShortAddress(
                  item.display_name,
                  item.address,
                  ciudadNombre,
                );
                results.push({
                  displayName: item.display_name,
                  shortAddress: shortAddr,
                  lat: Number(Number(item.lat).toFixed(6)),
                  lon: Number(Number(item.lon).toFixed(6)),
                  source: 'OSM',
                });
              }
              break;
            }
          }
        }
      }

      if (results.length > 0) {
        const best = results[0];
        setSearchResults(results);

        // Posicionar el PIN en el primer resultado verificado
        onCoordinatesChange(best.lat, best.lon, 'SEARCH');
        setVerifiedState(true, 'SEARCH');

        if (mapInstanceRef.current && markerInstanceRef.current) {
          markerInstanceRef.current.setLatLng([best.lat, best.lon]);
          mapInstanceRef.current.setView([best.lat, best.lon], 16);
        }

        setValidationMessage({
          type: 'success',
          text: `Dirección validada en el mapa: "${best.shortAddress}" (Lat: ${best.lat}, Lng: ${best.lon}). Puedes ajustar el PIN si deseas mayor precisión.`,
        });
      } else {
        setVerifiedState(false, null);
        setValidationMessage({
          type: 'warning',
          text: `No se encontró "${rawQuery}" como calle registrada en ${ciudadNombre || 'Ecuador'}. Te recomendamos hacer clic o arrastrar el PIN rojo en el mapa para fijar la ubicación exacta.`,
        });
      }
    } catch {
      setValidationMessage({
        type: 'error',
        text: 'No se pudo conectar con el servicio de validación geográfica. Puedes colocar el PIN directamente en el mapa.',
      });
    } finally {
      setSearchingAddress(false);
    }
  };

  // Seleccionar una sugerencia específica de la lista de resultados
  const handleSelectSuggestion = (item: GeocodeResultItem) => {
    onDireccionChange(item.shortAddress);
    onCoordinatesChange(item.lat, item.lon, 'SEARCH');
    setVerifiedState(true, 'SEARCH');
    setSearchResults([]);

    if (mapInstanceRef.current && markerInstanceRef.current) {
      markerInstanceRef.current.setLatLng([item.lat, item.lon]);
      mapInstanceRef.current.setView([item.lat, item.lon], 17);
    }

    setValidationMessage({
      type: 'success',
      text: `Ubicación confirmada: "${item.shortAddress}" (${item.lat}, ${item.lon})`,
    });
  };

  // Usar geolocalización GPS del navegador
  const handleUseMyGps = () => {
    if (!navigator.geolocation) {
      setValidationMessage({
        type: 'warning',
        text: 'Tu navegador no soporta geolocalización por GPS.',
      });
      return;
    }

    setReverseLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current && markerInstanceRef.current) {
          markerInstanceRef.current.setLatLng([latitude, longitude]);
          mapInstanceRef.current.setView([latitude, longitude], 17);
        }
        void handlePinPlacedOrMoved(latitude, longitude);
      },
      () => {
        setReverseLoading(false);
        setValidationMessage({
          type: 'warning',
          text: 'No se pudo obtener tu ubicación GPS. Arrastra el PIN en el mapa o escribe la dirección.',
        });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const googleMapsExternalUrl = `https://www.google.com/maps/search/?api=1&query=${effectiveLat},${effectiveLon}`;

  return (
    <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface/50 p-3.5 sm:p-4">
      {/* Encabezado e indicador de estado de validación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/80">
          {label}
        </label>

        {isVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {verifiedMethod === 'PIN'
              ? 'Ubicación exacta fijada con PIN'
              : 'Dirección validada en Google Maps'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />
            Valida la dirección o coloca el PIN en el mapa
          </span>
        )}
      </div>

      {/* OPCIÓN 1: Input de Dirección Física + Botón Validar en Mapa */}
      <div className="space-y-1.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MapPin className="h-4 w-4 text-brand-accent absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              required={required}
              maxLength={120}
              value={direccion}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ .,#\-_/()]/g, '');
                onDireccionChange(cleaned);
                if (verifiedMethod === 'SEARCH') {
                  setVerifiedState(false, null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleValidateWrittenAddress();
                }
              }}
              placeholder={placeholder}
              className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm text-brand-text bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 transition-all ${
                isVerified
                  ? 'border-emerald-500/70 focus:ring-emerald-500/30'
                  : 'border-brand-border focus:border-brand-primary focus:ring-brand-primary/30'
              }`}
            />
          </div>

          <button
            type="button"
            disabled={searchingAddress || direccion.trim().length < 4}
            onClick={() => void handleValidateWrittenAddress()}
            className="btn-primary py-2 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            title="Buscar y validar esta dirección en el mapa real"
          >
            {searchingAddress ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                Validar Dirección en Mapa
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-brand-text/65">
          <strong>Tienes 2 opciones:</strong> (1) Escribe la dirección y pulsa{' '}
          <span className="font-semibold text-brand-primary">“Validar Dirección en Mapa”</span>, o
          (2) haz clic / arrastra directamente el{' '}
          <span className="font-semibold text-red-600 dark:text-red-400">PIN rojo</span> en el mapa
          inferior hasta la ubicación exacta.
        </p>
      </div>

      {/* Lista de coincidencias reales encontradas en el mapa */}
      {searchResults.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-bg/90 p-2.5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-brand-text/80">
              Ubicaciones reales encontradas en {ciudadNombre || 'Ecuador'} (haz clic para aplicar):
            </span>
            <button
              type="button"
              onClick={() => setSearchResults([])}
              className="text-[10px] text-brand-text/60 hover:text-brand-text cursor-pointer underline"
            >
              Ocultar sugerencias
            </button>
          </div>
          <div className="divide-y divide-brand-border/60 max-h-40 overflow-y-auto">
            {searchResults.map((item, idx) => (
              <button
                key={`${item.lat}-${item.lon}-${idx}`}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left py-1.5 px-2 hover:bg-brand-primary/10 rounded-lg transition-colors flex items-start justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-brand-text block truncate">
                    {item.shortAddress}
                  </span>
                  <span className="text-[10px] text-brand-text/60 block truncate">
                    {item.displayName}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-brand-accent shrink-0 mt-0.5">
                  {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje de estado / validación */}
      {validationMessage && (
        <div
          className={`rounded-xl px-3 py-2 text-xs flex items-start gap-2 border ${
            validationMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : validationMessage.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200'
          }`}
        >
          {validationMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          )}
          <span className="leading-relaxed">{validationMessage.text}</span>
        </div>
      )}

      {/* OPCIÓN 2: Mapa Interactivo Real de Google Maps con PIN Arrastrable */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-text">
            <Crosshair className="h-3.5 w-3.5 text-red-500" />
            <span>Mapa Interactivo (Haz clic o arrastra el PIN al punto exacto)</span>
            {reverseLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] text-brand-accent font-normal">
                <Loader2 className="h-3 w-3 animate-spin" />
                Obteniendo dirección del PIN...
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Botón GPS */}
            <button
              type="button"
              onClick={handleUseMyGps}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1 text-[11px] font-semibold text-brand-text hover:border-brand-primary cursor-pointer transition-colors"
              title="Colocar el PIN en mi ubicación GPS actual"
            >
              <Navigation className="h-3 w-3 text-brand-primary" />
              Mi GPS
            </button>

            {/* Selector Calles / Satélite Google Maps */}
            <button
              type="button"
              onClick={() => setMapLayer((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1 text-[11px] font-semibold text-brand-text hover:border-brand-primary cursor-pointer transition-colors"
              title="Cambiar entre vista de Calles y Satélite de Google Maps"
            >
              <Layers className="h-3 w-3 text-brand-accent" />
              {mapLayer === 'roadmap' ? 'Vista Satélite' : 'Vista Calles'}
            </button>

            {/* Abrir en Google Maps */}
            <a
              href={googleMapsExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1 text-[11px] font-semibold text-brand-primary hover:underline"
              title="Verificar este punto directamente en Google Maps"
            >
              Google Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Contenedor del Mapa */}
        <div className="relative h-60 sm:h-72 w-full rounded-xl overflow-hidden border border-brand-border shadow-inner bg-stone-200 dark:bg-stone-800 z-0">
          {!leafletReady && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-text/60 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
              Cargando cartografía de Google Maps...
            </div>
          )}
          <div ref={mapContainerRef} className="h-full w-full z-0" />
        </div>

        {/* Barra inferior de coordenadas exactas del PIN */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-brand-text/70 bg-brand-bg/60 px-3 py-1.5 rounded-lg border border-brand-border/60">
          <span>
            Coordenadas del PIN:{' '}
            <strong className="font-mono text-brand-text">
              Lat {effectiveLat.toFixed(6)}, Lng {effectiveLon.toFixed(6)}
            </strong>
          </span>
          <span className="text-[10px] text-brand-text/60">
            Cartografía Google Maps ({mapLayer === 'roadmap' ? 'Calles' : 'Satélite Híbrido'}) ·{' '}
            {ciudadNombre || 'Ecuador'}
          </span>
        </div>
      </div>
    </div>
  );
};
