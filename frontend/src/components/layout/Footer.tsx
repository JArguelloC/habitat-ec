import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Headphones } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-brand-border bg-brand-surface text-brand-text transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 text-left">
          {/* Columna 1: Marca y Propuesta de Valor Comercial */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent overflow-hidden">
                <img src="/logo1.svg" alt="Hábitat EC" className="h-7 w-7 object-contain bg-transparent" />
              </div>
              <span className="font-serif text-lg font-bold text-brand-text">
                Hábitat <span className="text-brand-primary">EC</span>
              </span>
            </div>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-brand-text/70">
              Plataforma ecuatoriana de hospitalidad sostenible. Descubre y reserva Eco-Lodges, Hostales y Hoteles únicos en todo el país de forma segura.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-brand-secondary">
              <span className="chip-sage">
                <ShieldCheck className="h-3.5 w-3.5" />
                Pagos Seguros
              </span>
              <span className="chip-gold">
                <Headphones className="h-3.5 w-3.5" />
                Soporte Garantizado
              </span>
            </div>
          </div>

          {/* Columna 2: Explorar Ecuador */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Explorar Ecuador
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-brand-text/75">
              <li>
                <Link to="/" className="hover:text-brand-primary transition-colors">
                  Marketplace de Alojamientos
                </Link>
              </li>
              <li>
                <Link to="/mis-reservas" className="hover:text-brand-primary transition-colors">
                  Mis Reservas
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-brand-primary transition-colors font-medium text-brand-primary">
                  Publica tu propiedad
                </Link>
              </li>
              <li>
                <Link to="/perfil" className="hover:text-brand-primary transition-colors">
                  Configuración de Perfil
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Soporte & Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Soporte & Legal
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-brand-text/75">
              <li>
                <Link to="/legal/faq" className="hover:text-brand-primary transition-colors">
                  Preguntas Frecuentes (FAQ)
                </Link>
              </li>
              <li>
                <Link to="/legal/terms" className="hover:text-brand-primary transition-colors">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className="hover:text-brand-primary transition-colors">
                  Políticas de Privacidad
                </Link>
              </li>
              <li>
                <Link to="/legal/cancellation" className="hover:text-brand-primary transition-colors">
                  Políticas de Cancelación
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="mt-8 border-t border-brand-border pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-text/60">
          <p>© {new Date().getFullYear()} Hábitat EC. Todos los derechos reservados.</p>
          <p className="mt-2 sm:mt-0">
            Hospitalidad Sostenible & Ecoturismo Certificado
          </p>
        </div>
      </div>
    </footer>
  );
};
