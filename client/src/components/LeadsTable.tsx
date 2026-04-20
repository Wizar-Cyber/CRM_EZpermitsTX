import { useState, useMemo } from "react";
import { Eye, MapPin, ArrowUpDown, Copy, Trash2, RotateCcw, X, Save, UserPlus } from "lucide-react"; 
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; 
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

// ✅ helpers con token
import { apiGet as appGet, apiPost as appPost, apiDelete as appDelete, API_BASE_URL } from "@/lib/api";

// **********************************
// === API FUNCTIONS (wrapper a helpers con token) ===
// **********************************

// Implementación local de PATCH con token
async function appPatch(path: string, body?: any) {
  const token = localStorage.getItem("authToken");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return {};
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const method = (options.method || "GET").toUpperCase();

  const mapToHelperPath = (u: string) => {
    if (u === "/") return "/clientes"; // POST /
    if (u.startsWith("/validate-case/")) return `/clientes${u}`; // /clientes/validate-case/...
    if (u.startsWith("/api/")) return u.slice(4); // quita /api
    return u; // /leads, /clientes, etc.
  };

  const path = mapToHelperPath(url);

  const parseBody = () => {
    if (!options.body) return undefined;
    try { return JSON.parse(options.body as string); } catch { return undefined; }
  };

  if (method === "GET") return appGet(path);
  if (method === "POST") return appPost(path, parseBody());
  if (method === "PATCH") return appPatch(path, parseBody());
  if (method === "DELETE") return appDelete(path);
  return appGet(path as any);
}

const apiGet = async (url: string) => apiFetch(url, { method: 'GET' });
const apiPost = async (url: string, data: any) => apiFetch(url, { method: 'POST', body: JSON.stringify(data) });
const apiPatch = async (url: string, data: any) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(data) });
// =========================================================

// Required types for ClientModal
interface Client {
  id: number;
  fullname: string;
  email?: string;
  phone?: string;
  address?: string;
  type: string;
  status: string;
  priority: string;
  source?: string;
  assigned_name?: string;
  case_number?: string;
  description?: string;
  created_at?: string;
}

type NewClientData = {
  case_number: string;
  address: string;
  description: string;
  incident_address: string;
};

const NOOP = () => {}; 

