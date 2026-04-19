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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">Saved Routes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{routes.length} routes configured</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm" data-testid="table-routes">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800 to-slate-700">
              <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Route Name</th>
              <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Created By</th>
              <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Created</th>
              <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Scheduled</th>
              {routes.some(r => r.updated_at) && (
                <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Last Update</th>
              )}
              <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Points</th>
              <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Actions</th>
            </tr>
          </thead>

          <tbody>
            {routes.map((route, idx) => (
              <tr
                key={route.id}
                className={`border-t border-slate-100 dark:border-slate-800 transition-colors ${
                  idx % 2 === 0
                    ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    : "bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
                data-testid={`row-route-${route.id}`}
              >
                <td className="p-4 font-semibold text-sm text-slate-800 dark:text-slate-200">{route.name}</td>
                <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                  {route.created_by}
                  {route.updated_by && (
                    <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Updated by {route.updated_by}
                    </span>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                  {new Date(route.created_at).toLocaleDateString()}
                </td>
                <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                  {new Date(route.scheduled_on).toLocaleDateString()}
                </td>
                {routes.some(r => r.updated_at) && (
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                    {route.updated_at
                      ? new Date(route.updated_at).toLocaleDateString()
                      : "-"}
                  </td>
                )}
                <td className="p-4">
                  <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    {route.points_count ?? route.points?.length ?? 0} pts
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                      onClick={() => onEdit(route.id)}
                      data-testid={`button-edit-${route.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 text-blue-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      onClick={() => onDeleteRequest(route.id)}
                      data-testid={`button-delete-${route.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {routes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                  No routes saved yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
