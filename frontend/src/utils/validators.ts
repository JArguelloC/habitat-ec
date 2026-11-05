/**
 * Motor centralizado de validaciones en tiempo real y prevención de errores
 * basado en las Heurísticas de Usabilidad de Jakob Nielsen (IHC) para Hábitat EC.
 */

export const ECUADOR_PROVINCE_CODES: Record<string, string> = {
  '01': 'Azuay',
  '02': 'Bolívar',
  '03': 'Cañar',
  '04': 'Carchi',
  '05': 'Chimborazo',
  '06': 'Cotopaxi',
  '07': 'El Oro',
  '08': 'Esmeraldas',
  '09': 'Guayas',
  '10': 'Imbabura',
  '11': 'Loja',
  '12': 'Los Ríos',
  '13': 'Manabí',
  '14': 'Morona Santiago',
  '15': 'Napo',
  '16': 'Pastaza',
  '17': 'Pichincha',
  '18': 'Tungurahua',
  '19': 'Zamora Chinchipe',
  '20': 'Galápagos',
  '21': 'Sucumbíos',
  '22': 'Orellana',
  '23': 'Santo Domingo de los Tsáchilas',
  '24': 'Santa Elena',
  '30': 'Exterior / Régimen Especial',
};

/**
 * Bloquea de plano la escritura de números y caracteres especiales en campos de Nombre y Apellido.
 * Solo admite letras del alfabeto español (incluyendo tildes, diéresis y ñ) y espacios.
 */
export function sanitizeOnlyLetters(value: string): string {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').replace(/\s{2,}/g, ' ');
}

/**
 * Valida un campo de Nombre o Apellido con retroalimentación IHC obligatoria.
 */
export function validateName(
  value: string,
  fieldLabel = 'Este campo',
): {
  isEmpty: boolean;
  valid: boolean;
  message: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      isEmpty: true,
      valid: false,
      message: `${fieldLabel} es obligatorio (solo se admiten letras).`,
    };
  }
  if (trimmed.length < 2) {
    return {
      isEmpty: false,
      valid: false,
      message: `${fieldLabel} debe contener al menos 2 letras.`,
    };
  }
  const onlyLettersRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
  if (!onlyLettersRegex.test(trimmed)) {
    return {
      isEmpty: false,
      valid: false,
      message: `${fieldLabel} solo admite letras (sin números ni símbolos).`,
    };
  }
  return {
    isEmpty: false,
    valid: true,
    message: `${fieldLabel} válido (solo letras).`,
  };
}

/**
 * Valida estrictamente que un correo electrónico tenga formato real (usuario@dominio.tld).
 */
export function validateEmail(value: string): {
  isEmpty: boolean;
  valid: boolean;
  message: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      isEmpty: true,
      valid: false,
      message: 'El correo electrónico es obligatorio (ej. nombre@dominio.ec).',
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      isEmpty: false,
      valid: false,
      message: 'El correo electrónico no puede contener espacios en blanco.',
    };
  }
  if (!trimmed.includes('@')) {
    return {
      isEmpty: false,
      valid: false,
      message: 'Falta el símbolo "@" y el dominio (ej. usuario@correo.com).',
    };
  }
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[0]) {
    return {
      isEmpty: false,
      valid: false,
      message: 'Ingresa un nombre de usuario válido antes del "@".',
    };
  }
  const domain = parts[1];
  if (!domain || !domain.includes('.')) {
    return {
      isEmpty: false,
      valid: false,
      message: 'El dominio debe incluir una extensión válida (ej. .ec, .com, .org).',
    };
  }
  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!strictEmailRegex.test(trimmed)) {
    return {
      isEmpty: false,
      valid: false,
      message: 'Formato de correo inválido. Verifica que tenga la forma usuario@dominio.com.',
    };
  }
  return {
    isEmpty: false,
    valid: true,
    message: 'Correo electrónico válido y verificado en formato.',
  };
}

/**
 * Bloquea letras y símbolos en Cédula / RUC, permitiendo únicamente dígitos (máximo 13).
 */
export function sanitizeCedulaRuc(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}

