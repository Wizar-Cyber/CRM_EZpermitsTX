import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LeadsMap from "../components/LeadsMap";
import BackButton from "../components/BackButton";
import { apiGet, apiPost, apiPut } from "../lib/api";

type Point = { 
  id: string; 
  address: string; 
  lat?: number; 
  lng?: number; 
  case_number?: string 
};

type UserMe = { 
  user?: { id: number; fullname?: string; email?: string } 
};

export default function MapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<UserMe["user"] | null>(null);
  const [routeName, setRouteName] = useState("");
  const [routeId, setRouteId] = useState<number | null>(null);

  // cargar usuario
  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<UserMe>("/api/me");
        setMe(r.user || null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  // cargar puntos: desde BD si edito o desde localStorage si es nuevo
  useEffect(() => {
    const id = params.get("routeId");

    if (id) {
      setRouteId(Number(id));
      (async () => {
        try {
          const r = await apiGet<any>(`/api/routes/${id}`);
          console.log("👉 MapPage - cargando ruta desde BD:", r);
          setPoints(r.points || []);
          setRouteName(r.name || "");
        } catch (err) {
          console.error("❌ Error cargando ruta:", err);
          setPoints([]);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      const raw = localStorage.getItem("selectedForMap");
      console.log("👉 MapPage - raw localStorage:", raw);
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        console.log("👉 MapPage - parsed points:", parsed);
        setPoints(parsed);
      } catch (e) {
        console.error("❌ Error parseando localStorage:", e);
        setPoints([]);
      }
      setLoading(false);
    }
  }, [params]);

  const removePoint = (id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const clearAll = () => setPoints([]);

  const copyAllAddresses = async () => {
    const txt = points.map((p) => p.address).filter(Boolean).join("\n");
    if (!txt.trim()) return alert("No addresses.");
    await navigator.clipboard.writeText(txt);
    alert("Addresses copied ✅");
  };

  const canSave = points.length > 0 && routeName.trim().length > 0;

  const saveRoute = async () => {
    if (!canSave) return alert("Add a route name and at least one address.");

    const created_by = me?.fullname || me?.email || "Unknown User";
    const payload = { name: routeName.trim(), created_by, points };

    try {
      if (routeId) {
        await apiPut(`/api/routes/${routeId}`, payload); // actualizar
        alert("Route updated 🎉");
      } else {
        await apiPost("/api/routes", payload); // crear
        alert("Route created 🎉");
      }
      localStorage.removeItem("selectedForMap");
      navigate("/routes");
    } catch (err: any) {
      console.error(err);
      alert(`Error saving route: ${err.message || "unknown"}`);
    }
  };

  const title = useMemo(
    () =>
      points.length === 0
        ? "Map (Houston)"
        : `Map (Houston) — ${points.length} point${points.length > 1 ? "s" : ""}`,
    [points.length]
  );

  return (
    <div className="p-4 space-y-3">
      <BackButton />
      <h1 className="text-2xl font-bold mb-4">🗺 Map</h1>

      <div className="bg-gray-900 rounded p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="text-sm text-gray-400 mb-1">Route name</label>
            <input
              className="bg-gray-800 p-2 rounded min-w-[240px]"
              placeholder="e.g., Morning Route – West"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
            />
          </div>

          <button className="px-3 py-2 bg-blue-500 rounded hover:bg-blue-600" onClick={copyAllAddresses}>
            Copy addresses
          </button>

          <button
            className="px-3 py-2 bg-amber-500 rounded hover:bg-amber-600"
            onClick={clearAll}
            disabled={points.length === 0}
          >
            Clear all
          </button>

          <button
            className={`px-3 py-2 rounded ${
              canSave ? "bg-emerald-500 hover:bg-emerald-600" : "bg-gray-700 cursor-not-allowed"
            }`}
            onClick={saveRoute}
            disabled={!canSave}
          >
            {routeId ? "Update route" : "Save route"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Mapa */}
        <div className="bg-gray-900 rounded p-3 h-[600px] lg:col-span-2">
          <h2 className="text-xl font-semibold mb-2">{title}</h2>
          <div className="w-full h-[540px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Loading map…
              </div>
            ) : (
              <LeadsMap
                points={points.filter((p) => p.lat && p.lng).map((p) => ({
                  id: p.id,
                  lat: Number(p.lat),
                  lng: Number(p.lng),
                  address: p.address,
                }))}
              />
            )}
          </div>
        </div>

        {/* Lista de direcciones */}
        <div className="bg-gray-900 rounded p-3 h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2">Addresses</h2>
          {points.length === 0 ? (
            <p className="text-gray-400">
              No addresses selected. Go to{" "}
              <span className="underline cursor-pointer" onClick={() => navigate("/leads")}>
                Leads
              </span>{" "}
              and “Send to map”.
            </p>
          ) : (
            <ul className="space-y-2">
              {points.map((p) => (
                <li
                  key={p.id}
                  className="bg-gray-800 rounded p-2 flex items-start justify-between gap-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">{p.address || "(no address)"}</div>
                    {p.case_number && <div className="text-gray-500">Case #{p.case_number}</div>}
                  </div>
                  <button
                    className="px-2 py-1 bg-rose-600 rounded hover:bg-rose-700 text-sm"
                    onClick={() => removePoint(p.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
