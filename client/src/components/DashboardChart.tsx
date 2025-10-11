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
  );
}