// ClientModal Component
function ClientModal({ open, onOpenChange, clientData, onSuccess = NOOP }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  clientData: NewClientData; 
  onSuccess?: () => void;
}) {
  const defaultClientState = useMemo(() => ({
    fullname: "",
    email: "",
    phone: "",
    address: clientData.address || clientData.incident_address || "",
    source: "",
    case_number: clientData.case_number || "",
    description: clientData.description || "",
    type: "new", 
    status: "pending", 
    priority: "medium",
  }), [clientData]);
  
  const [client, setClient] = useState(defaultClientState);
  const [isLoading, setIsLoading] = useState(false);

  useMemo(() => {
    if (open) {
      setClient(defaultClientState);
    }
  }, [open, defaultClientState]);

  const handleValidateCase = async () => {
    if (!client.case_number.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiGet(`/validate-case/${client.case_number}`); 
      if ((res as any).valid && (res as any).description) {
        setClient((prev) => ({ ...prev, description: (res as any).description }));
        toast.success("Case found and description loaded.");
      } else {
        setClient((prev) => ({ ...prev, description: "" }));
        toast.error((res as any).message || "Case not found.");
      }
    } catch (err: any) {
      console.error("❌ Error validating case:", err);
      toast.error(`Error validating case: ${err.message}`);
      setClient((prev) => ({ ...prev, description: "" }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!client.fullname.trim()) return toast.error("Full name required");
    setIsLoading(true);
    try {
      await apiPost("/", client); 
      toast.success(`Client ${client.fullname} created successfully.`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("❌ Error creating client:", err.message);
      toast.error(`Error creating client: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Evita autofocus para que no “pegue” la dirección en el buscador */}
      <DialogContent
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          {/* 🔧 Quitamos la X manual para evitar doble botón de cierre */}
          <DialogTitle className="flex items-center justify-between">
            Add Client
          </DialogTitle>
          <DialogDescription>
            Create a new client record, pre-filled from Lead #{clientData.case_number}.
          </DialogDescription>
        </DialogHeader>

        {/* Evita submit por Enter dentro del modal */}
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-3 py-4">
            <Input
              placeholder="Full name (Required)"
              value={client.fullname}
              onChange={(e) => setClient({ ...client, fullname: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              required
            />
            <Input
              placeholder="Email"
              type="email"
              value={client.email}
              onChange={(e) => setClient({ ...client, email: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <Input
              placeholder="Phone"
              type="tel"
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <Input
              placeholder="Address"
              value={client.address}
              onChange={(e) => setClient({ ...client, address: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <Input
              placeholder="Source"
              value={client.source}
              onChange={(e) => setClient({ ...client, source: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />

            <div className="flex items-center gap-2">
              <Input
                placeholder="Case number"
                value={client.case_number}
                onChange={(e) =>
                  setClient({ ...client, case_number: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
              <Button 
                type="button"
                variant="outline" 
                onClick={handleValidateCase} 
                disabled={isLoading || !client.case_number.trim()}
              >
                {isLoading ? "Validating..." : "Validate"}
              </Button>
            </div>

            <Textarea
              placeholder="Description / Case Info (loaded from Lead or Case validation)"
              value={client.description}
              onChange={(e) => setClient({ ...client, description: e.target.value })}
              className="bg-muted text-foreground min-h-[100px]"
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isLoading || !client.fullname.trim()}>
              <Save className="w-4 h-4 mr-1" /> {isLoading ? "Saving..." : "Save Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 py-2 border-b border-border/50">
    <dt className="text-sm font-semibold text-muted-foreground sm:col-span-1">{label}</dt>
    <dd className="sm:col-span-3 text-sm">{children || "—"}</dd>
  </div>
);

export function LeadsTable() {
  const queryClient = useQueryClient(); 

  // pestañas de la página
  const [pageTab, setPageTab] = useState<"activos" | "clasificados">("activos");

  const statusColors = {
    GREEN: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    YELLOW: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    RED: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
    BLUE: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    DEFAULT: "bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700",
  };

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

  async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      if (!address?.trim()) return null;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data?.[0]) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  }

  const [selected, setSelected] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>("created_date_local");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [colorFilter, setColorFilter] = useState<string | null>(null);
    
  // --- States for the new Client Modal ---
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [clientToCreate, setClientToCreate] = useState<NewClientData>({
    case_number: "",
    address: "",
    description: "",
    incident_address: "",
  });
  // ---

  // helper con token
  const { data, isLoading, refetch } = useQuery<{ data: Lead[] }>({
    queryKey: ["/leads"],
    queryFn: async () => appGet("/leads"),
  });
  const leads = data?.data || [];

  // === SMART CLASSIFICATION (fallback) ===
  const normalizeText = (s?: string | null) =>
    (s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, " ")
      .replace(/[-_/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const anyMatch = (text: string, patterns: (string | RegExp)[]) =>
    patterns.some((p) => (typeof p === "string" ? text.includes(p) : p.test(text)));

  const NEGATIVE = [
    "task is closed","case closed","active project","already permitted",
    "permit approved","permit issued","permitted project",
    "referred to the structural","referred to structural","referred to electrical",
    "not investigate","no action required","duplicate case","duplicate request",
    "referred to","duplicate of case","voided","case cancelled","investigation closed",
    "unable to verify","not found","resolved previously","compliant","work completed",
    "no violation found","case closed as permitted","closed by inspector","issue resolved",
    "duplicate complaint","invalid report","no further action","owner obtained permit",
    "existing permit","no violation","not a building code violation"
  ];

  const ILLEGAL = [
    "unpermitted work","unpermitted","illegal","unauthorized",
    "no permit","no permits","building without permit", /no\s+\w*\s*permits?/
  ];

  const SAFETY = [
    "unsafe","unsafe condition","structural","rotten wood","electrical hazard", /wires?\s+for\s+electric/
  ];

  const POSITIVE_STRONG = [
    "site visit","site visit was conducted","inspection conducted","inspection complete",
    "1st notice","first notice","first inspection","field inspection","visit conducted",
    "red tag","red-tag","notice of violation","citation issued","126 hold placed",
    "stop work","violation observed","non-compliance",
    "construction observed","new construction","structure built","addition built",
    "remodeling","deck built","roof extension","illegal addition","attached structure",
    "foundation poured","footing installed","new wall built","driveway installed","garage addition"
  ];

  const FOLLOW_UP = [
    "follow up inspection","follow-up scheduled","reinspection","pending inspection",
    "awaiting reinspection","awaiting compliance","awaiting correction",
    "still active","open violation","compliance pending","awaiting resolution",
    "further inspection required"
  ];

  const NEUTRAL_REVIEW = [
    "pending assignment","awaiting assignment","inspection scheduled","pending response",
    "refer to supervisor","pending validation","waiting for response","forwarded to inspector",
    "information requested","awaiting documentation","awaiting owner response",
    "forwarded to department","referred to another division","escalated for review"
  ];

  const scoreTweaks = (t: string) => {
    let s = 0;
    if (t.includes("inspected") || t.includes("inspection conducted")) s += 1;
    if (t.includes("red tag") || t.includes("red-tag")) s += 3;
    if (t.includes("awaiting compliance")) s += 2;
    if (t.includes("closed")) s -= 2;
    if (t.includes("permit issued")) s -= 3;
    return s;
  };

  const NEW_CONSTRUCTION = [
    "foundation","new house","addition","garage","deck","roof","driveway",
  ];

  const getLeadClassification = (lead: Lead) => {
    const text = normalizeText(
      [lead.description, lead.resolution, lead.latest_case_notes, (lead as any).resolution_inspector].join(" ")
    );

    let baseScore = 0;
    let color: keyof typeof statusColors = "DEFAULT";
    let tag = "Unclassified";

    if (anyMatch(text, NEGATIVE))                { color = "RED";    tag = "Closed / Resolved";   baseScore = 0; }
    else if (anyMatch(text, ILLEGAL))            { color = "GREEN";  tag = "Illegal Work";        baseScore = 8; }
    else if (anyMatch(text, SAFETY))             { color = "GREEN";  tag = "Structural Concern";  baseScore = 7; }
    else if (anyMatch(text, POSITIVE_STRONG))    { color = "GREEN";  tag = "Active Violation";    baseScore = 6; }
    else if (anyMatch(text, FOLLOW_UP))          { color = "BLUE";   tag = "Active Follow-up";    baseScore = 5; }
    else if (anyMatch(text, NEUTRAL_REVIEW))     { color = "YELLOW"; tag = "Pending Review";      baseScore = 4; }
    else if (anyMatch(text, NEW_CONSTRUCTION))   { color = "GREEN";  tag = "New Construction";    baseScore = 5; }

    const s = Math.max(0, Math.min(10, baseScore + scoreTweaks(text)));
    return { color, tag, score: s };
  };

  // 👉 Si existe manual_classification en DB, usarlo como color/filtro; si no, fallback al smart
  const classifyLead = (lead: Lead): keyof typeof statusColors => {
    const manual = (((lead as any).manual_classification || "") as string).toUpperCase();
    if (["GREEN","YELLOW","BLUE","RED"].includes(manual)) return manual as keyof typeof statusColors;
    return getLeadClassification(lead).color;
  };

  // === Pestañas por manual_classification (no depende de consulta)
  const MANUAL_SET = new Set(["green","yellow","blue"]);
  const activeBase = leads.filter((l: any) => !MANUAL_SET.has(((l as any).manual_classification || "").toLowerCase()));
  const classifiedBase = leads.filter((l: any) => MANUAL_SET.has(((l as any).manual_classification || "").toLowerCase()));

  const sortAndFilter = (list: Lead[]) => {
    if (!list.length) return [];
    const searchLower = searchTerm.toLowerCase();

    const filtered = list
      .filter(
        (l) =>
          l.case_number?.toString().toLowerCase().includes(searchLower) ||
          l.incident_address?.toLowerCase().includes(searchLower)
      )
      .filter((l) => (colorFilter ? classifyLead(l) === colorFilter : true))
      .sort((a, b) => {
        const aVal = (a[sortField as keyof Lead] as any)?.toString?.().toLowerCase?.() ?? "";
        const bVal = (b[sortField as keyof Lead] as any)?.toString?.().toLowerCase?.() ?? "";
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });

    // Resueltos al final (si consulta fue marcada roja)
    return filtered.sort((a, b) => {
      const aResolved =
        (a as any).consulta === "red" || localStorage.getItem(`resolved_${a.case_number}`) === "true";
      const bResolved =
        (b as any).consulta === "red" || localStorage.getItem(`resolved_${b.case_number}`) === "true";
      return aResolved === bResolved ? 0 : aResolved ? 1 : -1;
    });
  };

  const sortedLeads = useMemo(() => sortAndFilter(activeBase), [leads, sortField, sortDirection, searchTerm, colorFilter]);
  const sortedClassifiedLeads = useMemo(() => sortAndFilter(classifiedBase), [leads, sortField, sortDirection, searchTerm, colorFilter]);

  const toggleSelectAll = (checked: boolean, list: Lead[]) =>
    setSelected(checked ? list.map((l) => l.case_number) : []);
  const toggleSelectOne = (id: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));

  const toMapItem = (l: Lead, coords?: { lat: number; lng: number } | null): MapItem => ({
    id: `${l.case_number}-${l.incident_address}`,
    case_number: l.case_number,
    incident_address: l.incident_address,
    address: l.incident_address,
    lat: (l as any).lat ?? coords?.lat ?? null,
    lng: (l as any).lng ?? coords?.lng ?? null,
  });

  const sendOne = async (lead: Lead) => {
    const coords = await geocodeAddress(lead.incident_address);
    mergeSelectedForMap([toMapItem(lead, coords)]);
    toast.success(`Sent ${lead.case_number} to map.`);
  };

  const sendMany = async (arr: Lead[]) => {
    const mapped = await Promise.all(
      arr.map(async (l) => toMapItem(l, await geocodeAddress(l.incident_address)))
    );
    mergeSelectedForMap(mapped);
    toast.success(`${arr.length} sent to map.`);
    setSelected([]);
  };

  const copySelectedDetails = () => {
    const selectedLeads = leads.filter((l) => selected.includes(l.case_number));
    const formatted = selectedLeads
      .map(
        (l) =>
          `Case: ${l.case_number}\nAddress: ${l.incident_address}\nStatus: ${l.status}\nDescription: ${
            l.description || "N/A"
          }\nResolution: ${l.resolution || "N/A"}`
      )
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(formatted);
    toast.success("Copied!");
  };

  // --- Abrir modal de cliente ---
  const handleOpenCreateClientModal = (lead: Lead) => {
    setClientToCreate({
      case_number: lead.case_number,
      address: lead.incident_address || "",
      incident_address: lead.incident_address || "", 
      description: lead.description || "",
    });
    setNewClientModalOpen(true);
  };

  // --- Mutations: manual_classification & consulta(red) ---

  // (A) Actualiza SOLO manual_classification (green/yellow/blue)
  const updateLeadManualClassificationMutation = useMutation({
    mutationFn: async (vars: { caseNumber: string; manual: "green" | "yellow" | "blue" | null }) => {
      const url = `/leads/${vars.caseNumber}/manual_classification`;
      await apiPatch(url, { manual_classification: vars.manual });
    },
    onSuccess: () => {
      toast.success(`Manual classification updated.`);
      queryClient.invalidateQueries({ queryKey: ["/leads"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Error updating manual classification");
    }
  });

  // (B) Solo para ROJO: cambia consulta = 'red' (no toca manual_classification)
  const updateLeadConsultationMutation = useMutation({
    mutationFn: async (vars: { caseNumber: string; consulta: "red" | null; localStorageKey?: string }) => {
      if (vars.localStorageKey) {
        if (vars.consulta === "red") {
          localStorage.setItem(vars.localStorageKey, "true");
        } else {
          localStorage.removeItem(vars.localStorageKey);
        }
      }
      const url = `/leads/${vars.caseNumber}/consulta`;
      await apiPatch(url, { consulta: vars.consulta });
    },
    onSuccess: (_, variables) => {
      if (variables.consulta === "red") {
        toast.success(`Case #${variables.caseNumber} marked as resolved.`);
      } else {
        toast.success(`Case #${variables.caseNumber} classification reverted.`);
      }
      // ❌ no cambiar de pestaña automáticamente
      setModalLead(null);
      queryClient.invalidateQueries({ queryKey: ["/leads"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Error updating case status in database");
    }
  });

  const handleSetManualClassification = (lead: Lead, manual: "green" | "yellow" | "blue") => {
    updateLeadManualClassificationMutation.mutate({
      caseNumber: lead.case_number,
      manual
    });
  };

  const handleSetRedConsultation = (lead: Lead) => {
    if (!confirm("Confirm to mark this case as resolved?")) return;
    updateLeadConsultationMutation.mutate({
      caseNumber: lead.case_number,
      consulta: "red",
      localStorageKey: `resolved_${lead.case_number}`,
    });
  };

  const handleRevertClassification = (lead: Lead) => {
    if (!confirm(`Confirm to revert the RED state of case #${lead.case_number}?`)) return;
    updateLeadConsultationMutation.mutate({
      caseNumber: lead.case_number,
      consulta: null,
      localStorageKey: `resolved_${lead.case_number}`,
    });
  };

  const handleDeleteLead = async (caseNumber: string) => {
    if (!confirm("Delete this lead?")) return;
    try {
      await apiFetch(`/api/leads/${caseNumber}`, { method: "DELETE" });
      toast.success("Lead deleted successfully");
      refetch();
    } catch (err: any) {
      console.error("❌ Error deleting lead:", err.message);
      toast.error(`Error deleting lead: ${err.message}`);
    }
  };

  if (isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  // === Encabezado y filtros (compartidos por ambas pestañas) ===
  const HeaderAndFilters = ({ list }: { list: Lead[] }) => (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {pageTab === "activos" ? "Active Leads" : "Classified Leads"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{list.length} records</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={copySelectedDetails} disabled={!selected.length} variant="outline" size="sm" className="text-xs cursor-pointer">
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy ({selected.length})
          </Button>
          <Button
            type="button"
            size="sm"
            className="text-xs cursor-pointer"
            onClick={() => sendMany(list.filter((l) => selected.includes(l.case_number)))}
            disabled={!selected.length}
          >
            <MapPin className="w-3.5 h-3.5 mr-1.5" /> Send to Map
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Input
            placeholder="Search case number or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: null, label: "All", bg: "bg-slate-100 dark:bg-slate-800", active: "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900", dot: null },
            { key: "GREEN", label: "Active", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", active: "bg-emerald-600 text-white", dot: "bg-emerald-500" },
            { key: "BLUE", label: "Follow-up", bg: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", active: "bg-blue-600 text-white", dot: "bg-blue-500" },
            { key: "YELLOW", label: "Pending", bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", active: "bg-amber-500 text-white", dot: "bg-amber-400" },
            { key: "RED", label: "Resolved", bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400", active: "bg-rose-600 text-white", dot: "bg-rose-500" },
          ].map(({ key, label, bg, active, dot }) => (
            <button
              key={key ?? "all"}
              type="button"
              onClick={() => setColorFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                colorFilter === key
                  ? `${active} border-transparent shadow-sm`
                  : `${bg} border-transparent hover:opacity-80`
              }`}
            >
              {dot && <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />}
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const Table = ({ list }: { list: Lead[] }) => (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-gradient-to-r from-slate-800 to-slate-700">
            <th className="p-4 w-10">
              <Checkbox
                checked={selected.length === list.length && !!list.length}
                onCheckedChange={(chk) => toggleSelectAll(!!chk, list)}
                className="border-slate-400 data-[state=checked]:bg-white data-[state=checked]:text-slate-800"
              />
            </th>
            {["case_number", "incident_address", "status", "tag_score", "channel"].map((col) => (
              <th key={col} className="p-4 text-left">
                <button
                  onClick={() => {
                    if (col !== "tag_score") {
                      if (sortField === col)
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      else setSortField(col);
                    }
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  {col === "tag_score"
                    ? "Classification"
                    : col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  {col !== "tag_score" && <ArrowUpDown className="w-3 h-3 opacity-60" />}
                </button>
              </th>
            ))}
            <th className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((lead, idx) => {
            const auto = getLeadClassification(lead);
            const manualKey = (((lead as any).manual_classification || "") as string).toUpperCase();
            const colorKey = (["GREEN","YELLOW","BLUE","RED"].includes(manualKey) ? manualKey : auto.color) as keyof typeof statusColors;

            const isResolved =
              (lead as any).consulta === "red" ||
              localStorage.getItem(`resolved_${lead.case_number}`) === "true";
            return (
              <tr
                key={lead.case_number}
                className={`border-t border-slate-100 dark:border-slate-800 transition-colors cursor-pointer ${
                  isResolved
                    ? "opacity-50 bg-slate-50 dark:bg-slate-900/50"
                    : idx % 2 === 0
                    ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    : "bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(lead.case_number)}
                    onCheckedChange={(chk) =>
                      toggleSelectOne(lead.case_number, chk as boolean)
                    }
                  />
                </td>
                <td className="p-4 font-semibold text-sm text-slate-800 dark:text-slate-200" onClick={() => setModalLead(lead)}>{lead.case_number}</td>
                <td className="p-4 text-sm text-slate-500 dark:text-slate-400 max-w-[220px] truncate" onClick={() => setModalLead(lead)}>{lead.incident_address}</td>
                <td className="p-4" onClick={() => setModalLead(lead)}>
                  <Badge className={`${statusColors[colorKey]} rounded-full px-2.5 py-0.5 text-[11px] font-medium`}>
                    {lead.status || "—"}
                  </Badge>
                </td>
                <td className="p-4 text-sm" onClick={() => setModalLead(lead)}>
                  <div className="font-medium text-slate-700 dark:text-slate-300">{auto.tag}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Score: {auto.score}/10</div>
                </td>
                <td className="p-4 text-sm text-slate-500 dark:text-slate-400" onClick={() => setModalLead(lead)}>{lead.channel || "—"}</td>
                <td className="p-4">
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" onClick={() => setModalLead(lead)} title="View Details">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer" onClick={() => sendOne(lead)} title="Send to Map">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                      onClick={() => handleOpenCreateClientModal(lead)}
                      title="Create Client"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
          {list.length === 0 && (
            <tr>
              <td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                No leads match your current filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full">
      <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as any)} className="w-full">
        <TabsList className="mb-5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <TabsTrigger value="activos" className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700">
            Active Leads
          </TabsTrigger>
          <TabsTrigger value="clasificados" className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700">
            Classified Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="space-y-4">
          <HeaderAndFilters list={sortedLeads} />
          <Table list={sortedLeads} />
        </TabsContent>

        <TabsContent value="clasificados" className="space-y-4">
          <HeaderAndFilters list={sortedClassifiedLeads} />
          <Table list={sortedClassifiedLeads} />
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      {modalLead && (
        <Dialog open={!!modalLead} onOpenChange={() => setModalLead(null)}>
          {/* Previene autofocus extraño */}
          <DialogContent
            className="max-w-3xl bg-card"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Case #{modalLead.case_number}
              </DialogTitle>
              <DialogDescription>
                {modalLead.ava_case_type} — {modalLead.status}
              </DialogDescription>
            </DialogHeader>

            {/* Tabs internas del modal de detalle */}
            <Tabs defaultValue="details" className="mt-4">
              <TabsList>
                {["details", "inspector", "general", "dates", "location"].map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {tab.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="details">
                <DetailItem label="Description">{modalLead.description}</DetailItem>
                <DetailItem label="Latest Notes">
                  {modalLead.latest_case_notes}
                </DetailItem>
                <DetailItem label="Resolution">{modalLead.resolution}</DetailItem>
              </TabsContent>
              <TabsContent value="inspector">
                <DetailItem label="Inspector Description">
                  {modalLead.description_inspector}
                </DetailItem>
                <DetailItem label="Inspector Resolution">
                  {modalLead.resolution_inspector}
                </DetailItem>
                <DetailItem label="Inspector Date">
                  {modalLead.created_date_inspector
                    ? new Date(modalLead.created_date_inspector as any).toLocaleString()
                    : "—"}
                </DetailItem>
                <DetailItem label="URL">
                  {modalLead.url ? (
                    <a
                      href={modalLead.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline break-all"
                    >
                      {modalLead.url}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailItem>
              </TabsContent>
              <TabsContent value="general">
                <DetailItem label="Address">{modalLead.incident_address}</DetailItem>
                <DetailItem label="Channel">{modalLead.channel}</DetailItem>
              </TabsContent>
              <TabsContent value="dates">
                <DetailItem label="Created (Local)">
                  {modalLead.created_date_local
                    ? new Date(modalLead.created_date_local as any).toLocaleString()
                    : "—"}
                </DetailItem>
                <DetailItem label="Resolve By">
                  {modalLead.resolve_by_time}
                </DetailItem>
              </TabsContent>
              <TabsContent value="location">
                <DetailItem label="State">
                  {modalLead.state_code_name}
                </DetailItem>
                <DetailItem label="ZIP Code">{modalLead.zip_code}</DetailItem>
              </TabsContent>
            </Tabs>

            {/* Clasificación y cerrar */}
            <DialogFooter className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                {/* GREEN / BLUE / YELLOW -> manual_classification (no toca consulta) */}
                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-700 p-0"
                  title="Mark as Green (Manual)"
                  onClick={() => handleSetManualClassification(modalLead, "green")}
                  disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                >
                  <div className="h-4 w-4 rounded-full bg-emerald-600"></div>
                </Button>

                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 p-0"
                  title="Mark as Blue (Manual)"
                  onClick={() => handleSetManualClassification(modalLead, "blue")}
                  disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                >
                  <div className="h-4 w-4 rounded-full bg-blue-600"></div>
                </Button>

                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-amber-500 hover:bg-amber-600 p-0"
                  title="Mark as Yellow (Manual)"
                  onClick={() => handleSetManualClassification(modalLead, "yellow")}
                  disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                >
                  <div className="h-4 w-4 rounded-full bg-amber-500"></div>
                </Button>

                {/* RED -> consulta = 'red' */}
                {((modalLead as any).consulta !== "red" && localStorage.getItem(`resolved_${modalLead.case_number}`) !== "true") && (
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-rose-600 hover:bg-rose-700 p-0"
                    title="Mark as Resolved (consulta='red')"
                    onClick={() => handleSetRedConsultation(modalLead)}
                    disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                  >
                    <div className="h-4 w-4 rounded-full bg-rose-600"></div>
                  </Button>
                )}

                {(((modalLead as any).consulta === "red") || localStorage.getItem(`resolved_${modalLead.case_number}`) === "true") && (
                  <>
                    <div className="flex items-center text-sm text-red-600 font-semibold">
                      Manually set as RED
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-3"
                      title="Revert RED state"
                      onClick={() => handleRevertClassification(modalLead)}
                      disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                    >
                      <RotateCcw className="w-4 h-4 mr-2 text-blue-500" /> Revert RED
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  type="button"
                  onClick={() => handleOpenCreateClientModal(modalLead)}
                  title="Create Client Record"
                  variant="secondary"
                  disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Create Client
                </Button>

                <Button type="button" variant="destructive" onClick={() => setModalLead(null)}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* CLIENT MODAL */}
      {newClientModalOpen && clientToCreate.case_number && (
        <ClientModal
          open={newClientModalOpen}
          onOpenChange={setNewClientModalOpen}
          clientData={clientToCreate}
          onSuccess={refetch} 
        />
      )}
    </div>
  );
}
