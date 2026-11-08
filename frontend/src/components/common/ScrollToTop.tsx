import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Componente global que restablece la posición del scroll a la parte superior (0, 0)
 * de forma instantánea cada vez que el usuario navega a una nueva ruta.
 * Incluye soporte para enlaces con hash (#id) si se especifica un ancla en la página.
 */
export const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Si la ruta contiene un hash (#elemento), hacer scroll suave hacia ese elemento
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    // Restablecimiento instantáneo a la parte superior de la ventana
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior,
    });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;

