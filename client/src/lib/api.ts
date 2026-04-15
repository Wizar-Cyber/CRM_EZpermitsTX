// src/lib/api.ts
export const API_BASE_URL = import.meta.env.VITE_API_URL;
const LAST_ACTIVITY_KEY = "authLastActivity";
const TOKEN_KEY = "authToken";

// Token and activity are stored in sessionStorage (cleared when browser closes).
// Always try both storages during the migration period.
function getToken(): string | null {
  try { return window.sessionStorage.getItem(TOKEN_KEY); } catch {}
  return null;
}

function clearAuth() {
  try { window.sessionStorage.removeItem(TOKEN_KEY); } catch {}
  try { window.sessionStorage.removeItem(LAST_ACTIVITY_KEY); } catch {}
  // Also clear legacy localStorage values
  try { window.localStorage.removeItem(TOKEN_KEY); } catch {}
  try { window.localStorage.removeItem(LAST_ACTIVITY_KEY); } catch {}
}

function stampActivity() {
  try {
    window.sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch {}
}

/**
 * Helper genérico para hacer peticiones al backend Express
 */
async function parseError(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    return j.error || j.message || text || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

function handle401() {
  clearAuth();
  try {
    window.dispatchEvent(new CustomEvent("auth:logout"));
  } catch {}
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export async function apiRequest<T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH", // 👈 agregado PATCH
  path: string,
  body?: any,
  extra?: RequestInit
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (extra?.headers) {
    const extraHeaders = new Headers(extra.headers);
    extraHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  let finalBody: BodyInit | undefined = undefined;

  if (body instanceof FormData) {
    delete headers["Content-Type"]; // el navegador lo maneja
    finalBody = body;
  } else if (body !== undefined) {
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: finalBody,
    ...extra,
  });

  if (!res.ok) {
    if (res.status === 401) handle401();
    const msg = await parseError(res);
    throw new Error(msg || `HTTP ${res.status}`);
  }

  stampActivity();

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return (await res.text()) as T;
}

// Métodos auxiliares
export const apiGet = <T = any>(path: string, opts: RequestInit = {}) =>
  apiRequest<T>("GET", path, undefined, opts);

export const apiPost = <T = any>(path: string, body?: any, opts: RequestInit = {}) =>
  apiRequest<T>("POST", path, body, opts);

export const apiPut = <T = any>(path: string, body?: any, opts: RequestInit = {}) =>
  apiRequest<T>("PUT", path, body, opts);

export const apiDelete = <T = any>(path: string, opts: RequestInit = {}) =>
  apiRequest<T>("DELETE", path, undefined, opts);

// ✅ NUEVO: soporte PATCH
export const apiPatch = <T = any>(path: string, body?: any, opts: RequestInit = {}) =>
  apiRequest<T>("PATCH", path, body, opts);

export function toFormData(obj: Record<string, any>): FormData {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (v instanceof File || v instanceof Blob) {
      fd.append(k, v);
    } else if (typeof v === "object") {
      fd.append(k, JSON.stringify(v));
    } else {
      fd.append(k, String(v));
    }
  });
  return fd;
}

// Compatibilidad
export const api = apiRequest;
