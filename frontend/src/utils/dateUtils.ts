/**
 * Convierte una fecha en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss...)
 * al formato estándar latinoamericano: DD/MM/YYYY.
 * Si la fecha es nula, indefinida o vacía, retorna un placeholder legible 'DD/MM/AAAA'.
 */
export function formatDateToLatam(isoDate?: string | null): string {
  if (!isoDate) return 'DD/MM/AAAA';
  const cleanDate = isoDate.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Calcula la fecha mínima de Check-out admisible (estrictamente Check-in + 1 día)
 * preservando la zona horaria local para evitar desfases por UTC.
 */
export function getMinCheckoutDate(checkinStr?: string | null): string {
  if (!checkinStr) {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const parts = checkinStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    return now.toISOString().split('T')[0];
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + 1);
  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, '0');
  const nextD = String(date.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}