/**
 * Valida Cédula (10 dígitos) o RUC (13 dígitos) según el estándar ecuatoriano:
 * - Código de provincia existente (01 a 24, o 30).
 * - Longitud de 10 a 13 caracteres (10 para Cédula, 13 terminados en 001 para RUC).
 * - Campo opcional: si está vacío es válido, pero si se escribe debe cumplir el estándar.
 */
export function validateEcuadorianCedulaRuc(value: string): {
  isEmpty: boolean;
  valid: boolean;
  provinceName: string | null;
  docType: 'CEDULA' | 'RUC' | null;
  message: string;
} {
  const cleaned = value.trim();
  if (!cleaned) {
    return {
      isEmpty: true,
      valid: true,
      provinceName: null,
      docType: null,
      message: 'Opcional: 10 dígitos para Cédula o 13 dígitos (terminado en 001) para RUC.',
    };
  }

  if (!/^\d+$/.test(cleaned)) {
    return {
      isEmpty: false,
      valid: false,
      provinceName: null,
      docType: null,
      message: 'Solo se admiten números en la Cédula o RUC.',
    };
  }

  if (cleaned.length < 2) {
    return {
      isEmpty: false,
      valid: false,
      provinceName: null,
      docType: null,
      message: 'Ingresa el código de provincia ecuatoriana (01 al 24).',
    };
  }

  const provCode = cleaned.slice(0, 2);
  const provinceName = ECUADOR_PROVINCE_CODES[provCode] || null;

  if (!provinceName) {
    return {
      isEmpty: false,
      valid: false,
      provinceName: null,
      docType: null,
      message: `Código provincial "${provCode}" inválido. En Ecuador solo existen códigos del 01 al 24 (o 30).`,
    };
  }

  if (cleaned.length < 10) {
    return {
      isEmpty: false,
      valid: false,
      provinceName,
      docType: null,
      message: `Provincia ${provinceName} (${provCode}): faltan ${10 - cleaned.length} dígitos para Cédula (10) o ${13 - cleaned.length} para RUC (13).`,
    };
  }

  if (cleaned.length === 10) {
    return {
      isEmpty: false,
      valid: true,
      provinceName,
      docType: 'CEDULA',
      message: `Cédula ecuatoriana válida (10 dígitos • Provincia: ${provinceName}).`,
    };
  }

  if (cleaned.length > 10 && cleaned.length < 13) {
    return {
      isEmpty: false,
      valid: false,
      provinceName,
      docType: null,
      message: `Para RUC de ${provinceName} (${provCode}) debes completar los 13 dígitos terminados en 001 (actual: ${cleaned.length}/13).`,
    };
  }

  if (cleaned.length === 13) {
    if (!cleaned.endsWith('001')) {
      return {
        isEmpty: false,
        valid: false,
        provinceName,
        docType: 'RUC',
        message: `El RUC ecuatoriano de 13 dígitos debe terminar en establecimiento "001" (Provincia: ${provinceName}).`,
      };
    }
    return {
      isEmpty: false,
      valid: true,
      provinceName,
      docType: 'RUC',
      message: `RUC ecuatoriano válido (13 dígitos • Provincia: ${provinceName}).`,
    };
  }

  return {
    isEmpty: false,
    valid: false,
    provinceName,
    docType: null,
    message: 'El documento debe tener entre 10 y 13 dígitos máximo.',
  };
}

/**
 * Sanitiza la entrada de teléfono móvil permitiendo únicamente "+" al inicio y dígitos.
 */
export function sanitizePhoneInput(value: string): string {
  const hasPlus = value.trimStart().startsWith('+');
  const digitsOnly = value.replace(/\D/g, '');
  if (hasPlus) {
    return `+${digitsOnly.slice(0, 12)}`;
  }
  return digitsOnly.slice(0, 10);
}

/**
 * Valida teléfono móvil de Ecuador admitiendo ambas formas:
 * 1) Con código de país: +5939XXXXXXXX (12 dígitos tras el +, ej. +593991234567)
 * 2) Formato nacional clásico: 09XXXXXXXX (10 dígitos iniciando en 09, ej. 0991234567)
 */
