import React, { forwardRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import {
  allowOnlyLettersKey,
  allowOnlyNumbersKey,
  allowPriceDecimalsKey,
  allowAlphanumericKey,
  cleanOnlyLetters,
  cleanOnlyNumbers,
  cleanPriceDecimals,
  cleanAlphanumeric,
} from '../../utils/inputFilters';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  success?: string | null;
  className?: string;
  children: React.ReactNode;
  id?: string;
}

/**
 * Contenedor estándar de formulario (Heurística #1 y #9 de Jakob Nielsen:
 * visibilidad del estado del sistema y retroalimentación constructiva de errores).
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  hint,
  success,
  className = '',
  children,
  id,
}) => {
  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </label>
      )}

      {children}

      {error ? (
        <p
          role="alert"
          className="text-xs font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1.5 animate-fadeIn"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </p>
      ) : success ? (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
          <span>{success}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );
};

export interface InputControlProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  required?: boolean;
  error?: string | null;
  success?: string | null;
  hint?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
  filterType?: 'letters' | 'numbers' | 'price' | 'alphanumeric';
  allowedSymbols?: string;
  onValueChange?: (val: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  wrapperClassName?: string;
}

/**
 * Control de entrada enriquecido con prevención física de errores (onKeyDown, onPaste)
 * y respuesta visual de doble capa.
 */
