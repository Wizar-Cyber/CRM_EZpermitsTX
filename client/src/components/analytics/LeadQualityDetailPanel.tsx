import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiGet } from '@/lib/api';
import type {
  QualityCategory,
  LeadQualityTrendsResponse,
  LeadQualityGeographyResponse,
  LeadQualityBacklogResponse,
  LeadQualityPeaksResponse,
} from '@/features/analytics/types';

interface LeadQualityDetailPanelProps {
  selectedCategory: QualityCategory | null;
  dateFrom: Date;
  dateTo: Date;
  groupBy: 'day' | 'month';
}

const CATEGORY_COLORS: Record<string, string> = {
  'Lead': '#22c55e',
  'In Follow-up': '#f59e0b',
  'Other': '#3b82f6',
  'Discarded': '#ef4444',
  'Unclassified': '#94a3b8',
};

type SubTab = 'trends' | 'geography' | 'backlog' | 'peaks';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-md border border-slate-100 text-sm font-medium text-slate-700">
        <div className="text-xs text-slate-500">{label}</div>
        <div>
          {payload[0].name}: <span className="text-slate-900 font-semibold">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function LeadQualityDetailPanel({
  selectedCategory,
  dateFrom,
  dateTo,
  groupBy,
}: LeadQualityDetailPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('trends');
  const [trendsData, setTrendsData] = useState<LeadQualityTrendsResponse['data'] | null>(null);
  const [geographyData, setGeographyData] = useState<LeadQualityGeographyResponse['data'] | null>(null);
  const [backlogData, setBacklogData] = useState<LeadQualityBacklogResponse['metrics'] | null>(null);
  const [peaksData, setPeaksData] = useState<LeadQualityPeaksResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCategory) return;

    const fetchAllViews = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          date_from: dateFrom.toISOString(),
          date_to: dateTo.toISOString(),
          group_by: groupBy,
          quality: selectedCategory,
        });

        const [trends, geography, backlog, peaks] = await Promise.all([
          apiGet(`/analytics/lead-quality?${params}&view=trends`) as Promise<LeadQualityTrendsResponse>,
          apiGet(`/analytics/lead-quality?${params}&view=geography`) as Promise<LeadQualityGeographyResponse>,
          apiGet(`/analytics/lead-quality?${params}&view=backlog`) as Promise<LeadQualityBacklogResponse>,
          apiGet(`/analytics/lead-quality?${params}&view=peaks`) as Promise<LeadQualityPeaksResponse>,
        ]);

        if (trends.view === 'trends') setTrendsData(trends.data);
        if (geography.view === 'geography') setGeographyData(geography.data);
        if (backlog.view === 'backlog') setBacklogData(backlog.metrics);
        if (peaks.view === 'peaks') setPeaksData(peaks.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar los datos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllViews();
  }, [selectedCategory, dateFrom, dateTo, groupBy]);

  if (!selectedCategory) return null;

  const color = CATEGORY_COLORS[selectedCategory] ?? '#3b82f6';
  const badgeBg =
    selectedCategory === 'Lead'
      ? 'bg-[#eaf4eb] text-[#2e7d32] border-[#a3d8a7]/50'
      : selectedCategory === 'In Follow-up'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : selectedCategory === 'Other'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : selectedCategory === 'Discarded'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  const renderTrends = () => {
    if (!trendsData) return null;
    const filtered = trendsData.filter((d) => d.quality === selectedCategory);
    const chartData = filtered.map((d) => ({
      period: new Date(d.period!).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      count: d.count,
    }));

    if (chartData.length === 0) {
      return <p className="text-sm text-slate-500 text-center py-12">Sin datos de tendencia.</p>;
    }

    return (
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="detailColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="period"
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 13 }}
              dy={10}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dx={-10} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="count"
              name={selectedCategory}
              stroke={color}
              strokeWidth={2}
              fill="url(#detailColor)"
              activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderGeography = () => {
    if (!geographyData) return null;
    const filtered = geographyData.filter((d) => d.quality === selectedCategory).slice(0, 10);
    const chartData = filtered.map((d) => ({ zip: d.zip_code, count: d.count }));

    if (chartData.length === 0) {
      return <p className="text-sm text-slate-500 text-center py-12">Sin distribución geográfica.</p>;
    }

    return (
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="0" />
            <XAxis
              dataKey="zip"
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="count" name="Leads" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderBacklog = () => {
    if (!backlogData) return null;
    const items = [
      { label: 'Sin clasificar', value: backlogData.unclassified ?? 0 },
      {
        label: 'Días promedio clasificación',
        value:
          typeof backlogData.avg_classification_days === 'number'
            ? backlogData.avg_classification_days.toFixed(1)
            : 'N/A',
      },
      { label: 'Clasificados sin fecha', value: backlogData.classified_no_date ?? 0 },
      { label: 'Clasificaciones tardías', value: backlogData.delayed_classification ?? 0 },
    ];
    return (
      <div className="grid grid-cols-2 gap-4 py-4">
        {items.map((it) => (
          <div key={it.label} className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <p className="text-3xl font-bold text-slate-900">{it.value}</p>
            <p className="text-xs text-slate-500 mt-1">{it.label}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderPeaks = () => {
    if (!peaksData) return null;
    const filtered = peaksData.filter((d) => d.quality === selectedCategory).slice(0, 10);
    const chartData = filtered.map((d) => ({
      date: new Date(d.date!).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      count: d.count,
    }));

    if (chartData.length === 0) {
      return <p className="text-sm text-slate-500 text-center py-12">Sin picos de volumen.</p>;
    }

    return (
      <>
        <h3 className="text-[17px] font-bold text-slate-900 mb-6">Fechas con Mayor Volumen</h3>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }} barCategoryGap="30%">
              <defs>
                <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity={1} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                tick={{ fill: '#475569', fontSize: 13 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 13 }} dx={-10} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" name="Leads" fill="url(#peakGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  };

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'trends', label: 'Tendencias' },
    { key: 'geography', label: 'Geografía' },
    { key: 'backlog', label: 'Backlog' },
    { key: 'peaks', label: 'Picos' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">Detalles de {selectedCategory}</h2>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${badgeBg}`}>
          {selectedCategory}
        </span>
      </div>

      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
        {tabs.map((t) => {
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`px-5 py-3 border-b-2 font-medium text-[15px] whitespace-nowrap transition-colors ${
                active
                  ? 'border-[#3b82f6] text-[#3b82f6]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">Cargando...</div>
      ) : error ? (
        <p className="text-red-600 text-sm">Error: {error}</p>
      ) : (
        <>
          {subTab === 'trends' && renderTrends()}
          {subTab === 'geography' && renderGeography()}
          {subTab === 'backlog' && renderBacklog()}
          {subTab === 'peaks' && renderPeaks()}
        </>
      )}

      {/* Legend strip */}
      <div className="flex justify-center items-center mt-6 flex-wrap gap-6">
        {(['Lead', 'In Follow-up', 'Other', 'Discarded'] as const).map((cat) => (
          <div key={cat} className="flex items-center text-sm text-slate-700 font-medium">
            <span
              className="w-4 h-[2px] rounded-sm mr-2"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />{' '}
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
}
