import { describe, it, expect } from 'vitest';
import { distanceMiles, isWithinRadius, serviceAreaCircle } from './geo';

// One degree of latitude is ~69 miles.
const a = { lng: 0, lat: 51.5 };
const b = { lng: 0, lat: 52.5 };

describe('distanceMiles', () => {
  it('measures ~69 miles for one degree of latitude', () => {
    expect(distanceMiles(a, b)).toBeGreaterThan(68);
    expect(distanceMiles(a, b)).toBeLessThan(70);
  });

  it('is zero for the same point', () => {
    expect(distanceMiles(a, a)).toBe(0);
  });
});

describe('isWithinRadius', () => {
  it('includes points inside and excludes points outside', () => {
    expect(isWithinRadius(a, b, 70)).toBe(true);
    expect(isWithinRadius(a, b, 50)).toBe(false);
  });
});

describe('serviceAreaCircle', () => {
  it('returns a GeoJSON polygon feature', () => {
    const f = serviceAreaCircle(a, 10);
    expect(f.type).toBe('Feature');
    expect(f.geometry.type).toBe('Polygon');
    expect((f.geometry.coordinates[0] ?? []).length).toBeGreaterThan(3);
  });
});
