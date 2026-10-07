import { useEffect, useState, type ReactNode } from 'react';
import { demoProperties } from '@/lib/habitat-data';
import { defaultSearch, type Property, type Reservation, type SearchParams, type Session } from '@/lib/habitat-types';
import { api, isDemo } from '@/services/api';
import { HabitatContext } from './context';
export function HabitatProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>(demoProperties);
  const [session, updateSession] = useState<Session | null>(null);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [search, setSearch] = useState(defaultSearch);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function reload() {
    setLoading(true);
    setError('');
    try {
      const list = await api.list();
      if (list && list.length > 0) setProperties(list);
    } catch (e) {
      console.warn('API error:', e);
    } finally {
      setLoading(false);
    }
  }
 useEffect(() => { void reload(); try { const saved = localStorage.getItem('habitat_session'); if (saved) updateSession(JSON.parse(saved)); } catch { localStorage.removeItem('habitat_session'); } }, []);
  function setSession(s: Session | null) { updateSession(s); if (s?.token) { localStorage.setItem('auth_token', s.token); localStorage.setItem('habitat_session', JSON.stringify(s)); } else { localStorage.removeItem('auth_token'); localStorage.removeItem('habitat_session'); } }
 return <HabitatContext.Provider value={{ properties, setProperties, session, setSession, authModal, setAuthModal, authMessage, setAuthMessage, search, setSearch, reservations, addReservation: r => setReservations(old => [...old, r]), loading, error, reload }}>{children}</HabitatContext.Provider>;
}
