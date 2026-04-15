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
import { apiGet, API_BASE_URL } from "@/lib/api";

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
        setDataPrev(rPrev);
        setDataCurr(rCurr);
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
      const year  = CURR_YEAR;
      const month = new Date().getMonth() + 1;
      const token = sessionStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/dashboard/csv/monthly?year=${year}&month=${month}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `trends_${year}_${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Error exporting CSV");
    }
  };

  // Summary chips
  const bestCurr = dataCurr.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best), null
  );
  const bestPrev = dataPrev.reduce<MonthlyData | null>(
    (best, d) => (!best || d.new_leads > best.new_leads ? d : best), null
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tendencias Anuales</h2>
          <p className="text-sm text-muted-foreground">
            Comparativa de leads por mes — {PREV_YEAR} vs {CURR_YEAR}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowPrev((v) => !v)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              showPrev
                ? "bg-gray-200 text-gray-800 border-gray-400"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {PREV_YEAR} {showPrev ? "✓" : ""}
          </button>
          <button
            onClick={() => setShowCurr((v) => !v)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              showCurr
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {CURR_YEAR} {showCurr ? "✓" : ""}
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
              Mejor mes {CURR_YEAR}
            </p>
            <p className="text-xl font-bold">
              {bestCurr ? MONTH_NAMES[bestCurr.month - 1] : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {bestCurr ? `${bestCurr.new_leads} leads` : "Sin datos aún"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Mejor mes {PREV_YEAR}
            </p>
            <p className="text-xl font-bold">
              {bestPrev ? MONTH_NAMES[bestPrev.month - 1] : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {bestPrev ? `${bestPrev.new_leads} leads` : "Sin datos"}
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
                yoyGrowth == null ? "" : Number(yoyGrowth) >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {yoyGrowth != null ? `${Number(yoyGrowth) >= 0 ? "+" : ""}${yoyGrowth}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {CURR_YEAR} vs {PREV_YEAR} (mismos meses)
            </p>
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
              Cargando...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                {showPrev && (
                  <Line
                    type="monotone"
                    dataKey={`leads${PREV_YEAR}`}
                    name={String(PREV_YEAR)}
                    stroke="#9ca3af"
                    strokeDasharray="5 3"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                )}
                {showCurr && (
                  <Line
                    type="monotone"
                    dataKey={`leads${CURR_YEAR}`}
                    name={String(CURR_YEAR)}
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

      {/* Monthly Breakdown Table — año actual */}
      {dataCurr.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Desglose Mensual {CURR_YEAR}</CardTitle>
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
                  <TableHead className="text-right">vs {PREV_YEAR}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataCurr.map((row) => {
                  const dP  = dataPrev.find((d) => d.month === row.month);
                  const vs  = dP != null ? row.new_leads - dP.new_leads : null;
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
