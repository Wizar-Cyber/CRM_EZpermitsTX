import { RoutesTable } from "@/components/RoutesTable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiDelete } from "@/lib/api";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import { Route as RouteIcon, MapPin } from "lucide-react";

export type Route = {
  id: number;
  name: string;
  created_by: string;
  created_at: string;
  scheduled_on: string;
  points?: any[];
  points_count?: number;
};

type ApiResponse = {
  data: Route[]; // ✅ ← ajustado: tu API devuelve { data: [...] }
};

export default function RoutesPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // 1️⃣ Obtener las rutas de la API
  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ["routes"],
    queryFn: () => apiGet("/routes"),
  });

  // ✅ Ahora accede correctamente a data.data
  const routes = data?.data || [];

  // 2️⃣ Mutación para eliminar
  const deleteMutation = useMutation({
    mutationFn: (routeId: number) => apiDelete(`/routes/${routeId}`),
    onSuccess: () => {
      toast.success("Ruta eliminada con éxito.");
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
    onError: (error: any) => {
      toast.error(`Error al eliminar la ruta: ${error.message}`);
    },
    onSettled: () => {
      setDeleteId(null);
    },
  });

  // 3️⃣ Editar y eliminar
  const handleEdit = (routeId: number) => {
    setLocation(`/map/${routeId}`);
  };

  const handleDeleteConfirm = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  // 4️⃣ Estados
  if (isLoading)
    return <div className="text-center p-8">Cargando rutas...</div>;
  if (isError)
    return (
      <div className="text-center p-8 text-destructive">
        Error al cargar las rutas.
      </div>
    );

  // 5️⃣ Render
  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 rounded-2xl px-6 py-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <RouteIcon className="w-4 h-4 opacity-70" />
              <span className="text-xs font-medium opacity-70 uppercase tracking-widest">Logistics</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Routes</h1>
            <p className="text-teal-100 text-sm mt-0.5">Manage delivery and inspection routes</p>
          </div>
          <div className="bg-white/15 rounded-xl px-4 py-2.5 text-center border border-white/20">
            <p className="text-xl font-bold">{routes.length}</p>
            <p className="text-xs opacity-75 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Routes</p>
          </div>
        </div>
      </div>

      <RoutesTable
        routes={routes}
        onEdit={handleEdit}
        onDeleteRequest={(id) => setDeleteId(id)}
        deleteId={deleteId}
        onDeleteCancel={() => setDeleteId(null)}
        onDeleteConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
