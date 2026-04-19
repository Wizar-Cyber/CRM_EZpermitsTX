import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, UserCheck, MapPin, RefreshCcw, Star } from "lucide-react";
import { apiGet, API_BASE_URL } from "@/lib/api";

interface WeekRow {
  week: number;
  new_leads: number;
  green_classified: number;
  delivery_sent: number;
  appointments: number;
  visits: number;
  new_clients: number;
}

interface Summary {
  leads: number;
  green: number;
  delivery: number;
  appts: number;
  visits: number;
  clients: number;
  conv_pct: string;
}

interface MonthlyResponse {
  label: string;
  summary: Summary;
  weeks: WeekRow[];
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function MonthlyTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMonthly = async () => {
      setLoading(true);
      try {
        const result = await apiGet<MonthlyResponse>(
          `/dashboard/monthly?year=${year}&month=${month}`
        );
        setData(result);
      } catch (err: any) {
        toast.error(err?.message ?? "Error loading monthly report");
      } finally {
        setLoading(false);
      }
    };
    fetchMonthly();
  }, [year, month]);

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/dashboard/csv/monthly?year=${year}&month=${month}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monthly_report_${year}_${String(month).padStart(2, "0")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Error exporting CSV");
    }
  };

  const yearOptions = [2024, 2025, 2026].filter((y) => y <= now.getFullYear());
  const bestWeek = data?.weeks.reduce<WeekRow | null>(
    (best, w) => (!best || w.new_leads > best.new_leads ? w : best),
    null
  );

  const pill = (val: number, kind: "blue" | "green" | "slate") => {
    if (val === 0) return "bg-slate-100 text-slate-500";
    if (kind === "blue") return "bg-blue-100 text-blue-700";
    if (kind === "green") return "bg-emerald-100 text-emerald-700";
    return "bg-slate-800 text-white";
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#eef5fe] rounded-xl shadow-sm border border-slate-200 p-5 flex items-start">
            <Users className="w-5 h-5 text-blue-500 mr-4 mt-1 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-600 tracking-wider">NEW LEADS</p>
              <h2 className="text-3xl font-bold mt-1 text-slate-900">{data.summary.leads}</h2>
              <p className="text-xs text-slate-500 mt-1">{data.label}</p>
            </div>
          </div>
          <div className="bg-[#eefcf7] rounded-xl shadow-sm border border-slate-200 p-5 flex items-start">
            <UserCheck className="w-5 h-5 text-emerald-500 mr-4 mt-1 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-600 tracking-wider">NUEVOS CLIENTES</p>
              <h2 className="text-3xl font-bold mt-1 text-slate-900">{data.summary.clients}</h2>
              <p className="text-xs text-slate-500 mt-1">Convertidos</p>
            </div>
          </div>
          <div className="bg-[#f0fdf4] rounded-xl shadow-sm border border-slate-200 p-5 flex items-start">
            <MapPin className="w-5 h-5 text-green-500 mr-4 mt-1 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-600 tracking-wider">VISITAS</p>
              <h2 className="text-3xl font-bold mt-1 text-slate-900">{data.summary.visits}</h2>
              <p className="text-xs text-slate-500 mt-1">Completadas</p>
            </div>
          </div>
          <div className="bg-[#f8fafc] rounded-xl shadow-sm border border-slate-200 p-5 flex items-start">
            <RefreshCcw className="w-5 h-5 text-slate-500 mr-4 mt-1 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-600 tracking-wider">CONVERSIÓN</p>
              <h2 className="text-3xl font-bold mt-1 text-slate-900">{data.summary.conv_pct}</h2>
              <p className="text-xs text-slate-500 mt-1">Delivery → Cliente</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Table Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center bg-white gap-4">
          <h3 className="font-semibold text-xl text-slate-800 text-left w-full sm:w-auto">
            Reporte Mensual
          </h3>
          <div className="flex space-x-3 w-full sm:w-auto justify-end">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={handleExportCsv}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="p-6 bg-[#fafafa]">
          {bestWeek && bestWeek.new_leads > 0 && (
            <div className="bg-[#fffbeb] border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center mb-6 text-sm">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 mr-3 flex-shrink-0" />
              <span>
                <strong className="font-semibold">Mejor semana:</strong> Semana {bestWeek.week} — {bestWeek.new_leads} leads
              </span>
            </div>
          )}

          {data && data.weeks.length > 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Semana</th>
                    <th className="px-6 py-4 text-center">New Leads</th>
                    <th className="px-6 py-4 text-center">Green</th>
                    <th className="px-6 py-4 text-center">Delivery</th>
                    <th className="px-6 py-4 text-center">Citas</th>
                    <th className="px-6 py-4 text-center">Visitas</th>
                    <th className="px-6 py-4 text-center">Clientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.weeks.map((row) => (
                    <tr key={row.week} className="bg-white hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-700">Semana {row.week}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${pill(row.new_leads, "blue")}`}>
                          {row.new_leads}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${pill(row.green_classified, "green")}`}>
                          {row.green_classified}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${pill(row.delivery_sent, "green")}`}>
                          {row.delivery_sent}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${pill(row.appointments, "green")}`}>
                          {row.appointments}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${pill(row.visits, "green")}`}>
                          {row.visits}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${row.new_clients > 0 ? "bg-slate-800 text-white" : "bg-slate-500 text-white"}`}>
                          {row.new_clients}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading && data ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No hay datos para {MONTH_NAMES[month - 1]} {year}.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
