import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, ShieldCheck, Lock, Globe } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-brand-border bg-brand-surface text-brand-text">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 text-left">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/25 text-brand-accent">
                <Leaf className="h-4 w-4" />
              </div>
              <span className="font-serif text-lg font-bold text-brand-text">
                Hábitat <span className="text-brand-accent">EC</span>
              </span>
            </div>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-brand-text/70">
              Plataforma ecuatoriana de hospitalidad sostenible, Eco-Lodges, Hostales y Hoteles con
              control de inventario transaccional ACID, contratos en Quinta Forma Normal (5FN) y
              liquidaciones automatizadas para anfitriones locales.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-brand-secondary">
              <span className="chip-sage">
                <ShieldCheck className="h-3.5 w-3.5" />
                Reserva Protegida Hold 15m
              </span>
              <span className="chip-gold">
                <Lock className="h-3.5 w-3.5" />
                Idempotencia & Auditoría Forense
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-accent">
              Explorar Ecuador
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-brand-text/75">
              <li>
                <Link to="/" className="hover:text-brand-accent transition-colors">
                  Marketplace de Alojamientos
                </Link>
              </li>
              <li>
                <Link to="/mis-reservas" className="hover:text-brand-accent transition-colors">
                  Mis Reservas y Vouchers PNR
                </Link>
              </li>
              <li>
                <Link to="/perfil" className="hover:text-brand-accent transition-colors">
                  Configuración de Perfil
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-accent">
              Arquitectura & Cumplimiento
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-brand-text/75">
              <li className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-brand-secondary" />
                PostgreSQL 16 + PostGIS + btree_gist
              </li>
              <li>Control de Stock por Tipología (Hotel / Eco-Lodge)</li>
              <li>Google OAuth 2.0 & RBAC Multinivel</li>
              <li>Heurísticas de Usabilidad de Jakob Nielsen</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-brand-border pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-text/60">
          <p>© {new Date().getFullYear()} Hábitat EC. Todos los derechos reservados.</p>
          <p className="mt-2 sm:mt-0">
            Paleta Oficial: Oro Campestre & Lino (#F9F8F5 • #CBB279 • #6E7A6E)
          </p>
        </div>
      </div>
    </footer>
  );
};

