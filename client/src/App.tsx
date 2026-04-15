import { Switch, Route, type RouteComponentProps } from "wouter";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useVersionCheck } from "@/features/hooks/useVersionCheck";
import { EditingRouteProvider } from "@/features/contexts/EditingRouteContext";
import "leaflet/dist/leaflet.css";

import {
  AuthProvider,
  useAuth,
  SESSION_TIMEOUT_MS,
  touchLastActivity,
} from "@/features/hooks/useAuth";
import { useLocation } from "wouter";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const LeadsPage = lazy(() => import("@/pages/LeadsPage"));
const DeliveryLeadsPage = lazy(() => import("@/pages/DeliveryLeadsPage"));
const MapPage = lazy(() => import("@/pages/MapPage"));
const RoutesPage = lazy(() => import("@/pages/RoutesPage"));
const AppointmentsPage = lazy(() => import("@/pages/AppointmentsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const NotFound = lazy(() => import("@/pages/not-found"));
const ClientsPage = lazy(() => import("@/pages/ClientsPage"));

type GuardedComponentProps = RouteComponentProps;
type AnyRouteComponent =
  | ComponentType<any>
  | LazyExoticComponent<ComponentType<any>>;

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading view...
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const isOnLogin = location === "/login";

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isOnLogin) {
      setTimeout(() => setLocation("/login"), 0);
    }
  }, [isAuthenticated, isLoading, isOnLogin, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Validating session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

function ProtectedRoute({
  component: Component,
  path,
}: {
  component: AnyRouteComponent;
  path: string;
}) {
  const Guard = (props: GuardedComponentProps) => (
    <RequireAuth>
      <Component {...props} />
    </RequireAuth>
  );

  return <Route path={path} component={Guard} />;
}

function AuthGate() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isPublic =
    location === "/login" ||
    location === "/register" ||
    location.startsWith("/reset-password");

  // ✅ Verificar nuevas versiones disponibles
  useVersionCheck();

  const MAX_INACTIVITY = SESSION_TIMEOUT_MS;

  // Use a ref so the inactivity timer always calls the latest logout
  // without needing logout in the useEffect dependency array
  // (which would cause the timer to reset on every auth state change).
  const logoutRef = useRef(logout);
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  // ✅ Inactivity control
  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      touchLastActivity();
      inactivityTimer = setTimeout(() => {
        console.warn("⏰ Session closed due to inactivity");
        logoutRef.current();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once — logoutRef always has latest logout via the effect above

  // ✅ Automatic redirect based on authentication state
  useEffect(() => {
    if (isLoading) {
      console.log("⏳ Waiting for authentication...");
      return;
    }

    if (!isAuthenticated && !isPublic) {
      setTimeout(() => setLocation("/login"), 0);
    } else if (isAuthenticated && isPublic) {
      setTimeout(() => setLocation("/dashboard"), 0);
    }
  }, [isAuthenticated, isLoading, isPublic, setLocation]);

  return null;
}

// ✅ New safe component for root "/"
function RedirectRoot() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => setLocation(isAuthenticated ? "/dashboard" : "/login"), 0);
    }
  }, [isLoading, isAuthenticated, setLocation]);

  return null;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        {/* Public Routes */}
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />


        {/* Private Routes */}
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/leads" component={LeadsPage} />
        <ProtectedRoute path="/leads-delivery" component={DeliveryLeadsPage} />
        <ProtectedRoute path="/clients" component={ClientsPage} />

        <ProtectedRoute path="/map" component={MapPage} />
        {/* ✅ Allow editing specific routes */}
        <ProtectedRoute path="/map/:routeId" component={MapPage} />
        <ProtectedRoute path="/routes" component={RoutesPage} />
        <ProtectedRoute path="/appointments" component={AppointmentsPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />

        {/* ✅ Safe root redirect */}
        <Route path="/" component={RedirectRoot} />

        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  const [location] = useLocation();
  const hideSidebar =
    location === "/login" ||
    location === "/register" ||
    location.startsWith("/reset-password");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <EditingRouteProvider>
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
                  <main
                    className={
                      hideSidebar
                        ? "flex-1 overflow-hidden"
                        : "flex-1 overflow-auto p-3 sm:p-4 md:p-5 lg:p-6 bg-background"
                    }
                  >
                    <Router />
                    {/* 👇 AuthGate now mounts here */}
                    <AuthGate />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster position="bottom-right" richColors closeButton />
          </EditingRouteProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
