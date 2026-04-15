import { RoutesTable } from "@/components/RoutesTable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiDelete, apiPatch } from "@/lib/api";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useEditingRoute } from "@/features/contexts/EditingRouteContext";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/hooks/useAuth";
import { Check, MapPin, UserPlus, X } from "lucide-react";
import { ClientCreateModal, type NewClientData } from "@/components/ClientCreateModal";
import { exportRoutePdf } from "@/lib/routePdf";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Route = {
  id: number;
  name: string;
  created_by: string;
  created_at: string;
  scheduled_on: string;
  updated_at?: string;
  updated_by?: string;
  points?: any[];
  points_count?: number;
  case_numbers?: string[];
};

type ApiResponse = {
  data: Route[];
};

type RouteLead = {
  case_number: string;
  incident_address?: string | null;
  created_date_local?: string | null;
  current_state?: string | null;
  sent_to_delivery_date?: string | null;
  contacted_at?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_note?: string | null;
  second_attempt_due_at?: string | null;
  delivery_attempts?: number | null;
  publicity_attempts?: number | null;
};

type FullLeadDetails = RouteLead & {
  resolution_inspector?: string | null;
  description_inspector?: string | null;
  created_date_inspector?: string | null;
  resolve_by_time?: string | null;
  state_code_name?: string | null;
  zip_code?: string | null;
  channel?: string | null;
  url?: string | null;
  status?: string | null;
};

type RouteLeadsResponse = {
  route: Pick<Route, "id" | "name" | "case_numbers">;
  data: RouteLead[];
};

type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

type RouteDetailResponse = Route & {
  points?: Array<{
    id?: string;
    address?: string;
    incident_address?: string;
    case_number?: string;
    lat?: number | string | null;
    lng?: number | string | null;
  }>;
};

const toMapItem = (lead: RouteLead) => ({
  id: `${lead.case_number}-${lead.incident_address || "address"}`,
  case_number: lead.case_number,
  address: lead.incident_address || "",
  incident_address: lead.incident_address || "",
  lat: null,
  lng: null,
});

const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const isSecondAttempt = (lead: RouteLead) => Number(lead.delivery_attempts || 0) >= 2;

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 py-2 border-b border-border/50">
    <dt className="text-sm font-semibold text-muted-foreground sm:col-span-1">{label}</dt>
    <dd className="sm:col-span-3 text-sm">{children || "—"}</dd>
  </div>
);

