import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Save, X, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/features/hooks/useAuth";

type Point = {
  id: string;
  lat: number;
  lng: number;
  address: string;
  case_number?: string;
};

// Corrige el problema del ícono por defecto en Leaflet con Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
}

export function MapView({ routeId }: { routeId?: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeName, setRouteName] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const loadPoints = async () => {
      setLoading(true);
      try {
        let initialPoints: Point[] = [];

        if (routeId) {
          const routeData = await apiGet(`/routes/${routeId}`);
          initialPoints = routeData.points || [];
          setRouteName(routeData.name || "");
          toast.info(`Editing route: ${routeData.name}`);
        }

        const rawPoints = localStorage.getItem("selectedForMap");
        const storedPoints = rawPoints ? JSON.parse(rawPoints) : [];

        const combinedPoints = [
          ...initialPoints,
          ...storedPoints.filter(
            (p: Point) => !initialPoints.some((ip) => ip.id === p.id)
          ),
        ];
        
        // ✅ INICIO DE LA CORRECCIÓN
        // Filtra los puntos para asegurar que todos tengan coordenadas válidas antes de renderizar.
        const validPoints = combinedPoints.filter(p => {
          const hasValidCoords = p && typeof p.lat === 'number' && typeof p.lng === 'number';
          
          if (!hasValidCoords) {
            console.warn("Punto descartado por coordenadas inválidas:", p);
          }
          
          return hasValidCoords;
        });

        setPoints(validPoints);
        // ✅ FIN DE LA CORRECCIÓN

      } catch (err: any) {
        console.error("❌ Error loading points:", err);
        toast.error(`Error loading route: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadPoints();
  }, [routeId]);

  useEffect(() => {
    if (!routeId && points.length > 0) {
      localStorage.setItem("selectedForMap", JSON.stringify(points));
    } else if (!routeId && points.length === 0) {
      localStorage.removeItem("selectedForMap");
    }
  }, [points, routeId]);

  const handleRemovePoint = (id: string) => {
    const updated = points.filter((p) => p.id !== id);
    setPoints(updated);
    toast.success("Address removed from route.");
  };

  const handleClearAll = () => {
    setPoints([]);
    localStorage.removeItem("selectedForMap");
    toast.warning("All addresses have been cleared.");
  };

  const handleCopyAddresses = () => {
    if (points.length === 0) return;
    const all = points.map((p) => p.address).join("\n");
    navigator.clipboard.writeText(all);
    toast.success("All addresses copied!");
  };

  const handleSaveRoute = async () => {
    if (!routeName.trim() || points.length === 0) {
      toast.error("Please name the route and add at least one address.");
      return;
    }
    if (!user) {
      toast.warning("Loading user information...");
      return;
    }

    if (!user.email) {
      toast.error("User not identified. Please log in again.");
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      name: routeName.trim(),
      points,
      created_by: user.email,
      updated_at: now,
      scheduled_on: now,
    };

    try {
      if (routeId) {
        await apiPut(`/routes/${routeId}`, payload);
        toast.success("Route updated successfully!");
      } else {
        await apiPost("/routes", payload);
        toast.success("Route saved successfully!");
      }

      localStorage.removeItem("selectedForMap");
      setPoints([]);
      setRouteName("");
      setLocation("/routes");
    } catch (err: any) {
      console.error("❌ Error saving route:", err);
      toast.error(`Error saving route: ${err.message}`);
    }
  };

  const canSave = routeName.trim().length > 0 && points.length > 0;

  return (
    <div className="flex flex-col md:flex-row h-full gap-4">
      <Card className="md:w-[380px] w-full flex flex-col p-4 rounded-2xl">
        <div className="mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Route Details
          </h3>
          <p className="text-sm text-gray-500">
            {points.length} {points.length === 1 ? "location" : "locations"} in this route
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button
            variant="outline"
            onClick={handleCopyAddresses}
            disabled={points.length === 0}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy All
          </Button>
          <Button
            variant="outline"
            onClick={handleClearAll}
            disabled={points.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading addresses...</p>
          ) : points.length > 0 ? (
            points.map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center border rounded-lg px-3 py-2 bg-background hover:bg-muted/50"
              >
                <div>
                  <span className="text-sm font-medium">{p.address}</span>
                  {p.case_number && (
                    <span className="text-xs text-muted-foreground block">
                      Case #{p.case_number}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePoint(p.id)}
                  className="h-7 w-7"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm text-center mt-8">
              No addresses selected. Go to Leads and “Send to Map”.
            </p>
          )}
        </div>

        <div className="pt-4 mt-auto space-y-2">
          <Input
            placeholder="Enter route name..."
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            className="rounded-lg"
          />
          <Button
            onClick={handleSaveRoute}
            disabled={!canSave}
            className="w-full rounded-lg"
          >
            <Save className="w-4 h-4 mr-2" />
            {routeId ? "Update Route" : "Save Route"}
          </Button>
        </div>
      </Card>

      <Card className="flex-1 rounded-2xl overflow-hidden flex items-center justify-center">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading map...</div>
        ) : (
          <MapContainer
            center={[29.7604, -95.3698]} // Houston, TX as a default center
            zoom={10}
            scrollWheelZoom
            className="w-full h-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points} />
            {points.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]}>
                <Popup>
                  <div className="text-sm">
                    <strong>{p.address}</strong>
                    <br />
                    {p.case_number && `Case: ${p.case_number}`}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </Card>
    </div>
  );
}