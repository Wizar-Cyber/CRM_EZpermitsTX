<<<<<<< HEAD
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
=======
import { useState } from "react";
import { MapPin, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// TODO: remove mock functionality - placeholder for map integration
const mockAddresses = [
  { id: "1", address: "123 Main St, City, State", lat: 40.7128, lng: -74.0060, case_number: "C-2024-001", color: "green" },
  { id: "2", address: "456 Oak Ave, City, State", lat: 40.7580, lng: -73.9855, case_number: "C-2024-002", color: "yellow" },
  { id: "3", address: "789 Pine Rd, City, State", lat: 40.7489, lng: -73.9680, case_number: "C-2024-003", color: "red" },
];

interface MapViewProps {
  routeId?: string;
}

export function MapView({ routeId }: MapViewProps) {
  const [addresses, setAddresses] = useState(mockAddresses);
  const [routeName, setRouteName] = useState("");
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const handleRemoveAddress = (id: string) => {
    setAddresses(addresses.filter(addr => addr.id !== id));
    console.log("Removed address:", id);
  };

  const handleSaveRoute = () => {
    console.log("Saving route:", { name: routeName, addresses });
    // TODO: Implement API call to save route
  };

  return (
    <div className="flex h-full gap-4">
      {/* Address List Sidebar */}
      <Card className="w-80 rounded-2xl shadow-sm p-4 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-lg mb-2">Selected Addresses</h3>
          <p className="text-sm text-muted-foreground">{addresses.length} locations</p>
        </div>

        <div className="flex-1 overflow-auto space-y-2">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No addresses selected. Go to Leads to select locations.
            </p>
          ) : (
            addresses.map((addr) => (
              <div 
                key={addr.id} 
                className={`p-3 rounded-lg border hover-elevate cursor-pointer ${
                  selectedMarker === addr.id ? 'bg-primary/10 border-primary' : 'bg-card border-border'
                }`}
                onClick={() => setSelectedMarker(addr.id)}
                data-testid={`address-item-${addr.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className={`w-4 h-4 text-${addr.color}-500`} />
                      <span className="text-xs font-medium text-muted-foreground">{addr.case_number}</span>
                    </div>
                    <p className="text-sm">{addr.address}</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAddress(addr.id);
                    }}
                    data-testid={`button-remove-${addr.id}`}
                    className="rounded-lg h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 pt-3 border-t">
          <Input 
            placeholder="Route name"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            data-testid="input-route-name"
            className="rounded-lg"
          />
          <Button 
            onClick={handleSaveRoute} 
            disabled={addresses.length < 2 || !routeName}
            className="w-full rounded-2xl"
            data-testid="button-save-route"
          >
            <Save className="w-4 h-4 mr-2" />
            {routeId ? 'Update Route' : 'Save Route'}
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
          </Button>
        </div>
      </Card>

<<<<<<< HEAD
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
=======
      {/* Map Area */}
      <Card className="flex-1 rounded-2xl shadow-sm p-4">
        <div className="w-full h-full bg-muted/30 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Map view with {addresses.length} markers
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              (react-leaflet integration pending)
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
