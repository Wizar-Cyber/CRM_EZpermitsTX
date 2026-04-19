import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiGet, API_BASE_URL } from "@/lib/api";

interface MonthlyData {
  month: number;
  month_name?: string;
  new_leads: number;
  total_clients: number;
  visits_completed: number;
  conversion_rate: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURR_YEAR = new Date().getFullYear();
const PREV_YEAR = CURR_YEAR - 1;

function buildChartRows(
  dataPrev: MonthlyData[],
  dataCurr: MonthlyData[]
): { name: string; [key: string]: number | string | null }[] {
  return MONTH_NAMES.map((name, i) => {
    const m = i + 1;
    const dP = dataPrev.find((d) => d.month === m);
    const dC = dataCurr.find((d) => d.month === m);
    return {
      name,
      [`leads${PREV_YEAR}`]: dP ? dP.new_leads : null,
      [`leads${CURR_YEAR}`]: dC ? dC.new_leads : null,
    };
  });
}

export function TrendsTab() {
  const [showPrev, setShowPrev] = useState(true);
  const [showCurr, setShowCurr] = useState(true);
  const [dataPrev, setDataPrev] = useState<MonthlyData[]>([]);
  const [dataCurr, setDataCurr] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBoth = async () => {
      setLoading(true);
      try {
        const [rPrev, rCurr] = await Promise.all([
          apiGet<MonthlyData[]>(`/dashboard/trends?year=${PREV_YEAR}`),
          apiGet<MonthlyData[]>(`/dashboard/trends?year=${CURR_YEAR}`),
        ]);
        setDataPrev(Array.isArray(rPrev) ? rPrev : []);
        setDataCurr(Array.isArray(rCurr) ? rCurr : []);
      } catch (err: any) {
        toast.error(err?.message ?? "Error loading trends");
      } finally {
        setLoading(false);
      }
    };
    fetchBoth();
  }, []);

  const handleExportCsv = async () => {
    try {
      const year = CURR_YEAR;
      const month = new Date().getMonth() + 1;
      const token = sessionStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/dashboard/csv/monthly?year=${year}&month=${month}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trends_${year}_${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Error exporting CSV");
    }
  };

  const bestCurr = dataCurr.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best),
    null
  );
  const bestPrev = dataPrev.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best),
    null
  );
  const totalCurr = dataCurr.reduce((s, d) => s + d.new_leads, 0);
  const totalPrevComparable = dataPrev
    .filter((d) => dataCurr.some((dC) => dC.month === d.month))
    .reduce((s, d) => s + d.new_leads, 0);
  const yoyGrowth =
    totalPrevComparable > 0
      ? (((totalCurr - totalPrevComparable) / totalPrevComparable) * 100).toFixed(1)
      : null;

  const chartRows = buildChartRows(dataPrev, dataCurr);

  return (
    <div className="space-y-6">
      {/* Header con Gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-2xl shadow-lg p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-white">
            <h2 className="text-3xl font-bold tracking-tight">Tendencias Anuales</h2>
            <p className="text-blue-100 text-sm mt-2">
              Análisis comparativo de leads por mes — {PREV_YEAR} vs {CURR_YEAR}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowPrev((v) => !v)}
              className={`px-4 py-2.5 rounded-lg text-xs font-semibold border-2 transition-all duration-200 transform hover:scale-105 ${
                showPrev
                  ? "bg-slate-100 text-slate-900 border-white shadow-lg"
                  : "bg-white/20 text-white border-white/40 hover:bg-white/30"
              }`}
            >
              {PREV_YEAR} {showPrev ? "✓" : ""}
            </button>
            <button
              onClick={() => setShowCurr((v) => !v)}
              className={`px-4 py-2.5 rounded-lg text-xs font-semibold border-2 transition-all duration-200 transform hover:scale-105 ${
                showCurr
                  ? "bg-white text-blue-600 border-white shadow-lg"
                  : "bg-white/20 text-white border-white/40 hover:bg-white/30"
              }`}
            >
              {CURR_YEAR} {showCurr ? "✓" : ""}
            </button>
            <button
              onClick={handleExportCsv}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-white text-blue-600 hover:bg-slate-100 transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-white"
            >
              ⬇ Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary chips mejorados */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 animate-pulse shadow-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-md border border-orange-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-widest text-orange-600 font-bold">
                🏆 Mejor mes {CURR_YEAR}
              </p>
              <div className="text-2xl">📈</div>
            </div>
            <p className="text-3xl font-bold text-orange-900">
              {bestCurr ? MONTH_NAMES[bestCurr.month - 1] : "—"}
            </p>
            <p className="text-sm text-orange-700 mt-2 font-medium">
              {bestCurr ? `${bestCurr.new_leads} leads` : "Sin datos"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-md border border-blue-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-widest text-blue-600 font-bold">
                🏆 Mejor mes {PREV_YEAR}
              </p>
              <div className="text-2xl">📊</div>
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {bestPrev ? MONTH_NAMES[bestPrev.month - 1] : "—"}
            </p>
            <p className="text-sm text-blue-700 mt-2 font-medium">
              {bestPrev ? `${bestPrev.new_leads} leads` : "Sin datos"}
            </p>
          </div>
          <div className={`bg-gradient-to-br rounded-2xl shadow-md border p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${
            yoyGrowth == null
              ? "from-slate-50 to-slate-100 border-slate-200"
              : Number(yoyGrowth) >= 0
              ? "from-emerald-50 to-green-50 border-green-200"
              : "from-rose-50 to-red-50 border-red-200"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-[11px] uppercase tracking-widest font-bold ${
                yoyGrowth == null
                  ? "text-slate-600"
                  : Number(yoyGrowth) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}>
                📉 Crecimiento YoY
              </p>
              <div className="text-2xl">{yoyGrowth == null ? "📊" : Number(yoyGrowth) >= 0 ? "📈" : "📉"}</div>
            </div>
            <p
              className={`text-3xl font-bold ${
                yoyGrowth == null ? "text-slate-900" : Number(yoyGrowth) >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {yoyGrowth != null ? `${Number(yoyGrowth) >= 0 ? "+" : ""}${yoyGrowth}%` : "—"}
            </p>
            <p className={`text-sm mt-2 font-medium ${
              yoyGrowth == null
                ? "text-slate-600"
                : Number(yoyGrowth) >= 0
                ? "text-green-700"
                : "text-red-700"
            }`}>
              {CURR_YEAR} vs {PREV_YEAR}
            </p>
          </div>
        </div>
      )}

      {/* Chart Mejorado */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-bold text-2xl text-slate-900">Comparativa de Leads</h3>
            <p className="text-slate-500 text-sm mt-1">Evolución mensual de leads capturados</p>
          </div>
          <div className="flex gap-4">
            {showPrev && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 bg-gray-400 rounded-full opacity-60" style={{ backgroundImage: "repeating-linear-gradient(90deg, #9ca3af 0px, #9ca3af 5px, transparent 5px, transparent 10px)" }}></div>
                <span className="text-xs font-medium text-slate-600">{PREV_YEAR}</span>
              </div>
            )}
            {showCurr && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 bg-blue-500 rounded-full"></div>
                <span className="text-xs font-medium text-blue-600">{CURR_YEAR}</span>
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <div className="h-80 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
              <p className="text-slate-500 text-sm">Cargando datos...</p>
            </div>
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientPrev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientCurr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    border: "2px solid #e2e8f0",
                    boxShadow: "0 8px 16px -2px rgb(0 0 0 / 0.15)",
                    backgroundColor: "#ffffff",
                  }}
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 2 }}
                />
                {showPrev && (
                  <Area
                    type="monotone"
                    dataKey={`leads${PREV_YEAR}`}
                    name={String(PREV_YEAR)}
                    stroke="#9ca3af"
                    strokeDasharray="5 3"
                    strokeWidth={2.5}
                    fill="url(#gradientPrev)"
                    dot={false}
                    connectNulls={false}
                  />
                )}
                {showCurr && (
                  <Area
                    type="monotone"
                    dataKey={`leads${CURR_YEAR}`}
                    name={String(CURR_YEAR)}
                    stroke="#2563eb"
                    strokeWidth={3}
                    fill="url(#gradientCurr)"
                    dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table Mejorada */}
      {dataCurr.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 overflow-x-auto">
          <div className="mb-8">
            <h3 className="font-bold text-2xl text-slate-900">Desglose Mensual {CURR_YEAR}</h3>
            <p className="text-slate-500 text-sm mt-1">Análisis detallado de métricas por mes</p>
          </div>
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b-2 border-blue-200 text-slate-700 font-bold">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">📅 Mes</th>
                <th className="px-6 py-4 text-right">📊 New Leads</th>
                <th className="px-6 py-4 text-right">👥 Clientes</th>
                <th className="px-6 py-4 text-right">📍 Visitas</th>
                <th className="px-6 py-4 text-right">📈 Conv%</th>
                <th className="px-6 py-4 text-right rounded-tr-lg">vs {PREV_YEAR}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataCurr.map((row, idx) => {
                const dP = dataPrev.find((d) => d.month === row.month);
                const vs = dP != null ? row.new_leads - dP.new_leads : null;
                const isHighlight = idx % 2 === 0;
                return (
                  <tr
                    key={row.month}
                    className={`transition-all duration-200 ${
                      isHighlight
                        ? "bg-slate-50/50 hover:bg-blue-50/80"
                        : "bg-white hover:bg-blue-50/50"
                    }`}
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">{MONTH_NAMES[row.month - 1]}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold">
                        {row.new_leads}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg font-bold">
                        {row.total_clients}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-bold">
                        {row.visits_completed}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-bold">
                        {row.conversion_rate?.toFixed(1)}%
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-bold text-sm ${
                        vs == null ? "text-slate-400" : vs >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {vs == null
                        ? "—"
                        : `${vs >= 0 ? "📈 +" : "📉 "}${vs}`
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
