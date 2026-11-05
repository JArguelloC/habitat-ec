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
} from 'lucide-react';
import { httpClient, extractErrorMessage } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';

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
    if (password && password.length < 8) {
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

      const { data } = await httpClient.patch<PerfilResponse>('/usuarios/perfil', payload);
      updateUser({
        nombre: data.nombre,
        apellido: data.apellido,
      });
      setPassword('');
      notify(
        'success',
        'Perfil actualizado',
        'Tus datos personales se han guardado correctamente en la base de datos.',
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
          <form onSubmit={handleSave} className="p-6 sm:p-10 space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Nombres *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Apellidos *
                </label>
                <input
                  type="text"
                  required
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-brand-text mb-1">
                  Cédula o RUC
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
                  Teléfono de Contacto
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

            <div className="border-t border-brand-border pt-5">
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Actualizar Contraseña (dejar en blanco para mantener la actual)
              </label>
              <div className="relative max-w-md">
                <Lock className="h-4 w-4 text-brand-text/40 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nueva contraseña (mínimo 8 caracteres)"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-brand-border">
              <button type="submit" disabled={saving} className="btn-primary">
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

