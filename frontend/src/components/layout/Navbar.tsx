import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  CalendarCheck,
  Building2,
  ShieldAlert,
  UserCircle,
  LogOut,
  LogIn,
  UserPlus,
  Menu,
  X,
  Leaf,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isAdmin,
    isSuperadmin,
    logout,
    notification,
    clearNotification,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-border bg-brand-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/25 border border-brand-primary/50 text-brand-accent transition-transform group-hover:scale-105">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-serif text-lg font-bold tracking-tight text-brand-text">
                Hábitat <span className="text-brand-accent">EC</span>
              </span>
              <span className="text-[11px] font-medium uppercase tracking-widest text-brand-secondary">
                Hospitalidad Sostenible
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              to="/"
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'bg-brand-primary/25 text-brand-accent font-semibold border border-brand-primary/40'
                  : 'text-brand-text/80 hover:bg-brand-bg hover:text-brand-text'
              }`}
            >
              <Compass className="h-4 w-4" />
              Marketplace
            </Link>

            {isAuthenticated && (
              <Link
                to="/mis-reservas"
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive('/mis-reservas')
                    ? 'bg-brand-primary/25 text-brand-accent font-semibold border border-brand-primary/40'
                    : 'text-brand-text/80 hover:bg-brand-bg hover:text-brand-text'
                }`}
              >
                <CalendarCheck className="h-4 w-4" />
                Mis Reservas
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isActive('/admin')
                    ? 'bg-brand-primary text-brand-text shadow-sm'
                    : 'border border-brand-primary/50 bg-brand-primary/15 text-brand-accent hover:bg-brand-primary/30'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Panel Anfitrión
              </Link>
            )}

            {isSuperadmin && (
              <Link
                to="/superadmin"
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isActive('/superadmin')
                    ? 'bg-brand-accent text-white shadow-sm'
                    : 'border border-brand-accent/40 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-white'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                Panel Superadmin
              </Link>
            )}
          </nav>

          {/* Right User / Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/perfil"
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors ${
                    isActive('/perfil')
                      ? 'border-brand-accent bg-brand-primary/20'
                      : 'border-brand-border bg-brand-bg hover:border-brand-accent'
                  }`}
                >
                  <UserCircle className="h-5 w-5 text-brand-accent" />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-brand-text leading-tight">
                      {user.nombre} {user.apellido}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {user.roles.map((r) => (
                        <span
                          key={r}
                          className="rounded bg-brand-secondary/15 px-1.5 py-0.2 text-[10px] font-semibold text-brand-secondary"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-medium text-brand-text/80 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link to="/login" className="btn-secondary py-2 px-3.5 text-xs">
                  <LogIn className="h-4 w-4 text-brand-accent" />
                  Iniciar Sesión
                </Link>
                <Link to="/registro" className="btn-primary py-2 px-4 text-xs">
                  <UserPlus className="h-4 w-4" />
                  Crear Cuenta
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-brand-border p-2 text-brand-text md:hidden"
            aria-label="Abrir menú de navegación"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-brand-border bg-brand-surface px-4 py-4 space-y-2 md:hidden">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-bg"
            >
              <Compass className="h-4 w-4 text-brand-accent" />
              Marketplace
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  to="/mis-reservas"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-bg"
                >
                  <CalendarCheck className="h-4 w-4 text-brand-accent" />
                  Mis Reservas
                </Link>
                <Link
                  to="/perfil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-bg"
                >
                  <UserCircle className="h-4 w-4 text-brand-accent" />
                  Mi Perfil ({user?.nombre})
                </Link>
              </>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-brand-primary/20 px-3 py-2.5 text-sm font-semibold text-brand-accent"
              >
                <Building2 className="h-4 w-4" />
                Panel Anfitrión
              </Link>
            )}

            {isSuperadmin && (
              <Link
                to="/superadmin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-brand-accent/15 px-3 py-2.5 text-sm font-semibold text-brand-accent"
              >
                <ShieldAlert className="h-4 w-4" />
                Panel Superadmin
              </Link>
            )}

            <div className="pt-2 border-t border-brand-border flex flex-col gap-2">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-secondary w-full justify-center"
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    to="/registro"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-primary w-full justify-center"
                  >
                    Crear Cuenta
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Global Toast Notification (Jakob Nielsen Heuristic #1 & #9) */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-fade-in">
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-elevated ${
              notification.type === 'success'
                ? 'border-brand-secondary/40 bg-brand-surface text-brand-text'
                : notification.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-900'
                : notification.type === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-brand-primary bg-brand-surface text-brand-text'
            }`}
          >
            {notification.type === 'success' && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-secondary mt-0.5" />
            )}
            {notification.type === 'error' && (
              <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            )}
            {notification.type === 'warning' && (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            )}
            {notification.type === 'info' && (
              <Info className="h-5 w-5 shrink-0 text-brand-accent mt-0.5" />
            )}
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">{notification.title}</p>
              <p className="mt-0.5 text-xs opacity-85">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={clearNotification}
              className="rounded-lg p-1 opacity-60 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

