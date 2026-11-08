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

