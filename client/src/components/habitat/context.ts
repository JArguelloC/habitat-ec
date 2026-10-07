import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { Property, Reservation, SearchParams, Session } from '@/lib/habitat-types';

export interface HabitatState {
  properties: Property[];
  setProperties: Dispatch<SetStateAction<Property[]>>;
  session: Session | null;
  setSession: (session: Session | null) => void;
  authModal: 'login' | 'register' | null;
  setAuthModal: (mode: 'login' | 'register' | null) => void;
  authMessage: string | null;
  setAuthMessage: (message: string | null) => void;
  search: SearchParams;
  setSearch: Dispatch<SetStateAction<SearchParams>>;
  reservations: Reservation[];
  addReservation: (reservation: Reservation) => void;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

// Keep this module independent of the provider and API, so refreshing either
// cannot replace the context while its consumers are still mounted.
export const HabitatContext = createContext<HabitatState | null>(null);

export function useHabitat() {
  const value = useContext(HabitatContext);
  if (!value) throw new Error('HabitatProvider required');
  return value;
}