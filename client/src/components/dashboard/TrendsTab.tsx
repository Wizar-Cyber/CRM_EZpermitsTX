import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api";

interface MonthlyData {
  month: number; // 1-12
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

function buildChartRows(
  data2024: MonthlyData[],
  data2025: MonthlyData[]
): { name: string; leads2024: number | null; leads2025: number | null }[] {
  return MONTH_NAMES.map((name, i) => {
    const m = i + 1;
    const d24 = data2024.find((d) => d.month === m);
    const d25 = data2025.find((d) => d.month === m);
    return {
      name,
      leads2024: d24 ? d24.new_leads : null,
      leads2025: d25 ? d25.new_leads : null,
    };
  });
}

export function TrendsTab() {
  const [show2024, setShow2024] = useState(false);
  const [show2025, setShow2025] = useState(true);
  const [data2024, setData2024] = useState<MonthlyData[]>([]);
  const [data2025, setData2025] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBoth = async () => {
      setLoading(true);
      try {
        const [r24, r25] = await Promise.all([
          apiGet<MonthlyData[]>("/dashboard/trends?year=2024"),
          apiGet<MonthlyData[]>("/dashboard/trends?year=2025"),
        ]);
        setData2024(r24);
        setData2025(r25);
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
      const year = show2025 ? 2025 : 2024;
      const month = new Date().getMonth() + 1;
      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/dashboard/csv/monthly?year=${year}&month=${month}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
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

  // Summary chips
  const best2025 = data2025.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best),
    null
  );
  const best2024 = data2024.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best),
    null
  );
  const total2025 = data2025.reduce((s, d) => s + d.new_leads, 0);
  const total2024Comparable = data2024
    .filter((d) => data2025.some((d25) => d25.month === d.month))
    .reduce((s, d) => s + d.new_leads, 0);
  const yoyGrowth =
    total2024Comparable > 0
      ? (((total2025 - total2024Comparable) / total2024Comparable) * 100).toFixed(1)
      : null;

  const chartRows = buildChartRows(data2024, data2025);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tendencias Anuales</h2>
          <p className="text-sm text-muted-foreground">Comparativa de leads por mes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Year toggles */}
          <button
            onClick={() => setShow2024((v) => !v)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              show2024
                ? "bg-gray-200 text-gray-800 border-gray-400"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            2024 {show2024 ? "✓" : ""}
          </button>
          <button
            onClick={() => setShow2025((v) => !v)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              show2025
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            2025 {show2025 ? "✓" : ""}
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Mejor mes 2025
            </p>
            <p className="text-xl font-bold">
              {best2025 ? MONTH_NAMES[best2025.month - 1] : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {best2025 ? `${best2025.new_leads} leads` : "Sin datos"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Mejor mes 2024
            </p>
            <p className="text-xl font-bold">
              {best2024 ? MONTH_NAMES[best2024.month - 1] : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {best2024 ? `${best2024.new_leads} leads` : "Sin datos"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Crecimiento YoY
            </p>
            <p
              className={`text-xl font-bold ${
                yoyGrowth == null
                  ? ""
                  : Number(yoyGrowth) >= 0
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {yoyGrowth != null ? `${Number(yoyGrowth) >= 0 ? "+" : ""}${yoyGrowth}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">2025 vs 2024 (mismos meses)</p>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                />
                <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                {show2024 && (
                  <Line
                    type="monotone"
                    dataKey="leads2024"
                    name="2024"
                    stroke="#9ca3af"
                    strokeDasharray="5 3"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                )}
                {show2025 && (
                  <Line
                    type="monotone"
                    dataKey="leads2025"
                    name="2025"
                    stroke="hsl(214, 71%, 28%)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      {data2025.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Desglose Mensual 2025</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">New Leads</TableHead>
                  <TableHead className="text-right">Clientes</TableHead>
                  <TableHead className="text-right">Visitas</TableHead>
                  <TableHead className="text-right">Conv%</TableHead>
                  <TableHead className="text-right">vs 2024</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data2025.map((row) => {
                  const d24 = data2024.find((d) => d.month === row.month);
                  const vs =
                    d24
                      ? row.new_leads - d24.new_leads
                      : null;
                  return (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">
                        {MONTH_NAMES[row.month - 1]}
                      </TableCell>
                      <TableCell className="text-right">{row.new_leads}</TableCell>
                      <TableCell className="text-right">{row.total_clients}</TableCell>
                      <TableCell className="text-right">{row.visits_completed}</TableCell>
                      <TableCell className="text-right">
                        {row.conversion_rate?.toFixed(1)}%
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          vs == null ? "" : vs >= 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {vs == null ? "—" : `${vs >= 0 ? "+" : ""}${vs}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
