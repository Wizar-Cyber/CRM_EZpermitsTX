import { useMemo, useState } from 'react';
import { LeadQualityFilterPanel } from './LeadQualityFilters';
import { LeadQualityDetailPanel } from './LeadQualityDetailPanel';
import { useLeadQualityData } from '@/features/analytics/hooks/useLeadQualityData';
import type { LeadQualityFilters, LeadQualityOverviewResponse, QualityCategory } from '@/features/analytics/types';

const DEFAULT_FILTERS: LeadQualityFilters = {
  dateFrom: new Date('2010-01-01'),
  dateTo: new Date(),
  groupBy: 'month',
  view: 'overview',
};

interface QualityCardConfig {
  label: QualityCategory;
  color: string;
  gradientFrom: string;
  borderColor: string;
  shadow: string;
}

const QUALITY_CARDS: QualityCardConfig[] = [
  {
    label: 'Lead',
    color: '#22c55e',
    gradientFrom: 'from-emerald-50',
    borderColor: 'border-emerald-400',
    shadow: '0_8px_16px_rgba(34,197,94,0.4)',
  },
  {
    label: 'In Follow-up',
    color: '#f59e0b',
    gradientFrom: 'from-amber-50',
    borderColor: 'border-amber-400',
    shadow: '0_8px_16px_rgba(245,158,11,0.4)',
  },
  {
    label: 'Other',
    color: '#3b82f6',
    gradientFrom: 'from-blue-50',
    borderColor: 'border-blue-400',
    shadow: '0_8px_16px_rgba(59,130,246,0.4)',
  },
  {
    label: 'Discarded',
    color: '#ef4444',
    gradientFrom: 'from-red-50',
    borderColor: 'border-red-300',
    shadow: '0_8px_16px_rgba(239,68,68,0.4)',
  },
];

export function LeadQualityDistribution() {
  const [filters, setFilters] = useState<LeadQualityFilters>(DEFAULT_FILTERS);
  const [selectedCategory, setSelectedCategory] = useState<QualityCategory | null>(null);

  const { data, error } = useLeadQualityData(filters);
  const overviewData = data && data.view === 'overview' ? (data as LeadQualityOverviewResponse) : undefined;

  const counts = useMemo(() => {
    const summary: Record<QualityCategory, number> = {
      'Lead': 0,
      'In Follow-up': 0,
      'Other': 0,
      'Discarded': 0,
      'Unclassified': 0,
    };
    overviewData?.distribution?.forEach((item) => {
      summary[item.quality] = item.count;
    });
    return summary;
  }, [overviewData]);

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex items-end gap-4 flex-wrap">
        <h1 className="text-[28px] font-bold text-[#0f172a] tracking-tight">
          Lead Quality Distribution Analysis
        </h1>
        {data && data.view === 'overview' && 'total' in data && (
          <span className="text-slate-500 text-lg pb-1">Total: {data.total} leads</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar filters */}
        <div className="lg:col-span-1">
          <LeadQualityFilterPanel filters={filters} onFiltersChange={setFilters} />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {QUALITY_CARDS.map((card) => {
              const count = counts[card.label] ?? 0;
              const isActive = selectedCategory === card.label;
              return (
                <div
                  key={card.label}
                  className={`bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center overflow-hidden border transition-all duration-200 ${
                    isActive ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-100'
                  }`}
                >
                  <div className={`w-full h-24 bg-gradient-to-b ${card.gradientFrom} to-white flex items-end justify-center pb-0 relative`}>
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold translate-y-1/2"
                      style={{
                        backgroundColor: card.color,
                        boxShadow: `0 8px 16px ${card.color}66`,
                      }}
                    >
                      {count}
                    </div>
                  </div>
                  <div className="w-full pb-6 pt-12 text-center bg-white">
                    <h3 className="text-slate-800 font-medium text-[17px]">{card.label}</h3>
                    <button
                      onClick={() => setSelectedCategory(card.label)}
                      className={`mt-3 px-6 py-1.5 rounded-full border text-sm font-medium transition-colors active:scale-95 ${card.borderColor}`}
                      style={{ color: card.color }}
                    >
                      Ver detalles
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedCategory && (
            <LeadQualityDetailPanel
              selectedCategory={selectedCategory}
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              groupBy={filters.groupBy}
            />
          )}

          {error && (
            <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm">
              <p className="text-red-600 text-sm">Error al cargar los datos: {error.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
