import { useMemo, useState } from "react";

type Lead = {
  case_number: string;
  incident_address: string;
  status: string;
  ava_case_type: string;
  created_date_local: string;
  resolve_by_time?: string;
  state_code_name?: string;
  zip_code?: string;
  created_date_utc?: string;
  channel: string;
  extract_date?: string;
  latest_case_notes?: string;
  description?: string;
  resolution?: string;
  color?: "GREEN" | "YELLOW" | "RED";
  lat?: number | null;
  lng?: number | null;
};

const fieldLabels: Record<string, string> = {
  case_number: "Case Number",
  incident_address: "Incident Address",
  created_date_local: "Created Date (Local)",
  resolve_by_time: "Resolve By Time",
  ava_case_type: "Case Type",
  state_code_name: "State",
  zip_code: "ZIP Code",
  created_date_utc: "Created Date (UTC)",
  channel: "Channel",
  extract_date: "Extract Date",
  latest_case_notes: "Latest Notes",
  created_date: "Created Date",
  status: "Status",
  description: "Description",
  resolution: "Resolution",
};

type Props = {
  rows: Lead[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  onSort: (col: string) => void;
  onSendToMap?: (lead: Lead) => void;
  onSendSelectedToMap?: (leads: Lead[]) => void;
};

const colorRow: Record<string, string> = {
  GREEN: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
  YELLOW: "bg-amber-100 hover:bg-amber-200 text-amber-900",
  RED: "bg-rose-100 hover:bg-rose-200 text-rose-900",
  DEFAULT: "bg-gray-50 hover:bg-gray-100 text-gray-900",
};

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border-b border-gray-700 pb-2">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

/** Toast */
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      <div className="bg-gray-900 text-white rounded-lg shadow-lg px-4 py-3 border border-gray-700">
        <div className="flex items-start gap-3">
          <span className="text-xl">✅</span>
          <div className="text-sm">{text}</div>
          <button
            onClick={onClose}
            className="ml-2 text-gray-400 hover:text-gray-200"
            aria-label="Close toast"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

/** Helpers -> localStorage["selectedForMap"] */
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

/** 🔎 geocodificación básica */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    if (!address || !address.trim()) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export default function LeadsTable({
  rows,
  selected,
  setSelected,
  onSort,
  onSendToMap,
  onSendSelectedToMap,
}: Props) {
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState("General");
  const [toast, setToast] = useState<string>("");

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.includes(r.case_number)),
    [rows, selected]
  );

  const toggleSelect = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const classifyLead = (lead: Lead): "GREEN" | "YELLOW" | "RED" | "DEFAULT" => {
    if (lead.color) return lead.color;
    const text = `${lead.status} ${lead.latest_case_notes} ${lead.description}`.toLowerCase();
    if (text.includes("contract") || text.includes("signed")) return "GREEN";
    if (text.includes("inspection") || text.includes("awaiting")) return "YELLOW";
    if (text.includes("not interested") || text.includes("closed")) return "RED";
    return "DEFAULT";
  };

  const badgeColor: Record<string, string> = {
    GREEN: "bg-emerald-500 text-white",
    YELLOW: "bg-amber-500 text-black",
    RED: "bg-rose-500 text-white",
    DEFAULT: "bg-gray-500 text-white",
  };

  /** —— enviar al mapa —— */
  const toMapItem = (l: Lead, coords?: { lat: number; lng: number } | null): MapItem => ({
    id: `${l.case_number}-${l.incident_address}`, // 🔑 ID único
    case_number: l.case_number,
    incident_address: l.incident_address,
    address: l.incident_address,
    lat: typeof l.lat === "number" ? l.lat : coords?.lat ?? null,
    lng: typeof l.lng === "number" ? l.lng : coords?.lng ?? null,
  });

  const sendOne = async (lead: Lead) => {
  console.log("📍 sendOne llamado con lead:", lead);

  let coords: { lat: number; lng: number } | null = null;

  if (typeof lead.lat !== "number" || typeof lead.lng !== "number") {
    coords = await geocodeAddress(lead.incident_address);
    console.log("🌍 geocodeAddress result:", coords);
  }

  const item = toMapItem(lead, coords);
  console.log("💾 Guardando en localStorage:", item);

  mergeSelectedForMap([item]);

  console.log("📦 Estado final localStorage:", readSelectedForMap());
setToast(`Sent 1 case to the map.`);
};

  // Move sendMany inside the LeadsTable component so setSelected is in scope
  const sendMany = async (leads: Lead[]) => {
    if (!leads.length) return;

    if (!onSendSelectedToMap) {
      const results: MapItem[] = [];
      for (const l of leads) {
        let coords: { lat: number; lng: number } | null = null;
        if (typeof l.lat !== "number" || typeof l.lng !== "number") {
          coords = await geocodeAddress(l.incident_address);
        }
        results.push(toMapItem(l, coords));
      }
      mergeSelectedForMap(results);
    } else {
      onSendSelectedToMap(leads);
    }

    setToast(`Sent ${leads.length} cases to the map.`);
    setSelected([]);
    setTimeout(() => setToast(""), 2500);
    console.log("👉 SendMany - leads seleccionados:", leads);
    console.log("👉 Después de merge:", readSelectedForMap());
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => sendMany(selectedRows)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            📍 Send {selected.length} selected to map
          </button>
        </div>
      )}

      <table className="w-full text-left border-collapse rounded overflow-hidden shadow">
        <thead>
          <tr className="bg-gray-800 text-gray-100">
            <th className="p-2">#</th>
            <th className="p-2 cursor-pointer" onClick={() => onSort("case_number")}>
              {fieldLabels["case_number"]}
            </th>
            <th className="p-2 cursor-pointer" onClick={() => onSort("incident_address")}>
              {fieldLabels["incident_address"]}
            </th>
            <th className="p-2">{fieldLabels["status"]}</th>
            <th className="p-2">{fieldLabels["ava_case_type"]}</th>
            <th className="p-2 cursor-pointer" onClick={() => onSort("created_date_local")}>
              {fieldLabels["created_date_local"]}
            </th>
            <th className="p-2">{fieldLabels["channel"]}</th>
            <th className="p-2">{fieldLabels["latest_case_notes"]}</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const leadColor = classifyLead(lead);
            return (
              <tr key={lead.case_number} className={`${colorRow[leadColor]} transition`}>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(lead.case_number)}
                    onChange={() => toggleSelect(lead.case_number)}
                  />
                </td>
                <td className="p-2 font-semibold">{lead.case_number}</td>
                <td className="p-2">{lead.incident_address}</td>
                <td className="p-2">{lead.status}</td>
                <td className="p-2">{lead.ava_case_type}</td>
                <td className="p-2">{lead.created_date_local}</td>
                <td className="p-2">{lead.channel}</td>
                <td className="p-2 truncate max-w-[200px]">{lead.latest_case_notes || "—"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModalLead(lead)}
                      className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                      title="View details"
                    >
                      👁
                    </button>
                    <button
                      onClick={() => {/* lógica de marcar resuelto */}}
                      className="px-2 py-1 rounded bg-green-200 hover:bg-green-300"
                      title="Mark as resolved"
                    >
                      ✅
                    </button>
                    <button
                      onClick={() => sendOne(lead)}
                      className="px-2 py-1 rounded bg-blue-200 hover:bg-blue-300"
                      title="Send to map"
                    >
                      📍
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal */}
      {modalLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-gray-100 rounded-lg p-6 w-[850px] max-h-[85vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Case #{modalLead.case_number}</h2>
                <p className="text-gray-400">
                  {modalLead.ava_case_type} — {modalLead.status}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${badgeColor[classifyLead(modalLead)]}`}
              >
                {classifyLead(modalLead)}
              </span>
            </div>

            <div className="flex border-b border-gray-700 mb-4">
              {["General", "Dates", "Location", "Details"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 ${activeTab === tab
                      ? "border-b-2 border-blue-500 text-blue-400"
                      : "text-gray-400 hover:text-gray-200"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {activeTab === "General" && (
                <>
                  <Field label={fieldLabels["incident_address"]} value={modalLead.incident_address} />
                  <Field label={fieldLabels["channel"]} value={modalLead.channel} />
                </>
              )}
              {activeTab === "Dates" && (
                <>
                  <Field label={fieldLabels["created_date_local"]} value={modalLead.created_date_local} />
                  <Field label={fieldLabels["created_date_utc"]} value={modalLead.created_date_utc} />
                  <Field label={fieldLabels["resolve_by_time"]} value={modalLead.resolve_by_time} />
                  <Field label={fieldLabels["extract_date"]} value={modalLead.extract_date} />
                </>
              )}
              {activeTab === "Location" && (
                <>
                  <Field label={fieldLabels["state_code_name"]} value={modalLead.state_code_name} />
                  <Field label={fieldLabels["zip_code"]} value={modalLead.zip_code} />
                </>
              )}
              {activeTab === "Details" && (
                <>
                  <Field label={fieldLabels["latest_case_notes"]} value={modalLead.latest_case_notes} />
                  <Field label={fieldLabels["description"]} value={modalLead.description} />
                  <Field label={fieldLabels["resolution"]} value={modalLead.resolution} />
                </>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setModalLead(null)}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </div>
  );
}
