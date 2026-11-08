import React from 'react';
import { Wifi, CreditCard as CreditCardIcon } from 'lucide-react';

export interface InteractiveCreditCardProps {
  cardNumber: string;
  cardHolder: string;
  cardExpiry: string;
  cardCvv: string;
  isFlipped?: boolean;
  onFlipToggle?: () => void;
  brand?: 'VISA' | 'MASTERCARD' | 'DINERS_AMEX' | null;
}

export const InteractiveCreditCard: React.FC<InteractiveCreditCardProps> = ({
  cardNumber,
  cardHolder,
  cardExpiry,
  cardCvv,
  isFlipped = false,
  onFlipToggle,
  brand,
}) => {
  // Formateo de los 16 dígitos en 4 bloques con placeholder
  const rawDigits = cardNumber.replace(/\D/g, '').slice(0, 16);
  const formattedGroups = [
    rawDigits.slice(0, 4).padEnd(4, '•'),
    rawDigits.slice(4, 8).padEnd(4, '•'),
    rawDigits.slice(8, 12).padEnd(4, '•'),
    rawDigits.slice(12, 16).padEnd(4, '•'),
  ];

  // Paleta de gradientes elegante y temática según la franquicia detectada
  const gradientClass =
    brand === 'VISA'
      ? 'from-[#0A1128] via-[#1C2541] to-[#1E3A8A]'
      : brand === 'MASTERCARD'
      ? 'from-[#141416] via-[#242429] to-[#3B3B43]'
      : brand === 'DINERS_AMEX'
      ? 'from-[#082F49] via-[#0C4A6E] to-[#0369A1]'
      : 'from-stone-900 via-neutral-900 to-stone-800';

  return (
    <div
      className="w-full max-w-[340px] sm:max-w-[380px] h-[210px] sm:h-[228px] cursor-pointer select-none perspective-[1000px]"
      onClick={onFlipToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlipToggle?.();
        }
      }}
      title="Haz clic para voltear la tarjeta"
    >
      <div
        className="relative w-full h-full rounded-2xl shadow-2xl transition-transform duration-600 ease-in-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* CARA FRONTAL (ANVERSO) */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-tr ${gradientClass} p-5 text-white shadow-xl border border-white/15 flex flex-col justify-between overflow-hidden`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Brillos holográficos de fondo */}
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-white/5 blur-xl pointer-events-none" />

          {/* Fila superior: Chip EMV, Contactless y Franquicia */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              {/* Chip Dorado */}
              <div className="relative h-9 w-11 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-md">
                <div className="h-full w-full rounded-[4px] border border-amber-800/30 grid grid-cols-2 gap-0.5 opacity-80" />
              </div>
              <Wifi className="h-5 w-5 text-white/70 rotate-90 drop-shadow-xs" />
            </div>

            {/* Logo de la Franquicia */}
            <div className="h-8 flex items-center justify-end">
              {brand === 'VISA' && (
                <span className="font-sans text-2xl font-black italic tracking-wider text-white drop-shadow-md">
                  VISA
                </span>
              )}
              {brand === 'MASTERCARD' && (
                <div className="flex items-center -space-x-2">
                  <div className="h-7 w-7 rounded-full bg-[#EB001B] opacity-95 shadow-xs" />
                  <div className="h-7 w-7 rounded-full bg-[#F79E1B] opacity-95 shadow-xs" />
                </div>
              )}
              {brand === 'DINERS_AMEX' && (
                <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-black tracking-widest text-white backdrop-blur-xs border border-white/30">
                  AMEX
                </span>
              )}
              {!brand && (
                <CreditCardIcon className="h-6 w-6 text-white/40" />
              )}
            </div>
          </div>

          {/* Fila central: 16 Dígitos */}
          <div className="my-auto py-2 z-10">
            <div className="font-mono text-base sm:text-lg font-bold tracking-[0.22em] text-white/95 drop-shadow-md flex justify-between">
              {formattedGroups.map((grp, idx) => (
                <span key={idx}>{grp}</span>
              ))}
            </div>
          </div>

          {/* Fila inferior: Titular y Expiración */}
          <div className="flex items-end justify-between text-xs tracking-wider z-10">
            <div className="max-w-[70%]">
              <span className="block text-[9px] font-medium uppercase text-white/60 tracking-wider">
                Titular de la tarjeta
              </span>
              <p className="font-semibold uppercase tracking-wide truncate text-white drop-shadow-xs text-xs sm:text-sm">
                {cardHolder.trim() || 'NOMBRE DEL TITULAR'}
              </p>
            </div>

            <div className="text-right">
              <span className="block text-[9px] font-medium uppercase text-white/60 tracking-wider">
                Expira
              </span>
              <p className="font-mono font-bold text-white drop-shadow-xs text-xs sm:text-sm">
                {cardExpiry || 'MM/AA'}
              </p>
            </div>
          </div>
        </div>

        {/* CARA TRASERA (REVERSO) */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-tr ${gradientClass} text-white shadow-xl border border-white/15 flex flex-col justify-between py-5 overflow-hidden`}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Banda Magnética */}
          <div className="w-full h-11 bg-black/95 shadow-inner" />

          {/* Panel de Firma y CVV */}
          <div className="px-5">
            <div className="flex items-center justify-between text-[10px] text-white/70 mb-1">
              <span>Panel de firma autorizada</span>
              <span className="font-bold">CVV / CVC</span>
            </div>
            <div className="flex items-center h-9 rounded bg-white/90 px-3 shadow-inner">
              <div className="flex-1 h-3 bg-gradient-to-r from-stone-200 via-stone-300 to-stone-200 rounded-xs opacity-70" />
              <span className="font-mono text-sm font-black italic text-stone-900 tracking-widest pl-3">
                {cardCvv ? cardCvv : '•••'}
              </span>
            </div>
          </div>

          {/* Microtexto de seguridad y Emblema */}
          <div className="px-5 flex items-center justify-between text-[8px] text-white/60 leading-tight">
            <p className="max-w-[75%]">
              Esta tarjeta virtual garantiza tu reserva segura a través de Hábitat Ecuador Pay.
            </p>
            <div className="h-6 w-6 rounded-full border border-white/30 bg-white/10 flex items-center justify-center font-bold text-[7px] text-white/80">
              SECURE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

