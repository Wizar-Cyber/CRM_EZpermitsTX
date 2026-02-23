import { useMemo, useState } from "react";
import { ArrowUpDown, FileDown, Pencil, Trash2 } from "lucide-react";
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
  onDownload: (route: Route) => void;
  onSelectRoute: (route: Route) => void;
  onDeleteRequest: (id: number) => void;
  deleteId: number | null;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
};

type SortField = "name" | "created_by" | "created_at" | "scheduled_on" | "updated_at" | "points_count";
type SortDir = "asc" | "desc";

export function RoutesTable({
  routes,
  onEdit,
  onDownload,
  onSelectRoute,
  onDeleteRequest,
  deleteId,
  onDeleteCancel,
  onDeleteConfirm,
}: RoutesTableProps) {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(field === "name" || field === "created_by" ? "asc" : "desc");
  };

  const sortedRoutes = useMemo(() => {
    const copy = [...routes];
    const toVal = (route: Route) => {
      if (sortField === "points_count") return Number(route.points_count ?? route.points?.length ?? 0);
      if (sortField === "name") return String(route.name || "").toLowerCase();
      if (sortField === "created_by") return String(route.created_by || "").toLowerCase();
      if (sortField === "created_at") return new Date(route.created_at || 0).getTime();
      if (sortField === "scheduled_on") return new Date(route.scheduled_on || 0).getTime();
      return new Date((route as any).updated_at || 0).getTime();
    };

    copy.sort((a, b) => {
      const av = toVal(a) as string | number;
      const bv = toVal(b) as string | number;
      const base = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === "asc" ? base : -base;
    });

    return copy;
  }, [routes, sortField, sortDir]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-1 font-semibold text-sm w-full"
      onClick={() => toggleSort(field)}
    >
      <span>{label}</span>
      <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
    </button>
  );

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4">Saved Routes</h2>

      <Card className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full" data-testid="table-routes">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-center"><SortHeader field="name" label="Route Name" /></th>
              <th className="p-4 text-center"><SortHeader field="created_by" label="Created By" /></th>
              <th className="p-4 text-center"><SortHeader field="created_at" label="Created" /></th>
              <th className="p-4 text-center"><SortHeader field="scheduled_on" label="Scheduled" /></th>
              {routes.some(r => r.updated_at) && (
                <th className="p-4 text-center"><SortHeader field="updated_at" label="Last Update" /></th>
              )}
              <th className="p-4 text-center"><SortHeader field="points_count" label="Points" /></th>
              <th className="p-4 text-center font-semibold text-sm">Actions</th>
            </tr>
          </thead>

          <tbody>
            {sortedRoutes.map((route) => (
              <tr
                key={route.id}
                className="border-t border-border hover:bg-muted/50 transition-colors cursor-pointer"
                data-testid={`row-route-${route.id}`}
                onClick={() => onSelectRoute(route)}
              >
                <td className="p-4 font-medium text-center">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => onSelectRoute(route)}
                  >
                    {route.name}
                  </button>
                </td>
                <td className="p-4 text-muted-foreground text-center">
                  {route.created_by}
                  {route.updated_by && (
                    <span className="block text-xs text-muted-foreground/70">
                      Updated by {route.updated_by}
                    </span>
                  )}
                </td>
                <td className="p-4 text-muted-foreground text-center">
                  {new Date(route.created_at).toLocaleDateString()}
                </td>
                <td className="p-4 text-muted-foreground text-center">
                  {new Date(route.scheduled_on).toLocaleDateString()}
                </td>
                {routes.some(r => r.updated_at) && (
                  <td className="p-4 text-muted-foreground text-center">
                    {route.updated_at
                      ? new Date(route.updated_at).toLocaleDateString()
                      : "-"}
                  </td>
                )}
                <td className="p-4 text-center">{route.points_count ?? route.points?.length ?? 0}</td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(route);
                      }}
                      title="Download PDF"
                      data-testid={`button-download-${route.id}`}
                    >
                      <FileDown className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(route.id);
                      }}
                      data-testid={`button-edit-${route.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRequest(route.id);
                      }}
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
