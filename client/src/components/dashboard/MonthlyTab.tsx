import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
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
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
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

  // Find best week by new_leads
  const bestWeek = data?.weeks.reduce<WeekRow | null>(
    (best, w) => (!best || w.new_leads > best.new_leads ? w : best),
    null
  );

  return (
    <div className="space-y-6">
      {/* Header + selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reporte Mensual</h2>
          <p className="text-sm text-muted-foreground">Desglose semanal del mes seleccionado</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI mini-cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  New Leads
                </p>
                <p className="text-2xl font-bold">{data.summary.leads}</p>
                <p className="text-xs text-muted-foreground">{data.label}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Nuevos Clientes
                </p>
                <p className="text-2xl font-bold">{data.summary.clients}</p>
                <p className="text-xs text-muted-foreground">Convertidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Visitas
                </p>
                <p className="text-2xl font-bold">{data.summary.visits}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Conversión
                </p>
                <p className="text-2xl font-bold">{data.summary.conv_pct}</p>
                <p className="text-xs text-muted-foreground">Delivery → Cliente</p>
              </CardContent>
            </Card>
          </div>

          {/* Extra summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Green Clasificados
                </p>
                <p className="text-xl font-bold text-green-700">{data.summary.green}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Deliveries Enviados
                </p>
                <p className="text-xl font-bold text-purple-700">{data.summary.delivery}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Citas Creadas
                </p>
                <p className="text-xl font-bold text-amber-700">{data.summary.appts}</p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Best week chip */}
      {bestWeek && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium">
          <span className="text-amber-500">★</span>
          Mejor semana: <strong>Semana {bestWeek.week}</strong> — {bestWeek.new_leads} leads
        </div>
      )}

      {/* Weekly breakdown table */}
      {data && data.weeks.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Desglose Semanal — {data.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead className="text-right">New Leads</TableHead>
                  <TableHead className="text-right">Green</TableHead>
                  <TableHead className="text-right">Delivery</TableHead>
                  <TableHead className="text-right">Citas</TableHead>
                  <TableHead className="text-right">Visitas</TableHead>
                  <TableHead className="text-right">Clientes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.weeks.map((row) => (
                  <TableRow key={row.week}>
                    <TableCell className="font-medium text-sm">
                      Semana {row.week}
                    </TableCell>
                    <TableCell className="text-right">{row.new_leads}</TableCell>
                    <TableCell className="text-right text-green-700 font-medium">
                      {row.green_classified}
                    </TableCell>
                    <TableCell className="text-right text-purple-700 font-medium">
                      {row.delivery_sent}
                    </TableCell>
                    <TableCell className="text-right">{row.appointments}</TableCell>
                    <TableCell className="text-right">{row.visits}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.new_clients}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !loading && data ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay datos para {MONTH_NAMES[month - 1]} {year}.
        </p>
      ) : null}
    </div>
  );
}
