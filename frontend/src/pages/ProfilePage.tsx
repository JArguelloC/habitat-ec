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
  Sparkles,
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { InputControl } from '../components/common/FormField';
import { focusFirstInvalidInput } from '../utils/inputFilters';
import {
  validateName,
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
  const [roles, setRoles] = useState<string[]>(user?.roles || []);

  // Validaciones en tiempo real (Heurísticas IHC de Jakob Nielsen)
  const nombreValidation = validateName(nombre, 'El nombre');
  const apellidoValidation = validateName(apellido, 'El apellido');
  const cedulaValidation = validateEcuadorianCedulaRuc(cedulaRuc);
  const telefonoValidation = validateEcuadorianPhone(telefono);
  const passwordStrength = evaluatePasswordStrength(password);
  const isPasswordValidIfEntered = !password.trim() || passwordStrength.validMinLength;

  const isFormValid =
    nombreValidation.valid &&
    apellidoValidation.valid &&
    cedulaValidation.valid &&
    telefonoValidation.valid &&
    isPasswordValidIfEntered;

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

    if (!isFormValid) {
      focusFirstInvalidInput();
      if (!nombreValidation.valid) {
        notify('warning', 'Nombre inválido', nombreValidation.message);
      } else if (!apellidoValidation.valid) {
        notify('warning', 'Apellido inválido', apellidoValidation.message);
      } else if (!cedulaValidation.valid) {
        notify('warning', 'Cédula / RUC inválido', cedulaValidation.message);
      } else if (!telefonoValidation.valid) {
        notify('warning', 'Teléfono móvil inválido', telefonoValidation.message);
      } else if (!isPasswordValidIfEntered) {
        notify(
          'warning',
          'Contraseña corta',
          'Si deseas actualizar tu contraseña, debe tener al menos 8 caracteres.',
        );
      }
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
              <InputControl
                label="Nombres *"
                required
                filterType="letters"
                maxLength={60}
                value={nombre}
                onValueChange={setNombre}
                placeholder="Ej. Mateo"
                error={!nombreValidation.isEmpty && !nombreValidation.valid ? nombreValidation.message : null}
                success={nombreValidation.valid ? nombreValidation.message : null}
              />

              <InputControl
                label="Apellidos *"
                required
                filterType="letters"
                maxLength={60}
                value={apellido}
                onValueChange={setApellido}
                placeholder="Ej. Villalobos"
                error={!apellidoValidation.isEmpty && !apellidoValidation.valid ? apellidoValidation.message : null}
                success={apellidoValidation.valid ? apellidoValidation.message : null}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InputControl
                label="Cédula o RUC (Opcional)"
                filterType="numbers"
                maxLength={13}
                icon={CreditCard}
                value={cedulaRuc}
                onValueChange={setCedulaRuc}
                placeholder="1712345678 o 1790012345001"
                error={!cedulaValidation.valid ? cedulaValidation.message : null}
                success={!cedulaValidation.isEmpty && cedulaValidation.valid ? cedulaValidation.message : null}
                hint={cedulaValidation.isEmpty ? cedulaValidation.message : null}
              />

              <InputControl
                label="Teléfono de Contacto (Opcional)"
                maxLength={13}
                icon={Phone}
                value={telefono}
                onValueChange={(val) => setTelefono(sanitizePhoneInput(val))}
                placeholder="+593991234567 o 0991234567"
                error={!telefonoValidation.valid ? telefonoValidation.message : null}
                success={!telefonoValidation.isEmpty && telefonoValidation.valid ? telefonoValidation.message : null}
                hint={telefonoValidation.isEmpty ? telefonoValidation.message : null}
              />
            </div>

            <div className="border-t border-brand-border pt-5">
              <div className="max-w-md">
                <InputControl
                  label="Actualizar Contraseña (dejar en blanco para mantener la actual)"
                  type="password"
                  icon={Lock}
                  value={password}
                  onValueChange={setPassword}
                  placeholder="Nueva contraseña (mínimo 8 caracteres)"
                  error={
                    password.length > 0 && !passwordStrength.validMinLength
                      ? 'La contraseña debe tener al menos 8 caracteres.'
                      : null
                  }
                />
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
                disabled={saving || !isFormValid}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
