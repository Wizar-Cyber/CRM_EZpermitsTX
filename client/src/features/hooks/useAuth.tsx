// src/features/auth/AuthProvider.tsx
import { useState, createContext, useContext, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

const TOKEN_STORAGE_KEY = "authToken";
export const LAST_ACTIVITY_KEY = "authLastActivity";
const SESSION_TIMEOUT_MINUTES =
  Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 10;
export const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

const canUseStorage = () => typeof window !== "undefined";
const getStorageItem = (key: string) => {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const setStorageItem = (key: string, value: string) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
};
const removeStorageItem = (key: string) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
};

const getStoredToken = () => getStorageItem(TOKEN_STORAGE_KEY);
const persistToken = (value: string) => setStorageItem(TOKEN_STORAGE_KEY, value);
const clearPersistedToken = () => removeStorageItem(TOKEN_STORAGE_KEY);

export const touchLastActivity = () =>
  setStorageItem(LAST_ACTIVITY_KEY, Date.now().toString());
const clearLastActivity = () => removeStorageItem(LAST_ACTIVITY_KEY);
const hasSessionExpired = () => {
  const lastActivityRaw = getStorageItem(LAST_ACTIVITY_KEY);
  if (!lastActivityRaw) return false;
  const lastActivity = Number(lastActivityRaw);
  if (Number.isNaN(lastActivity)) return false;
  return Date.now() - lastActivity > SESSION_TIMEOUT_MS;
};
const clearPersistedSession = () => {
  clearPersistedToken();
  clearLastActivity();
};

interface UserPayload {
  id: number;
  email: string;
  role: string;           // 'admin' | 'user'
  role_id?: number | null;
  fullname?: string | null;
  is_approved?: boolean;
  is_blocked?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserPayload | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const API = import.meta.env.VITE_API_URL;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const onForcedLogout = () => {
      setToken(null);
      setUser(null);
      clearPersistedSession();
    };
    window.addEventListener("auth:logout", onForcedLogout as EventListener);

    const verifyStoredToken = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      if (hasSessionExpired()) {
        clearPersistedSession();
        setIsLoading(false);
        return;
      }

      touchLastActivity();
      setToken(storedToken);
      try {
        // ✅ Verificamos y traemos el usuario desde /auth/verify
        const res = await fetch(`${API}/auth/verify`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.valid && data?.user) {
            setUser(data.user as UserPayload);
            touchLastActivity();
          } else {
            // fallback a decodificar token
            const decoded: UserPayload = jwtDecode(storedToken);
            setUser(decoded);
            touchLastActivity();
          }
        } else {
          // token inválido → limpiar
          clearPersistedSession();
          setToken(null);
          setUser(null);
        }
      } catch {
        // fallback a decodificar
        try {
          const decoded: UserPayload = jwtDecode(storedToken);
          setUser(decoded);
          touchLastActivity();
        } catch {
          clearPersistedSession();
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifyStoredToken();
    return () => window.removeEventListener("auth:logout", onForcedLogout as EventListener);
  }, []);

  const login = (newToken: string) => {
    persistToken(newToken);
    touchLastActivity();
    setToken(newToken);
    // Tras login, también usamos /auth/verify para obtener el perfil
    (async () => {
      try {
        const res = await fetch(`${API}/auth/verify`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.valid && data?.user) {
            setUser(data.user as UserPayload);
            touchLastActivity();
            return;
          }
        }
        // fallback
        const decoded: UserPayload = jwtDecode(newToken);
        setUser(decoded);
        touchLastActivity();
      } catch {
        try {
          const decoded: UserPayload = jwtDecode(newToken);
          setUser(decoded);
          touchLastActivity();
        } catch {
          setUser(null);
        }
      }
    })();
  };

  const logout = () => {
    clearPersistedSession();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        isLoading,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
