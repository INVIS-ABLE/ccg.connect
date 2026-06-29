/**
 * Geocoding adapter (integration boundary). UK postcode → coordinates via
 * postcodes.io (no API key). Best-effort: returns null on any failure so callers
 * degrade gracefully rather than blocking a save or a match.
 */
export async function geocodePostcode(
  postcode: string | null | undefined,
): Promise<{ lat: number; lng: number } | null> {
  const pc = postcode?.trim();
  if (!pc) return null;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { latitude?: number; longitude?: number } | null };
    const lat = body.result?.latitude;
    const lng = body.result?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    return null;
  } catch {
    return null;
  }
}