export default function RoutesPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setEditingRoute } = useEditingRoute();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [viewLead, setViewLead] = useState<RouteLead | null>(null);
  const [fullLeadDetails, setFullLeadDetails] = useState<FullLeadDetails | null>(null);
  const [loadingLeadDetails, setLoadingLeadDetails] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [clientToCreate, setClientToCreate] = useState<NewClientData>({
    case_number: "",
    address: "",
    incident_address: "",
    description: "",
  });

  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ["routes"],
    queryFn: () => apiGet("/routes"),
    refetchOnMount: "always",
  });

  const routes = data?.data || [];

  const routeLeadsQuery = useQuery<RouteLeadsResponse>({
    queryKey: ["route-leads", selectedRoute?.id],
    queryFn: () => apiGet(`/routes/${selectedRoute?.id}/leads`),
    enabled: !!selectedRoute?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (routeId: number) => {
      const qs = user?.email ? `?deleted_by=${encodeURIComponent(user.email)}` : "";
      return apiDelete(`/routes/${routeId}${qs}`);
    },
    onSuccess: () => {
      toast.success("Route deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/leads"] });
      if (selectedRoute && selectedRoute.id === deleteId) {
        setSelectedRoute(null);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to delete route: ${error.message}`);
    },
    onSettled: () => {
      setDeleteId(null);
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ caseNumber, action }: { caseNumber: string; action: "CONTACTED" | "CLOSED" }) => {
      const changedBy = user?.email || "system";
      if (action === "CLOSED") {
        return apiPatch(`/lead-states/${caseNumber}/close`, { changedBy });
      }
      return apiPatch(`/lead-states/${caseNumber}/contact`, { changedBy, result: "CONTACTED" });
    },
    onSuccess: () => {
      toast.success("Case updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["route-leads", selectedRoute?.id] });
      queryClient.invalidateQueries({ queryKey: ["delivery-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/leads"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update case.");
    },
  });

  const openLeadDetailsModal = async (lead: RouteLead) => {
    setViewLead(lead);
    setLoadingLeadDetails(true);
    try {
      const details = await apiGet<FullLeadDetails>(`/leads/${lead.case_number}`);
      setFullLeadDetails({ ...lead, ...details });
    } catch (err: any) {
      console.error("Error loading lead details:", err);
      toast.error("Could not load lead details");
    } finally {
      setLoadingLeadDetails(false);
    }
  };

  const handleEdit = (routeId: number) => {
    // Clear any previous editing context so MapView loads fresh from API
    setEditingRoute(null);
    setTimeout(() => setLocation(`/map/${routeId}`), 0);
  };

  const handleDownloadRoutePdf = async (route: Route) => {
    try {
      const [detail, leadsResponse] = await Promise.all([
        apiGet<RouteDetailResponse>(`/routes/${route.id}`),
        apiGet<RouteLeadsResponse>(`/routes/${route.id}/leads`),
      ]);

      const routePoints = Array.isArray(detail?.points) ? detail.points : [];
      const fallbackPoints = (leadsResponse?.data || []).map((lead, idx) => ({
        id: `${route.id}-${lead.case_number || idx}`,
        case_number: lead.case_number,
        address: lead.incident_address || "",
        incident_address: lead.incident_address || "",
      }));

      const points = routePoints.length ? routePoints : fallbackPoints;

      if (!points.length) {
        toast.error("This route has no points to export.");
        return;
      }

      await exportRoutePdf({
        routeName: route.name,
        scheduledOn: route.scheduled_on,
        points,
        leads: leadsResponse?.data || [],
        logoUrl: "/logo.png",
      });

      toast.success(`PDF downloaded for route \"${route.name}\"`);
    } catch (error: any) {
      console.error("Error exporting route PDF:", error);
      toast.error(error?.message || "Could not generate route PDF.");
    }
  };

  const openCreateClientModal = (lead: RouteLead) => {
    setClientToCreate({
      case_number: lead.case_number,
      address: lead.incident_address || "",
      incident_address: lead.incident_address || "",
      description: "",
    });
    setNewClientModalOpen(true);
  };

  const sendToMap = (lead: RouteLead) => {
    const performSend = () => {
      try {
        const existingRaw =
          localStorage.getItem("selectedForMap") ||
          localStorage.getItem("selectedLeadsForMap");
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        
        // Use Map for O(1) lookups instead of O(n²) reduce/some
        const byId = new Map(existing.map((item: any) => [item.id, item]));
        byId.set(toMapItem(lead).id, toMapItem(lead));
        const merged = Array.from(byId.values());

        const payload = JSON.stringify(merged);
        localStorage.setItem("selectedForMap", payload);
        localStorage.setItem("selectedLeadsForMap", payload);
        toast.success(`Case #${lead.case_number} added to map queue.`);
      } catch (err) {
        console.error("Error sending to map:", err);
        toast.error("Error adding case to map.");
      }
    };

    if ((lead.delivery_attempts || 0) >= 2) {
      setConfirmAction({
        title: "Send case to map again",
        description: `Case #${lead.case_number} already had a second attempt. Send to map again and create a new route?`,
        confirmLabel: "Send anyway",
        onConfirm: () => {
          performSend();
          setConfirmAction(null);
        },
      });
      return;
    }

    performSend();
  };

  const handleDeleteConfirm = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const routeLeads = routeLeadsQuery.data?.data || [];
  const filteredRouteLeads = useMemo(() => {
    const q = routeSearch.toLowerCase().trim();
    if (!q) return routeLeads;
    return routeLeads.filter((lead) =>
      String(lead.case_number || "").toLowerCase().includes(q) ||
      String(lead.incident_address || "").toLowerCase().includes(q) ||
      String(lead.current_state || "").toLowerCase().includes(q)
    );
  }, [routeLeads, routeSearch]);

  if (isLoading)
    return <div className="text-center p-8">Loading routes...</div>;
  if (isError)
    return (
      <div className="text-center p-8 text-destructive">
        Failed to load routes.
      </div>
    );

  return (
    <div className="space-y-4">
      <RoutesTable
        routes={routes}
        onEdit={handleEdit}
        onDownload={handleDownloadRoutePdf}
        onSelectRoute={(route) => {
          setSelectedRoute(route);
        }}
        onDeleteRequest={(id) => setDeleteId(id)}
        deleteId={deleteId}
        onDeleteCancel={() => setDeleteId(null)}
        onDeleteConfirm={handleDeleteConfirm}
      />

      <Dialog 
        open={!!selectedRoute} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRoute(null);
          }
        }}
      >
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Route Cases · {selectedRoute?.name || "Route"}</DialogTitle>
            <DialogDescription>
              {routeLeads.length} case{routeLeads.length === 1 ? "" : "s"} in this route.
            </DialogDescription>
          </DialogHeader>

          <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <Input
              value={routeSearch}
              onChange={(e) => setRouteSearch(e.target.value)}
              placeholder="Search by case, address or state..."
              className="max-w-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-center">Case #</th>
                  <th className="px-3 py-2 text-center">Address</th>
                  <th className="px-3 py-2 text-center">State</th>
                  <th className="px-3 py-2 text-center">Sent</th>
                  <th className="px-3 py-2 text-center">2nd Attempt Due</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRouteLeads.map((lead) => (
                  <tr 
                    key={lead.case_number} 
                    className="border-b hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => openLeadDetailsModal(lead)}
                  >
                    <td className="px-3 py-2 text-center font-medium">
                      {lead.case_number}
                    </td>
                    <td className="px-3 py-2 text-center">{lead.incident_address || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline">{lead.current_state || "N/A"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">{fmtDate(lead.sent_to_delivery_date)}</td>
                    <td className="px-3 py-2 text-center">{fmtDate(lead.second_attempt_due_at)}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {lead.current_state === "CONTACTED" ? (
                          <Button size="icon" variant="ghost" title="Mark as Contacted" onClick={() => updateLeadMutation.mutate({ caseNumber: lead.case_number, action: "CONTACTED" })}>
                            <Check className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" title="Mark as Contacted" onClick={() => updateLeadMutation.mutate({ caseNumber: lead.case_number, action: "CONTACTED" })}>
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Create Client" onClick={() => openCreateClientModal(lead)}>
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Send to Map" onClick={() => sendToMap(lead)}>
                          <MapPin className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Close Case"
                          onClick={() => {
                            setConfirmAction({
                              title: "Close case",
                              description: `Are you sure you want to close case #${lead.case_number}?`,
                              confirmLabel: "Close case",
                              destructive: true,
                              onConfirm: () => {
                                updateLeadMutation.mutate({ caseNumber: lead.case_number, action: "CLOSED" });
                                setConfirmAction(null);
                              },
                            });
                          }}
                        >
                          <X className="w-4 h-4 text-rose-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredRouteLeads.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No cases found for this route.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </DialogContent>
      </Dialog>

      {newClientModalOpen && clientToCreate.case_number && (
        <ClientCreateModal
          open={newClientModalOpen}
          onOpenChange={setNewClientModalOpen}
          clientData={clientToCreate}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["route-leads", selectedRoute?.id] })}
        />
      )}

      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmAction?.title || "Confirm action"}
        description={confirmAction?.description || "Are you sure you want to continue?"}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        destructive={!!confirmAction?.destructive}
        onConfirm={() => confirmAction?.onConfirm()}
      />

      <Dialog open={!!viewLead} onOpenChange={(open) => {
        if (!open) {
          setViewLead(null);
          setFullLeadDetails(null);
        }
      }}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader className="mb-3">
            <DialogTitle>Case Details</DialogTitle>
            <DialogDescription>
              Case #{fullLeadDetails?.case_number || viewLead?.case_number || "—"}
            </DialogDescription>
          </DialogHeader>

          {loadingLeadDetails ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Loading details...</p>
            </div>
          ) : fullLeadDetails ? (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-6 mb-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="inspector">Inspector</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="dates">Dates</TabsTrigger>
                <TabsTrigger value="route">Route</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-1">
                <DetailItem label="Case Number">{fullLeadDetails.case_number}</DetailItem>
                <DetailItem label="Address">{fullLeadDetails.incident_address}</DetailItem>
                <DetailItem label="Current State">
                  <Badge variant="outline">{fullLeadDetails.current_state || "—"}</Badge>
                </DetailItem>
              </TabsContent>

              <TabsContent value="inspector" className="space-y-1">
                <DetailItem label="Resolution">
                  {fullLeadDetails.resolution_inspector}
                </DetailItem>
                {fullLeadDetails.description_inspector && (
                  <DetailItem label="Description">
                    {fullLeadDetails.description_inspector}
                  </DetailItem>
                )}
                <DetailItem label="Inspector Date">
                  {fullLeadDetails.created_date_inspector
                    ? new Date(fullLeadDetails.created_date_inspector as any).toLocaleString()
                    : "—"}
                </DetailItem>
              </TabsContent>

              <TabsContent value="general" className="space-y-1">
                <DetailItem label="Channel">{fullLeadDetails.channel}</DetailItem>
                <DetailItem label="Status">{fullLeadDetails.status}</DetailItem>
                {fullLeadDetails.url && (
                  <DetailItem label="URL">
                    <a
                      href={fullLeadDetails.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline break-all"
                    >
                      {fullLeadDetails.url}
                    </a>
                  </DetailItem>
                )}
              </TabsContent>

              <TabsContent value="dates" className="space-y-1">
                <DetailItem label="Created (Local)">
                  {fullLeadDetails.created_date_local
                    ? new Date(fullLeadDetails.created_date_local as any).toLocaleString()
                    : "—"}
                </DetailItem>
                <DetailItem label="Resolve By">
                  {fullLeadDetails.resolve_by_time
                    ? new Date(fullLeadDetails.resolve_by_time as any).toLocaleString()
                    : "—"}
                </DetailItem>
                {fullLeadDetails.contacted_at && (
                  <DetailItem label="Contacted">
                    {new Date(fullLeadDetails.contacted_at as any).toLocaleString()}
                  </DetailItem>
                )}
              </TabsContent>

              <TabsContent value="route" className="space-y-1">
                <DetailItem label="Route Name">
                  {fullLeadDetails.route_name || (fullLeadDetails.assigned_route_id ? `Route ${fullLeadDetails.assigned_route_id}` : "—")}
                </DetailItem>
                <DetailItem label="Sent to Delivery">
                  {fullLeadDetails.sent_to_delivery_date
                    ? new Date(fullLeadDetails.sent_to_delivery_date as any).toLocaleString()
                    : "—"}
                </DetailItem>
                <DetailItem label="Delivery Attempts">
                  <div className="flex items-center gap-2">
                    <span>{fullLeadDetails.delivery_attempts || 0}</span>
                    {(fullLeadDetails.delivery_attempts || 0) >= 2 && (
                      <span className="text-xs text-red-600 font-semibold">(Second Attempt+)</span>
                    )}
                  </div>
                </DetailItem>
                {fullLeadDetails.second_attempt_due_at && (
                  <DetailItem label="Second Attempt Due">
                    {new Date(fullLeadDetails.second_attempt_due_at as any).toLocaleString()}
                  </DetailItem>
                )}
              </TabsContent>

              <TabsContent value="location" className="space-y-1">
                <DetailItem label="State">{fullLeadDetails.state_code_name}</DetailItem>
                <DetailItem label="ZIP Code">{fullLeadDetails.zip_code}</DetailItem>
              </TabsContent>
            </Tabs>
          ) : null}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (fullLeadDetails) {
                  setClientToCreate({
                    case_number: fullLeadDetails.case_number,
                    address: fullLeadDetails.incident_address || "",
                    incident_address: fullLeadDetails.incident_address || "",
                    description: fullLeadDetails.description_inspector || "",
                  });
                  setNewClientModalOpen(true);
                }
              }}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Create Client
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => {
              setViewLead(null);
              setFullLeadDetails(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
