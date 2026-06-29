import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Free OpenStreetMap raster style — no API key. Fine for an internal admin tool;
// swap for a keyed vector provider (e.g. MapTiler) if usage grows.
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/**
 * Reusable MapLibre map (upgrade plan, step 7). Renders markers and an optional
 * service-radius circle (GeoJSON from the Turf geo helpers). Lazy-load at the use
 * site so MapLibre stays out of the main bundle.
 *
 * Props:
 *   center  {lng,lat}
 *   zoom    number
 *   markers [{ id, lng, lat, color, label, onClick }]
 *   circle  GeoJSON Feature<Polygon> | null
 *   height  CSS height (default 360px)
 */
export default function CoverageMap({ center, zoom = 9, markers = [], circle = null, height = 360 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerObjs = useRef([]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [center?.lng ?? -1.5, center?.lat ?? 53],
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);  

  // Re-centre when the center prop changes.
  useEffect(() => {
    if (mapRef.current && center) mapRef.current.setCenter([center.lng, center.lat]);
  }, [center?.lng, center?.lat]);  

  // Sync markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerObjs.current.forEach((m) => m.remove());
    markerObjs.current = markers
      .filter((mk) => typeof mk.lng === 'number' && typeof mk.lat === 'number')
      .map((mk) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.title = mk.label ?? '';
        el.style.cssText = `width:16px;height:16px;border-radius:50%;border:2px solid #fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${mk.color ?? '#f97316'}`;
        if (mk.onClick) el.addEventListener('click', mk.onClick);
        const marker = new maplibregl.Marker({ element: el }).setLngLat([mk.lng, mk.lat]);
        if (mk.label) marker.setPopup(new maplibregl.Popup({ offset: 14 }).setText(mk.label));
        marker.addTo(map);
        return marker;
      });
  }, [markers]);

  // Sync the service-radius circle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer('radius-fill')) map.removeLayer('radius-fill');
      if (map.getLayer('radius-line')) map.removeLayer('radius-line');
      if (map.getSource('radius')) map.removeSource('radius');
      if (!circle) return;
      map.addSource('radius', { type: 'geojson', data: circle });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#f97316', 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#f97316', 'line-width': 1.5 } });
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [circle]);

  return <div ref={containerRef} style={{ height, width: '100%' }} className="overflow-hidden rounded-lg border" />;
}
