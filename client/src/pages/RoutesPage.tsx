import { RoutesTable } from "@/components/RoutesTable";
<<<<<<< HEAD
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiDelete } from "@/lib/api";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

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
    <RoutesTable
      routes={routes}
      onEdit={handleEdit}
      onDeleteRequest={(id) => setDeleteId(id)}
      deleteId={deleteId}
      onDeleteCancel={() => setDeleteId(null)}
      onDeleteConfirm={handleDeleteConfirm}
    />
  );
=======

export default function RoutesPage() {
  return <RoutesTable />;
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
}
