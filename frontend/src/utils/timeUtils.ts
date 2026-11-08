/**
 * Utilidades para manejo y formateo de horas de Check-in y Check-out en Hábitat EC.
 *
 * Principio de Diseño:
 * Las horas de check-in y check-out (ej. "14:00" o "02:00 PM") representan tiempo de pared
 * (wall-clock time) local de la propiedad en Ecuador (America/Guayaquil, UTC-5).
 * NUNCA se deben convertir a través de Date.toISOString() en UTC ni sumarse/restarse horas
 * por desfase de zona horaria del cliente o navegador.
 */

/**
 * Normaliza cualquier entrada de hora (AM/PM o 24h) al formato canónico "HH:mm" (24h)
 * para ser enviada de forma consistente en los payloads al backend.
 *
 * Ejemplos:
 * - "02:00 PM" -> "14:00"
 * - "2:00 pm"  -> "14:00"
 * - "11:00 AM" -> "11:00"
 * - "12:00 AM" -> "00:00"
 * - "12:00 PM" -> "12:00"
 * - "14:00"    -> "14:00"
 * - "14:00:00" -> "14:00"
 */
export function formatTimeForPayload(
  timeRaw?: string | null,
  fallback: string = '14:00',
): string {
  if (!timeRaw || typeof timeRaw !== 'string') return fallback;
  const raw = timeRaw.trim();
  if (!raw) return fallback;

  // 1. Caso Formato 12 Horas con AM/PM (ej. "02:00 PM", "2:30 pm", "11:00 AM")
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const modifier = ampmMatch[3].toUpperCase();

    if (modifier === 'PM' && hours < 12) {
      hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
      hours = 0;
    }

    const paddedHours = hours.toString().padStart(2, '0');
    return `${paddedHours}:${minutes}`;
  }

  // 2. Caso Formato 24 Horas (ej. "14:00" o "14:00:00")
  const h24Match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = h24Match[2];
    if (hours >= 0 && hours <= 23 && parseInt(minutes, 10) >= 0 && parseInt(minutes, 10) <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  }

  return fallback;
}

/**
 * Parsea y formatea la hora proveniente del backend (ej. "14:00", "14:00:00")
 * para su visualización amigable en la tarjeta de detalles sin alteraciones por zona horaria.
 *
 * @param timeRaw Cadena de hora de la base de datos o DTO
 * @param fallback Valor de respaldo si es nulo o vacío
 * @param formatStyle '24h' (ej. "14:00") o 'both' (ej. "14:00 (02:00 PM)")
 */
export function formatTimeForDisplay(
  timeRaw?: string | null,
  fallback: string = '14:00',
  formatStyle: '24h' | '12h' | 'both' = '24h',
): string {
  const normalized = formatTimeForPayload(timeRaw, fallback);
  const [hStr, mStr] = normalized.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = mStr;

  if (formatStyle === '24h') {
    return normalized;
  }

  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const h12Padded = h12.toString().padStart(2, '0');
  const time12 = `${h12Padded}:${minutes} ${ampm}`;

  if (formatStyle === '12h') {
    return time12;
  }

  return `${normalized} (${time12})`;
}

