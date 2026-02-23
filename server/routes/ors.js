import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// OpenRouteService API key - use as-is (the base64 token IS the key)
const ORS_KEY = (
  process.env.ORS_API_KEY ||
  process.env.OPENROUTESERVICE_API_KEY ||
  process.env.VITE_OPENROUTESERVICE_API_KEY ||
  ""
).trim();

if (!ORS_KEY) {
  console.warn(
    "⚠️  OpenRouteService API key missing. Set ORS_API_KEY in the server environment."
  );
}

const ensureKey = (res) => {
  if (ORS_KEY) return true;
  res.status(500).json({ error: "OpenRouteService API key is not configured." });
  return false;
};

router.post("/route", async (req, res) => {
  if (!ensureKey(res)) return;

  try {
    const body =
      req.body && Array.isArray(req.body.coordinates)
        ? { coordinates: req.body.coordinates }
        : req.body;

    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: ORS_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error("Error in ORS route proxy:", error);
    res.status(500).json({ error: "Proxy error" });
  }
});

router.get("/geocode", async (req, res) => {
  const text = (req.query.text || "").toString().trim();
  if (!text) {
    return res.status(400).json({ error: "Missing 'text' query parameter." });
  }

  try {
    // 1) Intentar ORS si hay API key configurada
    if (ORS_KEY) {
      const params = new URLSearchParams({
        api_key: ORS_KEY,
        text,
        size: "1",
      });

      const response = await fetch(
        `https://api.openrouteservice.org/geocode/search?${params.toString()}`
      );
      const data = await response.json();

      if (response.ok) {
        const coordinates = data?.features?.[0]?.geometry?.coordinates ?? null;
        return res.json({
          coordinates,
          feature: data?.features?.[0] ?? null,
          provider: "ors",
        });
      }

      console.warn("⚠️ ORS geocode failed, trying Nominatim fallback:", data?.error || response.status);
    }

    // 2) Fallback a Nominatim (server-side, sin CORS en navegador)
    const nominatimParams = new URLSearchParams({
      format: "json",
      q: text,
      limit: "1",
    });
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`,
      {
        headers: {
          "User-Agent": "crm-geocode-proxy/1.0",
          Accept: "application/json",
        },
      }
    );

    const nominatimData = await nominatimResponse.json();
    if (!nominatimResponse.ok) {
      return res.status(nominatimResponse.status).json(nominatimData);
    }

    const first = Array.isArray(nominatimData) ? nominatimData[0] : null;
    const lat = first?.lat ? Number(first.lat) : NaN;
    const lon = first?.lon ? Number(first.lon) : NaN;
    const coordinates = Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;

    return res.json({
      coordinates,
      feature: first || null,
      provider: "nominatim",
    });
  } catch (error) {
    console.error("Error in ORS geocode proxy:", error);
    res.status(500).json({ error: "Proxy error" });
  }
});

router.post("/optimize-route", async (req, res) => {
  try {
    const points = Array.isArray(req.body?.points) ? req.body.points : [];
    if (points.length < 2) {
      return res.status(400).json({ error: "At least 2 points are required." });
    }

    const normalized = points
      .map((point, index) => {
        const lng = Number(point?.lng);
        const lat = Number(point?.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return {
          index,
          id: point?.id ?? `p-${index}`,
          address: point?.address ?? "",
          case_number: point?.case_number ?? null,
          lng,
          lat,
        };
      })
      .filter(Boolean);

    if (normalized.length < 2) {
      return res
        .status(400)
        .json({ error: "At least 2 points with valid coordinates are required." });
    }

    const coordinates = normalized.map((p) => `${p.lng},${p.lat}`).join(";");

    const tripUrl =
      `https://router.project-osrm.org/trip/v1/driving/${coordinates}` +
      "?source=first&destination=last&roundtrip=false&steps=false&geometries=geojson&overview=full";

    const tripResponse = await fetch(tripUrl);
    const tripData = await tripResponse.json();

    if (tripResponse.ok && tripData?.trips?.[0] && Array.isArray(tripData?.waypoints)) {
      const orderedPoints = tripData.waypoints
        .map((waypoint, inputIdx) => {
          const original = normalized[inputIdx];
          if (!original) return null;
          return {
            order: Number.isFinite(waypoint?.waypoint_index)
              ? waypoint.waypoint_index
              : inputIdx,
            id: original.id,
            address: original.address,
            case_number: original.case_number,
            lng: original.lng,
            lat: original.lat,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order)
        .map(({ order, ...point }) => point)
        .filter(Boolean);

      return res.json({
        provider: "osrm-trip",
        ordered_points: orderedPoints,
        geometry: tripData.trips[0].geometry || null,
        distance_m: tripData.trips[0].distance ?? null,
        duration_s: tripData.trips[0].duration ?? null,
      });
    }

    // Fallback: ruta en orden original si OSRM trip no puede optimizar.
    const routeUrl =
      `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
      "?steps=false&geometries=geojson&overview=full";
    const routeResponse = await fetch(routeUrl);
    const routeData = await routeResponse.json();

    if (!routeResponse.ok || !routeData?.routes?.[0]) {
      return res.status(502).json({
        error: "Unable to optimize or build route with OSRM.",
        details: tripData?.message || routeData?.message || "OSRM error",
      });
    }

    return res.json({
      provider: "osrm-route-fallback",
      ordered_points: normalized.map((p) => ({
        id: p.id,
        address: p.address,
        case_number: p.case_number,
        lng: p.lng,
        lat: p.lat,
      })),
      geometry: routeData.routes[0].geometry || null,
      distance_m: routeData.routes[0].distance ?? null,
      duration_s: routeData.routes[0].duration ?? null,
    });
  } catch (error) {
    console.error("Error optimizing route:", error);
    res.status(500).json({ error: "Route optimization proxy error." });
  }
});

export default router;
