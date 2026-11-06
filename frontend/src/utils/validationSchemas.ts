import { z } from 'zod';
import { ECUADOR_PROVINCE_CODES } from './validators';

/**
 * Esquemas de validación fuertemente tipados con Zod para Hábitat EC.
 * Diseñados bajo la Heurística #9 de Jakob Nielsen (mensajes claros, constructivos y en español neutral).
 */

export const nameSchema = (fieldLabel = 'Este campo') =>
  z
    .string()
    .trim()
    .min(1, `${fieldLabel} es obligatorio.`)
    .min(2, `${fieldLabel} debe tener al menos 2 letras.`)
    .max(60, `${fieldLabel} no puede superar los 60 caracteres.`)
    .refine((val) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(val), {
      message: `${fieldLabel} solo admite letras y espacios (sin números ni caracteres especiales).`,
    });

export const titleSchema = (fieldLabel = 'El título') =>
  z
    .string()
    .trim()
    .min(1, `${fieldLabel} es obligatorio.`)
    .min(5, `${fieldLabel} debe tener al menos 5 caracteres.`)
    .max(100, `${fieldLabel} no puede superar los 100 caracteres.`)
    .refine((val) => /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,#-_/]+$/.test(val), {
      message: `${fieldLabel} contiene caracteres no permitidos.`,
    });

export const addressSchema = () =>
  z
    .string()
    .trim()
    .min(1, 'La dirección es obligatoria.')
    .min(5, 'La dirección debe tener al menos 5 caracteres.')
    .max(120, 'La dirección no puede superar los 120 caracteres.')
    .refine((val) => /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,#-_/]+$/.test(val), {
      message: 'La dirección contiene símbolos no válidos. Usa letras, números y signos comunes (. , # - /).',
    });

export const emailSchema = () =>
  z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio.')
    .email('Ingresa un correo electrónico con formato válido (ej. usuario@dominio.ec).')
    .refine((val) => !/\s/.test(val), {
      message: 'El correo electrónico no puede contener espacios en blanco.',
    });

export const passwordRegisterSchema = () =>
  z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(64, 'La contraseña no puede superar los 64 caracteres.')
    .refine((val) => /[A-ZÁÉÍÓÚÑ]/.test(val), {
      message: 'Debe contener al menos una letra mayúscula.',
    })
    .refine((val) => /[a-záéíóúñ]/.test(val), {
      message: 'Debe contener al menos una letra minúscula.',
    })
    .refine((val) => /\d/.test(val), {
      message: 'Debe contener al menos un número (0-9).',
    })
    .refine((val) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(val), {
      message: 'Debe incluir al menos un carácter especial (ej. ! @ # $ *).',
    });

export const ecuadorCedulaRucSchema = (isOptional = true) =>
  z.string().superRefine((val, ctx) => {
    const cleaned = val.trim();
    if (!cleaned) {
      if (!isOptional) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El documento Cédula o RUC es obligatorio.',
        });
      }
      return;
    }

    if (!/^\d+$/.test(cleaned)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Solo se admiten números en la Cédula o RUC.',
      });
      return;
    }

    if (cleaned.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ingresa el código de provincia ecuatoriana (01 al 24).',
      });
      return;
    }

    const provCode = cleaned.slice(0, 2);
    const provName = ECUADOR_PROVINCE_CODES[provCode];
    if (!provName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Código provincial "${provCode}" inválido. En Ecuador solo existen códigos del 01 al 24 (o 30).`,
      });
      return;
    }

    if (cleaned.length === 10) {
      // Cédula válida
      return;
    }

    if (cleaned.length === 13) {
      if (!cleaned.endsWith('001')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El RUC de ${provName} (${provCode}) debe terminar en establecimiento "001".`,
        });
        return;
      }
      // RUC válido
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Documento incompleto para ${provName}: debe tener exactamente 10 dígitos (Cédula) o 13 dígitos terminados en 001 (RUC).`,
    });
  });

export const ecuadorPhoneSchema = (isOptional = true) =>
  z.string().superRefine((val, ctx) => {
    const compact = val.replace(/\s+/g, '');
    if (!compact) {
      if (!isOptional) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El número de teléfono móvil es obligatorio.',
        });
      }
      return;
    }

    if (compact.startsWith('+')) {
      if (!compact.startsWith('+593')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El código internacional debe ser +593 para Ecuador.',
        });
        return;
      }
      const rest = compact.slice(4);
      if (!rest.startsWith('9')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Después de +593 el número debe iniciar con 9 (ej. +593991234567).',
        });
        return;
      }
      if (rest.length !== 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Formato internacional: debe tener 9 dígitos tras el +593 (actual: ${rest.length}).`,
        });
        return;
      }
      return;
    }

    if (compact.startsWith('09')) {
      if (compact.length !== 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El móvil nacional debe tener 10 dígitos iniciando con 09 (actual: ${compact.length}).`,
        });
        return;
      }
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Formato inválido. Ingresa formato nacional (09XXXXXXXX) o internacional (+5939XXXXXXXX).',
    });
  });

export const priceSchema = (fieldLabel = 'El precio') =>
  z
    .number()
    .positive(`${fieldLabel} debe ser mayor a 0 USD.`)
    .max(10000, `${fieldLabel} no puede exceder los $10,000 USD.`);

export const integerRangeSchema = (fieldLabel: string, min: number, max: number) =>
  z
    .number()
    .int(`${fieldLabel} debe ser un número entero sin decimales.`)
    .min(min, `${fieldLabel} debe ser al menos ${min}.`)
    .max(max, `${fieldLabel} no puede exceder ${max}.`);

export const textareaSchema = (fieldLabel = 'La descripción', minLength = 10, maxLength = 500) =>
  z
    .string()
    .trim()
    .min(minLength, `${fieldLabel} debe contener al menos ${minLength} caracteres.`)
    .max(maxLength, `${fieldLabel} no puede superar los ${maxLength} caracteres.`);

export const searchDateRangeSchema = z
  .object({
    checkin: z.string().min(1, 'La fecha de llegada (Check-in) es obligatoria.'),
    checkout: z.string().min(1, 'La fecha de salida (Check-out) es obligatoria.'),
  })
  .refine(
    (data) => {
      if (!data.checkin || !data.checkout) return true;
      return data.checkout > data.checkin;
    },
    {
      message: 'La fecha de salida (Check-out) debe ser posterior a la fecha de llegada (Check-in).',
      path: ['checkout'],
    },
  );
