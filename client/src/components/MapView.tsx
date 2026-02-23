import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Save, X, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/features/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import RutasMap from "@/components/maps/RutasMap";
import { copyText } from "@/lib/clipboard";

type Point = {
  id: string;
  lat?: number | string | null;
  lng?: number | string | null;
  address: string;
  case_number?: string;
};

type RouteResponse = {
  name?: string;
  points?: Point[];
};

export function MapView({ routeId }: { routeId?: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeName, setRouteName] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadPoints = async () => {
      setLoading(true);
      try {
        let initialPoints: Point[] = [];

        if (routeId) {
          const routeData = await apiGet<RouteResponse>(`/routes/${routeId}`);
          initialPoints = routeData.points || [];
          setRouteName(routeData.name || "");
          toast.info(`Editing route: ${routeData.name}`);
        }

        const rawPoints =
          localStorage.getItem("selectedForMap") ||
          localStorage.getItem("selectedLeadsForMap");
        const storedPoints = rawPoints ? JSON.parse(rawPoints) : [];

        const combinedPoints = [
          ...initialPoints,
          ...storedPoints.filter(
            (p: Point) => !initialPoints.some((ip) => ip.id === p.id)
          ),
        ];

        const normalizedPoints = combinedPoints.map((point: any) => {
          const lat =
            typeof point.lat === "string"
              ? parseFloat(point.lat)
              : point.lat ?? null;
          const lng =
            typeof point.lng === "string"
              ? parseFloat(point.lng)
              : point.lng ?? null;
          return {
            ...point,
            lat: Number.isFinite(lat) ? (lat as number) : null,
            lng: Number.isFinite(lng) ? (lng as number) : null,
          };
        });

        setPoints(normalizedPoints);

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
      const payload = JSON.stringify(points);
      localStorage.setItem("selectedForMap", payload);
      localStorage.setItem("selectedLeadsForMap", payload);
    } else if (!routeId && points.length === 0) {
      localStorage.removeItem("selectedForMap");
      localStorage.removeItem("selectedLeadsForMap");
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
    localStorage.removeItem("selectedLeadsForMap");
    toast.warning("All addresses have been cleared.");
  };

  const handleCopyAddresses = async () => {
    if (points.length === 0) return;
    const all = points.map((p) => p.address).join("\n");
    const copied = await copyText(all);
    if (copied) toast.success("All addresses copied!");
    else toast.error("Could not copy addresses on this browser context.");
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
    const caseNumbers = [
      ...new Set(
        points
          .map((p) => p.case_number)
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      ),
    ];

    const payload = {
      name: routeName.trim(),
      points,
      case_numbers: caseNumbers,
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

      if (caseNumbers.length > 0) {
        queryClient.setQueryData(["/leads"], (prev: any) => {
          if (!prev || !Array.isArray(prev.data)) return prev;
          const removed = new Set(caseNumbers);
          return {
            ...prev,
            data: prev.data.filter((lead: any) => !removed.has(String(lead?.case_number || ""))),
          };
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["routes"] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-leads"] });
      await queryClient.invalidateQueries({ queryKey: ["/leads"] });

      localStorage.removeItem("selectedForMap");
      localStorage.removeItem("selectedLeadsForMap");
      setPoints([]);
      setRouteName("");
      setTimeout(() => setLocation("/routes"), 0);
    } catch (err: any) {
      console.error("❌ Error saving route:", err);
      toast.error(`Error saving route: ${err.message}`);
    }
  };

  const canSave = routeName.trim().length > 0 && points.length > 0;

  const handlePointsResolved = (updatedPoints: Point[]) => {
    if (!updatedPoints.length) return;
    setPoints(
      updatedPoints.map((point) => ({
        ...point,
        lat:
          typeof point.lat === "number"
            ? point.lat
            : typeof point.lat === "string"
            ? (Number.isFinite(parseFloat(point.lat)) ? parseFloat(point.lat) : null)
            : null,
        lng:
          typeof point.lng === "number"
            ? point.lng
            : typeof point.lng === "string"
            ? (Number.isFinite(parseFloat(point.lng)) ? parseFloat(point.lng) : null)
            : null,
      }))
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-full gap-4">
      <Card className="md:w-[380px] w-full flex flex-col p-4 rounded-2xl">
        <div className="mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Route Details
          </h3>
          <p className="text-sm text-muted-foreground">
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
            <p className="text-muted-foreground text-sm">Loading addresses...</p>
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
            <p className="text-muted-foreground text-sm text-center mt-8">
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

      <Card className="flex-1 rounded-2xl p-4 flex flex-col min-h-[520px]">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Loading map...
          </div>
        ) : (
          <RutasMap
            points={points}
            onPointsResolved={handlePointsResolved}
            routeName={routeName}
          />
        )}
      </Card>
    </div>
  );
}
