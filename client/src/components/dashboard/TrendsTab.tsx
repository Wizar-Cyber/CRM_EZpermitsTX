import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
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

// First year of historical data; extend automatically each year
const FIRST_YEAR = 2025;
const CURR_YEAR = new Date().getFullYear();

// Color palette — index 0 = current year (blue), higher index = older (muted)
const YEAR_COLORS: Record<number, { stroke: string; fill: string; dash?: string }> = {
  0: { stroke: "#2563eb", fill: "#2563eb" },             // current year — solid blue
  1: { stroke: "#9ca3af", fill: "#9ca3af", dash: "5 3" }, // -1 year — gray dashed
  2: { stroke: "#22c55e", fill: "#22c55e", dash: "4 2" }, // -2 year — green dashed
  3: { stroke: "#f59e0b", fill: "#f59e0b", dash: "4 2" }, // -3 year — amber dashed
  4: { stroke: "#8b5cf6", fill: "#8b5cf6", dash: "4 2" }, // -4 year — violet dashed
  5: { stroke: "#ef4444", fill: "#ef4444", dash: "4 2" }, // -5 year — red dashed
};

function getYearStyle(year: number) {
  const idx = CURR_YEAR - year;
  return YEAR_COLORS[idx] ?? YEAR_COLORS[5];
}

function buildChartRows(
  dataMap: Record<number, MonthlyData[]>,
  selectedYears: number[]
): { name: string; [key: string]: number | string | null }[] {
  return MONTH_NAMES.map((name, i) => {
    const m = i + 1;
    const row: { name: string; [key: string]: number | string | null } = { name };
    for (const y of selectedYears) {
      const d = dataMap[y]?.find((r) => r.month === m);
      row[`leads${y}`] = d ? d.new_leads : null;
    }
    return row;
  });
}

// All years from FIRST_YEAR to current year
const ALL_YEARS: number[] = Array.from(
  { length: CURR_YEAR - FIRST_YEAR + 1 },
  (_, i) => CURR_YEAR - i // newest first
);

