import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Users,
  HelpCircle,
  Send,
  UserCheck,
  Calendar,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
  PieChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "./KpiCard";
import { apiGet } from "@/lib/api";

interface LeadQualityItem {
  name: string;
  value: number;
  fill?: string;
}

interface Metrics {
  total_leads: number;
  new_leads: number;
  leads_in_route: number;
  upcoming_appointments: number;
  completed_visits: number;
  total_clients: number;
  unclassified_leads: number;
  en_delivery: number;
  second_attempt_due: number;
  conversion_rate: number;
  lead_quality: LeadQualityItem[];
}

interface ChartDataPoint {
  label: string;
  new_leads: number;
  appointments_created: number;
  visits_completed: number;
}

interface FunnelStep {
  key: string;
  label: string;
  value: number;
}

interface OverviewTabProps {
  start: Date;
  end: Date;
}

type Granularity = "daily" | "weekly" | "monthly";

const CHART_COLORS = {
  blue: "hsl(214, 71%, 28%)",
  amber: "hsl(40, 85%, 45%)",
  green: "hsl(160, 70%, 38%)",
};

const FUNNEL_COLORS = [
  "hsl(214, 71%, 28%)",
  "hsl(40, 85%, 45%)",
  "hsl(160, 70%, 38%)",
  "hsl(160, 60%, 25%)",
];

const FUNNEL_WIDTHS = ["100%", "75%", "50%", "35%"];

const QUALITY_COLORS: Record<string, string> = {
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  red: "#ef4444",
  unclassified: "#94a3b8",
};

