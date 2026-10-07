import type { Customer, Property, Quote, SearchParams, Session } from '@/lib/habitat-types';
export const isDemo = !import.meta.env.VITE_API_URL;
const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
async function request<T>(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) { let message = 'No pudimos completar la solicitud. Inténtalo de nuevo.'; try { const error = await response.json(); message = Array.isArray(error.message) ? error.message.join(', ') : (typeof error.message === 'string' ? error.message : message); } catch { /* empty response */ } throw new Error(message); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
const destinationCityMap: Record<string, number> = {
  quito: 1,
  mindo: 2,
  'puerto ayora': 3,
  galapagos: 3,
  'galápagos': 3,
  cuenca: 4,
  tena: 5,
  napo: 5,
  'montañita': 6,
  montanita: 6,
};

const searchPayload = (s: SearchParams) => {
  const dest = s.destination?.toLowerCase().trim() || '';
  const city = destinationCityMap[dest];
  return {
    booker: { country: 'ec', platform: 'desktop' },
    checkin: s.checkin,
    checkout: s.checkout,
    guests: { number_of_adults: s.adults, number_of_rooms: s.rooms },
    currency: 'USD',
    ...(city ? { city } : {}),
  };
};

const propertyPayload = (p: Property) => ({ 
  name: p.name.trim(), 
  description: (p.description || p.name).trim(), 
  country: 'ec', 
  cityId: Number(p.cityId) || 1, 
  pricePerNight: Number(p.price), 
  currency: 'USD',
  maxAdults: Number(p.adults), 
  rooms: Number(p.rooms),
  tipo: p.type || p.tipo,
  direccion: p.address?.trim() || undefined,
});
import mountain from '@/assets/ecuador-hero.jpg';
import mindo from '@/assets/mindo.jpg';
import islands from '@/assets/galapagos.jpg';
import cuenca from '@/assets/cuenca.jpg';
import { demoQuote } from '@/lib/habitat-types';

function mapProperty(p: any): Property {
  const images: Record<number, string> = { 1: mountain, 2: mindo, 3: islands, 4: cuenca, 5: mindo, 6: islands };
  const cities: Record<number, string> = { 1: 'Quito', 2: 'Mindo', 3: 'Puerto Ayora', 4: 'Cuenca', 5: 'Tena', 6: 'Montañita' };
  const provinces: Record<number, string> = { 1: 'Pichincha', 2: 'Pichincha', 3: 'Galápagos', 4: 'Azuay', 5: 'Napo', 6: 'Santa Elena' };
  const regions: Record<number, string> = { 1: 'Sierra', 2: 'Sierra', 3: 'Galápagos', 4: 'Sierra', 5: 'Amazonía', 6: 'Costa' };
  const fallbackTypes: Record<number, string> = { 1: 'Cabaña de Montaña', 2: 'Eco-Lodge', 3: 'Hotel Boutique', 4: 'Hotel Boutique', 5: 'Eco-Lodge', 6: 'Hostal' };
  
  const cid = p.cityId || p.idCiudad || 1;
  const rawId = Number(p.id) || 1;
  const rawType = p.tipo || p.type || fallbackTypes[rawId] || fallbackTypes[cid] || 'Eco-Lodge';

  return {
    id: String(p.id),
    name: p.name || p.nombre,
    type: rawType as any,
    tipo: rawType,
    city: p.city || cities[cid] || 'Ecuador',
    province: p.province || provinces[cid] || '',
    region: p.region || regions[cid] || 'Sierra',
    cityId: cid,
    address: p.address || p.direccion || 'Ecuador',
    price: Number(p.pricePerNight || p.precioPorNoche || p.price || 0),
    adults: Number(p.maxAdults || p.maximoAdultos || p.adults || 2),
    rooms: Number(p.rooms || p.habitaciones || 1),
    rating: 9.0 + (cid % 10) / 10,
    reviews: cid * 10 + 20,
    image: p.image || images[cid] || mountain,
    active: p.isAvailable ?? p.activo ?? true,
    description: p.description || p.descripcion || '',
  };
}

export const api = {
  list: () => request<any[]>('/alojamientos').then(arr => arr.map(mapProperty)),
  search: async (s: SearchParams): Promise<Property[]> => {
    try {
      const res = await request<any>('/search', 'POST', searchPayload(s), { 'X-Device-Fingerprint': 'web-client-habitat-ec' });
      const ids: number[] = Array.isArray(res) ? res.map(x => x.id) : Array.isArray(res?.data) ? res.data.map((x: any) => x.id) : [];
      const all = await api.list();
      if (ids.length > 0) {
        return all.filter(p => ids.includes(Number(p.id)));
      }
      return all;
    } catch (e) {
      console.warn('API search error, falling back to local list:', e);
      return api.list();
    }
  },
  createProperty: (p: Property) => request<any>('/alojamientos', 'POST', propertyPayload(p)).then(mapProperty),
  createAlojamiento: (p: Property): Promise<Property> => request<any>('/alojamientos', 'POST', propertyPayload(p)).then(mapProperty),
  updateProperty: (p: Property) => request<any>(`/alojamientos/${encodeURIComponent(p.id)}`, 'PUT', propertyPayload(p)).then(() => p),
  deleteProperty: (id: string) => request<void>(`/alojamientos/${encodeURIComponent(id)}`, 'DELETE'),
  preview: async (p: Property, s: SearchParams): Promise<Quote> => {
    const res = await request<any>('/orders/preview', 'POST', {
      alojamientoId: Number(p.id),
      huespedes: Number(s.adults),
    });
    // El desglose se calcula localmente: total = (noches * precio) + servicio + impuestos.
    const local = demoQuote(p, s);
    return { ...local, quoteId: res?.data?.cotizacionId || res?.data?.order_preview_id };
  },
  createOrder: async (p: Property, s: SearchParams, customer: Customer, paymentMethod: string, idempotencyKey: string, quoteId?: string) => {
    if (!quoteId) throw new Error('La cotización expiró. Cierra y vuelve a abrir la reserva.');
    const res = await request<any>('/orders/create', 'POST', {
      cotizacionId: quoteId,
      referenciaPago: `PAY-${Date.now()}`,
      checkin: s.checkin,
      checkout: s.checkout,
      metodoPago: paymentMethod === 'card' ? 'TARJETA' : 'TRANSFERENCIA',
      cliente: {
        nombre: customer.firstName.trim(),
        apellido: customer.lastName.trim(),
        correo: customer.email.trim(),
      },
    }, { 'Idempotency-Key': idempotencyKey || crypto.randomUUID() });
    const pnr = res?.localizador || res?.id;
    if (!pnr) throw new Error('El servidor no devolvió el código de reserva.');
    return { pnr: String(pnr) };
  },
  login: async (emailInput: string, passwordInput: string) => {
    const data = { correo: emailInput.trim(), password: passwordInput };
    const res = await request<any>('/auth/login', 'POST', data);
    const token = res?.token || res?.access_token;
    if (token) localStorage.setItem('auth_token', token);
    return {
      token,
      user: {
        name: res?.user?.nombre ? `${res.user.nombre} ${res.user.apellido || ''}`.trim() : (res?.user?.name || ''),
        email: res?.user?.correo || res?.user?.email || emailInput,
        role: res?.user?.rol || res?.user?.role || 'CLIENTE'
      }
    };
  },
  register: async ({ fullName, email, password, roleType }: { fullName: string; email: string; password: string; roleType: Session['role'] }) => {
    const partes = fullName.trim().split(" ");
    const nombre = partes[0] || "";
    const apellido = partes.slice(1).join(" ") || nombre;
    const data = { nombre, apellido, correo: email.trim(), password, rol: roleType };
    
    const res = await request<any>('/auth/register', 'POST', data);
    const token = res?.token || res?.access_token;
    if (token) localStorage.setItem('auth_token', token);
    return {
      token,
      user: {
        name: res?.user?.nombre ? `${res.user.nombre} ${res.user.apellido || ''}`.trim() : (res?.user?.name || fullName),
        email: res?.user?.correo || res?.user?.email || email,
        role: res?.user?.rol || res?.user?.role || roleType
      }
    };
  },
};
