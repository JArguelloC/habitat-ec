import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import {
  Mail,
  Lock,
  User,
  Phone,
  CreditCard,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../api/httpClient';

interface AuthPageProps {
  mode: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { login, registerCliente, loginWithGoogle, notify } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cedulaRuc, setCedulaRuc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectPath = (location.state as { from?: string } | null)?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!correo.includes('@')) {
      setErrorMsg('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const loggedUser = await login(correo.trim(), password);
        if (loggedUser.roles.includes('SUPERADMIN') && redirectPath === '/') {
          navigate('/superadmin');
        } else if (loggedUser.roles.includes('ADMIN') && redirectPath === '/') {
          navigate('/admin');
        } else {
          navigate(redirectPath);
        }
      } else {
        if (!nombre.trim() || !apellido.trim()) {
          setErrorMsg('El nombre y apellido son obligatorios para registrarse.');
          setLoading(false);
          return;
        }
        await registerCliente({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          correo: correo.trim(),
          password,
          cedulaRuc: cedulaRuc.trim() || undefined,
          telefono: telefono.trim() || undefined,
        });
        navigate(redirectPath);
      }
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'No se pudo completar la autenticación.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setErrorMsg('Google no devolvió una credencial válida.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const loggedUser = await loginWithGoogle(credentialResponse.credential);
      if (loggedUser.roles.includes('SUPERADMIN') && redirectPath === '/') {
        navigate('/superadmin');
      } else if (loggedUser.roles.includes('ADMIN') && redirectPath === '/') {
        navigate('/admin');
      } else {
        navigate(redirectPath);
      }
    } catch (err: unknown) {
      setErrorMsg(
        extractErrorMessage(err, 'Error al verificar tu identidad con Google OAuth.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-brand-border bg-brand-surface shadow-elevated overflow-hidden">
        {/* Left Side: Editorial Visual / Value Proposition */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#141A17] via-[#1E2621] to-[#141A17] p-8 text-[#F4F1EA] dark:from-[#221c13] dark:via-[#1a150e] dark:to-[#110e09] dark:text-brand-text flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-primary/20 border border-brand-primary/40 px-3 py-1 text-xs font-medium text-brand-primary">
              <img src="/logo1.svg" alt="Hábitat EC" className="h-4 w-4 object-contain inline-block" />
              Ecoturismo & Hospitalidad 5FN
            </div>
            <h1 className="mt-6 font-serif text-2xl sm:text-3xl font-bold leading-snug text-white">
              Descubre refugios naturales y hoteles boutique en todo el Ecuador.
            </h1>
            <p className="mt-3 text-xs sm:text-sm text-white/90 leading-relaxed">
              Reserva cabañas íntimas, eco-lodges en el bosque nublado o habitaciones de hotel con
              disponibilidad garantizada en tiempo real y bloqueo temporal de 15 minutos.
            </p>
          </div>

          <div className="relative z-10 mt-8 space-y-3 border-t border-brand-border/40 pt-5 text-left text-xs text-white/85">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-brand-primary shrink-0" />
              <span>Autenticación unificada para Viajeros, Anfitriones y Superadmin</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-brand-primary shrink-0" />
              <span>Integración oficial con Google OAuth 2.0 (Auto-registro CLIENTE)</span>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="lg:col-span-7 p-6 sm:p-10 text-left">
          <div className="flex items-center justify-between border-b border-brand-border pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-brand-text">
                {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta de Viajero'}
              </h2>
              <p className="mt-1 text-xs text-brand-text/65">
                {mode === 'login'
                  ? 'Ingresa con tus credenciales o continúa con Google.'
                  : 'Regístrate como CLIENTE para reservar y calificar alojamientos.'}
              </p>
            </div>
            <div className="flex rounded-xl border border-brand-border bg-brand-bg p-1 text-xs font-medium">
              <Link
                to="/login"
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  mode === 'login'
                    ? 'bg-brand-primary text-brand-text font-semibold shadow-sm'
                    : 'text-brand-text/70 hover:text-brand-text'
                }`}
              >
                Ingresar
              </Link>
              <Link
                to="/registro"
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  mode === 'register'
                    ? 'bg-brand-primary text-brand-text font-semibold shadow-sm'
                    : 'text-brand-text/70 hover:text-brand-text'
                }`}
              >
                Registro
              </Link>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">No se pudo procesar la solicitud</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Google OAuth Button */}
          <div className="mt-6">
            <p className="mb-2.5 text-xs font-medium text-brand-text/70">
              Acceso rápido con un clic:
            </p>
            <div className="flex justify-start">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  notify(
                    'error',
                    'Error de Google OAuth',
                    'No se pudo iniciar la ventana de autenticación de Google.',
                  );
                }}
                useOneTap={false}
                shape="rectangular"
                theme="outline"
                size="large"
                text={mode === 'login' ? 'signin_with' : 'signup_with'}
              />
            </div>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-brand-border" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-brand-text/50">
              o con tu correo electrónico
            </span>
            <div className="h-px flex-1 bg-brand-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Nombres *
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. Camila"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Apellidos *
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      placeholder="Ej. Montalvo"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Correo Electrónico *
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="nombre@correo.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Contraseña *
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="input-field pl-10"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Cédula / RUC (Opcional)
                  </label>
                  <div className="relative">
                    <CreditCard className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      maxLength={13}
                      value={cedulaRuc}
                      onChange={(e) => setCedulaRuc(e.target.value)}
                      placeholder="1712345678"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">
                    Teléfono Móvil (Opcional)
                  </label>
                  <div className="relative">
                    <Phone className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="+593 99 123 4567"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Iniciar Sesión en Hábitat EC' : 'Completar Registro'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