export function TrendsTab() {
  const [selectedYears, setSelectedYears] = useState<number[]>([CURR_YEAR, CURR_YEAR - 1]);
  const [dataMap, setDataMap] = useState<Record<number, MonthlyData[]>>({});
  const [loadingYears, setLoadingYears] = useState<Set<number>>(new Set());

  // Fetch any selected year not yet in dataMap
  useEffect(() => {
    const missing = selectedYears.filter((y) => !(y in dataMap));
    if (!missing.length) return;

    setLoadingYears((prev) => new Set([...prev, ...missing]));

    Promise.all(
      missing.map((y) =>
        apiGet<MonthlyData[]>(`/dashboard/trends?year=${y}`)
          .then((rows) => ({ year: y, rows: Array.isArray(rows) ? rows : [] }))
          .catch(() => ({ year: y, rows: [] }))
      )
    ).then((results) => {
      setDataMap((prev) => {
        const next = { ...prev };
        results.forEach(({ year, rows }) => { next[year] = rows; });
        return next;
      });
      setLoadingYears((prev) => {
        const next = new Set(prev);
        results.forEach(({ year }) => next.delete(year));
        return next;
      });
    });
  }, [selectedYears]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year)
        ? prev.length > 1 ? prev.filter((y) => y !== year) : prev // keep at least 1
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const isLoading = loadingYears.size > 0;
  const chartRows = buildChartRows(dataMap, selectedYears);

  // Summary stats for current year vs previous selected year
  const sortedSelected = [...selectedYears].sort((a, b) => b - a);
  const newestYear = sortedSelected[0];
  const prevYear = sortedSelected[1];
  const newestData = dataMap[newestYear] ?? [];
  const prevData = dataMap[prevYear ?? -1] ?? [];

  const bestNewest = newestData.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best), null
  );
  const bestPrev = prevData.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best), null
  );
  const totalNewest = newestData.reduce((s, d) => s + d.new_leads, 0);
  const totalPrevComp = prevData
    .filter((d) => newestData.some((dC) => dC.month === d.month))
    .reduce((s, d) => s + d.new_leads, 0);
  const yoyGrowth =
    totalPrevComp > 0
      ? (((totalNewest - totalPrevComp) / totalPrevComp) * 100).toFixed(1)
      : null;

  const handleExportCsv = async () => {
    try {
      const year = newestYear;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-2xl shadow-lg p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-white">
            <h2 className="text-3xl font-bold tracking-tight">Annual Trends</h2>
            <p className="text-blue-100 text-sm mt-2">
              Select years to compare — monthly lead evolution
            </p>
          </div>
          {/* Year toggles */}
          <div className="flex gap-2 flex-wrap items-center">
            {ALL_YEARS.map((year) => {
              const active = selectedYears.includes(year);
              const style = getYearStyle(year);
              return (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold border-2 transition-all duration-200 transform hover:scale-105 ${
                    active
                      ? "bg-white text-slate-900 border-white shadow-lg"
                      : "bg-white/20 text-white border-white/40 hover:bg-white/30"
                  }`}
                  style={active ? { borderColor: style.stroke, color: style.stroke } : {}}
                >
                  {year} {active ? "✓" : "+"}
                </button>
              );
            })}
            <button
              onClick={handleExportCsv}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-white text-blue-600 hover:bg-slate-100 transition-all duration-200 transform hover:scale-105 shadow-lg border-2 border-white"
            >
              ⬇ Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary chips */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 animate-pulse shadow-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-md border border-blue-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-widest text-blue-600 font-bold">
                Top Month {newestYear}
              </p>
              <div className="text-2xl">📈</div>
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {bestNewest ? MONTH_NAMES[bestNewest.month - 1] : "—"}
            </p>
            <p className="text-sm text-blue-700 mt-2 font-medium">
              {bestNewest ? `${bestNewest.new_leads} leads` : "No data"}
            </p>
          </div>

          {prevYear && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-md border border-orange-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-widest text-orange-600 font-bold">
                  Top Month {prevYear}
                </p>
                <div className="text-2xl">📊</div>
              </div>
              <p className="text-3xl font-bold text-orange-900">
                {bestPrev ? MONTH_NAMES[bestPrev.month - 1] : "—"}
              </p>
              <p className="text-sm text-orange-700 mt-2 font-medium">
                {bestPrev ? `${bestPrev.new_leads} leads` : "No data"}
              </p>
            </div>
          )}

          <div className={`bg-gradient-to-br rounded-2xl shadow-md border p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${
            yoyGrowth == null
              ? "from-slate-50 to-slate-100 border-slate-200"
              : Number(yoyGrowth) >= 0
              ? "from-emerald-50 to-green-50 border-green-200"
              : "from-rose-50 to-red-50 border-red-200"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-[11px] uppercase tracking-widest font-bold ${
                yoyGrowth == null ? "text-slate-600" : Number(yoyGrowth) >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                YoY Growth
              </p>
              <div className="text-2xl">{yoyGrowth == null ? "📊" : Number(yoyGrowth) >= 0 ? "📈" : "📉"}</div>
            </div>
            <p className={`text-3xl font-bold ${
              yoyGrowth == null ? "text-slate-900" : Number(yoyGrowth) >= 0 ? "text-green-700" : "text-red-700"
            }`}>
              {yoyGrowth != null ? `${Number(yoyGrowth) >= 0 ? "+" : ""}${yoyGrowth}%` : "—"}
            </p>
            <p className={`text-sm mt-2 font-medium ${
              yoyGrowth == null ? "text-slate-600" : Number(yoyGrowth) >= 0 ? "text-green-700" : "text-red-700"
            }`}>
              {prevYear ? `${newestYear} vs ${prevYear}` : `Total ${newestYear}: ${totalNewest}`}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h3 className="font-bold text-2xl text-slate-900">Lead Comparison</h3>
            <p className="text-slate-500 text-sm mt-1">Monthly evolution of captured leads</p>
          </div>
          <div className="flex gap-4 flex-wrap">
            {[...selectedYears].sort((a, b) => b - a).map((year) => {
              const style = getYearStyle(year);
              return (
                <div key={year} className="flex items-center gap-2">
                  <div
                    className="w-6 h-1 rounded-full"
                    style={{
                      background: style.stroke,
                      opacity: year === newestYear ? 1 : 0.6,
                    }}
                  />
                  <span className="text-xs font-medium text-slate-600">{year}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="h-80 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Loading data...</p>
            </div>
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {[...selectedYears].map((year) => {
                    const style = getYearStyle(year);
                    return (
                      <linearGradient key={year} id={`gradient${year}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={style.fill} stopOpacity={year === newestYear ? 0.8 : 0.3} />
                        <stop offset="95%" stopColor={style.fill} stopOpacity={0} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
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
                {[...selectedYears].sort((a, b) => a - b).map((year) => {
                  const style = getYearStyle(year);
                  return (
                    <Area
                      key={year}
                      type="monotone"
                      dataKey={`leads${year}`}
                      name={String(year)}
                      stroke={style.stroke}
                      strokeDasharray={style.dash}
                      strokeWidth={year === newestYear ? 3 : 2}
                      fill={`url(#gradient${year})`}
                      dot={year === newestYear ? { r: 4, fill: style.stroke, strokeWidth: 2, stroke: "#fff" } : false}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Monthly breakdown table for newest selected year */}
      {(dataMap[newestYear]?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 overflow-x-auto">
          <div className="mb-8">
            <h3 className="font-bold text-2xl text-slate-900">Monthly Breakdown {newestYear}</h3>
            <p className="text-slate-500 text-sm mt-1">Detailed monthly metrics analysis</p>
          </div>
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b-2 border-blue-200 text-slate-700 font-bold">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">Month</th>
                <th className="px-6 py-4 text-right">New Leads</th>
                <th className="px-6 py-4 text-right">Clients</th>
                <th className="px-6 py-4 text-right">Visits</th>
                <th className="px-6 py-4 text-right">Conv%</th>
                {prevYear && (
                  <th className="px-6 py-4 text-right rounded-tr-lg">vs {prevYear}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(dataMap[newestYear] ?? []).map((row, idx) => {
                const dP = prevYear ? (dataMap[prevYear] ?? []).find((d) => d.month === row.month) : null;
                const vs = dP != null ? row.new_leads - dP.new_leads : null;
                return (
                  <tr
                    key={row.month}
                    className={`transition-all duration-200 ${
                      idx % 2 === 0 ? "bg-slate-50/50 hover:bg-blue-50/80" : "bg-white hover:bg-blue-50/50"
                    }`}
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">{MONTH_NAMES[row.month - 1]}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold">{row.new_leads}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg font-bold">{row.total_clients}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-bold">{row.visits_completed}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-bold">{row.conversion_rate?.toFixed(1)}%</span>
                    </td>
                    {prevYear && (
                      <td className={`px-6 py-4 text-right font-bold text-sm ${
                        vs == null ? "text-slate-400" : vs >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {vs == null ? "—" : `${vs >= 0 ? "📈 +" : "📉 "}${vs}`}
                      </td>
                    )}
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
