import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster"; // ✅ Toast visual shadcn
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import "leaflet/dist/leaflet.css";


// Pages
import Dashboard from "@/pages/Dashboard";
import { LeadsPage } from "@/pages/LeadsPage";
import MapPage from "@/pages/MapPage";
import RoutesPage from "@/pages/RoutesPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";

// Router setup
function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/map" component={MapPage} />
      <Route path="/routes" component={RoutesPage} />
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style}>
          <div className="flex h-screen w-full">
            {/* Sidebar */}
            <AppSidebar />

            {/* Main Content */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Header */}
              <header className="flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-50">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>

              {/* Page Content */}
              <main className="flex-1 overflow-auto p-6 bg-background">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>

        {/* ✅ Toaster visual moderno */}
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
