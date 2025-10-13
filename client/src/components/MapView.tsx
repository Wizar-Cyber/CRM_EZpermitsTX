import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Save, X, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// --- Tipos de Datos ---
type Point = {
  id: string;
  lat: number;
  lng: number;
  address: string;
  case_number?: string;
};

// --- Componentes Auxiliares del Mapa ---

// Arreglo para íconos de Leaflet en Vite/React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});


// Componente para ajustar el zoom del mapa a los puntos
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

// --- Componente Principal de la Vista del Mapa ---

export function MapView({ routeId }: { routeId?: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeName, setRouteName] = useState("");
  const [, setLocation] = useLocation();

  // MODIFICADO: Lógica para cargar puntos (desde API o localStorage)
  useEffect(() => {
    const loadPoints = async () => {
      setLoading(true);
      try {
        if (routeId) {
          // --- MODO EDICIÓN: Cargar desde la API ---
          const routeData = await api(`/api/routes/${routeId}`);
          setPoints(routeData.points || []);
          setRouteName(routeData.name || "");
          toast.info(`Editing route: ${routeData.name}`);
        } else {
          // --- MODO CREACIÓN: Cargar desde localStorage ---
          const raw = localStorage.getItem("selectedForMap");
          const parsedPoints = raw ? JSON.parse(raw) : [];
          // Asegurarse de que todos los puntos tengan lat/lng
          const validPoints = parsedPoints.filter((p: any) => p.lat && p.lng);
          setPoints(validPoints);
        }
      } catch (err) {
        console.error("❌ Error loading points:", err);
        toast.error("Failed to load route data.");
        setPoints([]);
      } finally {
        setLoading(false);
      }
    };
    loadPoints();
  }, [routeId]);

  // --- Funciones de Acción ---

  const handleRemovePoint = (id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
    toast.success("Address removed from route.");
  };

  const handleClearAll = () => {
    setPoints([]);
    toast.warning("All addresses have been cleared.");
  };
  
  const handleCopyAddresses = () => {
    if (points.length === 0) return;
    const allAddresses = points.map(p => p.address).join('\n');
    navigator.clipboard.writeText(allAddresses);
    toast.success("All addresses copied to clipboard!");
  };

  const handleSaveRoute = async () => {
    if (!routeName.trim() || points.length === 0) {
      toast.error("Please provide a route name and at least one address.");
      return;
    }

    const payload = { name: routeName.trim(), points };

    try {
      if (routeId) {
        // --- Actualizar Ruta Existente ---
        await api(`/api/routes/${routeId}`, { method: 'PUT', body: payload });
        toast.success("Route updated successfully!");
      } else {
        // --- Crear Nueva Ruta ---
        await api("/api/routes", { method: 'POST', body: payload });
        toast.success("Route saved successfully!");
      }
      localStorage.removeItem("selectedForMap"); // Limpiar localStorage después de guardar
      setLocation("/routes"); // Redirigir a la lista de rutas
    } catch (err) {
      console.error("❌ Error saving route:", err);
      toast.error("An error occurred while saving the route.");
    }
  };

  const canSave = routeName.trim().length > 0 && points.length > 0;

  return (
    <div className="flex flex-col md:flex-row h-full gap-4">
      {/* === PANEL IZQUIERDO: CONTROLES Y LISTA === */}
      <Card className="md:w-[380px] w-full flex flex-col p-4 rounded-2xl">
        <div className="mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Route Details
          </h3>
          <p className="text-sm text-gray-500">
            {points.length} {points.length === 1 ? "location" : "locations"} on this route
          </p>
        </div>
        
        {/* NUEVO: Botones de acciones rápidas */}
        <div className="grid grid-cols-2 gap-2 mb-4">
            <Button variant="outline" onClick={handleCopyAddresses} disabled={points.length === 0}><Copy className="w-4 h-4 mr-2"/>Copy All</Button>
            <Button variant="outline" onClick={handleClearAll} disabled={points.length === 0}><Trash2 className="w-4 h-4 mr-2"/>Clear All</Button>
        </div>

        {/* Lista de Direcciones */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading addresses...</p>
          ) : points.length > 0 ? (
            points.map((p) => (
              <div key={p.id} className="flex justify-between items-center border rounded-lg px-3 py-2 bg-background hover:bg-muted/50">
                <div>
                  <span className="text-sm font-medium">{p.address}</span>
                  {p.case_number && <span className="text-xs text-muted-foreground block">Case #{p.case_number}</span>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemovePoint(p.id)} className="h-7 w-7">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm text-center mt-8">No addresses selected. Go to Leads and "Send to Map".</p>
          )}
        </div>

        {/* Controles para Guardar */}
        <div className="pt-4 mt-auto space-y-2">
          <Input placeholder="Enter route name..." value={routeName} onChange={(e) => setRouteName(e.target.value)} className="rounded-lg" />
          <Button onClick={handleSaveRoute} disabled={!canSave} className="w-full rounded-lg">
            <Save className="w-4 h-4 mr-2" />
            {routeId ? "Update Route" : "Save Route"}
          </Button>
        </div>
      </Card>

      {/* === PANEL DERECHO: MAPA === */}
      <Card className="flex-1 rounded-2xl overflow-hidden flex items-center justify-center">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading map...</div>
        ) : (
          <MapContainer center={[29.7604, -95.3698]} zoom={10} scrollWheelZoom className="w-full h-full">
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={points} />
            {points.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]}>
                <Popup>
                  <div className="text-sm">
                    <strong>{p.address}</strong><br/>
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