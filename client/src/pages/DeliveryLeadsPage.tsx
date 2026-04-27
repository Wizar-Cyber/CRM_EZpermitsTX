import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Check, Copy, Eye, MapPin, RotateCcw, Truck, UserPlus, X } from "lucide-react";
import { formatCompactCount } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditingRoute } from "@/features/contexts/EditingRouteContext";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/features/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClientCreateModal, type NewClientData } from "@/components/ClientCreateModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { copyText } from "@/lib/clipboard";

type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

type DeliveryLead = {
  case_number: string;
  incident_address?: string | null;
  current_state?: string | null;
  created_date_local?: string | null;
  sent_to_delivery_date?: string | null;
  contacted_at?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_note?: string | null;
  second_attempt_due_at?: string | null;
  route_name?: string | null;
  delivery_attempts?: number | null;
  assigned_route_id?: number | null;
};

type FullLeadDetails = DeliveryLead & {
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

type ApiListResponse = { data: DeliveryLead[] };
type SortField = "case_number" | "incident_address" | "created_date_local" | "sent_to_delivery_date" | "contacted_at" | "route_name" | "current_state";
type SortDir = "asc" | "desc";

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

const isSecondAttempt = (lead: DeliveryLead) =>
  lead.current_state === 'SECOND_ATTEMPT' || Number(lead.delivery_attempts || 0) >= 2;
const getRouteAttemptNumber = (lead: DeliveryLead) => Math.max(1, Number(lead.delivery_attempts || 1));

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 py-2 border-b border-border/50">
    <dt className="text-sm font-semibold text-muted-foreground sm:col-span-1">{label}</dt>
    <dd className="sm:col-span-3 text-sm">{children || "—"}</dd>
  </div>
);

