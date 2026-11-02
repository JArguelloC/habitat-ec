import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { httpClient, TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '../api/httpClient';

export type UserRole = 'CLIENTE' | 'ADMIN' | 'SUPERADMIN';

export interface AuthUser {
  usuarioId: number;
  nombre: string;
  apellido: string;
  correo: string;
  roles: string[];
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface AuthResponsePayload {
  accessToken: string;
  usuario: AuthUser;
}

interface RegisterPayload {
  nombre: string;
  apellido: string;
  correo: string;
  password: string;
  cedulaRuc?: string;
  telefono?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  roles: string[];
  isAuthenticated: boolean;
  isCliente: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
  notification: ToastNotification | null;
  login: (correo: string, password: string) => Promise<AuthUser>;
  registerCliente: (payload: RegisterPayload) => Promise<AuthUser>;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  updateUser: (partial: Partial<AuthUser>) => void;
  logout: () => void;
  notify: (type: ToastNotification['type'], title: string, message: string) => void;
  clearNotification: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => loadStoredUser());
  const [notification, setNotification] = useState<ToastNotification | null>(null);

  const notify = useCallback(
    (type: ToastNotification['type'], title: string, message: string) => {
      const id = crypto.randomUUID();
      setNotification({ id, type, title, message });
      window.setTimeout(() => {
        setNotification((prev) => (prev?.id === id ? null : prev));
      }, 5500);
    },
    [],
  );

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const persistSession = useCallback((payload: AuthResponsePayload) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, payload.accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(payload.usuario));
    setToken(payload.accessToken);
    setUser(payload.usuario);
  }, []);

  const login = useCallback(
    async (correo: string, password: string): Promise<AuthUser> => {
      const { data } = await httpClient.post<AuthResponsePayload>('/auth/login', {
        correo,
        password,
      });
      persistSession(data);
      notify(
        'success',
        'Sesión iniciada',
        `Bienvenido nuevamente, ${data.usuario.nombre} ${data.usuario.apellido}.`,
      );
      return data.usuario;
    },
    [persistSession, notify],
  );

  const registerCliente = useCallback(
    async (payload: RegisterPayload): Promise<AuthUser> => {
      const { data } = await httpClient.post<AuthResponsePayload>('/auth/register', payload);
      persistSession(data);
      notify(
        'success',
        'Cuenta creada con éxito',
        `Tu cuenta de viajero en Hábitat EC está lista, ${data.usuario.nombre}.`,
      );
      return data.usuario;
    },
    [persistSession, notify],
  );

  const loginWithGoogle = useCallback(
    async (credential: string): Promise<AuthUser> => {
      const { data } = await httpClient.post<AuthResponsePayload>('/auth/google', {
        credential,
      });
      persistSession(data);
      notify(
        'success',
        'Autenticación con Google verificada',
        `Hola ${data.usuario.nombre}, has ingresado con tu cuenta de Google.`,
      );
      return data.usuario;
    },
    [persistSession, notify],
  );

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
    notify('info', 'Sesión cerrada', 'Has salido de tu cuenta de forma segura.');
  }, [notify]);

  const roles = useMemo(() => user?.roles || [], [user]);
  const isAuthenticated = Boolean(token && user);
  const isCliente = roles.includes('CLIENTE');
  const isAdmin = roles.includes('ADMIN') || roles.includes('SUPERADMIN');
  const isSuperadmin = roles.includes('SUPERADMIN');

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      roles,
      isAuthenticated,
      isCliente,
      isAdmin,
      isSuperadmin,
      notification,
      login,
      registerCliente,
      loginWithGoogle,
      updateUser,
      logout,
      notify,
      clearNotification,
    }),
    [
      user,
      token,
      roles,
      isAuthenticated,
      isCliente,
      isAdmin,
      isSuperadmin,
      notification,
      login,
      registerCliente,
      loginWithGoogle,
      updateUser,
      logout,
      notify,
      clearNotification,
    ],
  );

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </GoogleOAuthProvider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de un <AuthProvider>');
  }
  return ctx;
}

