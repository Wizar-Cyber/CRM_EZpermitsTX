import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MapPin, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { apiGet, API_BASE_URL } from "@/lib/api";

interface ZipStat {
  zip_code: string;
  count: number;
  pct: number;
}

interface GeographicTabProps {
  start: Date;
  end: Date;
}

export function GeographicTab({ start, end }: GeographicTabProps) {
  const [stats, setStats] = useState<ZipStat[]>([]);
  const [loading, setLoading] = useState(false);

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await apiGet<ZipStat[]>(
          `/dashboard/zipcode-stats?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
        );
        setStats(Array.isArray(data) ? data : []);
      } catch (err: any) {
        toast.error(err?.message ?? "Error loading geographic data");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [startStr, endStr]);

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/dashboard/csv/geographic?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `geographic_${startStr}_${endStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Error exporting CSV");
    }
  };

  const topZip = stats[0];
  const totalZips = stats.length;
  const totalCount = stats.reduce((s, z) => s + z.count, 0);
  const avgPerZip = totalZips > 0 ? (totalCount / totalZips).toFixed(1) : "—";

  const chartData = stats.slice(0, 12).map((z) => ({
    zip: z.zip_code,
    value: z.pct,
    count: z.count,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 tracking-wider">TOP ZIPCODE</p>
              <h2 className="text-3xl font-bold mt-1 text-slate-800 font-mono">
                {topZip ? topZip.zip_code : "—"}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {topZip ? `${topZip.count} leads (${topZip.pct?.toFixed(1)}%)` : "Sin datos"}
              </p>
            </div>
            <MapPin className="w-6 h-6 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 tracking-wider">ZIPCODES ACTIVOS</p>
              <h2 className="text-3xl font-bold mt-1 text-slate-800">{totalZips}</h2>
              <p className="text-sm text-slate-600 mt-1">Zonas con actividad</p>
            </div>
            <BarChart3 className="w-6 h-6 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 tracking-wider">PROMEDIO POR ZIP</p>
            <h2 className="text-3xl font-bold mt-1 text-slate-800">{avgPerZip}</h2>
            <p className="text-sm text-slate-600 mt-1">Leads por zona</p>
          </div>
          <button
            onClick={handleExportCsv}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm hover:bg-emerald-700 transition"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-lg text-slate-800 mb-6">
          Distribución por Código Postal
        </h3>
        <div className="h-[400px] w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Cargando...
            </div>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No hay datos geográficos para el período seleccionado.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="zip"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 13, fill: "#475569" }}
                  width={60}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any, _name: any, entry: any) => [
                    `${Number(value).toFixed(1)}% (${entry.payload.count} leads)`,
                    "Distribución",
                  ]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? "#5a7bf6" : "#7c9af8"}
                      fillOpacity={Math.max(0.4, 1 - index * 0.05)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
