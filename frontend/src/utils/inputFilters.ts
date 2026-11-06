import React from 'react';

/**
 * Utilitarios de interacción y filtrado de pulsaciones en vivo (Heurística #5 de Jakob Nielsen: Prevención de Errores)
 * para Hábitat EC.
 */

const SYSTEM_KEYS = new Set([
  'Backspace',
  'Tab',
  'Enter',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

function isModifierKey(e: React.KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey;
}

/**
 * Bloquea de plano la pulsación de teclas que no sean letras del alfabeto español o espacios simples.
 * Previene números, símbolos especiales y signos matemáticos.
 */
export function allowOnlyLettersKey(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void {
  if (SYSTEM_KEYS.has(e.key) || isModifierKey(e)) {
    return;
  }

  // Permitir letras del español (con tildes, diéresis y eñes)
  const isLetter = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]$/.test(e.key);
  const isSpace = e.key === ' ';

  if (isSpace) {
    const target = e.currentTarget;
    const value = target.value;
    const selectionStart = target.selectionStart ?? value.length;
    // Evitar espacios al inicio o espacios dobles consecutivos
    if (selectionStart === 0 || (selectionStart > 0 && value[selectionStart - 1] === ' ')) {
      e.preventDefault();
      return;
    }
    return;
  }

  if (!isLetter) {
    e.preventDefault();
  }
}

/**
 * Bloquea de plano cualquier tecla que no sea un dígito numérico (0-9).
 * Previene letras, caracteres especiales, operadores matemáticos (+, -, e, E) y puntuación.
 */
export function allowOnlyNumbersKey(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void {
  if (SYSTEM_KEYS.has(e.key) || isModifierKey(e)) {
    return;
  }

  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

/**
 * Filtro estricto para valores monetarios y precios en dólares (USD).
 * Permite dígitos (0-9) y como máximo un único punto decimal, restringiendo a 2 decimales.
 */
export function allowPriceDecimalsKey(
  e: React.KeyboardEvent<HTMLInputElement>,
  currentValue: string,
): void {
  if (SYSTEM_KEYS.has(e.key) || isModifierKey(e)) {
    return;
  }

  const isDigit = /^\d$/.test(e.key);
  const isDot = e.key === '.';

  if (isDot) {
    // Si ya existe un punto decimal o si está vacío (al inicio), bloquear
    if (currentValue.includes('.') || currentValue.length === 0) {
      e.preventDefault();
    }
    return;
  }

  if (!isDigit) {
    e.preventDefault();
    return;
  }

  // Si ya tiene un punto decimal y el cursor está en la parte decimal, verificar máximo 2 decimales
  const dotIndex = currentValue.indexOf('.');
  const selectionStart = e.currentTarget.selectionStart ?? currentValue.length;
  if (dotIndex !== -1 && selectionStart > dotIndex) {
    const decimals = currentValue.split('.')[1] || '';
    if (decimals.length >= 2 && e.currentTarget.selectionStart === e.currentTarget.selectionEnd) {
      e.preventDefault();
    }
  }
}

/**
 * Permite únicamente caracteres alfanuméricos, espacios y símbolos permitidos de puntuación
 * como '.', ',', '#', '-', '/'.
 */
export function allowAlphanumericKey(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  allowedChars = ' .,#-_/',
): void {
  if (SYSTEM_KEYS.has(e.key) || isModifierKey(e)) {
    return;
  }

  const isAlphanumeric = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]$/.test(e.key);
  const isAllowedChar = allowedChars.includes(e.key);

  if (!isAlphanumeric && !isAllowedChar) {
    e.preventDefault();
  }
}

/**
 * Sanitiza texto al pegar o escribir: solo letras y espacios sencillos.
 */
export function cleanOnlyLetters(value: string, maxLength?: number): string {
  const cleaned = value
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ');
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Sanitiza texto al pegar o escribir: únicamente dígitos numéricos.
 */
export function cleanOnlyNumbers(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/**
 * Sanitiza valores de precio: solo dígitos y a lo sumo un punto con 2 decimales.
 */
export function cleanPriceDecimals(value: string, maxLimit = 10000): string {
  const sanitized = value.replace(/[^\d.]/g, '');
  const parts = sanitized.split('.');
  let result = parts[0] || '';
  if (parts.length > 1) {
    result += `.${parts[1].slice(0, 2)}`;
  }
  const numeric = parseFloat(result);
  if (!isNaN(numeric) && numeric > maxLimit) {
    return maxLimit.toString();
  }
  return result;
}

/**
 * Sanitiza texto alfanumérico permitiendo caracteres autorizados.
 */
export function cleanAlphanumeric(
  value: string,
  allowedChars = ' .,#-_/',
  maxLength?: number,
): string {
  const escaped = allowedChars.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ${escaped}]`, 'g');
  const cleaned = value.replace(regex, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Intercepta el evento de pegado (onPaste) para limpiar caracteres no permitidos antes de insertarlos.
 */
export function handlePasteFiltered(
  e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  filterType: 'letters' | 'numbers' | 'price' | 'alphanumeric',
  onCleanValue: (cleanText: string) => void,
  maxLength?: number,
): void {
  e.preventDefault();
  const rawText = e.clipboardData.getData('text');
  let cleanText = '';
  switch (filterType) {
    case 'letters':
      cleanText = cleanOnlyLetters(rawText, maxLength);
      break;
    case 'numbers':
      cleanText = cleanOnlyNumbers(rawText, maxLength);
      break;
    case 'price':
      cleanText = cleanPriceDecimals(rawText);
      break;
    case 'alphanumeric':
      cleanText = cleanAlphanumeric(rawText, ' .,#-_/', maxLength);
      break;
  }
  onCleanValue(cleanText);
}

/**
 * Desplaza la vista suavemente y pone el foco en el primer campo inválido (Heurística #9 de Jakob Nielsen).
 */
export function focusFirstInvalidInput(container?: HTMLElement | Document | null): boolean {
  const root = container || document;
  const firstInvalid = root.querySelector<HTMLElement>(
    '[aria-invalid="true"], [data-invalid="true"]',
  );
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof firstInvalid.focus === 'function') {
      firstInvalid.focus();
    }
    return true;
  }
  return false;
}

