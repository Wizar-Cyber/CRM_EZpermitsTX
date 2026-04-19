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
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { KpiCard } from "./KpiCard";
import { apiGet } from "@/lib/api";

export interface LeadQualityItem {
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

const FUNNEL_GRADIENTS = ["grad1", "grad2", "grad3", "grad4", "grad5"];

const QUALITY_COLORS: Record<string, string> = {
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  red: "#ef4444",
  unclassified: "#94a3b8",
};

const QUALITY_LABELS: Record<string, string> = {
  green: "Green",
  blue: "Blue",
  yellow: "Yellow",
  red: "Red",
  unclassified: "Sin color",
};

// The 4 main colors always shown in legend order
const MAIN_COLORS = ["green", "blue", "yellow", "red"];

function LeadQualityDonut({ data }: { data: LeadQualityItem[] }) {
  const byName = Object.fromEntries(data.map((d) => [d.name, d]));
  const total = data.reduce((s, d) => s + d.value, 0);

  // Only draw arcs for buckets with value > 0
  const activeSegments = data.filter((d) => d.value > 0);
  const activeTotal = activeSegments.reduce((s, d) => s + d.value, 0);

  const radius = 28;
  const cx = 34;
  const cy = 34;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = activeSegments.map((d) => {
    const pct = activeTotal > 0 ? d.value / activeTotal : 0;
    const dash = pct * circumference;
    const arc = { dash, gap: circumference - dash, offset, color: d.fill ?? QUALITY_COLORS[d.name] ?? "#9ca3af" };
    offset += dash;
    return arc;
  });

  // Legend: always show the 4 main colors first, then "Sin color" if it has value
  const legendItems = [
    ...MAIN_COLORS.map((key) => ({
      key,
      label: QUALITY_LABELS[key],
      color: QUALITY_COLORS[key],
      value: byName[key]?.value ?? 0,
    })),
    ...(byName["unclassified"]?.value
      ? [{ key: "unclassified", label: "Sin color", color: QUALITY_COLORS.unclassified, value: byName["unclassified"].value }]
      : []),
  ];

  return (
    <div className="flex items-center gap-3 mt-1">
      {total > 0 ? (
        <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={radius}
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
      ) : (
        <div className="w-[68px] h-[68px] shrink-0 rounded-full border-4 border-muted" />
      )}
      <div className="flex flex-col gap-0.5">
        {legendItems.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color, opacity: item.value === 0 ? 0.35 : 1 }}
            />
            <span className={`text-[10px] ${item.value === 0 ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
              {item.label}
            </span>
            <span className={`text-[10px] font-semibold ml-auto pl-2 ${item.value === 0 ? "text-muted-foreground/40" : "text-foreground"}`}>
              {item.value === 0 ? "—" : item.value.toLocaleString()}
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
        apiGet<FunnelStep[]>(`/dashboard/funnel?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`),
      ]);
      setMetrics(m);
      setFunnelData(Array.isArray(f) ? f : []);
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
        setChartData(Array.isArray(data) ? data : []);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leads"
          value={metrics?.total_leads ?? "—"}
          icon={<Users className="w-4 h-4" />}
          iconBg="bg-blue-50 text-blue-500"
          subtitle="Leads totales en el sistema"
          sparkline={{ color: "#3b82f6", gradientId: "spk-total", data: [10, 20, 15, 30, 25, 45, 50] }}
        />
        <KpiCard
          title="Sin Clasificar"
          value={metrics?.unclassified_leads ?? "—"}
          icon={<HelpCircle className="w-4 h-4" />}
          iconBg="bg-amber-50 text-amber-500"
          alert={(metrics?.unclassified_leads ?? 0) > 0}
          subtitle="Leads pendientes de clasificación"
          sparkline={{ color: "#ef4444", gradientId: "spk-unclass", data: [10, 15, 12, 25, 22, 35, 40] }}
        />
        <KpiCard
          title="En Delivery"
          value={metrics?.en_delivery ?? "—"}
          icon={<Send className="w-4 h-4" />}
          iconBg="bg-purple-50 text-purple-500"
          subtitle="Leads enviados a delivery"
        />
        <KpiCard
          title="Total Clientes"
          value={metrics?.total_clients ?? "—"}
          icon={<UserCheck className="w-4 h-4" />}
          iconBg="bg-emerald-50 text-emerald-500"
          subtitle="Clientes activos"
        />
        <KpiCard
          title="Próximas Citas"
          value={metrics?.upcoming_appointments ?? "—"}
          icon={<Calendar className="w-4 h-4" />}
          iconBg="bg-amber-50 text-amber-500"
          subtitle="Citas programadas"
        />
        <KpiCard
          title="Tasa de Conversión"
          value={
            metrics?.conversion_rate != null
              ? `${metrics.conversion_rate.toFixed(1)}%`
              : "—"
          }
          icon={<TrendingUp className="w-4 h-4" />}
          iconBg="bg-blue-50 text-blue-500"
          subtitle="Leads → Clientes"
          sparkline={{ color: "#3b82f6", gradientId: "spk-conv", data: [20, 10, 30, 15, 25, 15, 20] }}
        />
        <KpiCard
          title="Visitas Completadas"
          value={metrics?.completed_visits ?? "—"}
          icon={<CheckCircle2 className="w-4 h-4" />}
          iconBg="bg-emerald-50 text-emerald-500"
          subtitle="En el período seleccionado"
        />
        <KpiCard
          title="2do Intento Hoy"
          value={metrics?.second_attempt_due ?? "—"}
          icon={<RotateCcw className="w-4 h-4" />}
          iconBg="bg-red-50 text-red-500"
          alert={(metrics?.second_attempt_due ?? 0) > 0}
          subtitle="Requieren seguimiento hoy"
        />
      </div>

      {/* Bottom: Chart + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
            <h3 className="font-semibold text-lg text-slate-800">Activity Overview</h3>
            <div className="flex bg-slate-100 rounded-md p-1">
              {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setChartGranularity(g)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    chartGranularity === g
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAppt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="new_leads"
                  name="New Leads"
                  stackId="1"
                  stroke="#2563eb"
                  fill="url(#colorNew)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="appointments_created"
                  name="Appointments"
                  stackId="1"
                  stroke="#6366f1"
                  fill="url(#colorAppt)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="visits_completed"
                  name="Visits"
                  stackId="1"
                  stroke="#94a3b8"
                  fill="#e2e8f0"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center items-center mt-6 space-x-6 flex-wrap">
            <div className="flex items-center text-xs text-slate-600 font-medium">
              <span className="w-3 h-3 rounded-sm bg-blue-600 mr-2"></span> New Leads
            </div>
            <div className="flex items-center text-xs text-slate-600 font-medium">
              <span className="w-3 h-3 rounded-sm bg-indigo-400 mr-2"></span> Appointments
            </div>
            <div className="flex items-center text-xs text-slate-600 font-medium">
              <span className="w-3 h-3 rounded-sm bg-slate-300 mr-2"></span> Visits
            </div>
          </div>
        </div>

        {/* Pipeline Funnel (1/3 width) — SVG with gradients */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 overflow-hidden flex flex-col">
          <h3 className="font-semibold text-lg text-slate-800 mb-4">Pipeline Funnel</h3>
          <div className="flex-1 flex items-center justify-center w-full min-h-[350px]">
            {funnelData.length === 0 ? (
              <p className="text-xs text-slate-500">No funnel data</p>
            ) : (
              <svg
                viewBox="0 0 400 350"
                className="w-full h-full max-w-[360px] drop-shadow-md overflow-visible"
              >
                <defs>
                  <clipPath id="funnel-curve">
                    <path d="M 0,0 L 400,0 C 330,150 290,250 260,350 L 140,350 C 110,250 70,150 0,0 Z" />
                  </clipPath>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="50%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                  <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#b45309" />
                    <stop offset="50%" stopColor="#fde047" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                  <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="50%" stopColor="#6ee7b7" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#065f46" />
                    <stop offset="50%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#065f46" />
                  </linearGradient>
                  <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#022c22" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#022c22" />
                  </linearGradient>
                </defs>

                <g clipPath="url(#funnel-curve)">
                  {funnelData.slice(0, 5).map((step, i) => {
                    const y = i * 70;
                    const height = i === 4 ? 70 : 68;
                    const originY = y + height / 2;
                    const next = funnelData[i + 1];
                    const dropPct =
                      next && step.value > 0
                        ? Math.round(((step.value - next.value) / step.value) * 100)
                        : null;
                    return (
                      <g
                        key={step.key ?? i}
                        className="cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 hover:animate-pulse"
                        style={{ transformOrigin: `200px ${originY}px` }}
                      >
                        <rect
                          x="0"
                          y={y}
                          width="400"
                          height={height}
                          fill={`url(#${FUNNEL_GRADIENTS[i]})`}
                        />
                        <text
                          x="200"
                          y={y + 32}
                          fill="white"
                          fontSize="14"
                          fontWeight="500"
                          textAnchor="middle"
                          style={{ pointerEvents: "none" }}
                        >
                          {step.label}
                        </text>
                        <text
                          x="200"
                          y={y + 54}
                          fill="white"
                          fontSize="20"
                          fontWeight="bold"
                          textAnchor="middle"
                          style={{ pointerEvents: "none" }}
                        >
                          {step.value}
                        </text>
                        {dropPct !== null && dropPct > 0 && (
                          <text
                            x="200"
                            y={y + height - 4}
                            fill="rgba(255,255,255,0.85)"
                            fontSize="10"
                            fontWeight="600"
                            textAnchor="middle"
                            style={{ pointerEvents: "none" }}
                          >
                            ↓ {dropPct}% drop-off
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
