<<<<<<< HEAD
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";
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
import { format } from "date-fns";

interface ChartData {
  label: string;
  new_leads: number;
  appointments_created: number;
  visits_completed: number;
}

export function DashboardChart({ start, end }: { start: Date; end: Date }) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      // ✅ NO pongas comillas en los query params
      const startStr = encodeURIComponent(format(start, "yyyy-MM-dd"));
      const endStr = encodeURIComponent(format(end, "yyyy-MM-dd"));

      // Si apiGet ya antepone /api, esta ruta es correcta
      const result = await apiGet<ChartData[]>(
        `/dashboard/chart-data?start=${startStr}&end=${endStr}`
      );

      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error(err);
      toast.error("Error loading chart data");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Activity Overview</h2>

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
          <Bar
            dataKey="appointments_created"
            name="Appointments Created"
            fill="#f59e0b"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="visits_completed"
            name="Visits Completed"
            fill="#3b82f6"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
=======
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// TODO: remove mock functionality - fetch real data from API
const mockData = [
  { status: 'GREEN', count: 45, fill: 'hsl(160 70% 50%)' },
  { status: 'YELLOW', count: 32, fill: 'hsl(40 85% 55%)' },
  { status: 'RED', count: 18, fill: 'hsl(6 79% 55%)' },
  { status: 'OTHER', count: 12, fill: 'hsl(214 20% 55%)' },
];

export function DashboardChart() {
  return (
    <Card className="rounded-2xl shadow-sm p-6" data-testid="card-chart">
      <h3 className="text-lg font-semibold mb-4">Leads by Status</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={mockData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis 
            dataKey="status" 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
  );
}
