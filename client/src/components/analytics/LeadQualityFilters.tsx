import { useState } from 'react';
import { CalendarIcon, FilterIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LeadQualityFilters, QualityCategory } from '@/features/analytics/types';

interface LeadQualityFiltersProps {
  filters: LeadQualityFilters;
  onFiltersChange: (filters: LeadQualityFilters) => void;
}

const QUALITY_OPTIONS: QualityCategory[] = ['Lead', 'In Follow-up', 'Other', 'Discarded', 'Unclassified'];

export function LeadQualityFilterPanel({ filters, onFiltersChange }: LeadQualityFiltersProps) {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const updateFilters = (updates: Partial<LeadQualityFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleQuality = (quality: QualityCategory) => {
    const current = filters.quality || [];
    const updated = current.includes(quality)
      ? current.filter(q => q !== quality)
      : [...current, quality];
    updateFilters({ quality: updated.length > 0 ? updated : undefined });
  };

  return (
    <div className="sticky top-0 bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
        <FilterIcon className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-slate-900">Filtros de Análisis</h3>
      </div>

      {/* Date Range Section */}
      <div className="space-y-3">
        <h4 className="text-xs uppercase tracking-widest font-semibold text-slate-600">📅 Rango de Fechas</h4>
        <div className="space-y-2">
          {/* Date From */}
          <div>
            <Label className="text-xs text-slate-600 mb-2 block">Desde</Label>
            <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between text-sm hover:bg-blue-50 border-blue-200 bg-blue-50/50 text-slate-800 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    {format(filters.dateFrom, 'dd MMM yyyy', { locale: es })}
                  </span>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => {
                    if (date) updateFilters({ dateFrom: date });
                    setDateFromOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div>
            <Label className="text-xs text-slate-600 mb-2 block">Hasta</Label>
            <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between text-sm hover:bg-green-50 border-green-200 bg-green-50/50 text-slate-800 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-green-600" />
                    {format(filters.dateTo, 'dd MMM yyyy', { locale: es })}
                  </span>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => {
                    if (date) updateFilters({ dateTo: date });
                    setDateToOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Grouping Section */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        <h4 className="text-xs uppercase tracking-widest font-semibold text-slate-600">📊 Agrupar por</h4>
        <Select value={filters.groupBy} onValueChange={(value: 'day' | 'month') => updateFilters({ groupBy: value })}>
          <SelectTrigger className="bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200 text-slate-800 font-medium hover:bg-blue-100/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">📅 Día</SelectItem>
            <SelectItem value="month">📆 Mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quality Categories Section */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        <h4 className="text-xs uppercase tracking-widest font-semibold text-slate-600">🏷️ Categorías</h4>
        <div className="space-y-2.5">
          {QUALITY_OPTIONS.map((quality) => {
            const categoryEmojis: Record<QualityCategory, string> = {
              'Lead': '✅',
              'In Follow-up': '⏳',
              'Other': '📌',
              'Discarded': '❌',
              'Unclassified': '❓',
            };
            const categoryStyles: Record<QualityCategory, { accent: string; bg: string; border: string; text: string }> = {
              'Lead': {
                accent: 'accent-green-600',
                bg: 'bg-green-50/60',
                border: 'border-l-4 border-green-600',
                text: 'text-green-900'
              },
              'In Follow-up': {
                accent: 'accent-amber-600',
                bg: 'bg-amber-50/60',
                border: 'border-l-4 border-amber-600',
                text: 'text-amber-900'
              },
              'Other': {
                accent: 'accent-blue-600',
                bg: 'bg-blue-50/60',
                border: 'border-l-4 border-blue-600',
                text: 'text-blue-900'
              },
              'Discarded': {
                accent: 'accent-red-600',
                bg: 'bg-red-50/60',
                border: 'border-l-4 border-red-600',
                text: 'text-red-900'
              },
              'Unclassified': {
                accent: 'accent-slate-600',
                bg: 'bg-slate-50/60',
                border: 'border-l-4 border-slate-600',
                text: 'text-slate-900'
              },
            };
            const style = categoryStyles[quality];
            return (
              <div
                key={quality}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${style.bg} ${style.border} hover:shadow-md hover:scale-102`}
              >
                <Checkbox
                  id={quality}
                  checked={filters.quality?.includes(quality) ?? false}
                  onCheckedChange={() => toggleQuality(quality)}
                  className={style.accent}
                />
                <label
                  htmlFor={quality}
                  className={`text-sm font-semibold cursor-pointer flex items-center gap-2 flex-1 ${style.text}`}
                >
                  <span>{categoryEmojis[quality]}</span>
                  {quality}
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}