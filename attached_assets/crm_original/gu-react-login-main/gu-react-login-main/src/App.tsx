import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LeadsPage from "./pages/LeadsPage";
import MapPage from "./pages/MapPage";
import RoutesPage from "./pages/RoutesPage";
import AppointmentsPage from "./pages/AppointmentsPage";

// Ruta protegida
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Redirección inicial */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Login */}
          <Route path="/login" element={<Login />} />

          {/* Register */}
          <Route path="/register" element={<Register />} />

          {/* Dashboard protegido */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Leads */}
          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <LeadsPage />
              </ProtectedRoute>
            }
          />

          {/* Mapa */}
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <MapPage />
              </ProtectedRoute>
            }
          />

          {/* Rutas */}
          <Route
            path="/routes"
            element={
              <ProtectedRoute>
                <RoutesPage />
              </ProtectedRoute>
            }
          />

          {/* Citas / Appointments */}
          <Route
            path="/appointments"
            element={
              <ProtectedRoute>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />

          {/* Página desconocida */}
          <Route
            path="*"
            element={<h1 className="text-center mt-20 text-2xl">404 Not Found</h1>}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
