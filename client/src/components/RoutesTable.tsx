import { useState } from "react";
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
              <th className="p-4 text-left font-semibold text-sm">Points</th>
              <th className="p-4 text-left font-semibold text-sm">Actions</th>
            </tr>
          </thead>
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

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this route? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && handleDelete(deleteId)}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
