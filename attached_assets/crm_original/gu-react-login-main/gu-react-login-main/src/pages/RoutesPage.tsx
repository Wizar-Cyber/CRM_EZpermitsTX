import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../components/BackButton";
import { apiGet, apiDelete } from "../lib/api";

type RouteRow = {
  id: number;
  name: string;
  created_by: string;
  created_at: string;
};

export default function RoutesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Cargar rutas desde la API
  useEffect(() => {
    const load = async () => {
      try {
        const r = await apiGet<{ data: RouteRow[] }>("/api/routes");
        setRows(r.data);
      } catch (err) {
        console.error("Error loading routes:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this route?")) return;
    try {
      await apiDelete(`/api/routes/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      alert("Route deleted ✅");
    } catch (err: any) {
      console.error(err);
      alert(`Error deleting route: ${err.message || "unknown"}`);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <BackButton />
      <h1 className="text-2xl font-bold mb-4">🚗 Routes</h1>

      <div className="bg-gray-900 rounded p-3">
        {loading ? (
          <p className="text-gray-400">Loading routes…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="p-2">ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Created By</th>
                <th className="p-2">Created At</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-800">
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.created_by}</td>
                  <td className="p-2">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-2 flex gap-2">
                    <button
                      onClick={() => navigate(`/map?routeId=${r.id}`)}
                      className="px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm"
                    >
                      Edit / View
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 p-4">
                    No routes created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