export const InputControl = forwardRef<HTMLInputElement, InputControlProps>(
  (
    {
      label,
      required,
      error,
      success,
      hint,
      icon: Icon,
      filterType,
      allowedSymbols = ' .,#-_/',
      type = 'text',
      className = '',
      wrapperClassName = '',
      id,
      value,
      onKeyDown,
      onPaste,
      onChange,
      onValueChange,
      maxLength,
      ...rest
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === 'password';
    const computedType = isPasswordType && showPassword ? 'text' : type;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (filterType === 'letters') {
        allowOnlyLettersKey(e);
      } else if (filterType === 'numbers') {
        allowOnlyNumbersKey(e);
      } else if (filterType === 'price') {
        allowPriceDecimalsKey(e, String(value ?? ''));
      } else if (filterType === 'alphanumeric') {
        allowAlphanumericKey(e, allowedSymbols);
      }

      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (filterType) {
        e.preventDefault();
        const raw = e.clipboardData.getData('text');
        let cleaned = raw;
        if (filterType === 'letters') cleaned = cleanOnlyLetters(raw, maxLength);
        else if (filterType === 'numbers') cleaned = cleanOnlyNumbers(raw, maxLength);
        else if (filterType === 'price') cleaned = cleanPriceDecimals(raw);
        else if (filterType === 'alphanumeric') cleaned = cleanAlphanumeric(raw, allowedSymbols, maxLength);

        if (onValueChange) {
          onValueChange(cleaned);
        } else if (onChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.currentTarget, value: cleaned },
            currentTarget: { ...e.currentTarget, value: cleaned },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
        return;
      }

      if (onPaste) {
        onPaste(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      if (filterType === 'letters') {
        val = cleanOnlyLetters(val, maxLength);
      } else if (filterType === 'numbers') {
        val = cleanOnlyNumbers(val, maxLength);
      } else if (filterType === 'price') {
        val = cleanPriceDecimals(val);
      } else if (filterType === 'alphanumeric') {
        val = cleanAlphanumeric(val, allowedSymbols, maxLength);
      }

      if (onValueChange) {
        onValueChange(val);
      }
      if (onChange) {
        e.target.value = val;
        onChange(e);
      }
    };

    const hasError = !!error;
    const hasSuccess = !hasError && !!success;

    const stateClasses = hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-950/40 text-stone-900 dark:text-stone-100 bg-red-50/20 dark:bg-red-950/10'
      : hasSuccess
        ? 'border-emerald-500/80 focus:border-emerald-500 focus:ring-emerald-200 dark:focus:ring-emerald-950/40 bg-emerald-50/20 dark:bg-emerald-950/10'
        : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:border-emerald-600 focus:ring-emerald-500/20 text-stone-900 dark:text-stone-100';

    return (
      <FormField
        label={label}
        required={required}
        error={error}
        success={success}
        hint={hint}
        id={id}
        className={wrapperClassName}
      >
        <div className="relative flex items-center w-full">
          {Icon && (
            <div className="absolute left-3.5 pointer-events-none text-stone-400 dark:text-stone-500 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </div>
          )}

          <input
            ref={ref}
            id={id}
            type={computedType}
            value={value}
            maxLength={maxLength}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onChange={handleChange}
            aria-invalid={hasError}
            data-invalid={hasError}
            className={`w-full rounded-xl border text-sm transition-all outline-none py-2.5 px-3.5 focus:ring-2 placeholder:text-stone-400 dark:placeholder:text-stone-500 disabled:opacity-50 disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:cursor-not-allowed ${
              Icon ? 'pl-10' : ''
            } ${isPasswordType || hasError ? 'pr-10' : ''} ${stateClasses} ${className}`}
            {...rest}
          />

          <div className="absolute right-3 flex items-center gap-1.5">
            {isPasswordType && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors focus:outline-none p-1"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}

            {hasError && !isPasswordType && (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 animate-bounceOnce" />
            )}
          </div>
        </div>
      </FormField>
    );
  },
);

InputControl.displayName = 'InputControl';

export interface TextAreaControlProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  required?: boolean;
  error?: string | null;
  success?: string | null;
  hint?: string | null;
  maxLength?: number;
  showCounter?: boolean;
  onValueChange?: (val: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  wrapperClassName?: string;
}

/**
 * Textarea con contador reactivo de caracteres en vivo y límites estrictos (Heurísticas #1 y #5).
 */
export const TextAreaControl = forwardRef<HTMLTextAreaElement, TextAreaControlProps>(
  (
    {
      label,
      required,
      error,
      success,
      hint,
      maxLength = 500,
      showCounter = true,
      className = '',
      wrapperClassName = '',
      id,
      value,
      onChange,
      onValueChange,
      ...rest
    },
    ref,
  ) => {
    const stringVal = String(value ?? '');
    const currentLength = stringVal.length;
    const isNearLimit = currentLength >= maxLength * 0.9;
    const isAtLimit = currentLength >= maxLength;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let val = e.target.value;
      if (maxLength && val.length > maxLength) {
        val = val.slice(0, maxLength);
      }
      if (onValueChange) {
        onValueChange(val);
      }
      if (onChange) {
        e.target.value = val;
        onChange(e);
      }
    };

    const hasError = !!error;
    const stateClasses = hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-950/40 text-stone-900 dark:text-stone-100 bg-red-50/20 dark:bg-red-950/10'
      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:border-emerald-600 focus:ring-emerald-500/20 text-stone-900 dark:text-stone-100';

    return (
      <FormField
        label={label}
        required={required}
        error={error}
        success={success}
        hint={hint}
        id={id}
        className={wrapperClassName}
      >
        <div className="relative w-full">
          <textarea
            ref={ref}
            id={id}
            value={value}
            maxLength={maxLength}
            onChange={handleChange}
            aria-invalid={hasError}
            data-invalid={hasError}
            className={`w-full rounded-xl border text-sm transition-all outline-none p-3.5 focus:ring-2 placeholder:text-stone-400 dark:placeholder:text-stone-500 disabled:opacity-50 disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:cursor-not-allowed ${stateClasses} ${className}`}
            {...rest}
          />
          {showCounter && maxLength && (
            <div className="flex justify-end mt-1">
              <span
                className={`text-[11px] font-mono transition-colors ${
                  isAtLimit
                    ? 'text-red-500 font-bold'
                    : isNearLimit
                      ? 'text-amber-500 font-semibold'
                      : 'text-stone-400 dark:text-stone-500'
                }`}
              >
                {currentLength} / {maxLength} caracteres
              </span>
            </div>
          )}
        </div>
      </FormField>
    );
  },
);

TextAreaControl.displayName = 'TextAreaControl';

export interface SelectControlProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  wrapperClassName?: string;
}

/**
 * Selector estandarizado y accesible con estados de error y selección unificados.
 */
export const SelectControl = forwardRef<HTMLSelectElement, SelectControlProps>(
  ({ label, required, error, hint, className = '', wrapperClassName = '', id, children, ...rest }, ref) => {
    const hasError = !!error;
    const stateClasses = hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-950/40 text-stone-900 dark:text-stone-100 bg-red-50/20 dark:bg-red-950/10'
      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:border-emerald-600 focus:ring-emerald-500/20 text-stone-900 dark:text-stone-100';

    return (
      <FormField
        label={label}
        required={required}
        error={error}
        hint={hint}
        id={id}
        className={wrapperClassName}
      >
        <select
          ref={ref}
          id={id}
          aria-invalid={hasError}
          data-invalid={hasError}
          className={`w-full rounded-xl border text-sm transition-all outline-none py-2.5 px-3.5 focus:ring-2 disabled:opacity-50 disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:cursor-not-allowed cursor-pointer ${stateClasses} ${className}`}
          {...rest}
        >
          {children}
        </select>
      </FormField>
    );
  },
);

SelectControl.displayName = 'SelectControl';

