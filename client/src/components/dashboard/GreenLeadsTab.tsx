import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
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

interface GreenLead {
  case_number: string;
  incident_address: string;
  zip_code: string;
  classified_at: string | null;
  days_waiting: number;
}

type SortOption = "days_desc" | "days_asc" | "date_desc" | "date_asc";

export function GreenLeadsTab() {
  const [, setLocation] = useLocation();
  const [leads, setLeads] = useState<GreenLead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [zipFilter, setZipFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("days_desc");
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        zip: zipFilter,
        sort,
      });
      const data = await apiGet<GreenLead[]>(`/dashboard/green-leads?${params.toString()}`);
      setLeads(data);
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

  const handleDelivery = async (caseNumbers: string[]) => {
    try {
      await Promise.all(
        caseNumbers.map((cn) =>
          apiPatch(`/leads/${cn}/delivery`, { delivery_status: "first_sent" })
        )
      );
      setLeads((prev) => prev.filter((l) => !caseNumbers.includes(l.case_number)));
      setSelected((prev) => {
        const next = new Set(prev);
        caseNumbers.forEach((cn) => next.delete(cn));
        return next;
      });
      toast.success(
        caseNumbers.length === 1 ? "Marked as delivery" : `${caseNumbers.length} leads marked as delivery`
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Error marking as delivery");
    }
  };

  const handleRoute = (caseNumbers: string[]) => {
    sessionStorage.setItem("pendingRouteLeads", JSON.stringify(caseNumbers));
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

  const total = leads.length;
  const available = leads.length;

  return (
    <div className="space-y-5">
      {/* Header with count chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Green Leads → Route</h2>
          <p className="text-sm text-muted-foreground">
            Leads clasificados como green listos para delivery/ruta
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Total Green: {total}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-medium border border-blue-200">
            Disponibles: {available}
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Buscar por dirección o case #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={zipFilter}
          onChange={(e) => setZipFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los zipcodes</option>
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
          <option value="days_desc">Más días esperando primero</option>
          <option value="days_asc">Menos días esperando primero</option>
          <option value="date_desc">Clasificado más reciente</option>
          <option value="date_asc">Clasificado más antiguo</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selected.size} seleccionados</span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleDelivery(Array.from(selected))}
              className="px-3 py-1 bg-white text-blue-700 rounded text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              Mark as Delivery
            </button>
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
            No hay green leads disponibles
          </p>
          <p className="text-sm text-muted-foreground">
            Todos los leads han sido enviados a delivery o ruta.
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
                <TableHead>Dirección</TableHead>
                <TableHead>Zipcode</TableHead>
                <TableHead>Clasificado</TableHead>
                <TableHead>Días Esperando</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
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
                        <button
                          onClick={() => handleDelivery([lead.case_number])}
                          className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100 transition-colors"
                        >
                          Delivery
                        </button>
                        <button
                          onClick={() => handleRoute([lead.case_number])}
                          className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
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
    </div>
  );
}
