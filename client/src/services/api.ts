import type { Customer, Property, Quote, SearchParams, Session } from '@/lib/habitat-types';
export const isDemo = !import.meta.env['VITE_API_URL'];
const baseUrl = (import.meta.env['VITE_API_URL'] || 'http://localhost:3000').replace(/\/$/, '');
async function request<T>(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('habitat_token') : null;
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) { let message = 'No pudimos completar la solicitud. Inténtalo de nuevo.'; try { const error = await response.json(); message = typeof error.message === 'string' ? error.message : message; } catch { /* empty response */ } throw new Error(message); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
const searchPayload = (s: SearchParams) => ({ booker: { country: 'EC' }, destination: s.destination, checkin: s.checkin, checkout: s.checkout, guests: { number_of_adults: s.adults, number_of_rooms: s.rooms }, currency: 'USD' });
const propertyPayload = (p: Property) => ({ nombre: p.name, tipo: p.type, ciudad_id: p.cityId, direccion: p.address, precio_noche: p.price, capacidad_adultos: p.adults, habitaciones: p.rooms, activo: p.active });
import mountain from '@/assets/ecuador-hero.jpg';
import mindo from '@/assets/mindo.jpg';
import islands from '@/assets/galapagos.jpg';
import cuenca from '@/assets/cuenca.jpg';

function mapProperty(p: any): Property {
  const images: Record<number, string> = { 1: mountain, 2: mindo, 3: islands, 4: cuenca, 5: mindo, 6: islands };
  const cities: Record<number, string> = { 1: 'Quito', 2: 'Mindo', 3: 'Puerto Ayora', 4: 'Cuenca', 5: 'Tena', 6: 'Montañita' };
  const provinces: Record<number, string> = { 1: 'Pichincha', 2: 'Pichincha', 3: 'Galápagos', 4: 'Azuay', 5: 'Napo', 6: 'Santa Elena' };
  const regions: Record<number, string> = { 1: 'Sierra', 2: 'Sierra', 3: 'Galápagos', 4: 'Sierra', 5: 'Amazonía', 6: 'Costa' };
  
  const cid = p.cityId || p.idCiudad || 1;

  return {
    id: String(p.id),
    name: p.name || p.nombre,
    type: p.type || p.tipo || 'Hotel',
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
  search: (s: SearchParams) => request<any[]>('/search', 'POST', searchPayload(s), { 'X-Device-Fingerprint': 'web-client-habitat-ec' }).then(arr => arr.map(mapProperty)),
  createProperty: (p: Property) => request<any>('/alojamientos', 'POST', propertyPayload(p)).then(mapProperty),
  updateProperty: (p: Property) => request<any>(`/alojamientos/${encodeURIComponent(p.id)}`, 'PATCH', propertyPayload(p)).then(mapProperty),
  deleteProperty: (id: string) => request<void>(`/alojamientos/${encodeURIComponent(id)}`, 'DELETE'),
  preview: (p: Property, s: SearchParams) => request<Quote>('/orders/preview', 'POST', { alojamiento_id: p.id, ...searchPayload(s) }),
  createOrder: (p: Property, s: SearchParams, customer: Customer, paymentMethod: string, idempotencyKey: string, quoteId?: string) => request<{ pnr: string }>('/orders/create', 'POST', { alojamiento_id: p.id, ...searchPayload(s), customer, payment_method: paymentMethod, quote_id: quoteId }, { 'Idempotency-Key': idempotencyKey }),
  auth: (mode: 'login' | 'register', data: { name?: string; email: string; password: string; role: Session['role'] }) => request<{ token?: string; access_token?: string; user: Session }>(`/auth/${mode}`, 'POST', data),
};
