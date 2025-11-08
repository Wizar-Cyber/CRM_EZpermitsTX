import { Switch, Route } from "wouter";
<<<<<<< HEAD
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
=======
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
<<<<<<< HEAD
import "leaflet/dist/leaflet.css";

import { AuthProvider, useAuth } from "@/features/hooks/useAuth";
import { useLocation } from "wouter";

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import Dashboard from "@/pages/Dashboard";
import LeadsPage  from "@/pages/LeadsPage";
=======
import Dashboard from "@/pages/Dashboard";
import LeadsPage from "@/pages/LeadsPage";
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
import MapPage from "@/pages/MapPage";
import RoutesPage from "@/pages/RoutesPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";
<<<<<<< HEAD
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
=======
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e

function Router() {
  return (
    <Switch>
<<<<<<< HEAD
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
=======
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/map" component={MapPage} />
      <Route path="/routes" component={RoutesPage} />
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/settings" component={SettingsPage} />
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
<<<<<<< HEAD
  } as React.CSSProperties;

  const [location] = useLocation();
  const hideSidebar = location === "/login" || location === "/register";
=======
  };
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
<<<<<<< HEAD
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
=======
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-50">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-auto p-6 bg-background">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
