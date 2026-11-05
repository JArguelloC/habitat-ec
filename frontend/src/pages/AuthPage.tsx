import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import {
  sanitizeOnlyLetters,
  validateName,
  validateEmail,
  sanitizeCedulaRuc,
  validateEcuadorianCedulaRuc,
  sanitizePhoneInput,
  validateEcuadorianPhone,
  evaluatePasswordStrength,
} from '../utils/validators';

interface AuthPageProps {
  mode: 'login' | 'register';
}

interface RecoveryEmailPayload {
  mensaje: string;
  correoDestino: string;
  expiraEnMinutos: number;
  codigoSeguridad: string;
  tokenRecuperacion: string;
  enlaceRecuperacionHttps: string;
  correoSeguroEnviado: {
    messageId: string;
    remitente: string;
    responderA: string;
    destinatario: string;
    asunto: string;
    idioma: string;
    politicasSeguridadAntiSpam: {
      protocoloEnlaces: string;
      spf: string;
      dkim: string;
      dmarc: string;
      proteccionAtaquesColaterales: string;
      clasificacion: string;
    };
    cuerpoTextoEspanol: string;
  };
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { login, registerCliente, loginWithGoogle, notify } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState(() => searchParams.get('correo') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cedulaRuc, setCedulaRuc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recovery Flow State (Soporta enlaces directos HTTPS ?modo=recuperar&correo=...&codigo=...&token=...)
  const [isRecovering, setIsRecovering] = useState(
    () => searchParams.get('modo') === 'recuperar',
  );
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>(() =>
    searchParams.get('codigo') || searchParams.get('token') ? 'reset' : 'request',
  );
  const [recoveryEmailData, setRecoveryEmailData] = useState<RecoveryEmailPayload | null>(null);
  const [codigoSeguridad, setCodigoSeguridad] = useState(
    () => searchParams.get('codigo') || '',
  );
  const [tokenRecuperacion, setTokenRecuperacion] = useState(
    () => searchParams.get('token') || '',
  );
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [showNuevaPassword, setShowNuevaPassword] = useState(false);

  const redirectPath = (location.state as { from?: string } | null)?.from || '/';

  // Validaciones en tiempo real (Heurísticas #1, #5 y #9 de Jakob Nielsen)
  const nombreValidation = validateName(nombre, 'El nombre');
  const apellidoValidation = validateName(apellido, 'El apellido');
  const correoValidation = validateEmail(correo);
  const cedulaValidation = validateEcuadorianCedulaRuc(cedulaRuc);
  const telefonoValidation = validateEcuadorianPhone(telefono);
  const passwordStrength = evaluatePasswordStrength(password);
  const nuevaPasswordStrength = evaluatePasswordStrength(nuevaPassword);

  const isPasswordError =
    errorMsg !== null &&
    (errorMsg.toLowerCase().includes('contraseña') ||
      errorMsg.toLowerCase().includes('credenciales'));

  const handleOpenRecovery = () => {
    setErrorMsg(null);
    setIsRecovering(true);
    setRecoveryStep('request');
  };

  const handleCloseRecovery = () => {
    setIsRecovering(false);
    setRecoveryStep('request');
    setRecoveryEmailData(null);
    setCodigoSeguridad('');
    setTokenRecuperacion('');
    setNuevaPassword('');
    setConfirmarPassword('');
    setErrorMsg(null);
    if (searchParams.has('modo')) {
      setSearchParams({});
    }
  };

  const handleRequestRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!correoValidation.valid) {
      setErrorMsg(correoValidation.message);
      return;
    }

