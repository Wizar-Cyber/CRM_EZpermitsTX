/**
 * geocode.ts
 * Servicio de geocodificación para direcciones de Leads.
 * Usa el proxy backend (/api/ors/geocode) para evitar bloqueos CORS en navegador.
 */

import { apiGet } from "@/lib/api";

export async function geocodeAddress(address: string) {
  try {
    if (!address.trim()) return null;

    const data = await apiGet<{ coordinates?: [number, number] | null }>(
      `/ors/geocode?text=${encodeURIComponent(address)}`
    );

    const coords = data?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length < 2) return null;

    // ORS devuelve [lng, lat]
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);

    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}
