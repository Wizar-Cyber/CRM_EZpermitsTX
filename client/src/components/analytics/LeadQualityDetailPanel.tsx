import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
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
  LeadQualityPeaksResponse,
} from '@/features/analytics/types';

interface LeadQualityDetailPanelProps {
  selectedCategory: QualityCategory | null;
  dateFrom: Date;
  dateTo: Date;
  groupBy: 'day' | 'month' | 'year';
}

const CATEGORY_COLORS: Record<string, string> = {
  'Lead': '#22c55e',
  'Discarded': '#ef4444',
};

type SubTab = 'trends' | 'geography' | 'peaks';

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

        const [trends, geography, peaks] = await Promise.all([
          apiGet(`/analytics/lead-quality?${params}&view=trends`) as Promise<LeadQualityTrendsResponse>,
          apiGet(`/analytics/lead-quality?${params}&view=geography`) as Promise<LeadQualityGeographyResponse>,
          apiGet(`/analytics/lead-quality?${params}&view=peaks`) as Promise<LeadQualityPeaksResponse>,
        ]);

        if (trends.view === 'trends') setTrendsData(trends.data);
        if (geography.view === 'geography') setGeographyData(geography.data);
        if (peaks.view === 'peaks') setPeaksData(peaks.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
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
      : 'bg-red-50 text-red-700 border-red-200';

  const formatPeriodLabel = (isoStr: string): string => {
    const d = new Date(isoStr);
    if (groupBy === 'year') return String(d.getUTCFullYear());
    if (groupBy === 'month') return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const renderTrends = () => {
    if (!trendsData) return null;
    const filtered = trendsData
      .filter((d) => d.quality === selectedCategory)
      .sort((a, b) => new Date(a.period!).getTime() - new Date(b.period!).getTime());
    const chartData = filtered.map((d) => ({
      period: formatPeriodLabel(d.period!),
      count: d.count,
    }));

    if (chartData.length === 0) {
      return <p className="text-sm text-slate-500 text-center py-12">No trend data available.</p>;
    }

    const minWidth = Math.max(600, chartData.length * 70);

    return (
      <div className="overflow-x-auto">
        <div style={{ minWidth, height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
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
      </div>
    );
  };

  const renderGeography = () => {
    if (!geographyData) return null;
    const filtered = geographyData.filter((d) => d.quality === selectedCategory).slice(0, 10);
    const chartData = filtered.map((d) => ({ zip: d.zip_code, count: d.count }));

    if (chartData.length === 0) {
      return <p className="text-sm text-slate-500 text-center py-12">No geographic distribution data.</p>;
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

  const renderPeaks = () => {
    if (!peaksData) return null;
    const filtered = peaksData.filter((d) => d.quality === selectedCategory).slice(0, 10);
    const chartData = filtered.map((d) => ({
      date: new Date(d.date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: d.count,
    }));

    if (chartData.length === 0) {
      return <p className="text-sm text-slate-500 text-center py-12">No volume peaks found.</p>;
    }

    return (
      <>
        <h3 className="text-[17px] font-bold text-slate-900 mb-6">Highest Volume Dates</h3>
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
    { key: 'trends', label: 'Trends' },
    { key: 'geography', label: 'Geography' },
    { key: 'peaks', label: 'Peaks' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">Details: {selectedCategory}</h2>
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
        <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">Loading...</div>
      ) : error ? (
        <p className="text-red-600 text-sm">Error: {error}</p>
      ) : (
        <>
          {subTab === 'trends' && renderTrends()}
          {subTab === 'geography' && renderGeography()}
          {subTab === 'peaks' && renderPeaks()}
        </>
      )}
    </div>
  );
}
