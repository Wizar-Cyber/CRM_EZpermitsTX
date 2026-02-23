export type SettingsState = {
  theme: "light" | "dark" | "system" | string;
  email_notifications: boolean;
  sms_notifications: boolean;
  language: string;
  version?: number;
  updated_at?: string;
};

export type ProfileState = {
  id?: number;
  fullname: string;
  email: string;
  phone: string;
  recovery_email?: string;
  role_id?: number | null;
  role?: string | null;
  language: string;
  timezone: string;
  date_format: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | string;
  avatar_url: string;
  version?: number;
  updated_at?: string;
};

export type UserRow = {
  id: number;
  fullname: string;
  email: string;
  phone: string | null;
  role_id: number | null;
  document_type: string | null;
  document_number: string | null;
  created_at: string;
  is_approved: boolean;
  is_blocked: boolean;
  role_name?: string | null;
  is_online?: boolean;
  active_sessions?: number;
  last_seen_at?: string | null;
};

export type RoleOption = {
  id: number;
  name: string;
};

export type AuditEventRow = {
  id: number;
  actor_user_id: number | null;
  target_user_id: number | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
  target_name?: string | null;
  target_email?: string | null;
};