export default function DeliveryLeadsPage() {
  const [mode, setMode] = useState<"in-delivery" | "second-attempt" | "follow-up">("in-delivery");
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [sortField, setSortField] = useState<SortField>("sent_to_delivery_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactLead, setContactLead] = useState<DeliveryLead | null>(null);
  const [viewLead, setViewLead] = useState<DeliveryLead | null>(null);
  const [fullLeadDetails, setFullLeadDetails] = useState<FullLeadDetails | null>(null);
  const [loadingLeadDetails, setLoadingLeadDetails] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [contactForm, setContactForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_note: "",
  });
  const [clientToCreate, setClientToCreate] = useState<NewClientData>({
    case_number: "",
    address: "",
    incident_address: "",
    description: "",
  });

  const { editingRoute, setEditingRoute } = useEditingRoute();
  const [addCasesToRouteConfirm, setAddCasesToRouteConfirm] = useState<{
    leadIds: string[];
    onConfirm: () => void;
  } | null>(null);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const endpoint =
    mode === "in-delivery"
      ? "/lead-states/in-delivery-no-contact"
      : mode === "second-attempt"
        ? "/lead-states/second-attempt-due"
        : "/lead-states/follow-up";

  const queryKey = useMemo(() => ["delivery-leads", mode], [mode]);

  useEffect(() => {
    if (mode === "follow-up") {
      setSortField("contacted_at");
      setSortDir("desc");
      return;
    }
    setSortField("sent_to_delivery_date");
    setSortDir("desc");
  }, [mode]);

  const closedQuery = useQuery({
    queryKey: ["delivery-leads", "closed"],
    queryFn: () => apiGet<ApiListResponse>("/lead-states/closed"),
    enabled: showClosed,
  });

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiGet<ApiListResponse>(endpoint),
    enabled: !showClosed,
  });

  const contactMutation = useMutation({
    mutationFn: ({
      caseNumber,
      result,
      contact_name,
      contact_phone,
      contact_note,
    }: {
      caseNumber: string;
      result: "CONTACTED";
      contact_name?: string;
      contact_phone?: string;
      contact_note?: string;
    }) =>
      apiPatch(`/lead-states/${caseNumber}/contact`, {
        changedBy: user?.email || "system",
        result,
        contact_name,
        contact_phone,
        contact_note,
      }),
    onSuccess: () => {
      toast.success("Case updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["delivery-leads"] });
      queryClient.invalidateQueries({ queryKey: ["route-leads"] });
      setContactModalOpen(false);
      setContactLead(null);
      setContactForm({ contact_name: "", contact_phone: "", contact_note: "" });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not update case.");
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ caseNumber }: { caseNumber: string }) =>
      apiPatch(`/lead-states/${caseNumber}/close`, {
        changedBy: user?.email || "system",
      }),
    onSuccess: () => {
      toast.success("Case closed successfully.");
      queryClient.invalidateQueries({ queryKey: ["delivery-leads"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not close case.");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({ caseNumber }: { caseNumber: string }) =>
      apiPatch(`/lead-states/${caseNumber}/reopen`, {
        changedBy: user?.email || "system",
      }),
    onSuccess: () => {
      toast.success("Case moved back to Delivery.");
      queryClient.invalidateQueries({ queryKey: ["delivery-leads"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not reopen case.");
    },
  });

  const rows = showClosed ? (closedQuery.data?.data || []) : (data?.data || []);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((lead: DeliveryLead) => {
      return (
        String(lead.case_number || "").toLowerCase().includes(q) ||
        String(lead.incident_address || "").toLowerCase().includes(q) ||
        String(lead.current_state || "").toLowerCase().includes(q) ||
        String(lead.route_name || "").toLowerCase().includes(q) ||
        String(lead.contact_name || "").toLowerCase().includes(q) ||
        String(lead.contact_phone || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const asValue = (lead: DeliveryLead) => {
      if (sortField === "created_date_local") return new Date(lead.created_date_local || 0).getTime();
      if (sortField === "sent_to_delivery_date") return new Date(lead.sent_to_delivery_date || 0).getTime();
      if (sortField === "contacted_at") return new Date(lead.contacted_at || 0).getTime();
      return String((lead as any)[sortField] || "").toLowerCase();
    };
    copy.sort((a, b) => {
      const av = asValue(a) as string | number;
      const bv = asValue(b) as string | number;
      const base = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === "asc" ? base : -base;
    });
    return copy;
  }, [filteredRows, sortField, sortDir]);

  const setSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(
      field === "case_number" || field === "incident_address" || field === "route_name" || field === "current_state"
        ? "asc"
        : "desc"
    );
  };

  const sendToMap = (lead: DeliveryLead) => {
    // Check if a route is currently being edited
    if (editingRoute) {
      // Show confirmation dialog to add to route
      setAddCasesToRouteConfirm({
        leadIds: [lead.case_number],
        onConfirm: () => {
          try {
            // Add case to the editing route
            const address = lead.incident_address || "";
            const newPoint = {
              id: `${lead.case_number}-${address}`,
              case_number: lead.case_number,
              address: address,
              incident_address: address,
              lat: null,
              lng: null,
              description: "",
            };

            // Update the editing route in context with new case
            const updatedRoute = {
              ...editingRoute,
              points: [...(editingRoute.points || []), newPoint],
            };
            setEditingRoute(updatedRoute);

            // Also add to map queue
            const existingRaw =
              localStorage.getItem("selectedForMap") ||
              localStorage.getItem("selectedLeadsForMap");
            const existing = existingRaw ? JSON.parse(existingRaw) : [];

            const item = {
              id: `${lead.case_number}-${address}`,
              case_number: lead.case_number,
              incident_address: address,
              address: address,
              lat: null,
              lng: null,
            };
            const merged = [...existing, item].reduce((acc: any[], curr: any) => {
              if (!acc.some((x) => x.id === curr.id)) acc.push(curr);
              return acc;
            }, []);

            localStorage.setItem("selectedForMap", JSON.stringify(merged));
            localStorage.setItem("selectedLeadsForMap", JSON.stringify(merged));

            toast.success(`Case added to route and map queue.`);
            setAddCasesToRouteConfirm(null);
          } catch (err: any) {
            console.error("Error adding case to route:", err);
            toast.error("Failed to add case to route");
          }
        },
      });
      return;
    }

    const performSend = () => {
      const existingRaw =
        localStorage.getItem("selectedForMap") ||
        localStorage.getItem("selectedLeadsForMap");
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const item = {
        id: `${lead.case_number}-${lead.incident_address || "address"}`,
        case_number: lead.case_number,
        incident_address: lead.incident_address || "",
        address: lead.incident_address || "",
        lat: null,
        lng: null,
      };
      const merged = [...existing, item].reduce((acc: any[], curr: any) => {
        if (!acc.some((x) => x.id === curr.id)) acc.push(curr);
        return acc;
      }, []);

      localStorage.setItem("selectedForMap", JSON.stringify(merged));
      localStorage.setItem("selectedLeadsForMap", JSON.stringify(merged));
      toast.success(`Case #${lead.case_number} added to map queue.`);
    };

    if (isSecondAttempt(lead)) {
      setConfirmAction({
        title: "Send case to map again",
        description: `Case #${lead.case_number} is already on second attempt. Send it to map again and create a new route?`,
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

  const openCreateClientModal = (lead: DeliveryLead) => {
    setClientToCreate({
      case_number: lead.case_number,
      address: lead.incident_address || "",
      incident_address: lead.incident_address || "",
      description: "",
    });
    setNewClientModalOpen(true);
  };

  const openContactModal = (lead: DeliveryLead) => {
    setContactLead(lead);
    setContactForm({
      contact_name: lead.contact_name || "",
      contact_phone: lead.contact_phone || "",
      contact_note: lead.contact_note || "",
    });
    setContactModalOpen(true);
  };

  const openLeadDetailsModal = async (lead: DeliveryLead) => {
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

  const submitContact = () => {
    if (!contactLead) return;
    contactMutation.mutate({
      caseNumber: contactLead.case_number,
      result: "CONTACTED",
      contact_name: contactForm.contact_name,
      contact_phone: contactForm.contact_phone,
      contact_note: contactForm.contact_note,
    });
  };

  const toggleSelectOne = (caseNumber: string, checked: boolean) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (checked) next.add(caseNumber);
      else next.delete(caseNumber);
      return next;
    });
  };

  const toggleSelectMany = (list: DeliveryLead[], checked: boolean) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      list.forEach((lead) => {
        if (checked) next.add(lead.case_number);
        else next.delete(lead.case_number);
      });
      return next;
    });
  };

  const copySelectedDetails = async () => {
    const selectedList = sortedRows.filter((lead) => selectedLeads.has(lead.case_number));
    if (!selectedList.length) return;

    const formatted = selectedList
      .map(
        (lead) =>
          `Case: ${lead.case_number}\nAddress: ${lead.incident_address || "N/A"}\nState: ${lead.current_state || "N/A"}\nRoute: ${lead.route_name || (lead.assigned_route_id ? `Route ${lead.assigned_route_id}` : "N/A")}\nSent: ${fmtDate(lead.sent_to_delivery_date)}`
      )
      .join("\n\n---\n\n");

    const copied = await copyText(formatted);
    if (copied) toast.success("Copied!");
    else toast.error("Could not copy on this browser context.");
  };

  const sendSelectedToMap = () => {
    const selectedList = sortedRows.filter((lead) => selectedLeads.has(lead.case_number));
    if (!selectedList.length) return;

    const hasSecondAttempt = selectedList.some((lead) => isSecondAttempt(lead));
    if (hasSecondAttempt) {
      setConfirmAction({
        title: "Send selected cases to map",
        description: "Some selected cases are already on second attempt. Send all selected cases to map anyway?",
        confirmLabel: "Send all",
        onConfirm: () => performSendToMap(selectedList),
      });
      return;
    }

    performSendToMap(selectedList);
  };

  const performSendToMap = (selectedList: DeliveryLead[]) => {
    // Check if a route is currently being edited
    if (editingRoute) {
      // Show confirmation dialog in English
      setAddCasesToRouteConfirm({
        leadIds: selectedList.map(l => l.case_number),
        onConfirm: () => {
          try {
            // Add cases to the editing route
            const newPoints = selectedList.map(l => {
              const address = l.incident_address || "";
              return {
                id: `${l.case_number}-${address}`,
                case_number: l.case_number,
                address: address,
                incident_address: address,
                lat: null,
                lng: null,
                description: "",
              };
            });

            // Update the editing route in context with new cases
            const updatedRoute = {
              ...editingRoute,
              points: [...(editingRoute.points || []), ...newPoints],
            };
            setEditingRoute(updatedRoute);

            // Also add to map queue for map page
            const existingRaw =
              localStorage.getItem("selectedForMap") ||
              localStorage.getItem("selectedLeadsForMap");
            const existing = existingRaw ? JSON.parse(existingRaw) : [];

            const newItems = selectedList.map((lead) => ({
              id: `${lead.case_number}-${lead.incident_address || "address"}`,
              case_number: lead.case_number,
              incident_address: lead.incident_address || "",
              address: lead.incident_address || "",
              lat: null,
              lng: null,
            }));

            const byId = new Map(existing.map((item: any) => [item.id, item]));
            newItems.forEach((item) => byId.set(item.id, item));
            const merged = Array.from(byId.values());

            const payload = JSON.stringify(merged);
            localStorage.setItem("selectedForMap", payload);
            localStorage.setItem("selectedLeadsForMap", payload);

            toast.success(`${selectedList.length} case(s) added to route and map queue.`);
            setSelectedLeads(new Set());
            setConfirmAction(null);
            setAddCasesToRouteConfirm(null);
          } catch (err) {
            console.error("Error adding cases to route:", err);
            toast.error("Error adding cases to route.");
          }
        },
      });
    } else {
      // No route being edited - just send to map normally
      try {
        const existingRaw =
          localStorage.getItem("selectedForMap") ||
          localStorage.getItem("selectedLeadsForMap");
        const existing = existingRaw ? JSON.parse(existingRaw) : [];

        const newItems = selectedList.map((lead) => ({
          id: `${lead.case_number}-${lead.incident_address || "address"}`,
          case_number: lead.case_number,
          incident_address: lead.incident_address || "",
          address: lead.incident_address || "",
          lat: null,
          lng: null,
        }));

        // Use Map for O(1) lookups (same pattern as LeadsTable)
        const byId = new Map(existing.map((item: any) => [item.id, item]));
        newItems.forEach((item) => byId.set(item.id, item));
        const merged = Array.from(byId.values());

        const payload = JSON.stringify(merged);
        localStorage.setItem("selectedForMap", payload);
        localStorage.setItem("selectedLeadsForMap", payload);
        
        toast.success(`${selectedList.length} case(s) added to map queue.`);
        setSelectedLeads(new Set());
        setConfirmAction(null);
      } catch (err) {
        console.error("Error sending to map:", err);
        toast.error("Error adding cases to map.");
      }
    }
  };

  const SortHeader = ({ field, title }: { field: SortField; title: string }) => (
    <button
      type="button"
      onClick={() => setSort(field)}
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:text-white transition-colors cursor-pointer"
    >
      <span>{title}</span>
      <ArrowUpDown className="w-3 h-3 opacity-60" />
    </button>
  );

  return (
    <div className="w-full space-y-0">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#103360] to-[#1565c0] rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-5 h-5 opacity-80" />
              <span className="text-sm font-medium opacity-80 uppercase tracking-widest">Field Operations</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Delivery Leads</h1>
            <p className="text-blue-100 mt-1 text-sm">
              Manage leads in delivery, follow-up and second attempts
            </p>
          </div>
          <div className="bg-white/15 rounded-xl px-4 py-2.5 text-center border border-white/20">
            <p className="text-xl font-bold">{formatCompactCount(sortedRows.length)}</p>
            <p className="text-xs opacity-75 mt-0.5 flex items-center gap-1 justify-center">
              <Truck className="w-3 h-3" /> {showClosed ? "Closed" : "Cases"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs and Bulk Actions - Same Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        {/* Tabs (pill style) */}
        <Tabs value={mode} onValueChange={(v: string) => setMode(v as typeof mode)} className="w-full md:w-auto">
          <TabsList className="rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger
              value="in-delivery"
              disabled={showClosed}
              className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
            >
              In Delivery
            </TabsTrigger>
            <TabsTrigger
              value="second-attempt"
              disabled={showClosed}
              className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
            >
              Second Attempt Due
            </TabsTrigger>
            <TabsTrigger
              value="follow-up"
              disabled={showClosed}
              className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
            >
              Follow-up
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Bulk actions */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={copySelectedDetails}
            disabled={selectedLeads.size === 0}
            variant="outline"
            size="sm"
            className="text-xs cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy ({selectedLeads.size})
          </Button>
          <Button
            type="button"
            size="sm"
            className="text-xs cursor-pointer"
            onClick={sendSelectedToMap}
            disabled={selectedLeads.size === 0}
          >
            <MapPin className="w-3.5 h-3.5 mr-1.5" /> Send to Map
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row justify-between gap-3 mb-6">
        <div className="relative max-w-xs w-full">
          <Input
            placeholder="Search case number or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      {isLoading || (showClosed && closedQuery.isLoading) ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
          <p className="text-sm text-slate-400">Loading leads...</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 to-slate-700">
                <th className="p-4 w-10">
                  <Checkbox
                    checked={sortedRows.length > 0 && sortedRows.every((lead) => selectedLeads.has(lead.case_number))}
                    onCheckedChange={(chk: unknown) => toggleSelectMany(sortedRows, !!chk)}
                    className="border-slate-400 data-[state=checked]:bg-white data-[state=checked]:text-slate-800"
                  />
                </th>
                <th className="p-4 text-left"><SortHeader field="case_number" title="Case #" /></th>
                <th className="p-4 text-left"><SortHeader field="incident_address" title="Address" /></th>
                <th className="p-4 text-left"><SortHeader field="created_date_local" title="Created" /></th>
                <th className="p-4 text-left"><SortHeader field="sent_to_delivery_date" title="Sent to Delivery" /></th>
                <th className="p-4 text-left">
                  {mode === "follow-up" ? (
                    <SortHeader field="contacted_at" title="Contact Date" />
                  ) : (
                    <SortHeader field="route_name" title="Route" />
                  )}
                </th>
                <th className="p-4 text-left"><SortHeader field="current_state" title="State" /></th>
                <th className="p-4 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((lead, idx) => (
                <tr
                  key={lead.case_number}
                  className={`border-t border-slate-100 dark:border-slate-800 transition-colors cursor-pointer ${
                    idx % 2 === 0
                      ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      : "bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                  onClick={() => openLeadDetailsModal(lead)}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedLeads.has(lead.case_number)}
                      onCheckedChange={(chk: unknown) => toggleSelectOne(lead.case_number, !!chk)}
                    />
                  </td>
                  <td className="p-4 font-semibold text-sm text-slate-800 dark:text-slate-200">
                    {lead.case_number}
                  </td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400 max-w-[220px] truncate" title={lead.incident_address || "—"}>
                    {lead.incident_address || "—"}
                  </td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{fmtDate(lead.created_date_local)}</td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{fmtDate(lead.sent_to_delivery_date)}</td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                    {mode === "follow-up" ? (
                      fmtDate(lead.contacted_at)
                    ) : (
                      <>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {lead.route_name || (lead.assigned_route_id ? `Route ${lead.assigned_route_id}` : "—")}
                        </span>
                        {isSecondAttempt(lead) ? (
                          <span className="block text-xs font-semibold text-rose-600 mt-0.5">
                            Route #{getRouteAttemptNumber(lead)}
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                      {lead.current_state || "N/A"}
                    </Badge>
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {!showClosed && mode !== "follow-up" && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                          title="Mark as Contacted"
                          onClick={() => openContactModal(lead)}
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </Button>
                      )}
                      {mode === "follow-up" && !showClosed && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                          title="View details"
                          onClick={() => setViewLead(lead)}
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </Button>
                      )}
                      {!showClosed && mode !== "follow-up" && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                          title={mode === "second-attempt" || isSecondAttempt(lead) ? "Send to Map Again" : "Send to Map"}
                          onClick={() => sendToMap(lead)}
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                        title="Create Client"
                        onClick={() => openCreateClientModal(lead)}
                      >
                        <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                      </Button>
                      {!showClosed ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          title="Close Case"
                          onClick={() => {
                            setConfirmAction({
                              title: "Close case",
                              description: `Are you sure you want to close case #${lead.case_number}?`,
                              confirmLabel: "Close case",
                              destructive: true,
                              onConfirm: () => {
                                closeMutation.mutate({ caseNumber: lead.case_number });
                                setConfirmAction(null);
                              },
                            });
                          }}
                        >
                          <X className="w-3.5 h-3.5 text-rose-600" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer"
                          title="Reopen to Delivery"
                          onClick={() => reopenMutation.mutate({ caseNumber: lead.case_number })}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 text-sm">
                    No leads match your current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-4">
        <Button
          variant={showClosed ? "default" : "outline"}
          className="w-full"
          onClick={() => setShowClosed((v) => !v)}
        >
          {showClosed ? "Back to Active Delivery Cases" : "Closed Cases"}
        </Button>
      </div>

      {newClientModalOpen && clientToCreate.case_number && (
        <ClientCreateModal
          open={newClientModalOpen}
          onOpenChange={setNewClientModalOpen}
          clientData={clientToCreate}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["delivery-leads"] })}
        />
      )}

      <Dialog
        open={contactModalOpen}
        onOpenChange={(open) => {
          setContactModalOpen(open);
          if (!open) {
            setContactLead(null);
            setContactForm({ contact_name: "", contact_phone: "", contact_note: "" });
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Mark as Contacted</DialogTitle>
            <DialogDescription>
              Add optional contact details for case #{contactLead?.case_number || "—"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Contact name (optional)"
              value={contactForm.contact_name}
              onChange={(e) => setContactForm((prev) => ({ ...prev, contact_name: e.target.value }))}
            />
            <Input
              placeholder="Phone (optional)"
              value={contactForm.contact_phone}
              onChange={(e) => setContactForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
            />
            <Textarea
              placeholder="Note (optional)"
              value={contactForm.contact_note}
              onChange={(e) => setContactForm((prev) => ({ ...prev, contact_note: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setContactModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitContact} disabled={contactMutation.isPending}>
              {contactMutation.isPending ? "Saving..." : "Save and mark contacted"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullLeadDetails && !!viewLead} onOpenChange={(open) => {
        if (!open) {
          setViewLead(null);
          setFullLeadDetails(null);
        }
      }}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              Case #{fullLeadDetails?.case_number || "—"}
            </DialogDescription>
          </DialogHeader>

          {loadingLeadDetails ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Loading details...</p>
            </div>
          ) : fullLeadDetails ? (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="inspector">Inspector</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="dates">Dates</TabsTrigger>
                <TabsTrigger value="route">Route</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-3">
                <DetailItem label="Case Number">{fullLeadDetails.case_number}</DetailItem>
                <DetailItem label="Address">{fullLeadDetails.incident_address}</DetailItem>
                <DetailItem label="Current State">
                  <Badge variant="outline">{fullLeadDetails.current_state || "—"}</Badge>
                </DetailItem>
                <DetailItem label="Route">
                  {fullLeadDetails.route_name || (fullLeadDetails.assigned_route_id ? `Route ${fullLeadDetails.assigned_route_id}` : "—")}
                </DetailItem>
                {fullLeadDetails.delivery_attempts ? (
                  <DetailItem label="Delivery Attempts">
                    <div className="flex items-center gap-2">
                      <span>{fullLeadDetails.delivery_attempts}</span>
                      {fullLeadDetails.delivery_attempts >= 2 && (
                        <span className="text-xs text-red-600 font-semibold">(Second Attempt+)</span>
                      )}
                    </div>
                  </DetailItem>
                ) : null}
              </TabsContent>

              <TabsContent value="inspector" className="space-y-3">
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

              <TabsContent value="general" className="space-y-3">
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

              <TabsContent value="dates" className="space-y-3">
                <DetailItem label="Created (Local)">
                  {fullLeadDetails.created_date_local
                    ? new Date(fullLeadDetails.created_date_local as any).toLocaleString()
                    : "—"}
                </DetailItem>
                <DetailItem label="Sent to Delivery">
                  {fullLeadDetails.sent_to_delivery_date
                    ? new Date(fullLeadDetails.sent_to_delivery_date as any).toLocaleString()
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

              <TabsContent value="route" className="space-y-3">
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

              <TabsContent value="location" className="space-y-3">
                <DetailItem label="State">{fullLeadDetails.state_code_name}</DetailItem>
                <DetailItem label="ZIP Code">{fullLeadDetails.zip_code}</DetailItem>
              </TabsContent>
            </Tabs>
          ) : null}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFullLeadDetails(null) || openCreateClientModal(viewLead!)}
            >
              <UserPlus className="w-4 h-4 mr-2" /> Create Client
            </Button>
            <Button type="button" variant="destructive" onClick={() => {
              setViewLead(null);
              setFullLeadDetails(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Add Cases to Route Dialog */}
      <AlertDialog open={!!addCasesToRouteConfirm} onOpenChange={(open) => {
        if (!open) setAddCasesToRouteConfirm(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Cases to Route</AlertDialogTitle>
            <AlertDialogDescription>
              Currently editing route <strong>{editingRoute?.name}</strong>. Add {addCasesToRouteConfirm?.leadIds.length || 0} cases to this route?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => addCasesToRouteConfirm?.onConfirm()}>
              Add Cases
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
