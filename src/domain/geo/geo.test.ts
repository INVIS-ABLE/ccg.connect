import { describe, it, expect } from 'vitest';
import { distanceMiles, isWithinRadius, serviceAreaCircle, distanceMeters, isWithinGeofence } from './geo';

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

describe('distanceMeters / isWithinGeofence', () => {
  // ~50 m due north of the site (1 deg lat ≈ 111_111 m, so 0.00045 deg ≈ 50 m).
  const site = { lng: -0.1278, lat: 51.5074 };
  const near = { lng: -0.1278, lat: 51.5074 + 0.00045 };
  const far = { lng: -0.1278, lat: 51.5074 + 0.01 }; // ~1.1 km north

  it('measures metres precisely (not rounded to 0.1 mile)', () => {
    expect(distanceMeters(site, near)).toBeGreaterThan(40);
    expect(distanceMeters(site, near)).toBeLessThan(60);
    expect(distanceMeters(site, site)).toBe(0);
  });

  it('flags inside vs outside a metre radius', () => {
    expect(isWithinGeofence(site, near, 150)).toBe(true);
    expect(isWithinGeofence(site, far, 150)).toBe(false);
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
