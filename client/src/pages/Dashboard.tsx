import { useEffect, useMemo, useState } from "react";
import { DashboardCard } from "@/components/DashboardCard";
import { DashboardChart } from "@/components/DashboardChart";
import {
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  CheckCircle2,
  CalendarRange,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type QualityBreakdown = { quality_bucket: string; value: number };
type StateBreakdown = { state: string; value: number };

type DashboardV2 = {
  range: { start: string; end: string; days: number; granularity?: "day" | "week" | "month" };
  filters: { classification: string; state: string };
  overview: {
    total_leads: number;
    new_leads: number;
    discarded_leads: number;
    in_delivery_pipeline: number;
    contacted_leads: number;
    closed_leads: number;
    total_clients: number;
    clients_created_period: number;
  };
  funnel: {
    captured: number;
    qualified: number;
    routed: number;
    contacted: number;
    clients: number;
    appointments: number;
    visits_completed: number;
  };
  conversion: {
    lead_to_client_rate: number;
    routed_to_contacted_rate: number;
    client_to_appointment_rate: number;
    appointment_to_visit_rate: number;
  };
  delivery: {
    currently_in_delivery: number;
    second_attempt_due: number;
    avg_delivery_attempts: number;
    re_sent_count: number;
    second_attempt_count: number;
  };
  appointments: {
    upcoming: number;
    completed_period: number;
    created_period: number;
  };
  rankings: {
    routes: Array<{
      provider: string;
      created_by: string;
      route_id: number;
      route_name: string;
      leads_assigned: number;
      contacted: number;
      re_sent: number;
      contact_rate: number;
    }>;
  };
  alerts: Array<{
    key: string;
    severity: "low" | "medium" | "high";
    title: string;
    count: number;
    description: string;
  }>;
  breakdowns: {
    quality: QualityBreakdown[];
    states: StateBreakdown[];
  };
  timeseries: Array<{
    label: string;
    new_leads: number;
    routed: number;
    contacted: number;
    clients: number;
    visits_completed: number;
  }>;
};

type DrilldownResponse = {
  metric: string;
  label: string;
  range: { start: string; end: string };
  filters: { classification: string; state: string };
  count: number;
  rows: Array<Record<string, any>>;
};

const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const n = (value: number) => Number(value || 0).toLocaleString();

export default function Dashboard() {
  const [data, setData] = useState<DashboardV2 | null>(null);
  const [start, setStart] = useState(() => new Date(new Date().setDate(new Date().getDate() - 30)));
  const [end, setEnd] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [drillMetric, setDrillMetric] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<DrilldownResponse | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      const response = await apiGet<DashboardV2>(
        `/dashboard/v2?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
      );
      setData(response);
    } catch (err: any) {
      console.error("Error loading metrics:", err);
      toast.error("Error loading metrics");
    } finally {
      setLoading(false);
    }
  };

  const openDrilldown = async (metric: string) => {
    try {
      setDrillMetric(metric);
      setDrillLoading(true);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");
      const response = await apiGet<DrilldownResponse>(
        `/dashboard/v2/drilldown?metric=${encodeURIComponent(metric)}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
      );
      setDrillData(response);
    } catch (err: any) {
      console.error("Error loading drilldown:", err);
      toast.error(err?.message || "Error loading metric details");
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const handlePreset = (days: number) => {
    setStart(new Date(new Date().setDate(new Date().getDate() - days)));
    setEnd(new Date());
  };

  const qualityMap = useMemo(() => {
    const map = new Map<string, number>();
    (data?.breakdowns?.quality || []).forEach((row) => map.set(row.quality_bucket, Number(row.value || 0)));
    return map;
  }, [data]);

  if (!data) return <p className="text-muted-foreground">Loading dashboard...</p>;

  const funnelSteps = [
    { key: "captured", label: "Captured", value: Number(data.funnel.captured || 0), drillMetric: "captured" },
    { key: "qualified", label: "Qualified", value: Number(data.funnel.qualified || 0), drillMetric: "qualified" },
    { key: "routed", label: "Routed", value: Number(data.funnel.routed || 0), drillMetric: "routed" },
    { key: "contacted", label: "Contacted", value: Number(data.funnel.contacted || 0), drillMetric: "contacted" },
    { key: "clients", label: "Clients", value: Number(data.funnel.clients || 0), drillMetric: "clients" },
    { key: "appointments", label: "Appointments", value: Number(data.funnel.appointments || 0), drillMetric: "appointments" },
    { key: "visits_completed", label: "Visits Done", value: Number(data.funnel.visits_completed || 0), drillMetric: "visits_completed" },
  ];

  const funnelMax = Math.max(...funnelSteps.map((s) => s.value), 1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          <CalendarRange className="w-5 h-5 text-muted-foreground" />
          <Button variant="outline" onClick={() => handlePreset(7)}>Last 7 days</Button>
          <Button variant="outline" onClick={() => handlePreset(30)}>Last 30 days</Button>
          <Button variant="outline" onClick={() => handlePreset(90)}>Last 90 days</Button>
          <input
            type="date"
            className="rounded-md border px-2 py-1 text-sm"
            value={format(start, "yyyy-MM-dd")}
            onChange={(e) => setStart(new Date(`${e.target.value}T00:00:00`))}
          />
          <input
            type="date"
            className="rounded-md border px-2 py-1 text-sm"
            value={format(end, "yyyy-MM-dd")}
            onChange={(e) => setEnd(new Date(`${e.target.value}T00:00:00`))}
          />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Updating metrics...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Total Leads" value={n(data.overview.total_leads)} icon={Users} trend="Current filtered universe" />
        <DashboardCard title="New Leads" value={n(data.overview.new_leads)} icon={TrendingUp} trend="Created in selected range" iconBgColor="bg-emerald-500/10" />
        <DashboardCard title="In Delivery Pipeline" value={n(data.overview.in_delivery_pipeline)} icon={MapPin} trend="IN_DELIVERY / RE-SENT / SECOND_ATTEMPT" iconBgColor="bg-blue-500/10" />
        <DashboardCard title="Total Clients" value={n(data.overview.total_clients)} icon={UserCheck} trend="Lead → Client converted" iconBgColor="bg-purple-500/10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard title="Upcoming Appointments" value={n(data.appointments.upcoming)} icon={Calendar} trend="Future scheduled visits" iconBgColor="bg-amber-500/10" />
        <DashboardCard title="Completed Visits" value={n(data.appointments.completed_period)} icon={CheckCircle2} trend="Visited / Done in range" iconBgColor="bg-green-500/10" />
        <DashboardCard title="Second Attempt Due" value={n(data.delivery.second_attempt_due)} icon={AlertTriangle} trend="Needs immediate action" iconBgColor="bg-red-500/10" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Conversion Rates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3"><span className="text-muted-foreground">Lead → Client</span><p className="text-2xl font-bold">{pct(data.conversion.lead_to_client_rate)}</p></div>
            <div className="rounded-lg border p-3"><span className="text-muted-foreground">Routed → Contacted</span><p className="text-2xl font-bold">{pct(data.conversion.routed_to_contacted_rate)}</p></div>
            <div className="rounded-lg border p-3"><span className="text-muted-foreground">Client → Appointment</span><p className="text-2xl font-bold">{pct(data.conversion.client_to_appointment_rate)}</p></div>
            <div className="rounded-lg border p-3"><span className="text-muted-foreground">Appointment → Visit</span><p className="text-2xl font-bold">{pct(data.conversion.appointment_to_visit_rate)}</p></div>
          </div>
        </Card>

        <Card className="rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Lead Quality Distribution</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Green</p><p className="text-xl font-bold">{n(qualityMap.get("green") || 0)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Yellow</p><p className="text-xl font-bold">{n(qualityMap.get("yellow") || 0)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Blue</p><p className="text-xl font-bold">{n(qualityMap.get("blue") || 0)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Red</p><p className="text-xl font-bold">{n(qualityMap.get("red") || 0)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Unclassified</p><p className="text-xl font-bold">{n(qualityMap.get("unclassified") || 0)}</p></div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Operational Funnel</h2>
        <div className="space-y-3">
          {funnelSteps.map((step) => (
            <div key={step.key}>
              <div className="flex items-center justify-between text-sm mb-1 gap-2">
                <span className="font-medium">{step.label}</span>
                <div className="inline-flex items-center gap-2">
                  <span>{n(step.value)}</span>
                  <Button size="sm" variant="ghost" onClick={() => openDrilldown(step.drillMetric)}>
                    View
                  </Button>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-muted">
                <div
                  className="h-2.5 rounded-full bg-primary"
                  style={{ width: `${Math.max(4, (step.value / funnelMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Delivery Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-md border p-3"><p className="text-muted-foreground">Currently In Delivery</p><p className="text-xl font-bold">{n(data.delivery.currently_in_delivery)}</p></div>
          <div className="rounded-md border p-3"><p className="text-muted-foreground">Re-sent to Delivery</p><p className="text-xl font-bold">{n(data.delivery.re_sent_count)}</p></div>
          <div className="rounded-md border p-3"><p className="text-muted-foreground">Second Attempt</p><p className="text-xl font-bold">{n(data.delivery.second_attempt_count)}</p></div>
          <div className="rounded-md border p-3"><p className="text-muted-foreground">Avg Delivery Attempts</p><p className="text-xl font-bold">{Number(data.delivery.avg_delivery_attempts || 0).toFixed(2)}</p></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Route / Provider Ranking</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-2 py-2">Route</th>
                  <th className="px-2 py-2">Provider</th>
                  <th className="px-2 py-2 text-right">Assigned</th>
                  <th className="px-2 py-2 text-right">Contacted</th>
                  <th className="px-2 py-2 text-right">Re-sent</th>
                  <th className="px-2 py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {(data.rankings?.routes || []).map((r) => (
                  <tr key={r.route_id} className="border-b">
                    <td className="px-2 py-2">{r.route_name}</td>
                    <td className="px-2 py-2">{r.provider}</td>
                    <td className="px-2 py-2 text-right">{n(r.leads_assigned)}</td>
                    <td className="px-2 py-2 text-right">{n(r.contacted)}</td>
                    <td className="px-2 py-2 text-right">{n(r.re_sent)}</td>
                    <td className="px-2 py-2 text-right font-semibold">{pct(Number(r.contact_rate || 0))}</td>
                  </tr>
                ))}
                {!data.rankings?.routes?.length && (
                  <tr><td className="px-2 py-4 text-muted-foreground" colSpan={6}>No ranking data for selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">SLA Alerts</h2>
          {(data.alerts || []).map((alert) => (
            <div
              key={alert.key}
              className={`rounded-lg border p-3 ${
                alert.severity === "high"
                  ? "border-red-200 bg-red-50"
                  : alert.severity === "medium"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{n(alert.count)}</p>
                  <Button size="sm" variant="outline" onClick={() => openDrilldown(alert.key)}>
                    View
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <DashboardChart data={data.timeseries || []} loading={loading} granularity={data.range.granularity} />

      <Card className="rounded-2xl p-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Range: <strong>{data.range.start}</strong> → <strong>{data.range.end}</strong> · Days: <strong>{data.range.days}</strong>
          </span>
          <span>
            Grouped by: <strong>{data.range.granularity || "day"}</strong>
          </span>
        </div>
      </Card>

      <Dialog open={!!drillMetric} onOpenChange={(open) => !open && (setDrillMetric(null), setDrillData(null))}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{drillData?.label || "Metric details"}</DialogTitle>
            <DialogDescription>
              {drillData ? `${drillData.count} row(s) · ${drillData.range.start} → ${drillData.range.end}` : "Loading details..."}
            </DialogDescription>
          </DialogHeader>

          {drillLoading ? (
            <p className="text-sm text-muted-foreground">Loading details...</p>
          ) : !drillData?.rows?.length ? (
            <p className="text-sm text-muted-foreground">No records for this metric and filter.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 border-b">
                  <tr>
                    {Object.keys(drillData.rows[0]).map((k) => (
                      <th key={k} className="px-3 py-2 text-left whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drillData.rows.map((row, idx) => (
                    <tr key={idx} className="border-b">
                      {Object.keys(drillData.rows[0]).map((k) => (
                        <td key={`${idx}-${k}`} className="px-3 py-2 align-top whitespace-nowrap">
                          {row[k] === null || row[k] === undefined ? "—" : String(row[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
