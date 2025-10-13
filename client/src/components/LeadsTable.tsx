import { useState, useMemo } from "react";
import { Eye, MapPin, CheckCircle, ArrowUpDown, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Lead } from "@shared/schema";

// Componente auxiliar para mostrar detalles en el modal
const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 py-2 border-b border-border/50">
    <dt className="text-sm font-semibold text-muted-foreground sm:col-span-1">{label}</dt>
    <dd className="sm:col-span-3 text-sm">{children || "—"}</dd>
  </div>
);

export function LeadsTable() {
  // 🎨 Colores de Estado
  const statusColors = {
    GREEN: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    YELLOW: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    RED: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    DEFAULT: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  };

  // 🧭 Tipos y funciones para el mapa
  type MapItem = {
    id: string;
    case_number: string;
    incident_address: string;
    address: string;
    lat: number | null;
    lng: number | null;
  };

  function readSelectedForMap(): MapItem[] {
    try {
      const raw = localStorage.getItem("selectedForMap");
      return raw ? (JSON.parse(raw) as MapItem[]) : [];
    } catch {
      return [];
    }
  }
  function writeSelectedForMap(items: MapItem[]) {
    localStorage.setItem("selectedForMap", JSON.stringify(items));
  }
  function mergeSelectedForMap(newOnes: MapItem[]) {
    const byId = new Map<string, MapItem>();
    [...readSelectedForMap(), ...newOnes].forEach((it) => byId.set(it.id, it));
    writeSelectedForMap([...byId.values()]);
  }

  // 🌍 Geocodificación simple
  async function geocodeAddress(
    address: string
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      if (!address?.trim()) return null;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}&limit=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || !data[0]) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch {
      return null;
    }
  }

  // Hooks de estado del componente
  const [selected, setSelected] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>("created_date_local");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  // Hook para obtener los datos
  const { data, isLoading } = useQuery<{ data: Lead[] }>({
    queryKey: ["/api/leads"],
    queryFn: async () => {
      const res = await fetch("http://localhost:4000/api/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const leads = data?.data || [];

  // Función para clasificar leads por color
  const classifyLead = (lead: Lead): keyof typeof statusColors => {
    const text = `${lead.status} ${lead.latest_case_notes} ${lead.description}`.toLowerCase();
    if (text.includes("contract") || text.includes("signed")) return "GREEN";
    if (text.includes("inspection") || text.includes("awaiting")) return "YELLOW";
    if (text.includes("not interested") || text.includes("closed")) return "RED";
    return "DEFAULT";
  };

  // Lógica de filtrado, búsqueda y ordenamiento
  const sortedLeads = useMemo(() => {
    if (!leads.length) return [];
    
    const filteredLeads = leads
      .filter((lead) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          lead.case_number.toLowerCase().includes(searchLower) ||
          lead.incident_address.toLowerCase().includes(searchLower)
        );
      })
      .filter((lead) => {
        if (!colorFilter) return true;
        return classifyLead(lead) === colorFilter;
      });

    return [...filteredLeads].sort((a, b) => {
      const aVal = (a[sortField as keyof Lead] as any)?.toString().toLowerCase?.() ?? "";
      const bVal = (b[sortField as keyof Lead] as any)?.toString().toLowerCase?.() ?? "";
      return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [leads, sortField, sortDirection, searchTerm, colorFilter]);

  // Funciones de acción
  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? sortedLeads.map((l) => l.case_number) : []);
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };
  
  const toMapItem = (l: Lead, coords?: { lat: number; lng: number } | null): MapItem => ({
    id: `${l.case_number}-${l.incident_address}`,
    case_number: l.case_number,
    incident_address: l.incident_address,
    address: l.incident_address,
    lat: typeof l.lat === "number" ? l.lat : coords?.lat ?? null,
    lng: typeof l.lng === "number" ? l.lng : coords?.lng ?? null,
  });

  const sendOne = async (lead: Lead) => {
    let coords: { lat: number; lng: number } | null = null;
    if (typeof lead.lat !== "number" || typeof lead.lng !== "number") {
      coords = await geocodeAddress(lead.incident_address);
    }
    mergeSelectedForMap([toMapItem(lead, coords)]);
    toast.success(`Sent 1 case to the map.`);
  };

  const sendMany = async (leads: Lead[]) => {
    if (!leads.length) return;
    const results: MapItem[] = [];
    for (const l of leads) {
      let coords: { lat: number; lng: number } | null = null;
      if (typeof l.lat !== "number" || typeof l.lng !== "number") {
        coords = await geocodeAddress(l.incident_address);
      }
      results.push(toMapItem(l, coords));
    }
    mergeSelectedForMap(results);
    toast.success(`Sent ${leads.length} cases to the map.`);
    setSelected([]);
  };

  const copySelectedDetails = () => {
    if (selected.length === 0) return;
    const selectedLeads = leads.filter(l => selected.includes(l.case_number));
    const formattedText = selectedLeads.map(lead => 
      `Case Number: ${lead.case_number}\nAddress: ${lead.incident_address}\nStatus: ${lead.status}\nDescription: ${lead.description || 'N/A'}\nResolution: ${lead.resolution || 'N/A'}`
    ).join('\n\n---\n\n');
    
    navigator.clipboard.writeText(formattedText).then(() => {
      toast.success(`${selectedLeads.length} case(s) copied to clipboard!`);
      setSelected([]); // Deselecciona los items después de copiar
    }).catch(() => toast.error('Failed to copy details.'));
  };

  const formatHeader = (header: string) => {
    return header
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  if (isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Leads</h2>
        <div className="flex items-center gap-2">
            <Button onClick={copySelectedDetails} disabled={selected.length === 0} variant="outline" className="rounded-2xl">
                <Copy className="w-4 h-4 mr-2"/> Copy Details ({selected.length})
            </Button>
            <Button onClick={() => sendMany(leads.filter((l) => selected.includes(l.case_number)))} disabled={selected.length === 0} className="rounded-2xl">
                <MapPin className="w-4 h-4 mr-2" /> Send to Map ({selected.length})
            </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <Input placeholder="Search by case number or address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-full md:max-w-xs" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Filter by:</span>
          <Button size="sm" variant={!colorFilter ? 'secondary' : 'ghost'} onClick={() => setColorFilter(null)}>All</Button>
          <Button size="sm" variant={colorFilter === 'GREEN' ? 'secondary' : 'ghost'} onClick={() => setColorFilter('GREEN')} className="text-emerald-700">Green</Button>
          <Button size="sm" variant={colorFilter === 'YELLOW' ? 'secondary' : 'ghost'} onClick={() => setColorFilter('YELLOW')} className="text-amber-700">Yellow</Button>
          <Button size="sm" variant={colorFilter === 'RED' ? 'secondary' : 'ghost'} onClick={() => setColorFilter('RED')} className="text-rose-700">Red</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4">
                <Checkbox
                  checked={selected.length === sortedLeads.length && sortedLeads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              {["case_number", "incident_address", "status", "ava_case_type", "channel"].map((col) => (
                <th key={col} className="p-4 text-left">
                  <button
                    onClick={() => {
                        if (sortField === col) {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                        } else {
                            setSortField(col);
                            setSortDirection("asc");
                        }
                    }}
                    className="flex items-center gap-2 font-semibold text-sm hover:underline"
                  >
                    {formatHeader(col)}
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
              ))}
              <th className="p-4 text-left font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map((lead) => {
              const color = classifyLead(lead);
              return (
                <tr
                  key={lead.case_number}
                  className={`border-t border-border hover:bg-muted/40 ${
                    selected.includes(lead.case_number) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="p-4">
                    <Checkbox
                      checked={selected.includes(lead.case_number)}
                      onCheckedChange={(checked) =>
                        toggleSelectOne(lead.case_number, checked as boolean)
                      }
                    />
                  </td>
                  <td className="p-4 font-medium">{lead.case_number}</td>
                  <td className="p-4 text-muted-foreground">{lead.incident_address}</td>
                  <td className="p-4">
                    <Badge className={`${statusColors[color]} rounded-full px-3 py-1`}>
                      {lead.status || "—"}
                    </Badge>
                  </td>
                  <td className="p-4">{lead.ava_case_type || "—"}</td>
                  <td className="p-4">{lead.channel || "—"}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setModalLead(lead)} className="rounded-lg">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => sendOne(lead)} className="rounded-lg">
                        <MapPin className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalles del Lead */}
      {modalLead && (
        <Dialog open={!!modalLead} onOpenChange={() => setModalLead(null)}>
          <DialogContent className="max-w-3xl bg-card">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Case #{modalLead.case_number}
              </DialogTitle>
              <DialogDescription>
                {modalLead.ava_case_type} — {modalLead.status}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="details" className="mt-4">
              <TabsList>
                {["details", "general", "dates", "location"].map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {tab.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="details" className="mt-4">
                  <DetailItem label="Description">{modalLead.description}</DetailItem>
                  <DetailItem label="Latest Notes">{modalLead.latest_case_notes}</DetailItem>
                  <DetailItem label="Resolution">{modalLead.resolution}</DetailItem>
              </TabsContent>

              <TabsContent value="general" className="mt-4">
                  <DetailItem label="Address">{modalLead.incident_address}</DetailItem>
                  <DetailItem label="Channel">{modalLead.channel}</DetailItem>
              </TabsContent>

              <TabsContent value="dates" className="mt-4">
                  <DetailItem label="Created (Local)">{modalLead.created_date_local ? new Date(modalLead.created_date_local).toLocaleString() : '—'}</DetailItem>
                  <DetailItem label="Resolve By">{modalLead.resolve_by_time}</DetailItem>
              </TabsContent>

              <TabsContent value="location" className="mt-4">
                  <DetailItem label="State">{modalLead.state_code_name}</DetailItem>
                  <DetailItem label="ZIP Code">{modalLead.zip_code}</DetailItem>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
                <Button variant="destructive" onClick={() => setModalLead(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}