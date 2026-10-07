export const propertyTypes = ['Todos', 'Eco-Lodge', 'Hotel Boutique', 'Cabaña de Montaña', 'Hostal'] as const;
export type PropertyType = Exclude<(typeof propertyTypes)[number], 'Todos'>;
export interface Property { id: string; name: string; type: PropertyType; tipo?: string; city: string; province: string; region: string; cityId: number; address: string; price: number; adults: number; rooms: number; rating: number; reviews: number; image: string; active: boolean; description: string }
export interface SearchParams { destination: string; checkin: string; checkout: string; adults: number; rooms: number }
export interface Session { name: string; email: string; role: 'CLIENTE' | 'PROPIETARIO'; token?: string }
export interface Customer { firstName: string; lastName: string; email: string }
export interface Quote { nights: number; base: number; service: number; tax: number; total: number; quoteId?: string }
export interface Reservation { pnr: string; propertyId: string; total: number; checkin: string; checkout: string }
export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
export function defaultSearch(): SearchParams { const start = new Date(); start.setDate(start.getDate() + 7); const end = new Date(start); end.setDate(end.getDate() + 2); return { destination: '', checkin: start.toISOString().slice(0, 10), checkout: end.toISOString().slice(0, 10), adults: 2, rooms: 1 }; }
export function demoQuote(property: Property, search: SearchParams): Quote { const nights = Math.max(1, Math.round((new Date(search.checkout).getTime() - new Date(search.checkin).getTime()) / 86400000)); const base = property.price * nights; const service = Math.round(base * 0.08 * 100) / 100; const tax = Math.round((base + service) * 0.15 * 100) / 100; return { nights, base, service, tax, total: Math.round((base + service + tax) * 100) / 100 }; }
