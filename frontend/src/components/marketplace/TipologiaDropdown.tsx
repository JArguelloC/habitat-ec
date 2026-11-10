import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SlidersHorizontal, ChevronDown, Check, X, Sparkles } from 'lucide-react';

export interface TipoAlojamientoItem {
  tipo_id: number;
  nombre: string;
  codigo: string;
}

interface TipologiaDropdownProps {
  tipos: TipoAlojamientoItem[];
  selectedTipoId: number | null;
  onSelectTipo: (tipoId: number | null) => void;
  getTipoIcon: (codigo: string) => React.ReactNode;
}

export const TipologiaDropdown: React.FC<TipologiaDropdownProps> = ({
  tipos,
  selectedTipoId,
  onSelectTipo,
  getTipoIcon,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTipo = tipos.find((t) => t.tipo_id === selectedTipoId);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (tipoId: number | null) => {
    onSelectTipo(tipoId);
    handleClose();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectTipo(null);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Botón Activador (Trigger) */}
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${
          selectedTipoId !== null
            ? 'border-brand-primary/60 bg-brand-primary/10 text-brand-primary dark:border-[#C5A059]/60 dark:bg-[#C5A059]/10 dark:text-[#C5A059] font-semibold shadow-sm'
            : 'border-brand-border bg-brand-surface text-brand-text/85 hover:border-brand-primary hover:text-brand-text shadow-xs'
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-primary/15 text-brand-primary dark:bg-[#C5A059]/15 dark:text-[#C5A059]">
          <SlidersHorizontal className="h-3 w-3" />
        </span>

        <span className="truncate max-w-[200px] sm:max-w-[260px]">
          <span className="text-brand-text/50 font-normal mr-1">Tipología:</span>
          {selectedTipo ? selectedTipo.nombre : 'Todos los Alojamientos'}
        </span>

        {selectedTipoId !== null && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTipo(null);
              }
            }}
            title="Quitar filtro de tipología"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-text/10 hover:bg-brand-text/20 text-brand-text transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        )}

        <ChevronDown
          className={`h-3.5 w-3.5 text-brand-text/60 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-brand-primary dark:text-[#C5A059]' : ''
          }`}
        />
      </button>

      {/* Menú Flotante (Dropdown Flotante) */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 z-50 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-brand-border bg-brand-surface/95 p-1.5 shadow-xl backdrop-blur-md transition-all duration-200"
        >
          {/* Opción fija: Todos los Alojamientos */}
          <button
            type="button"
            role="option"
            aria-selected={selectedTipoId === null}
            onClick={() => handleSelect(null)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
              selectedTipoId === null
                ? 'bg-brand-primary text-brand-bg font-bold shadow-xs'
                : 'text-brand-text/80 hover:bg-brand-bg hover:text-brand-text'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md ${
                  selectedTipoId === null
                    ? 'bg-white/20 text-white'
                    : 'bg-brand-text/5 text-brand-primary dark:text-[#C5A059]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">Todos los Alojamientos</span>
            </div>
            {selectedTipoId === null && <Check className="h-3.5 w-3.5 ml-2 shrink-0" />}
          </button>

          <div className="my-1 border-t border-brand-border/60" />

          {/* Opciones del catálogo */}
          {tipos.map((t) => {
            const isSelected = selectedTipoId === t.tipo_id;
            return (
              <button
                key={t.tipo_id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(t.tipo_id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-brand-primary text-brand-bg font-bold shadow-xs'
                    : 'text-brand-text/80 hover:bg-brand-bg hover:text-brand-text'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-brand-text/5 text-brand-primary dark:text-[#C5A059]'
                    }`}
                  >
                    {getTipoIcon(t.codigo)}
                  </span>
                  <span className="truncate">{t.nombre}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 ml-2 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
