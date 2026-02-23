import { useState, useMemo, useEffect } from "react";
import { Eye, MapPin, ArrowUpDown, Copy, RotateCcw, X, UserPlus } from "lucide-react"; 
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
import { geocodeAddress } from "@/lib/geocode";
import { ClientCreateModal, type NewClientData } from "@/components/ClientCreateModal";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { copyText } from "@/lib/clipboard";

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
    if (u === "/") return "/clients"; // POST /
    if (u.startsWith("/validate-case/")) return `/clients${u}`; // /clients/validate-case/...
    if (u.startsWith("/api/")) return u.slice(4); // quita /api
    return u; // /leads, /clients, etc.
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

// ---

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 py-2 border-b border-border/50">
    <dt className="text-sm font-semibold text-muted-foreground sm:col-span-1">{label}</dt>
    <dd className="sm:col-span-3 text-sm">{children || "—"}</dd>
  </div>
);

export function LeadsTable() {
  const queryClient = useQueryClient(); 

  type PageTab = "active" | "classified";

  const statusColors = {
    GREEN: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    YELLOW: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    RED: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    BLUE: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    DEFAULT: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
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
      const raw =
        localStorage.getItem("selectedForMap") ||
        localStorage.getItem("selectedLeadsForMap");
      return raw ? (JSON.parse(raw) as MapItem[]) : [];
    } catch {
      return [];
    }
  }
  function writeSelectedForMap(items: MapItem[]) {
    const payload = JSON.stringify(items);
    // llave canónica
    localStorage.setItem("selectedForMap", payload);
    // compat temporal con versiones previas
    localStorage.setItem("selectedLeadsForMap", payload);
  }
  function mergeSelectedForMap(newOnes: MapItem[]) {
    const byId = new Map<string, MapItem>();
    [...readSelectedForMap(), ...newOnes].forEach((it) => byId.set(it.id, it));
    writeSelectedForMap(Array.from(byId.values()));
  }

  type SortField = "case_number" | "incident_address" | "status" | "tag_score" | "inspector_date";
  type SortDirection = "asc" | "desc";
  type SortRule = { field: SortField; direction: SortDirection };
  type SemaforoColor = "GREEN" | "BLUE" | "YELLOW" | "RED" | null;
  type SessionState = {
    pageTab: PageTab;
    searchTerm: string;
    showDiscarded: boolean;
    sortRules: SortRule[];
    colorFilter: SemaforoColor;
  };

  const SESSION_STORAGE_KEY = "leads-table-session-v1";
  const DEFAULT_SORT_RULES: SortRule[] = [
    { field: "inspector_date", direction: "desc" },
    { field: "tag_score", direction: "desc" },
    { field: "status", direction: "asc" },
  ];

  const isSortField = (value: unknown): value is SortField =>
    ["case_number", "incident_address", "status", "tag_score", "inspector_date"].includes(String(value));
  const isSortDirection = (value: unknown): value is SortDirection => value === "asc" || value === "desc";

  const readSessionState = (): SessionState => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return {
          pageTab: "active" as PageTab,
          searchTerm: "",
          showDiscarded: false,
          sortRules: DEFAULT_SORT_RULES,
          colorFilter: null as SemaforoColor,
        };
      }
      const parsed = JSON.parse(raw) as {
        pageTab?: unknown;
        searchTerm?: string;
        showDiscarded?: boolean;
        sortRules?: Array<{ field?: unknown; direction?: unknown }>;
        colorFilter?: unknown;
      };

      const safeSortRules = (parsed.sortRules || [])
        .filter((r) => isSortField(r?.field) && isSortDirection(r?.direction))
        .map((r) => ({ field: r.field as SortField, direction: r.direction as SortDirection }))
        .slice(0, 3);

      const safeColorFilter: SemaforoColor = ["GREEN", "BLUE", "YELLOW", "RED"].includes(String(parsed.colorFilter))
        ? (parsed.colorFilter as Exclude<SemaforoColor, null>)
        : null;

      return {
        pageTab:
          parsed.pageTab === "classified" || parsed.pageTab === "clasificados"
            ? "classified"
            : "active",
        searchTerm: typeof parsed.searchTerm === "string" ? parsed.searchTerm : "",
        showDiscarded: Boolean(parsed.showDiscarded),
        sortRules: safeSortRules.length ? safeSortRules : DEFAULT_SORT_RULES,
        colorFilter: safeColorFilter,
      };
    } catch {
      return {
        pageTab: "active" as PageTab,
        searchTerm: "",
        showDiscarded: false,
        sortRules: DEFAULT_SORT_RULES,
        colorFilter: null as SemaforoColor,
      };
    }
  };

  const initialSessionState = readSessionState();

  const [pageTab, setPageTab] = useState<PageTab>(initialSessionState.pageTab);
  const [searchTerm, setSearchTerm] = useState(initialSessionState.searchTerm);
  const [showDiscarded, setShowDiscarded] = useState(initialSessionState.showDiscarded);
  const [sortRules, setSortRules] = useState<SortRule[]>(initialSessionState.sortRules);
  const [colorFilter, setColorFilter] = useState<SemaforoColor>(initialSessionState.colorFilter);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        pageTab,
        searchTerm,
        showDiscarded,
        sortRules,
        colorFilter,
      })
    );
  }, [pageTab, searchTerm, showDiscarded, sortRules, colorFilter]);
    
  // --- States for the new Client Modal ---
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

  // === SMART CLASSIFICATION BASED ONLY ON INSPECTOR RESOLUTION ===
  const normalizeText = (s?: string | null) =>
    (s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, " ")
      .replace(/[-_/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const countMatches = (text: string, patterns: (string | RegExp)[]) =>
    patterns.reduce((acc, pattern) => {
      if (typeof pattern === "string") return text.includes(pattern) ? acc + 1 : acc;
      return pattern.test(text) ? acc + 1 : acc;
    }, 0);

  // NOTA DE NEGOCIO:
  // El score y color deben salir únicamente de resolution_inspector.
  // Esta lista representa frases de cierre/descartado y tiene prioridad.
  const RED_KEYWORDS = [
    "task is closed","case closed","active project","already permitted",
    "permit approved","permit issued","permitted project",
    "referred to the structural","referred to structural","referred to electrical",
    "not investigate","no action required","duplicate case","duplicate request",
    "referred to","duplicate of case","voided","case cancelled","investigation closed",
    "unable to verify","not found","resolved previously","compliant","work completed",
    "no violation found","case closed as permitted","closed by inspector","issue resolved",
    "duplicate complaint","invalid report","no further action","owner obtained permit",
    "existing permit","no violation","not a building code violation",
    "closed","resolved","completed","compliant"
  ];

  const GREEN_KEYWORDS = [
    "unpermitted work","unpermitted","illegal","unauthorized",
    "no permit","no permits","building without permit", /no\s+\w*\s*permits?/,
    "violation","permit required","structural","safety","foundation","danger"
  ];

  const YELLOW_KEYWORDS = [
    "follow-up", "follow up", "reinspection", "additional", "monitor",
    "follow up inspection","follow-up scheduled","pending inspection",
    "awaiting reinspection","awaiting compliance","awaiting correction",
    "still active","open violation","compliance pending","awaiting resolution",
    "further inspection required"
  ];

  const BLUE_KEYWORDS = [
    "pending assignment","awaiting assignment","inspection scheduled","pending response",
    "refer to supervisor","pending validation","waiting for response","forwarded to inspector",
    "information requested","awaiting documentation","awaiting owner response",
    "forwarded to department","referred to another division","escalated for review"
  ];

  type LeadScore = {
    color: keyof typeof statusColors;
    tag: string;
    score: number;
    hasResolution: boolean;
  };

  const getLeadScore = (lead: Lead): LeadScore => {
    const manual = String((lead as any).manual_classification || "").toLowerCase();
    const isRedDiscarded =
      (lead as any).consulta === "red" || localStorage.getItem(`resolved_${lead.case_number}`) === "true";

    // Prioridad 1: descartado manual rojo
    if (isRedDiscarded) {
      return { color: "RED", tag: "Discarded", score: 0, hasResolution: true };
    }

    // Prioridad 2: clasificación manual aplicada por el usuario
    if (manual === "green") {
      return { color: "GREEN", tag: "Lead", score: 10, hasResolution: true };
    }
    if (manual === "yellow") {
      return { color: "YELLOW", tag: "In Follow-up", score: 6, hasResolution: true };
    }
    if (manual === "blue") {
      return { color: "BLUE", tag: "Other", score: 2, hasResolution: true };
    }

    const rawResolution = (lead.resolution_inspector || "").trim();

    // Regla de negocio: sin nota del inspector no hay semántica de clasificación.
    // Mostramos mensaje claro + score 0 para ordenamiento consistente.
    if (!rawResolution) {
      return {
        color: "DEFAULT",
        tag: "No Resolution",
        score: 0,
        hasResolution: false,
      };
    }

    const text = normalizeText(rawResolution);

    // Recorremos TODO el texto y contamos ocurrencias por categoría para evitar
    // clasificar por la primera coincidencia parcial.
    const redHits = countMatches(text, RED_KEYWORDS);
    const greenHits = countMatches(text, GREEN_KEYWORDS);
    const yellowHits = countMatches(text, YELLOW_KEYWORDS);
    const blueHits = countMatches(text, BLUE_KEYWORDS);

    if (redHits > 0 && redHits >= greenHits) {
      return { color: "RED", tag: "Discarded", score: 0, hasResolution: true };
    }

    if (greenHits > 0) {
      const score = Math.min(10, 6 + greenHits);
      return { color: "GREEN", tag: "Lead", score, hasResolution: true };
    }

    if (yellowHits > 0) {
      const score = Math.min(6, 3 + yellowHits);
      return { color: "YELLOW", tag: "In Follow-up", score, hasResolution: true };
    }

    if (blueHits > 0) {
      return { color: "BLUE", tag: "Other", score: 2, hasResolution: true };
    }

    return { color: "BLUE", tag: "Other", score: 1, hasResolution: true };
  };

  const isManuallyDiscarded = (lead: Lead) =>
    (lead as any).consulta === "red" || localStorage.getItem(`resolved_${lead.case_number}`) === "true";

  const formatInspectorDate = (value?: any) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString();
  };

  const getSortValue = (lead: Lead, field: SortField) => {
    if (field === "tag_score") return getLeadScore(lead).score;
    if (field === "inspector_date") {
      const rawDate = (lead as any).created_date_inspector;
      if (!rawDate) return 0;
      const parsed = new Date(rawDate).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (field === "status") return String(lead.status || "").toLowerCase();
    if (field === "case_number") return String(lead.case_number || "").toLowerCase();
    return String(lead.incident_address || "").toLowerCase();
  };

  const compareValues = (a: string | number, b: string | number, direction: SortDirection) => {
    const base = a > b ? 1 : a < b ? -1 : 0;
    return direction === "asc" ? base : -base;
  };

  const upsertSortRule = (field: SortField) => {
    setSortRules((prev) => {
      const current = [...prev];
      const primary = current[0];
      const currentRule = current.find((r) => r.field === field);

      if (primary?.field === field) {
        const toggled: SortRule = {
          field,
          direction: primary.direction === "asc" ? "desc" : "asc",
        };
        return [toggled, ...current.filter((r) => r.field !== field)].slice(0, 3);
      }

      const nextDirection: SortDirection =
        field === "inspector_date" || field === "tag_score" ? "desc" : "asc";
      const nextPrimary: SortRule = {
        field,
        direction: currentRule ? currentRule.direction : nextDirection,
      };

      const remainder = [primary, ...current.filter((r) => r.field !== field && r.field !== primary?.field)]
        .filter(Boolean) as SortRule[];

      return [nextPrimary, ...remainder].slice(0, 3);
    });
  };

  const sortAndFilter = (list: Lead[]) => {
    if (!list.length) return [];
    const searchLower = searchTerm.toLowerCase();

    return list
      .filter((lead) => {
        const caseNumber = String(lead.case_number ?? "").toLowerCase();
        const incidentAddress = String(lead.incident_address ?? "").toLowerCase();
        const matchesSearch =
          caseNumber.includes(searchLower) ||
          incidentAddress.includes(searchLower);

        if (!matchesSearch) return false;

        const scoreResult = getLeadScore(lead);
        if (!colorFilter) return true;
        return scoreResult.color === colorFilter;
      })
      .sort((a, b) => {
        for (const rule of sortRules) {
          const aVal = getSortValue(a, rule.field);
          const bVal = getSortValue(b, rule.field);
          const cmp = compareValues(aVal, bVal, rule.direction);
          if (cmp !== 0) return cmp;
        }
        return compareValues(
          String(a.case_number).toLowerCase(),
          String(b.case_number).toLowerCase(),
          "asc"
        );
      });
  };

  // Regla de negocio solicitada:
  // los casos marcados manualmente en rojo (descartados) NO se mezclan con la tabla principal.
  const discardedLeads = leads.filter(isManuallyDiscarded);
  const nonDiscardedLeads = leads.filter((lead: Lead) => !isManuallyDiscarded(lead));

  // Se mantienen tabs actuales, pero ambos respetan la separación de descartados.
  const MANUAL_SET = new Set(["green", "yellow", "blue"]);
  const activeBase = nonDiscardedLeads.filter(
    (l: any) => !MANUAL_SET.has(((l as any).manual_classification || "").toLowerCase())
  );
  const classifiedBase = nonDiscardedLeads.filter(
    (l: any) => MANUAL_SET.has(((l as any).manual_classification || "").toLowerCase())
  );

  const sortedLeads = useMemo(() => sortAndFilter(activeBase), [activeBase, searchTerm, colorFilter, sortRules]);
  const sortedClassifiedLeads = useMemo(
    () => sortAndFilter(classifiedBase),
    [classifiedBase, searchTerm, colorFilter, sortRules]
  );
  const sortedDiscardedLeads = useMemo(
    () => sortAndFilter(discardedLeads),
    [discardedLeads, searchTerm, colorFilter, sortRules]
  );

  const resetTableView = () => {
    setSearchTerm("");
    setColorFilter(null);
    setShowDiscarded(false);
    setSortRules([...DEFAULT_SORT_RULES]);
  };

  const toggleSelectAll = (checked: boolean, list: Lead[]) =>
    setSelectedLeads(checked ? new Set(list.map((l) => l.case_number)) : new Set());
  const toggleSelectOne = (id: string, checked: boolean) =>
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

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
    setSelectedLeads(new Set());
  };

  const copySelectedDetails = async () => {
    const selectedLeadsList = leads.filter((l: Lead) => selectedLeads.has(l.case_number));
    const formatted = selectedLeadsList
      .map(
        (l: Lead) =>
          `Case: ${l.case_number}\nAddress: ${l.incident_address}\nStatus: ${l.status}\nDescription: ${
            l.description || "N/A"
          }\nResolution: ${l.resolution || "N/A"}`
      )
      .join("\n\n---\n\n");
    const copied = await copyText(formatted);
    if (copied) toast.success("Copied!");
    else toast.error("Could not copy on this browser context.");
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
    onError: (err: unknown) => {
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
    onSuccess: (_: unknown, variables: { caseNumber: string; consulta: "red" | null; localStorageKey?: string }) => {
      if (variables.consulta === "red") {
        toast.success(`Case #${variables.caseNumber} marked as resolved.`);
      } else {
        toast.success(`Case #${variables.caseNumber} classification reverted.`);
      }
      // ❌ no cambiar de pestaña automáticamente
      setModalLead(null);
      queryClient.invalidateQueries({ queryKey: ["/leads"] });
    },
    onError: (err: unknown) => {
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
    setConfirmAction({
      title: "Mark case as resolved",
      description: `Confirm to mark case #${lead.case_number} as resolved?`,
      confirmLabel: "Mark resolved",
      destructive: true,
      onConfirm: () => {
        updateLeadConsultationMutation.mutate({
          caseNumber: lead.case_number,
          consulta: "red",
          localStorageKey: `resolved_${lead.case_number}`,
        });
        setConfirmAction(null);
      },
    });
  };

  const handleRevertClassification = (lead: Lead) => {
    setConfirmAction({
      title: "Revert RED state",
      description: `Confirm to revert the RED state of case #${lead.case_number}?`,
      confirmLabel: "Revert",
      onConfirm: () => {
        updateLeadConsultationMutation.mutate({
          caseNumber: lead.case_number,
          consulta: null,
          localStorageKey: `resolved_${lead.case_number}`,
        });
        setConfirmAction(null);
      },
    });
  };

  const handleDeleteLead = async (caseNumber: string) => {
    setConfirmAction({
      title: "Delete lead",
      description: `Delete lead #${caseNumber}? This action cannot be undone.`,
      confirmLabel: "Delete lead",
      destructive: true,
      onConfirm: async () => {
        try {
          await apiFetch(`/api/leads/${caseNumber}`, { method: "DELETE" });
          toast.success("Lead deleted successfully");
          refetch();
        } catch (err: any) {
          console.error("❌ Error deleting lead:", err.message);
          toast.error(`Error deleting lead: ${err.message}`);
        } finally {
          setConfirmAction(null);
        }
      },
    });
  };

  if (isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  // === Encabezado y filtros (compartidos por ambas pestañas) ===
  const renderHeaderAndFilters = () => (
    <>
      <div className="mb-3 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Lead</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> In Follow-up</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Other</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Discarded</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
        <Input
          placeholder="Search by case number or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:max-w-xs"
        />
        <div className="flex flex-wrap gap-2 md:justify-end">
          {["All", "GREEN", "BLUE", "YELLOW", "RED"].map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={colorFilter === (f === "All" ? null : f) ? "secondary" : "ghost"}
              onClick={() => setColorFilter(f === "All" ? null : (f as "GREEN" | "BLUE" | "YELLOW" | "RED"))}
            >
              {f}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetTableView}
            title="Reset table order and filters"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  const Table = ({ list }: { list: Lead[] }) => (
      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[700px] table-auto">
        <thead className="bg-muted/50">
          <tr className="text-center">
            <th className="p-3 w-10">
              <Checkbox
                checked={selectedLeads.size === list.length && !!list.length}
                onCheckedChange={(chk: unknown) => toggleSelectAll(!!chk, list)}
              />
            </th>
            {[
              ["case_number", "Case #"],
              ["incident_address", "Address"],
              ["status", "Status"],
              ["tag_score", "Tag"],
              ["inspector_date", "Date"],
            ].map(([col, title]) => (
              <th key={col} className={`p-3 text-center align-middle ${col === "incident_address" ? "w-[30%]" : ""}`}>
                <button
                  onClick={() => upsertSortRule(col as SortField)}
                  className="flex w-full items-center justify-center gap-1 text-center font-semibold text-sm hover:underline whitespace-nowrap"
                >
                  {title}
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
            ))}
            <th className="p-3 text-center align-middle font-semibold text-sm w-28">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((lead) => {
            const scoreResult = getLeadScore(lead);
            const colorKey = scoreResult.color;
            return (
              <tr
                key={lead.case_number}
                className="border-t hover:bg-muted/40"
              >
                <td className="p-3 text-center align-middle">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={selectedLeads.has(lead.case_number)}
                      onCheckedChange={(chk: unknown) =>
                        toggleSelectOne(lead.case_number, chk as boolean)
                      }
                    />
                  </div>
                </td>
                <td className="p-3 font-medium text-center align-middle text-sm">{lead.case_number}</td>
                <td className="p-3 text-muted-foreground text-center align-middle">
                  <div
                    className="mx-auto max-w-[280px] truncate text-sm"
                    title={lead.incident_address || "N/A"}
                  >
                    {lead.incident_address || "N/A"}
                  </div>
                </td>
                <td className="p-3 text-center align-middle">
                  <div className="flex justify-center">
                    <Badge className={`${statusColors[colorKey]} rounded-full px-2 py-0.5 text-xs`}>
                      {lead.status || "—"}
                    </Badge>
                  </div>
                </td>
                <td className="p-3 text-xs text-muted-foreground text-center align-middle">
                  {scoreResult.hasResolution ? (
                    <div className="inline-flex flex-col items-center justify-center">
                      <div>{scoreResult.tag}</div>
                      <div className="opacity-80">{scoreResult.score}</div>
                    </div>
                  ) : (
                    <div className="inline-flex flex-col items-center justify-center">
                      <div>—</div>
                      <div className="opacity-80">0</div>
                    </div>
                  )}
                </td>
                <td className="p-3 text-center text-sm">{formatInspectorDate((lead as any).created_date_inspector)}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setModalLead(lead)} title="View Details">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => sendOne(lead)} title="Send to Map">
                      <MapPin className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleOpenCreateClientModal(lead)}
                      title="Create Client"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4">
        {pageTab === "active" ? "Leads" : "Classified Leads"}
      </h2>
      {/* pestañas de la página */}
      <Tabs value={pageTab} onValueChange={(v: string) => setPageTab(v as PageTab)} className="w-full">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <TabsList className="mb-0">
            <TabsTrigger value="active">Leads</TabsTrigger>
            <TabsTrigger value="classified">Classified Leads</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={copySelectedDetails} disabled={selectedLeads.size === 0} variant="outline">
              <Copy className="w-4 h-4 mr-2" /> Copy ({selectedLeads.size})
            </Button>
            <Button
              type="button"
              onClick={() =>
                sendMany(
                  (pageTab === "active" ? sortedLeads : sortedClassifiedLeads).filter((l) =>
                    selectedLeads.has(l.case_number)
                  )
                )
              }
              disabled={selectedLeads.size === 0}
            >
              <MapPin className="w-4 h-4 mr-2" /> Send to Map
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="space-y-4" forceMount>
          {renderHeaderAndFilters()}
          <Table list={sortedLeads} />
        </TabsContent>

        <TabsContent value="classified" className="space-y-4" forceMount>
          {renderHeaderAndFilters()}
          <Table list={sortedClassifiedLeads} />
        </TabsContent>
      </Tabs>

      <div className="mt-6 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowDiscarded((prev) => !prev)}
          className="mb-3"
        >
          {showDiscarded ? "Hide Discarded Leads" : `Show Discarded Leads (${sortedDiscardedLeads.length})`}
        </Button>

        {showDiscarded && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-rose-600">Discarded Leads (manual red)</h3>
            <Table list={sortedDiscardedLeads} />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {modalLead && (
        <Dialog open={!!modalLead} onOpenChange={() => setModalLead(null)}>
          {/* Previene autofocus extraño */}
          <DialogContent
            className="max-w-3xl bg-card"
            onOpenAutoFocus={(e: Event) => e.preventDefault()}
            onCloseAutoFocus={(e: Event) => e.preventDefault()}
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
                  {(modalLead as any).url ? (
                    <a
                      href={(modalLead as any).url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline break-all"
                    >
                      {(modalLead as any).url}
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
                  {modalLead.resolve_by_time
                    ? new Date(modalLead.resolve_by_time as any).toLocaleString()
                    : "—"}
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
                  variant="outline"
                  className="h-8 px-3"
                  title="Mark as Green (Manual)"
                  onClick={() => handleSetManualClassification(modalLead, "green")}
                  disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 mr-2" />
                  Green · Lead
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3"
                  title="Mark as Blue (Manual)"
                  onClick={() => handleSetManualClassification(modalLead, "blue")}
                  disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600 mr-2" />
                  Blue · Other
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3"
                  title="Mark as Yellow (Manual)"
                  onClick={() => handleSetManualClassification(modalLead, "yellow")}
                  disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 mr-2" />
                  Yellow · In Follow-up
                </Button>

                {/* RED -> consulta = 'red' */}
                {((modalLead as any).consulta !== "red" && localStorage.getItem(`resolved_${modalLead.case_number}`) !== "true") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3"
                    title="Mark as Resolved (consulta='red')"
                    onClick={() => handleSetRedConsultation(modalLead)}
                    disabled={updateLeadManualClassificationMutation.isPending || updateLeadConsultationMutation.isPending}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600 mr-2" />
                    Red · Discarded
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
        <ClientCreateModal
          open={newClientModalOpen}
          onOpenChange={setNewClientModalOpen}
          clientData={clientToCreate}
          onSuccess={refetch} 
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
    </div>
  );
}
