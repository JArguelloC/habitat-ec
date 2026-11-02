import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { isAuthenticated, roles, notify } = useAuth();
  const location = useLocation();

  const hasPermission = isAuthenticated && allowedRoles.some((role) => roles.includes(role));

  useEffect(() => {
    if (!isAuthenticated) {
      notify(
        'warning',
        'Autenticación requerida',
        'Inicia sesión para acceder a esta sección protegida.',
      );
    } else if (!hasPermission) {
      notify(
        'error',
        'Acceso restringido por Rol (RBAC)',
        `Esta vista requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.`,
      );
    }
  }, [isAuthenticated, hasPermission, allowedRoles, notify]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

