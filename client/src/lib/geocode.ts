/**
 * geocode.ts
 * Servicio de geocodificación para direcciones de Leads.
 * Utiliza la API de OpenStreetMap (Nominatim).
 */

export async function geocodeAddress(address: string) {
  try {
    if (!address.trim()) return null;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.[0]) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);

    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}
