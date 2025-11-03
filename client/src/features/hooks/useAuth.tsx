import { useState, createContext, useContext, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

interface UserPayload {
  id: number;
  email: string;
  role: string;
  fullname?: string; // ✅ Añadido por si el backend lo devuelve
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserPayload | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const onForcedLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("auth:logout", onForcedLogout as EventListener);

    const verifyStoredToken = async () => {
      const storedToken = localStorage.getItem("authToken");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // Pre‑set token para evitar parpadeos mientras se verifica
      setToken(storedToken);

      try {
        // 🔹 1. Verificar token
        const response = await fetch("http://localhost:4000/api/auth/verify", {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (response.ok) {
          const data = await response.json();

          if (data.valid) {
            setToken(storedToken);

            try {
              // 🔹 2. Consultar /api/me para obtener la info completa
              const userRes = await fetch("http://localhost:4000/api/me", {
                headers: { Authorization: `Bearer ${storedToken}` },
              });

              if (userRes.ok) {
                const { user: fullUser } = await userRes.json();
                setUser(fullUser);
              } else {
                // fallback: decodificar token si /api/me falla
                const decodedUser: UserPayload = jwtDecode(storedToken);
                setUser(decodedUser);
              }
            } catch (err) {
              console.error("Error fetching full user:", err);
              const decodedUser: UserPayload = jwtDecode(storedToken);
              setUser(decodedUser);
            }
          } else {
            localStorage.removeItem("authToken");
            setToken(null);
            setUser(null);
          }
        } else {
          localStorage.removeItem("authToken");
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error("Error verificando token:", error);
        localStorage.removeItem("authToken");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifyStoredToken();

    return () => {
      window.removeEventListener("auth:logout", onForcedLogout as EventListener);
    };
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem("authToken", newToken);
    setToken(newToken);
    // Intentar obtener el perfil completo inmediatamente
    (async () => {
      try {
        const meRes = await fetch("http://localhost:4000/api/me", {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (meRes.ok) {
          const { user: fullUser } = await meRes.json();
          setUser(fullUser);
          return;
        }
      } catch (err) {
        console.warn("Fallo obteniendo /api/me tras login, se usa JWT decodificado");
      }

      try {
        const decodedUser: UserPayload = jwtDecode(newToken);
        setUser(decodedUser);
      } catch (error) {
        console.error("No se pudo decodificar el nuevo token:", error);
        setUser(null);
      }
    })();
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
  };

  const value = {
    isAuthenticated: !!token,
    isLoading,
    user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
