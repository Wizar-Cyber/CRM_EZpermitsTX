import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import LeadsFilters from "../components/LeadsFilters";
import LeadsTable from "../components/LeadsTable";
import CopyAddresses from "../components/CopyAddresses";
import BackButton from "../components/BackButton";
import LeadsMap from "../components/LeadsMap"; // 👈 tu mapa con react-leaflet

type Lead = {
  case_number: string;
  incident_address: string;
  created_date_local: string;
  resolve_by_time?: string;
  ava_case_type: string;
  state_code_name?: string;
  zip_code?: string;
  created_date_utc?: string;
  channel: string;
  extract_date?: string;
  latest_case_notes?: string;
  created_date: string;
  status: string;
  description?: string;
  resolution?: string;
};

export default function LeadsPage() {
  const [query, setQuery] = useState<any>({});
  const [rows, setRows] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" }>({
    col: "created_date_local",
    dir: "desc",
  });

  // 📍 estado de los puntos en el mapa
  const [mapPoints, setMapPoints] = useState<
    { id: string; lat: number; lng: number; address: string }[]
  >([]);

  const fetchData = async () => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    params.set("sort", sort.col);
    params.set("order", sort.dir);

    const r = await apiGet<{ data: Lead[] }>(`/api/leads?${params.toString()}`);
    setRows(r.data);
    setSelected([]);
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

  // 👉 función para geocodificar (usarías un servicio real: Nominatim, Google, Mapbox)
  const geocodeAddress = async (address: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          address + " Houston, TX"
        )}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }
    return null;
  };

  // 📍 enviar un lead al mapa
  const handleSendToMap = async (lead: Lead) => {
    const coords = await geocodeAddress(lead.incident_address);
    if (coords) {
      setMapPoints((prev) => [
        ...prev,
        { id: lead.case_number, address: lead.incident_address, ...coords },
      ]);
    } else {
      alert("Could not locate address");
    }
  };

  // 📍 enviar varios seleccionados
  const handleSendSelectedToMap = async (leads: Lead[]) => {
    for (const lead of leads) {
      const coords = await geocodeAddress(lead.incident_address);
      if (coords) {
        setMapPoints((prev) => [
          ...prev,
          { id: lead.case_number, address: lead.incident_address, ...coords },
        ]);
      }
    }
  };

  return (
    <div className="p-4 space-y-3">
      <BackButton />
      <h1 className="text-2xl font-bold mb-4">Leads</h1>

      {/* Filtros en caja oscura */}
      <div className="inline-flex flex-wrap gap-2 items-end bg-gray-900 p-3 rounded">
        <LeadsFilters onChange={setQuery} />
      </div>

      <div className="flex items-center gap-2">
        <CopyAddresses ids={selected} rows={rows} />
      </div>

      <div className="bg-gray-900 rounded p-3">
        <LeadsTable
          rows={rows}
          selected={selected}
          setSelected={setSelected}
          onSort={onSort}
          onSendToMap={handleSendToMap} // 👈 un caso
          onSendSelectedToMap={handleSendSelectedToMap} // 👈 varios casos
        />
      </div>

      {/* 📍 Sección de mapa */}
      {mapPoints.length > 0 && (
        <div className="bg-gray-900 rounded p-3 mt-4">
          <h2 className="text-xl font-bold mb-2">Map</h2>
          <LeadsMap points={mapPoints} />
        </div>
      )}
    </div>
  );
}
