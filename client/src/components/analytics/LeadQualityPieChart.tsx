import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeadQualityData, QualityCategory } from '@/features/analytics/types';
import { QUALITY_COLORS } from '@/features/analytics/types';

interface LeadQualityPieChartProps {
  data: LeadQualityData[];
  isLoading: boolean;
  onSegmentClick: (category: QualityCategory) => void;
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function LeadQualityPieChart({ data, isLoading, onSegmentClick }: LeadQualityPieChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Calidad de Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    name: item.quality,
    value: item.count,
    color: QUALITY_COLORS[item.quality]
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Calidad de Leads</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              onClick={(data) => onSegmentClick(data.name as QualityCategory)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [value, 'Leads']}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center text-sm text-muted-foreground mt-4">
          Haz click en un segmento para ver detalles
        </div>
      </CardContent>
    </Card>
  );
}