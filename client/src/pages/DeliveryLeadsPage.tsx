import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Check, Eye, MapPin, RotateCcw, UserPlus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/features/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClientCreateModal, type NewClientData } from "@/components/ClientCreateModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type ApiListResponse = { data: DeliveryLead[] };
type SortField = "case_number" | "incident_address" | "created_date_local" | "sent_to_delivery_date" | "contacted_at" | "route_name" | "current_state";
type SortDir = "asc" | "desc";

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

const isSecondAttempt = (lead: DeliveryLead) => Number(lead.delivery_attempts || 0) >= 2;
const getRouteAttemptNumber = (lead: DeliveryLead) => Math.max(1, Number(lead.delivery_attempts || 1));

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
        onConfirm: () => {
          const existingRaw =
            localStorage.getItem("selectedForMap") ||
            localStorage.getItem("selectedLeadsForMap");
          const existing = existingRaw ? JSON.parse(existingRaw) : [];

          const items = selectedList.map((lead) => ({
            id: `${lead.case_number}-${lead.incident_address || "address"}`,
            case_number: lead.case_number,
            incident_address: lead.incident_address || "",
            address: lead.incident_address || "",
            lat: null,
            lng: null,
          }));

          const merged = [...existing, ...items].reduce((acc: any[], curr: any) => {
            if (!acc.some((x) => x.id === curr.id)) acc.push(curr);
            return acc;
          }, []);

          localStorage.setItem("selectedForMap", JSON.stringify(merged));
          localStorage.setItem("selectedLeadsForMap", JSON.stringify(merged));
          toast.success(`${selectedList.length} case(s) added to map queue.`);
          setSelectedLeads(new Set());
          setConfirmAction(null);
        },
      });
      return;
    }

    const existingRaw =
      localStorage.getItem("selectedForMap") ||
      localStorage.getItem("selectedLeadsForMap");
    const existing = existingRaw ? JSON.parse(existingRaw) : [];

    const items = selectedList.map((lead) => ({
      id: `${lead.case_number}-${lead.incident_address || "address"}`,
      case_number: lead.case_number,
      incident_address: lead.incident_address || "",
      address: lead.incident_address || "",
      lat: null,
      lng: null,
    }));

    const merged = [...existing, ...items].reduce((acc: any[], curr: any) => {
      if (!acc.some((x) => x.id === curr.id)) acc.push(curr);
      return acc;
    }, []);

    localStorage.setItem("selectedForMap", JSON.stringify(merged));
    localStorage.setItem("selectedLeadsForMap", JSON.stringify(merged));
    toast.success(`${selectedList.length} case(s) added to map queue.`);
    setSelectedLeads(new Set());
  };

  const SortHeader = ({ field, title }: { field: SortField; title: string }) => (
    <button
      type="button"
      onClick={() => setSort(field)}
      className="inline-flex items-center justify-center gap-1 font-semibold text-sm w-full"
    >
      <span>{title}</span>
      <ArrowUpDown className="w-4 h-4" />
    </button>
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Delivery Leads</h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v: string) => setMode(v as typeof mode)} className="w-full md:w-auto">
          <TabsList className="mb-0">
            <TabsTrigger value="in-delivery" disabled={showClosed}>In Delivery</TabsTrigger>
            <TabsTrigger value="second-attempt" disabled={showClosed}>Second Attempt Due</TabsTrigger>
            <TabsTrigger value="follow-up" disabled={showClosed}>Follow-up</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button type="button" onClick={copySelectedDetails} disabled={selectedLeads.size === 0} variant="outline">
            Copy ({selectedLeads.size})
          </Button>
          <Button type="button" onClick={sendSelectedToMap} disabled={selectedLeads.size === 0}>
            Send to Map
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by case number or address..."
          className="w-full md:max-w-xs"
        />
      </div>

      <Card className="p-4 overflow-x-auto">
        {isLoading || (showClosed && closedQuery.isLoading) ? (
          <p className="text-sm text-muted-foreground">Loading leads...</p>
        ) : sortedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads found for the current filter.</p>
        ) : (
          <table className="w-full min-w-[700px] table-auto text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-center">
                      <th className="p-3">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={sortedRows.length > 0 && sortedRows.every((lead) => selectedLeads.has(lead.case_number))}
                            onCheckedChange={(chk: unknown) => toggleSelectMany(sortedRows, !!chk)}
                          />
                        </div>
                      </th>
                      <th className="p-3"><SortHeader field="case_number" title="Case #" /></th>
                      <th className="p-3"><SortHeader field="incident_address" title="Address" /></th>
                      <th className="p-3"><SortHeader field="created_date_local" title="Created (Lead)" /></th>
                      <th className="p-3"><SortHeader field="sent_to_delivery_date" title="Sent to Delivery" /></th>
                      <th className="p-3">
                        {mode === "follow-up" ? (
                          <SortHeader field="contacted_at" title="Contact Date" />
                        ) : (
                          <SortHeader field="route_name" title="Route" />
                        )}
                      </th>
                      <th className="p-3"><SortHeader field="current_state" title="State" /></th>
                      <th className="p-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((lead) => (
                      <tr key={lead.case_number} className="border-t hover:bg-muted/30">
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={selectedLeads.has(lead.case_number)}
                              onCheckedChange={(chk: unknown) => toggleSelectOne(lead.case_number, !!chk)}
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center font-medium">
                          {lead.case_number}
                        </td>
                        <td className="p-3 text-center truncate" title={lead.incident_address || "—"}>
                          {lead.incident_address || "—"}
                        </td>
                        <td className="p-3 text-center">{fmtDate(lead.created_date_local)}</td>
                        <td className="p-3 text-center">{fmtDate(lead.sent_to_delivery_date)}</td>
                        <td className="p-3 text-center">
                          {mode === "follow-up" ? (
                            fmtDate(lead.contacted_at)
                          ) : (
                            <>
                              {lead.route_name || (lead.assigned_route_id ? `Route ${lead.assigned_route_id}` : "—")}
                              {isSecondAttempt(lead) ? (
                                <span className="block text-xs font-semibold text-red-600">
                                  Route #{getRouteAttemptNumber(lead)}
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline">{lead.current_state || "N/A"}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2">
                            {!showClosed && mode !== "follow-up" && (
                              <Button size="icon" variant="ghost" title="Mark as Contacted" onClick={() => openContactModal(lead)}>
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            {mode === "follow-up" && !showClosed && (
                              <Button size="icon" variant="ghost" title="View Contact" onClick={() => setViewLead(lead)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            {!showClosed && mode !== "follow-up" && (
                              <Button size="icon" variant="ghost" title={mode === "second-attempt" || isSecondAttempt(lead) ? "Send to Map Again" : "Send to Map"} onClick={() => sendToMap(lead)}>
                                <MapPin className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Create Client" onClick={() => openCreateClientModal(lead)}>
                              <UserPlus className="w-4 h-4" />
                            </Button>
                            {!showClosed ? (
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
                                      closeMutation.mutate({ caseNumber: lead.case_number });
                                      setConfirmAction(null);
                                    },
                                  });
                                }}
                              >
                                <X className="w-4 h-4 text-rose-600" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Reopen to Delivery"
                                onClick={() => reopenMutation.mutate({ caseNumber: lead.case_number })}
                              >
                                <RotateCcw className="w-4 h-4 text-indigo-600" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
        )}
      </Card>

      <div className="pt-2">
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

      <Dialog open={!!viewLead} onOpenChange={(open) => !open && setViewLead(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Contact details</DialogTitle>
            <DialogDescription>
              Case #{viewLead?.case_number || "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Contact date:</span> {fmtDate(viewLead?.contacted_at)}</p>
            <p><span className="font-medium">Name:</span> {viewLead?.contact_name || "—"}</p>
            <p><span className="font-medium">Phone:</span> {viewLead?.contact_phone || "—"}</p>
            <p><span className="font-medium">Note:</span> {viewLead?.contact_note || "—"}</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setViewLead(null)}>Close</Button>
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
    </div>
  );
}
