import { describe, expect, it } from 'vitest';
import { demoQuote, defaultSearch, type Property } from '@/lib/habitat-types';
const property = { price: 95 } as Property;
describe('Habitat reservation calculations', () => {
 it('returns defaults with valid dates and minimum guests', () => { const s = defaultSearch(); expect(s.checkout > s.checkin).toBe(true); expect(s.adults).toBeGreaterThanOrEqual(1); expect(s.rooms).toBeGreaterThanOrEqual(1); });
 it('calculates a transparent demo quote', () => { const q = demoQuote(property, { destination: '', checkin: '2026-11-01', checkout: '2026-11-03', adults: 2, rooms: 1 }); expect(q).toEqual({ nights: 2, base: 190, service: 15.2, tax: 30.78, total: 235.98 }); });
});
