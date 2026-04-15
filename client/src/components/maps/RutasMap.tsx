import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type MapOptions, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, FileDown } from "lucide-react";
import { geocodeAddress as geocodeLeadAddress } from "@/lib/geocode";
import { apiPost } from "@/lib/api";
import { exportRoutePdf } from "@/lib/routePdf";
import { useEditingRoute } from "@/features/contexts/EditingRouteContext";

type RoutePoint = {
  id: string;
  lat?: number | string | null;
  lng?: number | string | null;
  address: string;
  case_number?: string;
};

type RutasMapProps = {
  points: RoutePoint[];
  onPointsResolved?: (points: RoutePoint[]) => void;
  routeName?: string;
};

type OptimizeRouteResponse = {
  provider?: string;
  ordered_points?: RoutePoint[];
  geometry?: {
    type?: string;
    coordinates?: number[][];
  } | null;
  distance_m?: number | null;
  duration_s?: number | null;
};

const ROUTE_SOURCE_ID = "optimized-route-source";
const ROUTE_LAYER_ID = "optimized-route-layer";
const DEFAULT_CENTER: [number, number] = [-95.3698, 29.7604]; // Houston
const MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "Houston Base",
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#c7e8ff" },
    },
    {
      id: "osm-raster",
      type: "raster",
      source: "osm-raster",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

const toNumber = (value?: number | string | null) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildSignature = (list: RoutePoint[]) =>
  list
    .map(
      (p) =>
        `${toNumber(p.lat) ?? ""},${toNumber(p.lng) ?? ""},${p.address}`.trim()
    )
    .join("|");

export default function RutasMap({ points, onPointsResolved, routeName }: RutasMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { editingRoute } = useEditingRoute();

  const [mapReady, setMapReady] = useState(false);
  const [resolvedPoints, setResolvedPoints] = useState<RoutePoint[]>([]);
  const [optimizedPoints, setOptimizedPoints] = useState<RoutePoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<number[][]>([]);
  const [routeMetrics, setRouteMetrics] = useState<{ distance_m: number | null; duration_s: number | null }>({
    distance_m: null,
    duration_s: null,
  });
  const [isHydratingPoints, setIsHydratingPoints] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState<{ current: number; total: number } | null>(null);
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);
  const hydratedSignatureRef = useRef<string | null>(null);
  const optimizedSignatureRef = useRef<string | null>(null);

  // Combine points from prop with points from editing route context
  const effectivePoints = useMemo(() => {
    const basePoints = Array.isArray(points) ? points : [];
    const editedRoutePoints = editingRoute?.points ? (Array.isArray(editingRoute.points) ? editingRoute.points : []) : [];
    
    // Combine and deduplicate by id
    const byId = new Map<string, RoutePoint>();
    basePoints.forEach(p => {
      const id = p.id || `${p.case_number}-${p.address}`;
      byId.set(id, p);
    });
    editedRoutePoints.forEach((p: any) => {
      const id = p.id || `${p.case_number}-${p.incident_address || p.address}`;
      byId.set(id, { ...p, address: p.incident_address || p.address || p.address });
    });
    
    return Array.from(byId.values());
  }, [points, editingRoute?.points]);

  const pointsSignature = useMemo(() => buildSignature(effectivePoints), [effectivePoints]);
  const displayPoints = useMemo(() => {
    if (optimizedPoints.length >= 2) return optimizedPoints;
    if (resolvedPoints.length > 0) return resolvedPoints;
    return effectivePoints;
  }, [optimizedPoints, resolvedPoints, effectivePoints]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 11,
      preserveDrawingBuffer: true,
    } as MapOptions);
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    mapRef.current = map;
    map.on("load", () => setMapReady(true));
    map.on("error", (evt) => {
      console.error("MapLibre error:", evt?.error);
      setMapReady(true);
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);


  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const dataset = displayPoints;

    dataset.forEach((point, index) => {
      const lng = toNumber(point.lng);
      const lat = toNumber(point.lat);
      if (lng === null || lat === null) return;
      const color =
        index === 0
          ? "#22C55E"
          : index === dataset.length - 1
          ? "#EF4444"
          : "#0EA5E9";

      const marker = new maplibregl.Marker({ color })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setText(point.address));

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    if (dataset.length === 1) {
      const [only] = dataset;
      const lng = toNumber(only.lng);
      const lat = toNumber(only.lat);
      if (lng !== null && lat !== null) {
        map.flyTo({ center: [lng, lat], zoom: 13, essential: true });
      }
    } else if (dataset.length > 1) {
      const coords = dataset
        .map((point) => {
          const lng = toNumber(point.lng);
          const lat = toNumber(point.lat);
          if (lng === null || lat === null) return null;
          return [lng, lat] as [number, number];
        })
        .filter(Boolean) as [number, number][];

      if (coords.length > 1) {
        const bounds = coords.reduce(
          (acc, coord) => acc.extend(coord),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
      }
    } else if (dataset.length === 0) {
      map.flyTo({ center: DEFAULT_CENTER, zoom: 10, essential: true });
    }
    map.resize();
  }, [displayPoints, mapReady]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const hasGeometry = Array.isArray(routeGeometry) && routeGeometry.length > 1;
    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

    if (!hasGeometry) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      return;
    }

    const geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routeGeometry,
      },
    } as const;

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: {
          "line-color": "#2563eb",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
    }
  }, [mapReady, routeGeometry]);

  const geocodeAddress = useCallback(async (address: string) => {
    if (!address.trim()) return null;
    try {
      const coords = await geocodeLeadAddress(address);
      if (!coords) return null;
      return [coords.lng, coords.lat] as [number, number];
    } catch (error) {
      console.error("❌ Error geocoding address:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const pointsNeedingGeocode = points.filter(
      (p) => toNumber(p.lat) === null || toNumber(p.lng) === null
    );
    if (pointsNeedingGeocode.length === 0) {
      setResolvedPoints(points);
      hydratedSignatureRef.current = pointsSignature;
      setIsHydratingPoints(false);
      setGeocodeProgress(null);
      return;
    }
    if (hydratedSignatureRef.current === pointsSignature) return;

    let cancelled = false;
    const BATCH_SIZE = 5; // Geocode up to 5 addresses in parallel

    (async () => {
      setIsHydratingPoints(true);
      setGeocodeProgress({ current: 0, total: pointsNeedingGeocode.length });

      // Create a map of address -> coordinates for caching
      const geocodeCache = new Map<string, [number, number] | null>();
      let completed = 0;

      // Process points needing geocode in parallel batches
      for (let i = 0; i < pointsNeedingGeocode.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = pointsNeedingGeocode.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (point) => {
            const cached = geocodeCache.get(point.address);
            if (cached !== undefined) return { point, coords: cached };
            const fetched = await geocodeAddress(point.address);
            geocodeCache.set(point.address, fetched);
            return { point, coords: fetched };
          })
        );
        results.forEach(({ point, coords }) => {
          geocodeCache.set(point.address, coords);
        });
        completed += batch.length;
        if (!cancelled) {
          setGeocodeProgress({ current: completed, total: pointsNeedingGeocode.length });
        }
      }

      if (cancelled) return;

      // Build final resolved points array
      const updated: RoutePoint[] = points.map((point) => {
        let lng = toNumber(point.lng);
        let lat = toNumber(point.lat);
        if (lng === null || lat === null) {
          const cached = geocodeCache.get(point.address);
          if (cached) {
            lng = cached[0];
            lat = cached[1];
          }
        }
        return { ...point, lng, lat };
      });

      setResolvedPoints(updated);
      onPointsResolved?.(updated);
      hydratedSignatureRef.current = buildSignature(updated);
      setIsHydratingPoints(false);
      setGeocodeProgress(null);
    })();

    return () => {
      cancelled = true;
      setIsHydratingPoints(false);
      setGeocodeProgress(null);
    };
  }, [geocodeAddress, onPointsResolved, points, pointsSignature]);

  useEffect(() => {
    const dataset = resolvedPoints.length > 0 ? resolvedPoints : points;
    const valid = dataset
      .map((point) => {
        const lng = toNumber(point.lng);
        const lat = toNumber(point.lat);
        if (lng === null || lat === null) return null;
        return {
          ...point,
          lng,
          lat,
        };
      })
      .filter(Boolean) as RoutePoint[];

    if (valid.length < 2) {
      setOptimizedPoints([]);
      setRouteGeometry([]);
      setRouteMetrics({ distance_m: null, duration_s: null });
      optimizedSignatureRef.current = null;
      return;
    }

    const signature = buildSignature(valid);
    if (optimizedSignatureRef.current === signature) return;

    let cancelled = false;
    (async () => {
      setIsOptimizingRoute(true);
      try {
        const result = await apiPost<OptimizeRouteResponse>("/ors/optimize-route", {
          points: valid,
        });

        if (cancelled) return;

        const optimized = Array.isArray(result?.ordered_points) && result.ordered_points.length
          ? result.ordered_points
          : valid;

        const normalizedOptimized = optimized.map((point) => ({
          ...point,
          lng: toNumber(point.lng),
          lat: toNumber(point.lat),
        }));

        setOptimizedPoints(normalizedOptimized);
        setRouteGeometry(Array.isArray(result?.geometry?.coordinates) ? result.geometry!.coordinates! : []);
        setRouteMetrics({
          distance_m: typeof result?.distance_m === "number" ? result.distance_m : null,
          duration_s: typeof result?.duration_s === "number" ? result.duration_s : null,
        });

        const currentSignature = buildSignature(valid);
        const optimizedSignature = buildSignature(normalizedOptimized);
        if (onPointsResolved && optimizedSignature && currentSignature !== optimizedSignature) {
          onPointsResolved(normalizedOptimized);
        }

        optimizedSignatureRef.current = optimizedSignature || currentSignature;
      } catch (error) {
        if (!cancelled) {
          console.error("❌ Route optimization error:", error);
          setOptimizedPoints(valid);
          setRouteGeometry([]);
          setRouteMetrics({ distance_m: null, duration_s: null });
          optimizedSignatureRef.current = signature;
        }
      } finally {
        if (!cancelled) setIsOptimizingRoute(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsOptimizingRoute(false);
    };
  }, [onPointsResolved, points, resolvedPoints]);

  const buildGoogleMapsUrl = useCallback(
    (ordered?: RoutePoint[]) => {
      const dataset =
        ordered && ordered.length >= 2
          ? ordered
          : displayPoints.length >= 2
          ? displayPoints
          : points;
      if (dataset.length < 2) return null;
      const origin = encodeURIComponent(dataset[0].address);
      const destination = encodeURIComponent(dataset[dataset.length - 1].address);
      const waypoints = dataset
        .slice(1, -1)
        .map((p) => encodeURIComponent(p.address))
        .join("|");

      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      if (waypoints) url += `&waypoints=${waypoints}`;
      return url;
    },
    [displayPoints, points]
  );

  const routeUrl = useMemo(() => buildGoogleMapsUrl(), [buildGoogleMapsUrl]);
  const handleExportPdf = useCallback(() => {
    const details = displayPoints.length ? displayPoints : points;
    if (!details.length) return;
    exportRoutePdf({
      routeName: routeName?.trim() || "Route",
      points: details,
      logoUrl: "/logo.png",
    });
  }, [displayPoints, points, routeName]);

  return (
    <div className="flex h-full w-full flex-col">
      <div
        ref={mapContainerRef}
        className="relative h-full min-h-[420px] flex-1 rounded-2xl bg-muted"
      >
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading map...
          </div>
        )}
        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Send addresses from Leads to visualize them on the map.
          </div>
        )}
        {isHydratingPoints && points.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow">
            <Loader2 className="h-3 w-3 animate-spin" />
            {geocodeProgress
              ? `Geocoding ${geocodeProgress.current} of ${geocodeProgress.total}...`
              : "Locating addresses on the map..."}
          </div>
        )}
        {isOptimizingRoute && displayPoints.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow">
            <Loader2 className="h-3 w-3 animate-spin" />
            Optimizing route order...
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => routeUrl && window.open(routeUrl, "_blank", "noopener")}
          disabled={!routeUrl}
        >
          <ExternalLink className="h-4 w-4" />
          View in Google Maps
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleExportPdf}
          disabled={!mapReady || !routeUrl}
        >
          <FileDown className="h-4 w-4" />
          Export to PDF
        </Button>

        {displayPoints.length >= 2 && (
          <>
            <span className="text-sm text-muted-foreground">
              Distance: {routeMetrics.distance_m ? `${(routeMetrics.distance_m / 1000).toFixed(2)} km` : "calculating..."}
            </span>
            <span className="text-sm text-muted-foreground">
              ETA: {routeMetrics.duration_s ? `${Math.round(routeMetrics.duration_s / 60)} min` : "calculating..."}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
