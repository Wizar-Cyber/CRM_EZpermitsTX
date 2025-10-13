// src/lib/api.ts
export const API_BASE_URL = "http://localhost:4000/api";

/**
 * Helper genérico para hacer peticiones al backend Express
 */
export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }

  return res.json();
}

/** Extrae un mensaje legible del error del fetch */
async function parseError(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    return j.error || j.message || text || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

/** Redirección simple en 401 (opcional) */
function handle401() {
  // Si tienes una ruta de login, descomenta:
  // window.location.assign("/login");
}

/** Request genérico */
async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: any,
  extra?: RequestInit
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: HeadersInit = {
    ...(extra?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let finalBody: BodyInit | undefined = undefined;

  if (body instanceof FormData) {
    // Deja que el navegador ponga el boundary de multipart
    finalBody = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(`${API}${path}`, {
    method,
    ...extra,
    headers,
    body: finalBody,
  });

  if (!res.ok) {
    if (res.status === 401) handle401();
    const msg = await parseError(res);
    throw new Error(msg || `HTTP ${res.status}`);
  }

  // Intenta parsear JSON, si no, devuelve texto
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  // @ts-expect-error: permitimos texto cuando la API no devuelve JSON
  return (res.text() as unknown) as T;
}

/** Métodos cómodos */
export function apiGet<T>(path: string, opts: RequestInit = {}): Promise<T> {
  return apiRequest<T>("GET", path, undefined, opts);
}

export function apiPost<T>(path: string, body?: any, opts: RequestInit = {}): Promise<T> {
  return apiRequest<T>("POST", path, body, opts);
}

export function apiPut<T>(path: string, body?: any, opts: RequestInit = {}): Promise<T> {
  return apiRequest<T>("PUT", path, body, opts);
}

export function apiDelete<T>(path: string, opts: RequestInit = {}): Promise<T> {
  return apiRequest<T>("DELETE", path, undefined, opts);
}

/** Helper para enviar multipart/form-data fácilmente */
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
