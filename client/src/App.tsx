import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import "leaflet/dist/leaflet.css";

import { AuthProvider, useAuth } from "@/features/hooks/useAuth";
import { useLocation } from "wouter";

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import Dashboard from "@/pages/Dashboard";
import LeadsPage  from "@/pages/LeadsPage";
import MapPage from "@/pages/MapPage";
import RoutesPage from "@/pages/RoutesPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";
import ClientsPage from "@/pages/ClientsPage";

function AuthGate() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isPublic = location === "/login" || location === "/register";

  const MAX_INACTIVITY =
    (Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 30) * 60 * 1000;

  // ✅ Control de inactividad
  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        console.warn("⏰ Sesión cerrada por inactividad");
        logout();
      }, MAX_INACTIVITY);
    };
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(inactivityTimer);
    };
  }, [logout, MAX_INACTIVITY]);

  // ✅ Redirección automática según estado de autenticación
  useEffect(() => {
    if (isLoading) {
      console.log("⏳ Waiting for authentication...");
      return;
    }

    if (!isAuthenticated && !isPublic) {
      setLocation("/login");
    } else if (isAuthenticated && isPublic) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, isPublic, setLocation]);

  return null;
}

// ✅ Nuevo componente seguro para la raíz "/"
function RedirectRoot() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      setLocation(isAuthenticated ? "/dashboard" : "/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Rutas Públicas */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />


      {/* Rutas Privadas */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/clients" component={ClientsPage} />

      <Route path="/map" component={MapPage} />
      {/* ✅ Permitir editar rutas específicas */}
      <Route path="/map/:routeId" component={MapPage} />
      <Route path="/routes" component={RoutesPage} />
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/settings" component={SettingsPage} />

      {/* ✅ Redirección raíz segura */}
      <Route path="/" component={RedirectRoot} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  const [location] = useLocation();
  const hideSidebar = location === "/login" || location === "/register";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SidebarProvider style={style}>
            <div className="flex h-screen w-full">
              {!hideSidebar && <AppSidebar />}
              <div className="flex flex-col flex-1 overflow-hidden">
                {!hideSidebar && (
                  <header className="flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-50">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <ThemeToggle />
                  </header>
                )}
                <main className="flex-1 overflow-auto p-6 bg-background">
                  <Router />
                  {/* 👇 Ahora AuthGate se monta aquí */}
                  <AuthGate />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
