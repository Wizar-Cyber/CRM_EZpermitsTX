export type QualityCategory = 'Lead' | 'In Follow-up' | 'Other' | 'Discarded' | 'Unclassified';

export interface LeadQualityData {
  period?: string;
  quality: QualityCategory;
  count: number;
  zip_code?: string;
  date?: string;
}

export interface LeadQualityOverviewResponse {
  view: 'overview';
  total: number;
  distribution: LeadQualityData[];
}

export interface LeadQualityTrendsResponse {
  view: 'trends';
  data: LeadQualityData[];
}

export interface LeadQualityGeographyResponse {
  view: 'geography';
  data: LeadQualityData[];
}

export interface LeadQualityBacklogResponse {
  view: 'backlog';
  metrics: {
    unclassified: number;
    classified_no_date: number;
    avg_classification_days: number;
    delayed_classification: number;
  };
}

export interface LeadQualityPeaksResponse {
  view: 'peaks';
  data: LeadQualityData[];
}

export type LeadQualityResponse =
  | LeadQualityOverviewResponse
  | LeadQualityTrendsResponse
  | LeadQualityGeographyResponse
  | LeadQualityBacklogResponse
  | LeadQualityPeaksResponse;

export interface LeadQualityFilters {
  dateFrom: Date;
  dateTo: Date;
  quality?: QualityCategory[];
  groupBy: 'day' | 'month';
  view: 'overview' | 'trends' | 'geography' | 'backlog' | 'peaks';
}

export const QUALITY_COLORS: Record<QualityCategory, string> = {
  'Lead': '#22c55e',
  'In Follow-up': '#f59e0b',
  'Other': '#3b82f6',
  'Discarded': '#ef4444',
  'Unclassified': '#6b7280'
};