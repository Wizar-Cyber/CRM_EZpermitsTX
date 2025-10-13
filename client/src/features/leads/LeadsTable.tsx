import { useState } from "react";
import { Lead } from "./api";

export default function LeadsTable({
  rows,
  selected,
  setSelected,
  onSort,
  onSendToMap,
  onSendSelectedToMap,
}: {
  rows: Lead[];
  selected: string[];
  setSelected: (v: string[]) => void;
  onSort: (col: string) => void;
  onSendToMap: (lead: Lead) => void;
  onSendSelectedToMap: (leads: Lead[]) => void;
}) {
  const [modalLead, setModalLead] = useState<Lead | null>(null);

  const toggleSelect = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => onSendSelectedToMap(rows.filter((r) => selected.includes(r.case_number)))}
            className="bg-primary text-primary-foreground px-3 py-2 rounded"
          >
            📍 Send {selected.length} to map
          </button>
        </div>
      )}

      <table className="w-full text-sm border border-border rounded-md">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="p-2">#</th>
            <th className="p-2 cursor-pointer" onClick={() => onSort("case_number")}>
              Case #
            </th>
            <th className="p-2 cursor-pointer" onClick={() => onSort("incident_address")}>
              Address
            </th>
            <th className="p-2">Status</th>
            <th className="p-2 cursor-pointer" onClick={() => onSort("created_date_local")}>
              Created
            </th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr key={lead.case_number} className="border-t border-border hover:bg-accent">
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
              <td className="p-2">{lead.created_date_local}</td>
              <td className="p-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalLead(lead)}
                    className="px-2 py-1 rounded bg-muted hover:bg-accent"
                  >
                    👁
                  </button>
                  <button
                    onClick={() => onSendToMap(lead)}
                    className="px-2 py-1 rounded bg-primary/80 hover:bg-primary"
                  >
                    📍
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[700px] shadow-lg">
            <h2 className="text-xl font-bold mb-2">
              Case #{modalLead.case_number}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {modalLead.ava_case_type} — {modalLead.status}
            </p>
            <p>{modalLead.incident_address}</p>
            <button
              onClick={() => setModalLead(null)}
              className="mt-6 bg-destructive text-destructive-foreground px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
