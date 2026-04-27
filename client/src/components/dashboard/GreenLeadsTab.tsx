import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiPatch } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GreenLead {
  case_number: string;
  incident_address: string;
  zip_code: string;
  classified_at: string | null;
  days_waiting: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface GreenLeadsResponse {
  total: number;
  available: number;
  leads: GreenLead[];
}

type SortOption = "days_desc" | "days_asc" | "date_desc" | "date_asc";

interface FullLeadDetails extends GreenLead {
  created_date_local?: string | null;
  created_date_inspector?: string | null;
  resolution_inspector?: string | null;
  description_inspector?: string | null;
  resolve_by_time?: string | null;
  state_code_name?: string | null;
  channel?: string | null;
  url?: string | null;
  status?: string | null;
}

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 py-2 border-b border-border/50">
    <dt className="text-sm font-semibold text-muted-foreground sm:col-span-1">{label}</dt>
    <dd className="sm:col-span-3 text-sm">{children || "—"}</dd>
  </div>
);

export function GreenLeadsTab() {
  const [, setLocation] = useLocation();
  const [leads, setLeads] = useState<GreenLead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [zipFilter, setZipFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("days_desc");
  const [loading, setLoading] = useState(false);
  const [viewLead, setViewLead] = useState<GreenLead | null>(null);
  const [fullLeadDetails, setFullLeadDetails] = useState<FullLeadDetails | null>(null);
  const [loadingLeadDetails, setLoadingLeadDetails] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, zip: zipFilter, sort });
      const data = await apiGet<GreenLeadsResponse>(`/dashboard/green-leads?${params.toString()}`);
      setLeads(data.leads ?? []);
      setTotalCount(data.total ?? 0);
      setAvailableCount(data.available ?? 0);
    } catch (err: any) {
      toast.error(err?.message ?? "Error loading green leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, zipFilter, sort]);

  const uniqueZips = useMemo(
    () => Array.from(new Set(leads.map((l) => l.zip_code).filter(Boolean))).sort(),
    [leads]
  );

  const handleRoute = (caseNumbers: string[]) => {
    // MapView lee de localStorage con key "selectedLeadsForMap"
    // Formato esperado: Array<{id, address, case_number, lat?, lng?}>
    const points = leads
      .filter((l) => caseNumbers.includes(l.case_number))
      .map((l) => ({
        id: l.case_number,
        address: l.incident_address,
        case_number: l.case_number,
        lat: l.lat ?? null,
        lng: l.lng ?? null,
      }));
    localStorage.setItem("selectedLeadsForMap", JSON.stringify(points));
    setLocation("/map");
  };

  const toggleSelect = (cn: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cn)) next.delete(cn);
      else next.add(cn);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.case_number)));
    }
  };

  const openLeadDetailsModal = async (lead: GreenLead) => {
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

  return (
    <div className="space-y-5">
      {/* Header with count chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Green Leads → Route</h2>
          <p className="text-sm text-muted-foreground">
            Leads manually classified as green since April 20 — ready for delivery/route
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Total Green: {totalCount}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-medium border border-blue-200">
            Available: {availableCount}
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search by address or case #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={zipFilter}
          onChange={(e) => setZipFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All zipcodes</option>
          {uniqueZips.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="days_desc">Most days waiting first</option>
          <option value="days_asc">Least days waiting first</option>
          <option value="date_desc">Most recently classified</option>
          <option value="date_asc">Oldest classified</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleRoute(Array.from(selected))}
              className="px-3 py-1 bg-blue-800 text-white rounded text-xs font-semibold hover:bg-blue-900 transition-colors"
            >
              Send to Route →
            </button>
          </div>
        </div>
      )}

      {/* Table or empty state */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400" />
          <p className="text-base font-medium text-foreground">
            No green leads available
          </p>
          <p className="text-sm text-muted-foreground">
            All leads have been sent to delivery or route.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === leads.length && leads.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Case #</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Zipcode</TableHead>
                <TableHead>Classified</TableHead>
                <TableHead>Days Waiting</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const isSelected = selected.has(lead.case_number);
                const isPriority = lead.days_waiting > 10;
                return (
                  <TableRow
                    key={lead.case_number}
                    className={isSelected ? "bg-blue-50 dark:bg-blue-950/20" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(lead.case_number)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-muted rounded border border-border">
                        {lead.case_number}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">
                      {lead.incident_address}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-medium border border-blue-200">
                        {lead.zip_code}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.classified_at
                        ? format(new Date(lead.classified_at), "MMM d, yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-bold text-sm ${
                          isPriority ? "text-orange-600" : "text-foreground"
                        }`}
                      >
                        {lead.days_waiting}d
                      </span>
                      {isPriority && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold border border-orange-200">
                          prioritize
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1.5 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openLeadDetailsModal(lead)}
                          className="h-8 px-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                          title="View case details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <button
                          onClick={() => handleRoute([lead.case_number])}
                          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
                        >
                          Route →
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Loading details...</p>
            </div>
          ) : fullLeadDetails ? (
            <div className="space-y-4">
              <div className="space-y-0">
                <DetailItem label="Case #">{fullLeadDetails.case_number}</DetailItem>
                <DetailItem label="Address">{fullLeadDetails.incident_address}</DetailItem>
                <DetailItem label="State">{fullLeadDetails.state_code_name || "—"}</DetailItem>
                <DetailItem label="Zip Code">{fullLeadDetails.zip_code}</DetailItem>
                <DetailItem label="Channel">{fullLeadDetails.channel || "—"}</DetailItem>
                <DetailItem label="Classification Date">
                  {fullLeadDetails.classified_at
                    ? new Date(fullLeadDetails.classified_at).toLocaleString()
                    : "—"}
                </DetailItem>
                <DetailItem label="Created">{fullLeadDetails.created_date_local
                    ? new Date(fullLeadDetails.created_date_local).toLocaleString()
                    : "—"}</DetailItem>
                <DetailItem label="Resolve By">{fullLeadDetails.resolve_by_time
                    ? new Date(fullLeadDetails.resolve_by_time).toLocaleString()
                    : "—"}</DetailItem>
                <DetailItem label="Status">{fullLeadDetails.status || "—"}</DetailItem>
                <DetailItem label="Description">{fullLeadDetails.description_inspector || "—"}</DetailItem>
                <DetailItem label="Resolution">{fullLeadDetails.resolution_inspector || "—"}</DetailItem>
                <DetailItem label="URL">
                  {fullLeadDetails.url ? (
                    <a href={fullLeadDetails.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-xs">
                      {fullLeadDetails.url}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailItem>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No details available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