export function validateEcuadorianPhone(value: string): {
  isEmpty: boolean;
  valid: boolean;
  formatType: 'INTERNACIONAL' | 'NACIONAL' | null;
  message: string;
} {
  const compact = value.replace(/\s+/g, '');
  if (!compact) {
    return {
      isEmpty: true,
      valid: true,
      formatType: null,
      message: 'Opcional: Acepta +5939XXXXXXXX o el clásico 09XXXXXXXX.',
    };
  }

  if (compact.startsWith('+')) {
    if (!compact.startsWith('+593')) {
      return {
        isEmpty: false,
        valid: false,
        formatType: 'INTERNACIONAL',
        message: 'El código internacional para Ecuador debe iniciar con +593seguido de 9XXXXXXXX.',
      };
    }
    const afterCode = compact.slice(4);
    if (afterCode.length > 0 && !afterCode.startsWith('9')) {
      return {
        isEmpty: false,
        valid: false,
        formatType: 'INTERNACIONAL',
        message: 'Después de +593 el número móvil debe empezar con 9 (ej. +593991234567).',
      };
    }
    if (afterCode.length < 9) {
      return {
        isEmpty: false,
        valid: false,
        formatType: 'INTERNACIONAL',
        message: `Formato +593: faltan ${9 - afterCode.length} dígitos móviles (ej. +593991234567).`,
      };
    }
    if (/^\+5939\d{8}$/.test(compact)) {
      return {
        isEmpty: false,
        valid: true,
        formatType: 'INTERNACIONAL',
        message: 'Móvil ecuatoriano válido en formato internacional (+593 9XXXXXXXX).',
      };
    }
  } else {
    if (!compact.startsWith('09')) {
      return {
        isEmpty: false,
        valid: false,
        formatType: 'NACIONAL',
        message: 'El móvil nacional debe iniciar con 09 (10 dígitos) o con código +5939XXXXXXXX.',
      };
    }
    if (compact.length < 10) {
      return {
        isEmpty: false,
        valid: false,
        formatType: 'NACIONAL',
        message: `Formato 09XXXXXXXX: faltan ${10 - compact.length} dígitos para completar los 10.`,
      };
    }
    if (/^09\d{8}$/.test(compact)) {
      return {
        isEmpty: false,
        valid: true,
        formatType: 'NACIONAL',
        message: 'Móvil ecuatoriano válido en formato clásico (09XXXXXXXX).',
      };
    }
  }

  return {
    isEmpty: false,
    valid: false,
    formatType: null,
    message: 'Formato inválido. Usa +5939XXXXXXXX o 09XXXXXXXX.',
  };
}

export interface PasswordStrengthResult {
  score: number; // 0..5
  label: string;
  validMinLength: boolean;
  criteria: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
  suggestions: string[];
}

/**
 * Evalúa la fortaleza de una contraseña y entrega sugerencias interactivas de mejora.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const minLength = password.length >= 8;
  const hasUpper = /[A-ZÁÉÍÓÚÑ]/.test(password);
  const hasLower = /[a-záéíóúñ]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const checks = [minLength, hasUpper, hasLower, hasNumber, hasSpecial];
  const score = checks.filter(Boolean).length;

  const suggestions: string[] = [];
  if (!minLength) {
    suggestions.push(`Agrega al menos ${Math.max(1, 8 - password.length)} caracteres más (mínimo 8).`);
  }
  if (!hasUpper) {
    suggestions.push('Incluye al menos una letra MAYÚSCULA (ej. A, M, Z).');
  }
  if (!hasLower) {
    suggestions.push('Incluye al menos una letra minúscula (ej. a, m, z).');
  }
  if (!hasNumber) {
    suggestions.push('Agrega al menos un número (0-9).');
  }
  if (!hasSpecial) {
    suggestions.push('Añade un símbolo especial como !, @, #, $ o * para máxima seguridad.');
  }

  let label = 'Muy débil';
  if (score === 2) label = 'Débil';
  if (score === 3) label = 'Aceptable';
  if (score === 4) label = 'Buena';
  if (score === 5) label = 'Excelente y Segura';

  return {
    score,
    label,
    validMinLength: minLength,
    criteria: {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
    },
    suggestions,
  };
}

