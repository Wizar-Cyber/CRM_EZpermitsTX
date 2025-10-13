import { api } from "@/lib/api";

export interface Lead {
  case_number: string;
  incident_address: string;
  created_date_local: string;
  status: string;
  ava_case_type: string;
  channel: string;
  latest_case_notes?: string;
  resolve_by_time?: string;
  created_date_utc?: string;
  extract_date?: string;
  state_code_name?: string;
  zip_code?: string;
  description?: string;
  resolution?: string;
}

export const LeadsAPI = {
  list: (params: string) => api.get<{ data: Lead[] }>(`/api/leads?${params}`),
  getById: (id: string) => api.get<Lead>(`/api/leads/${id}`),
};
