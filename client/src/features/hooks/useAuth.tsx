// src/features/auth/AuthProvider.tsx
import { useState, createContext, useContext, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

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

const API = "http://localhost:4000/api";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const onForcedLogout = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem("authToken");
    };
    window.addEventListener("auth:logout", onForcedLogout as EventListener);

    const verifyStoredToken = async () => {
      const storedToken = localStorage.getItem("authToken");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

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
          } else {
            // fallback a decodificar token
            const decoded: UserPayload = jwtDecode(storedToken);
            setUser(decoded);
          }
        } else {
          // token inválido → limpiar
          localStorage.removeItem("authToken");
          setToken(null);
          setUser(null);
        }
      } catch {
        // fallback a decodificar
        try {
          const decoded: UserPayload = jwtDecode(storedToken);
          setUser(decoded);
        } catch {
          localStorage.removeItem("authToken");
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
    localStorage.setItem("authToken", newToken);
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
            return;
          }
        }
        // fallback
        const decoded: UserPayload = jwtDecode(newToken);
        setUser(decoded);
      } catch {
        try {
          const decoded: UserPayload = jwtDecode(newToken);
          setUser(decoded);
        } catch {
          setUser(null);
        }
      }
    })();
  };

  const logout = () => {
    localStorage.removeItem("authToken");
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