    setLoading(true);
    try {
      const { data } = await httpClient.post<RecoveryEmailPayload>(
        '/auth/recuperar-password',
        { correo: correo.trim() },
      );
      setRecoveryEmailData(data);
      setTokenRecuperacion(data.tokenRecuperacion);
      setRecoveryStep('reset');
      notify(
        'info',
        'Correo Seguro HTTPS Enviado',
        `Revisa las instrucciones en español enviadas a ${data.correoDestino}.`,
      );
    } catch (err: unknown) {
      setErrorMsg(
        extractErrorMessage(
          err,
          'No se pudo generar la solicitud de recuperación para este correo.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!correoValidation.valid) {
      setErrorMsg(correoValidation.message);
      return;
    }
    if (!codigoSeguridad.trim()) {
      setErrorMsg('Ingresa el código de seguridad de 6 dígitos recibido en el correo.');
      return;
    }
    if (!nuevaPasswordStrength.validMinLength) {
      setErrorMsg('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setErrorMsg('Las contraseñas no coinciden. Verifica la confirmación.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await httpClient.post<{ mensaje: string }>(
        '/auth/restablecer-password',
        {
          correo: correo.trim(),
          codigoSeguridad: codigoSeguridad.trim(),
          tokenRecuperacion: tokenRecuperacion || undefined,
          nuevaPassword,
        },
      );
      notify('success', 'Contraseña Restablecida', data.mensaje);
      setPassword('');
      handleCloseRecovery();
      navigate('/login');
    } catch (err: unknown) {
      setErrorMsg(
        extractErrorMessage(
          err,
          'No se pudo restablecer la contraseña. Verifica el código de seguridad.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!correoValidation.valid) {
      setErrorMsg(correoValidation.message);
      return;
    }

    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (mode === 'register') {
      if (!nombreValidation.valid) {
        setErrorMsg(nombreValidation.message);
        return;
      }
      if (!apellidoValidation.valid) {
        setErrorMsg(apellidoValidation.message);
        return;
      }
      if (!cedulaValidation.valid) {
        setErrorMsg(cedulaValidation.message);
        return;
      }
      if (!telefonoValidation.valid) {
        setErrorMsg(telefonoValidation.message);
        return;
      }
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
              <img
                src="/logo1.svg"
                alt="Hábitat EC"
                className="h-4 w-4 object-contain inline-block"
              />
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
              <span>Recuperación segura vía HTTPS Anti-SPAM y validaciones IHC</span>
            </div>
          </div>
        </div>

        {/* Right Side: Form or Recovery View */}
        <div className="lg:col-span-7 p-6 sm:p-10 text-left">
          {isRecovering ? (
            /* ================= FLUJO DE RECUPERACIÓN SEGURA DE CONTRASEÑA ================= */
            <div>
              <div className="flex items-center justify-between border-b border-brand-border pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary mb-1">
                    <KeyRound className="h-3.5 w-3.5" />
                    Seguridad de Cuentas • HTTPS Anti-SPAM
                  </span>
                  <h2 className="font-serif text-2xl font-bold text-brand-text">
                    Recuperar Contraseña
                  </h2>
                  <p className="mt-1 text-xs text-brand-text/65">
                    {recoveryStep === 'request'
                      ? 'Ingresa el correo electrónico con el que te registraste en Hábitat EC.'
                      : 'Sigue los pasos del correo seguro en español para establecer tu nueva clave.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseRecovery}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-bg px-3 py-1.5 text-xs font-semibold text-brand-text hover:border-brand-primary transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver al Login
                </button>
              </div>

              {errorMsg && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Atención en la recuperación</p>
                    <p className="mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {recoveryStep === 'request' ? (
                <form onSubmit={handleRequestRecoveryEmail} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Correo Electrónico Registrado *
                    </label>
                    <div className="relative">
                      <Mail className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value.trim())}
                        placeholder="nombre@correo.ec"
                        className="input-field pl-10"
                      />
                    </div>
                    <p
                      className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${
                        correoValidation.isEmpty
                          ? 'text-brand-text/55'
                          : correoValidation.valid
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-amber-600 dark:text-amber-400 font-medium'
                      }`}
                    >
                      {correoValidation.valid ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{correoValidation.message}</span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-brand-border bg-brand-bg/70 p-3.5 text-xs text-brand-text/80 space-y-1.5">
                    <p className="font-semibold text-brand-text flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-brand-primary" />
                      Garantía de Correo Seguro y No-SPAM
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Recibirás un correo electrónico en <strong>Español</strong> con cabeceras
                      autenticadas (<code className="font-mono">SPF/DKIM/DMARC</code>) y un enlace{' '}
                      <code className="font-mono">https://</code> de un solo uso válido por 15
                      minutos para evitar ataques colaterales o filtrado por SPAM.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !correoValidation.valid}
                    className="btn-primary w-full py-3 text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generando correo seguro HTTPS...
                      </>
                    ) : (
                      <>
                        Enviar Correo de Recuperación Seguro
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="mt-5 space-y-5">
                  {/* Vista Previa del Correo Seguro en Español enviado por el Backend */}
                  {recoveryEmailData && (
                    <div className="rounded-2xl border border-brand-primary/40 bg-brand-bg/90 p-4 text-xs shadow-sm space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-2.5">
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" />
                            Correo Seguro Verificado (Anti-SPAM • HTTPS TLS 1.3)
                          </span>
                          <p className="mt-1 font-bold text-brand-text">
                            {recoveryEmailData.correoSeguroEnviado.asunto}
                          </p>
                          <p className="text-[11px] text-brand-text/65">
                            De: {recoveryEmailData.correoSeguroEnviado.remitente} • Para:{' '}
                            {recoveryEmailData.correoSeguroEnviado.destinatario}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCodigoSeguridad(recoveryEmailData.codigoSeguridad);
                            setTokenRecuperacion(recoveryEmailData.tokenRecuperacion);
                            notify(
                              'info',
                              'Enlace HTTPS Verificado',
                              'Se ha aplicado automáticamente tu código de seguridad de un solo uso.',
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-1.5 text-[11px] font-bold text-brand-bg hover:opacity-90 transition-opacity"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Usar Enlace HTTPS / Autocompletar Código
                        </button>
                      </div>

                      <div className="max-h-44 overflow-y-auto rounded-xl border border-brand-border bg-brand-surface p-3 font-sans text-[11px] leading-relaxed text-brand-text whitespace-pre-line">
                        {recoveryEmailData.correoSeguroEnviado.cuerpoTextoEspanol}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-brand-text/70">
                        <span>
                          🔒 Enlace oficial:{' '}
                          <code className="font-mono text-brand-primary">
                            {recoveryEmailData.enlaceRecuperacionHttps.slice(0, 58)}...
                          </code>
                        </span>
                        <span className="font-semibold text-brand-primary">
                          Código: {recoveryEmailData.codigoSeguridad}
                        </span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">
                        Código de Seguridad de 6 Dígitos (recibido en tu correo) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={codigoSeguridad}
                        onChange={(e) =>
                          setCodigoSeguridad(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="Ej. 849201"
                        className="input-field font-mono tracking-widest text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">
                        Nueva Contraseña Segura *
                      </label>
                      <div className="relative">
                        <Lock className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                        <input
                          type={showNuevaPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={nuevaPassword}
                          onChange={(e) => setNuevaPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className="input-field pl-10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNuevaPassword((v) => !v)}
                          className="absolute right-3 top-2.5 text-brand-text/50 hover:text-brand-text"
                          title={showNuevaPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showNuevaPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Medidor de Fortaleza y Sugerencias de Contraseña */}
                      <div className="mt-2 rounded-xl border border-brand-border bg-brand-bg/60 p-3 text-[11px] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-brand-text flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                            Fortaleza: {nuevaPasswordStrength.label}
                          </span>
                          <span className="font-mono text-brand-text/70">
                            {nuevaPasswordStrength.score}/5 criterios
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-brand-border overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              nuevaPasswordStrength.score <= 2
                                ? 'bg-red-500'
                                : nuevaPasswordStrength.score <= 3
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${(nuevaPasswordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                        {nuevaPasswordStrength.suggestions.length > 0 ? (
                          <ul className="space-y-1 text-brand-text/75 list-disc list-inside">
                            {nuevaPasswordStrength.suggestions.map((sug, i) => (
                              <li key={i}>{sug}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            ¡Excelente! Tu contraseña cumple todos los estándares de seguridad.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">
                        Confirmar Nueva Contraseña *
                      </label>
                      <div className="relative">
                        <Lock className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                        <input
                          type={showNuevaPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={confirmarPassword}
                          onChange={(e) => setConfirmarPassword(e.target.value)}
                          placeholder="Repite tu nueva contraseña"
                          className="input-field pl-10"
                        />
                      </div>
                      {confirmarPassword.length > 0 && (
                        <p
                          className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${
                            nuevaPassword === confirmarPassword
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {nuevaPassword === confirmarPassword ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Las contraseñas coinciden correctamente.
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3.5 w-3.5" />
                              Las contraseñas aún no coinciden.
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        codigoSeguridad.length < 6 ||
                        !nuevaPasswordStrength.validMinLength ||
                        nuevaPassword !== confirmarPassword
                      }
                      className="btn-primary w-full py-3 text-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Actualizando contraseña...
                        </>
                      ) : (
                        <>
                          Guardar Nueva Contraseña y Volver al Login
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            /* ================= FLUJO PRINCIPAL DE LOGIN Y REGISTRO ================= */
            <div>
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
                    onClick={() => setErrorMsg(null)}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      mode === 'login'
                        ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
                        : 'text-brand-text/70 hover:text-brand-text'
                    }`}
                  >
                    Ingresar
                  </Link>
                  <Link
                    to="/registro"
                    onClick={() => setErrorMsg(null)}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      mode === 'register'
                        ? 'bg-brand-primary text-brand-bg font-bold shadow-sm'
                        : 'text-brand-text/70 hover:text-brand-text'
                    }`}
                  >
                    Registro
                  </Link>
                </div>
              </div>

              {/* Banner de Advertencia IHC (Heurística #9 de Jakob Nielsen: Reconocer, diagnosticar y recuperarse de errores) */}
              {errorMsg && (
                <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-red-900">
                        {isPasswordError
                          ? 'Contraseña incorrecta para tu cuenta'
                          : 'No se pudo procesar la solicitud'}
                      </p>
                      <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
                      {mode === 'login' && (
                        <div className="mt-2.5 pt-2 border-t border-red-200 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-red-700 font-medium">
                            ¿No recuerdas tu clave de acceso?
                          </span>
                          <button
                            type="button"
                            onClick={handleOpenRecovery}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-800 transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Recuperar contraseña por correo seguro
                          </button>
                        </div>
                      )}
                    </div>
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

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === 'register' && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">
                        Nombres * <span className="font-normal text-brand-text/55">(Solo letras)</span>
                      </label>
                      <div className="relative">
                        <User className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          value={nombre}
                          onChange={(e) => setNombre(sanitizeOnlyLetters(e.target.value))}
                          placeholder="Ej. Camila"
                          className="input-field pl-10"
                        />
                      </div>
                      <p
                        className={`mt-1 flex items-center gap-1 text-[11px] ${
                          nombreValidation.isEmpty
                            ? 'text-brand-text/55'
                            : nombreValidation.valid
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-amber-600 dark:text-amber-400 font-medium'
                        }`}
                      >
                        {nombreValidation.valid ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3 w-3 shrink-0" />
                        )}
                        <span>{nombreValidation.message}</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">
                        Apellidos * <span className="font-normal text-brand-text/55">(Solo letras)</span>
                      </label>
                      <div className="relative">
                        <User className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          value={apellido}
                          onChange={(e) => setApellido(sanitizeOnlyLetters(e.target.value))}
                          placeholder="Ej. Montalvo"
                          className="input-field pl-10"
                        />
                      </div>
                      <p
                        className={`mt-1 flex items-center gap-1 text-[11px] ${
                          apellidoValidation.isEmpty
                            ? 'text-brand-text/55'
                            : apellidoValidation.valid
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-amber-600 dark:text-amber-400 font-medium'
                        }`}
                      >
                        {apellidoValidation.valid ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3 w-3 shrink-0" />
                        )}
                        <span>{apellidoValidation.message}</span>
                      </p>
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
                      onChange={(e) => setCorreo(e.target.value.trim())}
                      placeholder="nombre@correo.ec"
                      className="input-field pl-10"
                    />
                  </div>
                  <p
                    className={`mt-1 flex items-center gap-1 text-[11px] ${
                      correoValidation.isEmpty
                        ? 'text-brand-text/55'
                        : correoValidation.valid
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-amber-600 dark:text-amber-400 font-medium'
                    }`}
                  >
                    {correoValidation.valid ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3 w-3 shrink-0" />
                    )}
                    <span>{correoValidation.message}</span>
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-brand-text">
                      Contraseña *
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={handleOpenRecovery}
                        className="text-[11px] font-semibold text-brand-primary hover:underline flex items-center gap-1"
                      >
                        <KeyRound className="h-3 w-3" />
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="input-field pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-brand-text/50 hover:text-brand-text"
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {mode === 'login' ? (
                    <p
                      className={`mt-1 flex items-center gap-1 text-[11px] ${
                        password.length === 0
                          ? 'text-brand-text/55'
                          : password.length >= 8
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-amber-600 dark:text-amber-400 font-medium'
                      }`}
                    >
                      {password.length >= 8 ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>Longitud de contraseña válida ({password.length} caracteres).</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>
                            Ingresa tu contraseña (mínimo 8 caracteres). Si no la recuerdas, usa
                            &ldquo;¿Olvidaste tu contraseña?&rdquo;.
                          </span>
                        </>
                      )}
                    </p>
                  ) : (
                    /* Medidor de Fortaleza y Sugerencias Interactivas en Registro */
                    <div className="mt-2 rounded-xl border border-brand-border bg-brand-bg/60 p-3 text-[11px] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-brand-text flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                          Seguridad de la contraseña: {passwordStrength.label}
                        </span>
                        <span className="font-mono text-brand-text/70">
                          {passwordStrength.score}/5
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-brand-border overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordStrength.score <= 2
                              ? 'bg-red-500'
                              : passwordStrength.score <= 3
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      {passwordStrength.suggestions.length > 0 ? (
                        <div>
                          <p className="font-semibold text-brand-text/85 mb-1">
                            Sugerencias para mejorar tu contraseña:
                          </p>
                          <ul className="space-y-0.5 text-brand-text/75 list-disc list-inside">
                            {passwordStrength.suggestions.map((sug, idx) => (
                              <li key={idx}>{sug}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          ¡Contraseña excelente! Cumple con todos los criterios recomendados.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {mode === 'register' && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">
                        Cédula / RUC (Opcional • 10 a 13 dígitos)
                      </label>
                      <div className="relative">
                        <CreditCard className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={13}
                          value={cedulaRuc}
                          onChange={(e) => setCedulaRuc(sanitizeCedulaRuc(e.target.value))}
                          placeholder="1712345678 o 1790012345001"
                          className="input-field pl-10"
                        />
                      </div>
                      <p
                        className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${
                          cedulaValidation.isEmpty
                            ? 'text-brand-text/55'
                            : cedulaValidation.valid
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-amber-600 dark:text-amber-400 font-medium'
                        }`}
                      >
                        {cedulaValidation.isEmpty ? (
                          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        ) : cedulaValidation.valid ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        )}
                        <span>{cedulaValidation.message}</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">
                        Teléfono Móvil (Opcional • +593 o 09)
                      </label>
                      <div className="relative">
                        <Phone className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                        <input
                          type="tel"
                          maxLength={13}
                          value={telefono}
                          onChange={(e) => setTelefono(sanitizePhoneInput(e.target.value))}
                          placeholder="+593991234567 o 0991234567"
                          className="input-field pl-10"
                        />
                      </div>
                      <p
                        className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${
                          telefonoValidation.isEmpty
                            ? 'text-brand-text/55'
                            : telefonoValidation.valid
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-amber-600 dark:text-amber-400 font-medium'
                        }`}
                      >
                        {telefonoValidation.isEmpty ? (
                          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        ) : telefonoValidation.valid ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        )}
                        <span>{telefonoValidation.message}</span>
                      </p>
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
          )}
        </div>
      </div>
    </div>
  );
};
