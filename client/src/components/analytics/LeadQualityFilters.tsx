import { useState } from 'react';
import { CalendarIcon, FilterIcon, ChevronDown, BarChart2, CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LeadQualityFilters } from '@/features/analytics/types';

interface LeadQualityFiltersProps {
  filters: LeadQualityFilters;
  onFiltersChange: (filters: LeadQualityFilters) => void;
}

export function LeadQualityFilterPanel({ filters, onFiltersChange }: LeadQualityFiltersProps) {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const updateFilters = (updates: Partial<LeadQualityFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  return (
    <div className="sticky top-0 bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
        <FilterIcon className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-slate-900">Analysis Filters</h3>
      </div>

      {/* Date Range Section */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-slate-600">
          <CalendarDays className="w-3.5 h-3.5" /> Date Range
        </h4>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-slate-600 mb-2 block">From</Label>
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

          <div>
            <Label className="text-xs text-slate-600 mb-2 block">To</Label>
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
        <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-slate-600">
          <BarChart2 className="w-3.5 h-3.5" /> Group by
        </h4>
        <Select value={filters.groupBy} onValueChange={(value: 'day' | 'month' | 'year') => updateFilters({ groupBy: value })}>
          <SelectTrigger className="bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200 text-slate-800 font-medium hover:bg-blue-100/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">
              <span className="flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Day</span>
            </SelectItem>
            <SelectItem value="month">
              <span className="flex items-center gap-2"><CalendarRange className="w-4 h-4" /> Month</span>
            </SelectItem>
            <SelectItem value="year">
              <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Year</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
