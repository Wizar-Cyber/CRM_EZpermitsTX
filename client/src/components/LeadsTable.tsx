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
  const [pageTab, setPageTab] = useState<"activos" | "clasificados" | "red">("activos");

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
  const [sortField, setSortField] = useState<string>("created_date_inspector");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [hasInspectorNoteFilter, setHasInspectorNoteFilter] = useState(false);
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
    
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

  // === SMART CLASSIFICATION v2 ===
  // Regla 0: sin inspector resolution → score 0, sin clasificar
  // Regla 1: negación contextual antes de keywords positivas → descalifica
  // Regla 2: frases completas ponderadas, no tokens aislados
  // Regla 3: inspector resolution tiene peso 3x vs descripción ciudadana

  const norm = (s?: string | null) =>
    (s || "").toLowerCase().normalize("NFKD")
      .replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  // Detecta si una frase aparece precedida por negación en ventana de 4 palabras
  const negated = (text: string, phrase: string): boolean => {
    const idx = text.indexOf(phrase);
    if (idx === -1) return false;
    const window = text.slice(Math.max(0, idx - 40), idx);
    return /\b(no|not|without|never|ninguna?|sin|never|isn t|wasn t|didn t|cannot|can t)\b/.test(window);
  };

  const phraseMatch = (text: string, phrases: string[]): string | null => {
    for (const p of phrases) if (text.includes(p)) return p;
    return null;
  };

  // ── DISQUALIFIERS (inspector resolution dice que no hay oportunidad) ──────
  // Frases que el inspector usa para cerrar sin acción de roofing/permitting
  const DISQ_INSPECTOR: string[] = [
    "this task is closed",
    "task is closed",
    "active project with permit",
    "active project with multiple permits",
    "permitted project",
    "this is a permitted project",
    "permit bought",
    "already permitted",
    "permit approved",
    "permit issued",
    "owner obtained permit",
    "existing permit",
    "no violation",
    "no violation found",
    "not a building code violation",
    "not a bcv",
    "this is not a building code",
    "case closed",
    "case is closed",
    "investigation closed",
    "referred to structural dept",
    "referred to the structural",
    "referred to electrical",
    "occupancy complaint",
    "please make 311 complaint with occupancy",
    "minimum standards",
    "dept of neighborhood",
    "not a building",
    "no action required",
    "no further action",
    "duplicate case",
    "duplicate complaint",
    "voided",
    "case cancelled",
    "resolved previously",
    "issue resolved",
    "work completed",
    "service completed",           // cuando viene con cierre definitivo
    "compliant",
    "invalid report",
    "unable to verify",
    "insufficient information to investigate",
  ];

  // "service completed" solo descalifica cuando va seguido de cierre explícito
  const isServiceCompletedDisq = (inspRes: string): boolean => {
    if (!inspRes.includes("service completed")) return false;
    return DISQ_INSPECTOR.some((d) => d !== "service completed" && inspRes.includes(d));
  };

  // ── STRONG POSITIVE (inspector confirma violación activa) ─────────────────
  const INSP_GREEN_PHRASES: string[] = [
    "active ongoing investigation",
    "active/ongoing investigation",
    "follow up is scheduled",
    "follow-up is scheduled",
    "red tag",
    "red-tag",
    "stop work order",
    "stop work",
    "notice of violation",
    "citation issued",
    "126 hold",
    "non-compliance confirmed",
    "violation confirmed",
    "violation found",
    "violation observed",
    "illegal construction confirmed",
    "unpermitted work confirmed",
    "referred to enforcement",
  ];

  // ── MODERATE POSITIVE (inspector menciona inspección de campo pendiente) ──
  const INSP_BLUE_PHRASES: string[] = [
    "follow up inspection",
    "follow-up inspection",
    "reinspection",
    "pending inspection",
    "awaiting compliance",
    "awaiting correction",
    "open violation",
    "compliance pending",
    "further inspection required",
    "will be inspected",
    "inspection scheduled",
    "assign to i",           // "assign to i36" → asignado a inspector
  ];

  // ── CITIZEN DESCRIPTION: señales de obra sin permiso ─────────────────────
  // Solo cuentan si NO hay inspector resolution que los descarte
  const DESC_STRONG: string[] = [
    "without a permit", "without permit", "without permits",
    "no permit", "no permits", "no visible permit",
    "unpermitted work", "unpermitted construction", "unpermitted",
    "building without permit", "work without permit",
    "illegal addition", "illegal construction", "unauthorized construction",
    "red tag", "red-tag",
    "foundation poured", "footing installed",
    "construction without",
  ];

  const DESC_MODERATE: string[] = [
    "no permit posted", "permit not posted", "permit not visible",
    "structural work", "electrical work without", "plumbing without",
    "new construction", "addition to the house", "adding to the house",
    "garage addition", "deck built", "roof extension",
    "demolition without", "digging without",
    "unsafe condition", "unsafe structure", "unsafe building",
    "electrical hazard", "rotten wood", "structural concern",
    "setback violation", "setback rule", "setback problem",
    "deed restricted", "code violation confirmed",
  ];

  const getLeadClassification = (lead: Lead) => {
    const inspRes  = norm((lead as any).resolution_inspector);
    const inspDesc = norm((lead as any).description_inspector);
    const desc     = norm(lead.description);
    const res      = norm(lead.resolution);
    const notes    = norm(lead.latest_case_notes);

    const hasInspectorResolution = inspRes.length > 5;

    // ── Regla 0: sin inspector resolution → no clasificar ────────────────
    if (!hasInspectorResolution) {
      // Excepción: descripción ciudadana muy fuerte (red tag confirmado, etc.)
      const descMatch = phraseMatch(desc + " " + notes, DESC_STRONG);
      if (descMatch && !negated(desc, descMatch)) {
        return { color: "YELLOW" as keyof typeof statusColors, tag: "Unverified Report", score: 2 };
      }
      return { color: "DEFAULT" as keyof typeof statusColors, tag: "No Inspector Review", score: 0 };
    }

    // ── Regla 1: inspector dice que está cerrado / no hay oportunidad ─────
    const isDisq = isServiceCompletedDisq(inspRes)
      || DISQ_INSPECTOR.filter(d => d !== "service completed").some(d => inspRes.includes(d));

    if (isDisq) {
      return { color: "DEFAULT" as keyof typeof statusColors, tag: "Closed / No Opportunity", score: 0 };
    }

    // ── Regla 2: inspector confirma violación activa (GREEN) ──────────────
    const greenMatch = phraseMatch(inspRes, INSP_GREEN_PHRASES);
    if (greenMatch) {
      let score = 8;
      if (inspRes.includes("red tag") || inspRes.includes("stop work")) score = 10;
      if (inspRes.includes("follow up is scheduled") || inspRes.includes("active/ongoing")) score = 9;
      return { color: "GREEN" as keyof typeof statusColors, tag: "Active Investigation", score };
    }

    // ── Regla 3: inspector asignó seguimiento (BLUE) ──────────────────────
    const blueMatch = phraseMatch(inspRes + " " + inspDesc, INSP_BLUE_PHRASES);
    if (blueMatch) {
      const score = inspRes.includes("awaiting compliance") ? 7 : 6;
      return { color: "BLUE" as keyof typeof statusColors, tag: "Inspector Follow-up", score };
    }

    // ── Regla 4: inspector respondió pero sin cierre ni confirmación ──────
    // → evaluar descripción ciudadana para ver si vale la pena
    const descAll = desc + " " + notes;
    const strongDescMatch = phraseMatch(descAll, DESC_STRONG);
    if (strongDescMatch && !negated(descAll, strongDescMatch)) {
      return { color: "YELLOW" as keyof typeof statusColors, tag: "Pending Verification", score: 4 };
    }
    const modDescMatch = phraseMatch(descAll, DESC_MODERATE);
    if (modDescMatch && !negated(descAll, modDescMatch)) {
      return { color: "YELLOW" as keyof typeof statusColors, tag: "Possible Violation", score: 3 };
    }

    // ── Sin señales suficientes ───────────────────────────────────────────
    return { color: "DEFAULT" as keyof typeof statusColors, tag: "Low Signal", score: 1 };
  };

  // 👉 Si existe manual_classification en DB, usarlo como color/filtro; si no, fallback al smart
  const classifyLead = (lead: Lead): keyof typeof statusColors => {
    const manual = (((lead as any).manual_classification || "") as string).toUpperCase();
    if (["GREEN","YELLOW","BLUE","RED"].includes(manual)) return manual as keyof typeof statusColors;
    return getLeadClassification(lead).color;
  };

  // === Pestañas por manual_classification (no depende de consulta)
  const MANUAL_SET = new Set(["green","yellow","blue"]);
  const RED_SET   = new Set(["red"]);
  const isRedLead = (l: any) =>
    RED_SET.has(((l as any).manual_classification || "").toLowerCase()) ||
    (l as any).consulta === "red" ||
    localStorage.getItem(`resolved_${l.case_number}`) === "true";
  const activeBase     = leads.filter((l: any) => {
    const mc = ((l as any).manual_classification || "").toLowerCase();
    return !MANUAL_SET.has(mc) && !isRedLead(l);
  });
  const classifiedBase = leads.filter((l: any) => {
    const mc = ((l as any).manual_classification || "").toLowerCase();
    return MANUAL_SET.has(mc) && !isRedLead(l);
  });
  const redBase = leads.filter((l: any) => isRedLead(l));

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
      .filter((l) => hasInspectorNoteFilter ? !!(l.description_inspector || l.resolution_inspector) : true)
      .filter((l) => minScoreFilter > 0 ? getLeadClassification(l).score >= minScoreFilter : true)
      .sort((a, b) => {
        if (sortField === "tag_score") {
          const aScore = getLeadClassification(a).score;
          const bScore = getLeadClassification(b).score;
          return sortDirection === "asc" ? aScore - bScore : bScore - aScore;
        }
        // For date fields, sort nulls last
        const aRaw = (a[sortField as keyof Lead] as any);
        const bRaw = (b[sortField as keyof Lead] as any);
        if (aRaw == null && bRaw == null) return 0;
        if (aRaw == null) return 1;
        if (bRaw == null) return -1;
        const aVal = aRaw?.toString?.().toLowerCase?.() ?? "";
        const bVal = bRaw?.toString?.().toLowerCase?.() ?? "";
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

  const sortedLeads = useMemo(() => sortAndFilter(activeBase), [leads, sortField, sortDirection, searchTerm, colorFilter, hasInspectorNoteFilter, minScoreFilter]);
  const sortedClassifiedLeads = useMemo(() => sortAndFilter(classifiedBase), [leads, sortField, sortDirection, searchTerm, colorFilter, hasInspectorNoteFilter, minScoreFilter]);
  const sortedRedLeads = useMemo(() => sortAndFilter(redBase), [leads, sortField, sortDirection, searchTerm, colorFilter, hasInspectorNoteFilter, minScoreFilter]);

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
  const HeaderAndFilters = ({ list: _list }: { list: Lead[] }) => (
    <>
      <div className="flex flex-col md:flex-row justify-between gap-3 mb-3">
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
            { key: "GREEN", label: "Green", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", active: "bg-emerald-600 text-white", dot: "bg-emerald-500" },
            { key: "BLUE", label: "Blue", bg: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", active: "bg-blue-600 text-white", dot: "bg-blue-500" },
            { key: "YELLOW", label: "Yellow", bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", active: "bg-amber-500 text-white", dot: "bg-amber-400" },
            { key: "RED", label: "Red", bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400", active: "bg-rose-600 text-white", dot: "bg-rose-500" },
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
      {colorFilter && (
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setColorFilter(null)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        </div>
      )}
    </>
  );

  const TABLE_COLS = [
    { key: "case_number", label: "Case #" },
    { key: "incident_address", label: "Address" },
    { key: "status", label: "Status" },
    { key: "tag_score", label: "Classification" },
    { key: "resolution_inspector", label: "Inspector Resolution" },
  ];

  const LeadsTableView = ({ list }: { list: Lead[] }) => (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-gradient-to-r from-slate-800 to-slate-700">
            <th className="p-4 w-10 text-center">
              <Checkbox
                checked={selected.length === list.length && !!list.length}
                onCheckedChange={(chk) => toggleSelectAll(!!chk, list)}
                className="border-slate-400 data-[state=checked]:bg-white data-[state=checked]:text-slate-800"
              />
            </th>
            {TABLE_COLS.map((col) => (
              <th key={col.key} className="p-4 text-center">
                <button
                  onClick={() => {
                    if (sortField === col.key) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                    else { setSortField(col.key); setSortDirection("desc"); }
                  }}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  {col.label}
                  <ArrowUpDown className={`w-3 h-3 opacity-60 ${sortField === col.key ? "opacity-100 text-blue-300" : ""}`} />
                </button>
              </th>
            ))}
            <th className="p-4 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Actions</th>
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
            const inspRes = (lead as any).resolution_inspector as string | null | undefined;
            const inspResShort = inspRes
              ? inspRes.replace(/\d{1,2}\/\d{1,2}\/\d{4}.*$/i, "").trim().slice(0, 80) + (inspRes.length > 80 ? "…" : "")
              : "—";
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
                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(lead.case_number)}
                    onCheckedChange={(chk) => toggleSelectOne(lead.case_number, chk as boolean)}
                  />
                </td>
                <td className="p-4 text-center font-semibold text-sm text-slate-800 dark:text-slate-200" onClick={() => setModalLead(lead)}>{lead.case_number}</td>
                <td className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 max-w-[220px] truncate" onClick={() => setModalLead(lead)}>{lead.incident_address}</td>
                <td className="p-4 text-center" onClick={() => setModalLead(lead)}>
                  <Badge className={`${statusColors[colorKey]} rounded-full px-2.5 py-0.5 text-[11px] font-medium`}>
                    {lead.status || "—"}
                  </Badge>
                </td>
                <td className="p-4 text-center text-sm" onClick={() => setModalLead(lead)}>
                  <div className="font-medium text-slate-700 dark:text-slate-300">{auto.tag}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Score: {auto.score}/10</div>
                </td>
                <td className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 max-w-[200px]" onClick={() => setModalLead(lead)}>
                  <span title={inspRes || ""} className="line-clamp-2">{inspResShort}</span>
                </td>
                <td className="p-4 text-center">
                  <div className="flex gap-1 justify-center">
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
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <TabsList className="rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="activos" className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700">
              Active Leads
            </TabsTrigger>
            <TabsTrigger value="clasificados" className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700">
              Classified Leads
            </TabsTrigger>
            <TabsTrigger value="red" className="rounded-lg text-sm font-medium cursor-pointer data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 data-[state=active]:bg-white" />
              Red Leads
              {redBase.length > 0 && (
                <span className="ml-1 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {redBase.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button type="button" onClick={copySelectedDetails} disabled={!selected.length} variant="outline" size="sm" className="text-xs cursor-pointer">
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy ({selected.length})
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs cursor-pointer"
              onClick={() => {
                const currentList = pageTab === "activos" ? sortedLeads : pageTab === "clasificados" ? sortedClassifiedLeads : sortedRedLeads;
                sendMany(currentList.filter((l) => selected.includes(l.case_number)));
              }}
              disabled={!selected.length}
            >
              <MapPin className="w-3.5 h-3.5 mr-1.5" /> Send to Map
            </Button>
          </div>
        </div>

        <TabsContent value="activos" className="space-y-4">
          <HeaderAndFilters list={sortedLeads} />
          <LeadsTableView list={sortedLeads} />
        </TabsContent>

        <TabsContent value="clasificados" className="space-y-4">
          <HeaderAndFilters list={sortedClassifiedLeads} />
          <LeadsTableView list={sortedClassifiedLeads} />
        </TabsContent>

        <TabsContent value="red" className="space-y-4">
          <HeaderAndFilters list={sortedRedLeads} />
          <LeadsTableView list={sortedRedLeads} />
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      {modalLead && (() => {
        const auto = getLeadClassification(modalLead);
        const manualKey = (((modalLead as any).manual_classification || "") as string).toUpperCase();
        const colorKey = (["GREEN","YELLOW","BLUE","RED"].includes(manualKey) ? manualKey : auto.color) as keyof typeof statusColors;
        const isResolved = (modalLead as any).consulta === "red" || localStorage.getItem(`resolved_${modalLead.case_number}`) === "true";
        const isPending = updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending;
        return (
        <Dialog open={!!modalLead} onOpenChange={() => setModalLead(null)}>
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#103360] to-[#1565c0] p-6 text-white rounded-t-lg flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs px-2 py-0.5 bg-white/20 rounded text-white/80">Case #{modalLead.case_number}</span>
                    <Badge className={`${statusColors[colorKey]} text-[11px]`}>{auto.tag}</Badge>
                    <span className="text-xs text-white/60">Score {auto.score}/10</span>
                    {isResolved && <span className="text-xs bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded">Resolved</span>}
                  </div>
                  <h2 className="text-xl font-bold truncate">{modalLead.incident_address || "No address"}</h2>
                  <p className="text-blue-200 text-sm mt-0.5">{modalLead.ava_case_type || ""} {modalLead.status ? `— ${modalLead.status}` : ""}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleOpenCreateClientModal(modalLead)} disabled={isPending} className="text-xs">
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Client
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => sendOne(modalLead)} className="text-white hover:bg-white/20 text-xs">
                    <MapPin className="w-3.5 h-3.5 mr-1.5" /> Map
                  </Button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <Tabs defaultValue="details">
                <TabsList className="mb-4 bg-slate-100 dark:bg-slate-800">
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                  <TabsTrigger value="inspector" className="text-xs">Inspector</TabsTrigger>
                  <TabsTrigger value="location" className="text-xs">Location</TabsTrigger>
                  <TabsTrigger value="dates" className="text-xs">Dates</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-0">
                  <DetailItem label="Description">{modalLead.description}</DetailItem>
                  <DetailItem label="Latest Notes">{modalLead.latest_case_notes}</DetailItem>
                  <DetailItem label="Resolution">{modalLead.resolution}</DetailItem>
                  <DetailItem label="Channel">{modalLead.channel}</DetailItem>
                </TabsContent>
                <TabsContent value="inspector" className="space-y-0">
                  {(modalLead.description_inspector || modalLead.resolution_inspector) ? (
                    <>
                      <div className="mb-3 px-3 py-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300 font-medium">
                        Inspector note recorded
                      </div>
                      <DetailItem label="Description">{modalLead.description_inspector}</DetailItem>
                      <DetailItem label="Resolution">{modalLead.resolution_inspector}</DetailItem>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4">No inspector notes recorded.</p>
                  )}
                  <DetailItem label="Inspector Date">
                    {modalLead.created_date_inspector ? new Date(modalLead.created_date_inspector as any).toLocaleString() : "—"}
                  </DetailItem>
                  <DetailItem label="URL">
                    {(modalLead as any).url ? (
                      <a href={(modalLead as any).url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all text-xs">
                        {(modalLead as any).url}
                      </a>
                    ) : "—"}
                  </DetailItem>
                </TabsContent>
                <TabsContent value="location" className="space-y-0">
                  <DetailItem label="Address">{modalLead.incident_address}</DetailItem>
                  <DetailItem label="State">{modalLead.state_code_name}</DetailItem>
                  <DetailItem label="ZIP Code">{modalLead.zip_code}</DetailItem>
                </TabsContent>
                <TabsContent value="dates" className="space-y-0">
                  <DetailItem label="Created (Local)">
                    {modalLead.created_date_local ? new Date(modalLead.created_date_local as any).toLocaleString() : "—"}
                  </DetailItem>
                  <DetailItem label="Resolve By">
                    {modalLead.resolve_by_time ? new Date(modalLead.resolve_by_time as any).toLocaleString() : "—"}
                  </DetailItem>
                </TabsContent>
              </Tabs>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-t border-border flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">Classify:</span>
                {[
                  { color: "green" as const, cls: "bg-emerald-500 hover:bg-emerald-600 text-white", label: "Green" },
                  { color: "blue" as const, cls: "bg-blue-500 hover:bg-blue-600 text-white", label: "Blue" },
                  { color: "yellow" as const, cls: "bg-amber-400 hover:bg-amber-500 text-white", label: "Yellow" },
                ].map(({ color, cls, label }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleSetManualClassification(modalLead, color)}
                    disabled={isPending}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${cls} ${manualKey.toLowerCase() === color ? "ring-2 ring-offset-1 ring-current" : ""}`}
                  >
                    {label}
                  </button>
                ))}
                {!isResolved ? (
                  <button
                    type="button"
                    onClick={() => handleSetRedConsultation(modalLead)}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRevertClassification(modalLead)}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-slate-500 hover:bg-slate-600 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Revert
                  </button>
                )}
              </div>
              <Button type="button" variant="outline" onClick={() => setModalLead(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
        );
      })()}

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