function LeadQualityDonut({ data }: { data: LeadQualityItem[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">No data</p>;

  const segments: { pct: number; color: string; label: string }[] = data.map((d) => ({
    pct: d.value / total,
    color: d.fill ?? QUALITY_COLORS[d.name?.toLowerCase()] ?? "#9ca3af",
    label: d.name ?? "N/A",
  }));

  // Build SVG donut
  const radius = 28;
  const cx = 34;
  const cy = 34;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = seg.pct * circumference;
    const gap = circumference - dash;
    const arc = { dash, gap, offset, color: seg.color, label: seg.label, pct: seg.pct };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-3 mt-1">
      <svg width="68" height="68" viewBox="0 0 68 68">
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset + circumference * 0.25}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <circle cx={cx} cy={cy} r={radius - strokeWidth / 2 - 2} fill="var(--card)" />
      </svg>
      <div className="flex flex-col gap-0.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-[10px] text-muted-foreground">
              {seg.label === "unclassified" ? "Sin clasif." : seg.label.charAt(0).toUpperCase() + seg.label.slice(1)}{" "}
              <span className="font-medium">{Math.round(seg.pct * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewTab({ start, end }: OverviewTabProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartGranularity, setChartGranularity] = useState<Granularity>("weekly");
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(false);

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, f] = await Promise.all([
        apiGet<Metrics>(
          `/dashboard/metrics?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
        ),
        apiGet<FunnelStep[]>("/dashboard/funnel"),
      ]);
      setMetrics(m);
      setFunnelData(f);
    } catch (err: any) {
      toast.error(err?.message ?? "Error loading overview");
    } finally {
      setLoading(false);
    }
  }, [startStr, endStr]);

  const fetchChart = useCallback(
    async (granularity: Granularity) => {
      try {
        const data = await apiGet<ChartDataPoint[]>(
          `/dashboard/chart-data?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}&granularity=${granularity}`
        );
        setChartData(data);
      } catch (err: any) {
        toast.error(err?.message ?? "Error loading chart");
      }
    },
    [startStr, endStr]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchChart(chartGranularity);
  }, [fetchChart, chartGranularity]);

  if (loading && !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const quality = metrics?.lead_quality ?? [];

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {((metrics?.unclassified_leads ?? 0) > 0 ||
        (metrics?.second_attempt_due ?? 0) > 0) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {(metrics?.unclassified_leads ?? 0) > 0 && (
            <div className="flex-1 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-2.5 text-sm">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>
                <button className="font-semibold underline underline-offset-2">
                  {metrics!.unclassified_leads} leads sin clasificar
                </button>{" "}
                requieren atención
              </span>
            </div>
          )}
          {(metrics?.second_attempt_due ?? 0) > 0 && (
            <div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-2.5 text-sm">
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>
                <strong>{metrics!.second_attempt_due} leads</strong> necesitan 2do intento hoy
              </span>
            </div>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Row 1 */}
        <KpiCard
          title="Total Leads"
          value={metrics?.total_leads ?? "—"}
          icon={<Users className="w-4 h-4 text-blue-700" />}
          iconBg="bg-blue-50"
          subtitle="Leads totales en el sistema"
        />
        <KpiCard
          title="Sin Clasificar"
          value={metrics?.unclassified_leads ?? "—"}
          icon={<HelpCircle className="w-4 h-4 text-amber-700" />}
          iconBg="bg-amber-50"
          alert={(metrics?.unclassified_leads ?? 0) > 0}
          subtitle="Leads pendientes de clasificación"
        />
        <KpiCard
          title="En Delivery"
          value={metrics?.en_delivery ?? "—"}
          icon={<Send className="w-4 h-4 text-purple-700" />}
          iconBg="bg-purple-50"
          subtitle="Leads enviados a delivery"
        />

        {/* Row 2 */}
        <KpiCard
          title="Total Clientes"
          value={metrics?.total_clients ?? "—"}
          icon={<UserCheck className="w-4 h-4 text-green-700" />}
          iconBg="bg-green-50"
          subtitle="Clientes activos"
        />
        <KpiCard
          title="Próximas Citas"
          value={metrics?.upcoming_appointments ?? "—"}
          icon={<Calendar className="w-4 h-4 text-amber-700" />}
          iconBg="bg-amber-50"
          subtitle="Citas programadas"
        />
        <KpiCard
          title="Visitas Completadas"
          value={metrics?.completed_visits ?? "—"}
          icon={<CheckCircle2 className="w-4 h-4 text-green-700" />}
          iconBg="bg-green-50"
          subtitle="En el período seleccionado"
        />

        {/* Row 3 */}
        <KpiCard
          title="2do Intento Hoy"
          value={metrics?.second_attempt_due ?? "—"}
          icon={<RotateCcw className="w-4 h-4 text-red-700" />}
          iconBg="bg-red-50"
          alert={(metrics?.second_attempt_due ?? 0) > 0}
          subtitle="Requieren seguimiento hoy"
        />
        <KpiCard
          title="Tasa de Conversión"
          value={
            metrics?.conversion_rate != null
              ? `${metrics.conversion_rate.toFixed(1)}%`
              : "—"
          }
          icon={<TrendingUp className="w-4 h-4 text-blue-700" />}
          iconBg="bg-blue-50"
          subtitle="Leads → Clientes"
        />

        {/* Lead Quality Card */}
        <Card className="relative overflow-hidden transition-shadow duration-200 hover:shadow-md hover:-translate-y-0.5">
          <CardContent className="p-5">
            <div className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100">
              <PieChart className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 pr-12">
              Calidad de Leads
            </p>
            <LeadQualityDonut data={quality} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Chart + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Chart (2/3 width) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-semibold">Activity Overview</CardTitle>
              <div className="flex gap-1">
                {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setChartGranularity(g)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      chartGranularity === g
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                />
                <Bar dataKey="new_leads" name="New Leads" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} />
                <Bar
                  dataKey="appointments_created"
                  name="Appointments"
                  fill={CHART_COLORS.amber}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="visits_completed"
                  name="Visits"
                  fill={CHART_COLORS.green}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex gap-4 justify-center mt-2 flex-wrap">
              {[
                { color: CHART_COLORS.blue, label: "New Leads" },
                { color: CHART_COLORS.amber, label: "Appointments" },
                { color: CHART_COLORS.green, label: "Visits" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Funnel (1/3 width) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {funnelData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No funnel data</p>
            ) : (
              funnelData.map((step, idx) => {
                const widthClass = FUNNEL_WIDTHS[idx] ?? "30%";
                const nextStep = funnelData[idx + 1];
                const dropPct =
                  nextStep && step.value > 0
                    ? (((step.value - nextStep.value) / step.value) * 100).toFixed(0)
                    : null;

                return (
                  <div key={idx}>
                    <div
                      className="flex items-center justify-between px-3 py-2 rounded text-white text-sm font-medium"
                      style={{
                        width: widthClass,
                        backgroundColor: FUNNEL_COLORS[idx] ?? FUNNEL_COLORS[FUNNEL_COLORS.length - 1],
                        minWidth: 120,
                      }}
                    >
                      <span className="truncate">{step.label}</span>
                      <span className="ml-2 font-bold">{step.value}</span>
                    </div>
                    {dropPct && (
                      <p className="text-[10px] text-red-500 pl-1 mt-0.5">
                        ↓ -{dropPct}% drop-off
                      </p>
                    )}
                  </div>
                );
              })
            )}
            {funnelData.length > 1 && (
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border mt-2">
                Drop-off entre etapas del pipeline
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
