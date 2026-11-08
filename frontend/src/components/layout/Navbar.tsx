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
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

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
  const { isDark, toggleTheme } = useTheme();
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
      <header className="sticky top-0 z-40 border-b border-brand-border bg-brand-surface/95 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Brand Logo & Isotype */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent transition-transform group-hover:scale-105 overflow-hidden">
              <img
                src="/logo1.svg"
                alt="Hábitat EC Logo"
                className="h-8 w-8 object-contain bg-transparent"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-serif text-lg font-bold tracking-tight text-brand-text">
                Hábitat <span className="text-brand-primary">EC</span>
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
                  ? 'bg-brand-primary/25 text-brand-primary font-bold border border-brand-primary/40'
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
                    ? 'bg-brand-primary/25 text-brand-primary font-bold border border-brand-primary/40'
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
                    ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
                    : 'border border-brand-primary/50 bg-brand-primary/15 text-brand-primary hover:bg-brand-primary/30'
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
                    ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
                    : 'border border-brand-primary/50 bg-brand-primary/15 text-brand-primary hover:bg-brand-primary/30'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                Panel Superadmin
              </Link>
            )}
          </nav>

          {/* Right User / Auth Actions & Theme Switcher */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text/80 hover:text-brand-primary hover:border-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? (
                <Sun className="h-4.5 w-4.5 text-amber-400" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-brand-text/75" />
              )}
            </button>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/perfil"
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors ${
                    isActive('/perfil')
                      ? 'border-brand-primary bg-brand-primary/20'
                      : 'border-brand-border bg-brand-bg hover:border-brand-primary'
                  }`}
                >
                  <UserCircle className="h-5 w-5 text-brand-primary" />
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-medium text-brand-text/80 hover:border-red-300 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link to="/login" className="btn-secondary py-2 px-3.5 text-xs">
                  <LogIn className="h-4 w-4 text-brand-primary" />
                  Iniciar Sesión
                </Link>
                <Link to="/registro" className="btn-primary py-2 px-4 text-xs">
                  <UserPlus className="h-4 w-4" />
                  Crear Cuenta
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Actions: Theme Toggle & Hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text/80 hover:text-brand-primary transition-colors"
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? (
                <Sun className="h-4.5 w-4.5 text-amber-400" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-brand-text/75" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-xl border border-brand-border p-2 text-brand-text"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-brand-border bg-brand-surface px-4 py-4 space-y-2 md:hidden">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-bg"
            >
              <Compass className="h-4 w-4 text-brand-primary" />
              Marketplace
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  to="/mis-reservas"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-bg"
                >
                  <CalendarCheck className="h-4 w-4 text-brand-primary" />
                  Mis Reservas
                </Link>
                <Link
                  to="/perfil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-bg"
                >
                  <UserCircle className="h-4 w-4 text-brand-primary" />
                  Mi Perfil ({user?.nombre})
                </Link>
              </>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-brand-primary/20 px-3 py-2.5 text-sm font-semibold text-brand-primary"
              >
                <Building2 className="h-4 w-4" />
                Panel Anfitrión
              </Link>
            )}

            {isSuperadmin && (
              <Link
                to="/superadmin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-brand-primary/20 px-3 py-2.5 text-sm font-semibold text-brand-primary"
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600"
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
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 max-w-md animate-fade-in pointer-events-auto">
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl ${
              notification.type === 'success'
                ? 'border-brand-secondary/40 bg-white dark:bg-brand-surface text-brand-text'
                : notification.type === 'error'
                ? 'border-red-300 dark:border-red-800 bg-white dark:bg-brand-surface text-red-600 dark:text-red-400'
                : notification.type === 'warning'
                ? 'border-amber-300 dark:border-amber-800 bg-white dark:bg-brand-surface text-amber-700 dark:text-amber-300'
                : 'border-brand-primary bg-white dark:bg-brand-surface text-brand-text'
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
              <Info className="h-5 w-5 shrink-0 text-brand-primary mt-0.5" />
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
