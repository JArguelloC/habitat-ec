import { useState, useEffect, useCallback, useRef } from 'react';

export const CHECKOUT_EXPIRES_KEY = 'checkout_expires_at';
const DEFAULT_DURATION_MS = 15 * 60 * 1000; // 15 minutos en milisegundos

export interface UseCheckoutTimerOptions {
  durationMs?: number;
  isPaused?: boolean;
  onExpire?: () => void;
  storageKey?: string;
  initialExpiresAt?: string | null;
}

export interface UseCheckoutTimerReturn {
  secondsLeft: number;
  formattedTimer: string;
  isExpired: boolean;
  clearTimer: () => void;
  resetTimer: (newDurationMs?: number) => void;
}

export function useCheckoutTimer({
  durationMs = DEFAULT_DURATION_MS,
  isPaused = false,
  onExpire,
  storageKey = CHECKOUT_EXPIRES_KEY,
  initialExpiresAt = null,
}: UseCheckoutTimerOptions = {}): UseCheckoutTimerReturn {
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  const hasExpiredRef = useRef(false);

  // 1, 2, 3, 4: Inicialización con lectura de localStorage o inicialización de nuevo timestamp
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const now = Date.now();

      if (stored) {
        const expiresAt = parseInt(stored, 10);
        if (!isNaN(expiresAt)) {
          const remainingSeconds = Math.floor((expiresAt - now) / 1000);
          return remainingSeconds > 0 ? remainingSeconds : 0;
        }
      }

      // Si no existe en localStorage, calcular nuevo tiempo de expiración
      const targetTime = initialExpiresAt
        ? new Date(initialExpiresAt).getTime()
        : now + durationMs;

      const finalExpiresAt = !isNaN(targetTime) && targetTime > now ? targetTime : now + durationMs;
      localStorage.setItem(storageKey, finalExpiresAt.toString());

      return Math.max(0, Math.floor((finalExpiresAt - now) / 1000));
    } catch {
      return Math.floor(durationMs / 1000);
    }
  });

  const clearTimer = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignorar error de acceso a storage
    }
  }, [storageKey]);

  const resetTimer = useCallback(
    (newDurationMs: number = durationMs) => {
      const expiresAt = Date.now() + newDurationMs;
      try {
        localStorage.setItem(storageKey, expiresAt.toString());
      } catch {
        // Ignorar
      }
      hasExpiredRef.current = false;
      setSecondsLeft(Math.floor(newDurationMs / 1000));
    },
    [durationMs, storageKey],
  );

  // 5. Manejo de tiempo expirado
  useEffect(() => {
    if (isPaused) return;

    if (secondsLeft <= 0) {
      clearTimer();
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
    }
  }, [secondsLeft, isPaused, clearTimer]);

  // Sincronización continua con Date.now()
  useEffect(() => {
    if (isPaused || secondsLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) {
          setSecondsLeft(0);
          return;
        }

        const expiresAt = parseInt(stored, 10);
        const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000);

        if (remainingSeconds <= 0) {
          setSecondsLeft(0);
          clearTimer();
          window.clearInterval(intervalId);
        } else {
          setSecondsLeft(remainingSeconds);
        }
      } catch {
        setSecondsLeft((prev) => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isPaused, secondsLeft, storageKey, clearTimer]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpired = secondsLeft <= 0;

  return {
    secondsLeft,
    formattedTimer,
    isExpired,
    clearTimer,
    resetTimer,
  };
}
