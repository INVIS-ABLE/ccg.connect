/**
 * Geographic helpers for matching and maps, built on Turf. Pure and unit-tested.
 * Used for the distance/service-radius visuals; the matching score keeps its own
 * (tested) haversine so scoring behaviour is unaffected.
 */
import distance from '@turf/distance';
import circle from '@turf/circle';
import { point } from '@turf/helpers';
import type { Feature, Polygon } from 'geojson';

export interface LngLat {
  lng: number;
  lat: number;
}

/** Great-circle distance in miles, rounded to 0.1. */
export function distanceMiles(a: LngLat, b: LngLat): number {
  const miles = distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: 'miles' });
  return Math.round(miles * 10) / 10;
}

/** Whether `p` lies within `radiusMiles` of `center`. */
export function isWithinRadius(center: LngLat, p: LngLat, radiusMiles: number): boolean {
  return distanceMiles(center, p) <= radiusMiles;
}

/** GeoJSON polygon approximating a service-radius circle, for map display. */
export function serviceAreaCircle(center: LngLat, radiusMiles: number): Feature<Polygon> {
  return circle([center.lng, center.lat], radiusMiles, { units: 'miles', steps: 64 });
}
