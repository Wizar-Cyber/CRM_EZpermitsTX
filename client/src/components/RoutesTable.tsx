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
              {/* ✅ Nueva columna solo si alguna ruta tiene actualización */}
              {routes.some(r => r.updated_at) && (
                <th className="p-4 text-left font-semibold text-sm">Last Update</th>
              )}
              <th className="p-4 text-left font-semibold text-sm">Points</th>
              <th className="p-4 text-left font-semibold text-sm">Actions</th>
            </tr>
          </thead>

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

      {/* Diálogo controlado */}
      <AlertDialog open={deleteId !== null} onOpenChange={onDeleteCancel}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this route? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={onDeleteCancel}
              className="rounded-2xl"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
