import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

interface ChartData {
  label: string;
  new_leads: number;
  routed: number;
  contacted: number;
  clients: number;
  visits_completed: number;
}

type Granularity = "day" | "week" | "month";

const granularityLabel: Record<Granularity, string> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

export function DashboardChart({ data, loading, granularity = "day" }: { data: ChartData[]; loading?: boolean; granularity?: Granularity }) {

  return (
    <div className="bg-card rounded-2xl shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-1">Activity Overview</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Aggregation: {granularityLabel[granularity]}
      </p>

      {loading && (
        <p className="text-sm text-muted-foreground mb-2">Loading chart...</p>
      )}
      {!loading && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No data for the selected range.
        </p>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="18%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            // ➜ escala se adapta a la cantidad (con un pequeño headroom)
            domain={[0, (max: number) => Math.max(5, Math.ceil(max * 1.15))]}
          />
          <Tooltip
            formatter={(value: number) => value?.toLocaleString?.() ?? value}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            }}
          />
          <Legend />

          {/* Barras agrupadas */}
          <Bar
            dataKey="new_leads"
            name="New Leads"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
          />
          <Bar dataKey="routed" name="Routed" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          <Bar dataKey="contacted" name="Contacted" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          <Bar dataKey="clients" name="Clients" fill="#a855f7" radius={[6, 6, 0, 0]} />
          <Bar
            dataKey="visits_completed"
            name="Visits Completed"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
