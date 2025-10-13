import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import LeadsFilters from "./LeadsFilters";
import LeadsTable from "./LeadsTable";
import { geocodeAddress } from "@/lib/geocode";
import BackButton from "@/components/BackButton";
import { Lead } from "./api";

export default function LeadsPage() {
  const [query, setQuery] = useState<any>({});
  const [rows, setRows] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" }>({
    col: "created_date_local",
    dir: "desc",
  });

  const fetchData = async () => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    params.set("sort", sort.col);
    params.set("order", sort.dir);

    try {
      const res = await api.get<{ data: Lead[] }>(`/api/leads?${params.toString()}`);
      setRows(res.data);
      setSelected([]);
    } catch (err) {
      console.error("Error fetching leads:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(query), sort.col, sort.dir]);

  const onSort = (col: string) => {
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" }
    );
  };

  const handleSendToMap = async (lead: Lead) => {
    const coords = await geocodeAddress(lead.incident_address);
    if (!coords) return alert("Could not locate address");
    localStorage.setItem(
      "selectedForMap",
      JSON.stringify([{ id: lead.case_number, ...coords }])
    );
  };

  const handleSendSelectedToMap = async (leads: Lead[]) => {
    const points = [];
    for (const lead of leads) {
      const coords = await geocodeAddress(lead.incident_address);
      if (coords) points.push({ id: lead.case_number, ...coords });
    }
    localStorage.setItem("selectedForMap", JSON.stringify(points));
    alert(`${points.length} leads sent to map`);
  };

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <h1 className="text-2xl font-bold">Leads</h1>

      <div className="p-4 rounded-lg bg-card border">
        <LeadsFilters onChange={setQuery} />
      </div>

      <div className="bg-card rounded-lg border p-4">
        <LeadsTable
          rows={rows}
          selected={selected}
          setSelected={setSelected}
          onSort={onSort}
          onSendToMap={handleSendToMap}
          onSendSelectedToMap={handleSendSelectedToMap}
        />
      </div>
    </div>
  );
}
