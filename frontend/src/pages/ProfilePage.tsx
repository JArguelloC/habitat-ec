import React, { useEffect, useState } from 'react';
import {
  UserCircle,
  Mail,
  Phone,
  CreditCard,
  Lock,
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import {
  sanitizeOnlyLetters,
  validateName,
  sanitizeCedulaRuc,
  validateEcuadorianCedulaRuc,
  sanitizePhoneInput,
  validateEcuadorianPhone,
  evaluatePasswordStrength,
} from '../utils/validators';

interface PerfilResponse {
  usuario_id: number;
  cedula_ruc: string | null;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  activo: boolean;
  creado_en: string;
  roles: string[];
}

export const ProfilePage: React.FC = () => {
  const { user, updateUser, notify } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState(user?.nombre || '');
  const [apellido, setApellido] = useState(user?.apellido || '');
  const [correo, setCorreo] = useState(user?.correo || '');
  const [cedulaRuc, setCedulaRuc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roles, setRoles] = useState<string[]>(user?.roles || []);

  // Validaciones en tiempo real (Heurísticas IHC de Jakob Nielsen)
  const nombreValidation = validateName(nombre, 'El nombre');
  const apellidoValidation = validateName(apellido, 'El apellido');
  const cedulaValidation = validateEcuadorianCedulaRuc(cedulaRuc);
  const telefonoValidation = validateEcuadorianPhone(telefono);
  const passwordStrength = evaluatePasswordStrength(password);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data } = await httpClient.get<PerfilResponse>('/usuarios/perfil');
        setNombre(data.nombre || '');
        setApellido(data.apellido || '');
        setCorreo(data.correo || '');
        setCedulaRuc(data.cedula_ruc || '');
        setTelefono(data.telefono || '');
        setRoles(data.roles || []);
      } catch (err: unknown) {
        notify('error', 'No se pudo cargar tu perfil', extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, [notify]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombreValidation.valid) {
      notify('warning', 'Nombre inválido', nombreValidation.message);
      return;
    }
    if (!apellidoValidation.valid) {
      notify('warning', 'Apellido inválido', apellidoValidation.message);
      return;
    }
    if (!cedulaValidation.valid) {
      notify('warning', 'Cédula / RUC inválido', cedulaValidation.message);
      return;
    }
    if (!telefonoValidation.valid) {
      notify('warning', 'Teléfono móvil inválido', telefonoValidation.message);
      return;
    }
    if (password.trim() && !passwordStrength.validMinLength) {
      notify(
        'warning',
        'Contraseña corta',
        'Si deseas actualizar tu contraseña, debe tener al menos 8 caracteres.',
      );
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
      };
      if (cedulaRuc.trim()) payload.cedulaRuc = cedulaRuc.trim();
      if (telefono.trim()) payload.telefono = telefono.trim();
      if (password.trim()) payload.password = password.trim();

      const changedPassword = Boolean(password.trim());
      const { data } = await httpClient.patch<PerfilResponse>('/usuarios/perfil', payload);
      updateUser({
        nombre: data.nombre,
        apellido: data.apellido,
      });
      setPassword('');
      notify(
        'success',
        changedPassword ? 'Perfil y contraseña actualizados' : 'Perfil actualizado',
        changedPassword
          ? 'Tus datos personales y tu nueva contraseña segura se han guardado en la base de datos.'
          : 'Tus datos personales se han guardado correctamente en la base de datos.',
      );
    } catch (err: unknown) {
      notify('error', 'Error al actualizar perfil', extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 text-left">
      <div className="card-surface overflow-hidden">
        <div className="bg-gradient-to-r from-[#141A17] via-[#1C2420] to-[#141A17] px-6 py-8 text-[#F4F1EA] dark:from-[#221c13] dark:to-[#1a150e] dark:text-brand-text sm:px-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/25 border border-brand-primary/50 text-brand-primary">
                <UserCircle className="h-10 w-10" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold text-white">
                  {nombre} {apellido}
                </h1>
                <p className="text-xs text-white/85 flex items-center gap-1.5 mt-1">
                  <Mail className="h-3.5 w-3.5 text-brand-primary" />
                  {correo}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-1 text-xs font-bold text-brand-bg"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Rol: {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-10 rounded-xl bg-brand-border/60" />
            <div className="h-10 rounded-xl bg-brand-border/60" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 sm:p-10 space-y-6" noValidate>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Nombres * <span className="font-normal text-brand-text/55">(Solo letras)</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(sanitizeOnlyLetters(e.target.value))}
                  placeholder="Ej. Mateo"
                  className="input-field"
                />
                <p
                  className={`mt-1 flex items-center gap-1 text-[11px] ${
                    nombreValidation.valid
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
                <input
                  type="text"
                  required
                  value={apellido}
                  onChange={(e) => setApellido(sanitizeOnlyLetters(e.target.value))}
                  placeholder="Ej. Villalobos"
                  className="input-field"
                />
                <p
                  className={`mt-1 flex items-center gap-1 text-[11px] ${
                    apellidoValidation.valid
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Cédula o RUC (Opcional • 10 a 13 dígitos)
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
                  Teléfono de Contacto (Opcional • +593 o 09)
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

            <div className="border-t border-brand-border pt-5">
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Actualizar Contraseña (dejar en blanco para mantener la actual)
              </label>
              <div className="relative max-w-md">
                <Lock className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nueva contraseña (mínimo 8 caracteres)"
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

              {password.length > 0 && (
                <div className="mt-2.5 max-w-md rounded-xl border border-brand-border bg-brand-bg/60 p-3 text-[11px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-text flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                      Fortaleza de nueva contraseña: {passwordStrength.label}
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
                    <ul className="space-y-0.5 text-brand-text/75 list-disc list-inside">
                      {passwordStrength.suggestions.map((sug, idx) => (
                        <li key={idx}>{sug}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      ¡Contraseña excelente y lista para guardarse!
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-brand-border">
              <button
                type="submit"
                disabled={
                  saving ||
                  !nombreValidation.valid ||
                  !apellidoValidation.valid ||
                  !cedulaValidation.valid ||
                  !telefonoValidation.valid ||
                  (password.length > 0 && !passwordStrength.validMinLength)
                }
                className="btn-primary"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando cambios...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar Cambios de Perfil
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
