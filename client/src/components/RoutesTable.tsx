<<<<<<< HEAD
=======
import { useState } from "react";
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
<<<<<<< HEAD
import { type Route } from "@/pages/RoutesPage"; // ✅ Importa el tipo de dato

type RoutesTableProps = {
  routes: Route[];
  onEdit: (id: number) => void;
  onDeleteRequest: (id: number) => void;
  deleteId: number | null;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
};

export function RoutesTable({
  routes,
  onEdit,
  onDeleteRequest,
  deleteId,
  onDeleteCancel,
  onDeleteConfirm,
}: RoutesTableProps) {
=======

// TODO: remove mock functionality - placeholder data
const mockRoutes = [
  { id: 1, name: "North District Route", created_by: "John Doe", created_at: "2024-01-15", scheduled_on: "2024-01-20", points: 5 },
  { id: 2, name: "Downtown Area", created_by: "Jane Smith", created_at: "2024-01-16", scheduled_on: "2024-01-22", points: 8 },
  { id: 3, name: "West Side Coverage", created_by: "Bob Johnson", created_at: "2024-01-17", scheduled_on: "2024-01-25", points: 6 },
];

export function RoutesTable() {
  const [routes, setRoutes] = useState(mockRoutes);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleEdit = (routeId: number) => {
    console.log("Edit route:", routeId);
    // TODO: Navigate to /map?routeId={routeId}
  };

  const handleDelete = (routeId: number) => {
    setRoutes(routes.filter(r => r.id !== routeId));
    setDeleteId(null);
    console.log("Deleted route:", routeId);
    // TODO: API call to delete route
  };

>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4">Saved Routes</h2>

      <Card className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full" data-testid="table-routes">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-left font-semibold text-sm">Route Name</th>
              <th className="p-4 text-left font-semibold text-sm">Created By</th>
              <th className="p-4 text-left font-semibold text-sm">Created</th>
              <th className="p-4 text-left font-semibold text-sm">Scheduled</th>
<<<<<<< HEAD
              {/* ✅ Nueva columna solo si alguna ruta tiene actualización */}
              {routes.some(r => r.updated_at) && (
                <th className="p-4 text-left font-semibold text-sm">Last Update</th>
              )}
=======
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
              <th className="p-4 text-left font-semibold text-sm">Points</th>
              <th className="p-4 text-left font-semibold text-sm">Actions</th>
            </tr>
          </thead>
<<<<<<< HEAD

          <tbody>
            {routes.map((route) => (
              <tr
                key={route.id}
                className="border-t border-border hover:bg-muted/50 transition-colors"
                data-testid={`row-route-${route.id}`}
              >
                <td className="p-4 font-medium">{route.name}</td>
                <td className="p-4 text-muted-foreground">
                  {route.created_by}
                  {/* ✅ Muestra quién actualizó si existe */}
                  {route.updated_by && (
                    <span className="block text-xs text-muted-foreground/70">
                      Updated by {route.updated_by}
                    </span>
                  )}
                </td>
                <td className="p-4 text-muted-foreground">
                  {new Date(route.created_at).toLocaleDateString()}
                </td>
                <td className="p-4 text-muted-foreground">
                  {new Date(route.scheduled_on).toLocaleDateString()}
                </td>
                {/* ✅ Nueva celda: fecha de última actualización */}
                {routes.some(r => r.updated_at) && (
                  <td className="p-4 text-muted-foreground">
                    {route.updated_at
                      ? new Date(route.updated_at).toLocaleDateString()
                      : "-"}
                  </td>
                )}
                <td className="p-4">{route.points_count ?? route.points?.length ?? 0}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(route.id)}
                      data-testid={`button-edit-${route.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDeleteRequest(route.id)}
                      data-testid={`button-delete-${route.id}`}
=======
          <tbody>
            {routes.map((route) => (
              <tr 
                key={route.id} 
                className="border-t border-border hover-elevate"
                data-testid={`row-route-${route.id}`}
              >
                <td className="p-4 font-medium">{route.name}</td>
                <td className="p-4 text-muted-foreground">{route.created_by}</td>
                <td className="p-4 text-muted-foreground">{route.created_at}</td>
                <td className="p-4 text-muted-foreground">{route.scheduled_on}</td>
                <td className="p-4">{route.points}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleEdit(route.id)}
                      data-testid={`button-edit-${route.id}`}
                      className="rounded-lg"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => setDeleteId(route.id)}
                      data-testid={`button-delete-${route.id}`}
                      className="rounded-lg"
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

<<<<<<< HEAD
      {/* Diálogo controlado */}
      <AlertDialog open={deleteId !== null} onOpenChange={onDeleteCancel}>
=======
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this route? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
<<<<<<< HEAD
            <AlertDialogCancel
              onClick={onDeleteCancel}
              className="rounded-2xl"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
=======
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && handleDelete(deleteId)}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
