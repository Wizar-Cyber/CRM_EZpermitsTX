import {
  LayoutDashboard,
  Map,
  Route as RouteIcon,
  Calendar,
  Settings,
  LogOut,
  Users,
  Truck,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar";
import { useAuth } from "@/features/hooks/useAuth";

const menuItems = [
  { title: "Dashboard",    url: "/",               icon: LayoutDashboard },
  { title: "Leads",        url: "/leads",           icon: Users },
  { title: "Delivery",     url: "/leads-delivery",  icon: Truck },
  { title: "Clients",      url: "/clients",         icon: Shield },
  { title: "Map",          url: "/map",             icon: Map },
  { title: "Routes",       url: "/routes",          icon: RouteIcon },
  { title: "Appointments", url: "/appointments",    icon: Calendar },
  { title: "Settings",     url: "/settings",        icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user && (user as any).role === "admin";

  return (
    <Sidebar className="border-r-0 shadow-xl">
      <SidebarContent
        className="flex flex-col h-full"
        style={{ background: "linear-gradient(180deg, #0d2d5a 0%, #103360 60%, #0e2d58 100%)" }}
      >
        {/* ── Logo ── */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-wide leading-tight">
                EZpermitsTX
              </p>
              <p className="text-white/40 text-[11px] leading-tight">CRM Platform</p>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">
            Main Menu
          </p>
          {menuItems.map((item) => {
            const isActive = location === item.url;
            return (
              <Link href={item.url} key={item.title}>
                <div
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    isActive
                      ? "bg-white/18 text-white font-semibold shadow-inner ring-1 ring-white/15"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                  data-testid={`link-${item.title.toLowerCase()}`}
                >
                  <item.icon
                    className={`w-4.5 h-4.5 shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-white/45 group-hover:text-white/80"
                    }`}
                    style={{ width: "1.1rem", height: "1.1rem" }}
                  />
                  <span className="text-sm flex-1">{item.title}</span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-white/50 shrink-0" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* ── User info + Logout ── */}
        <div className="px-3 pb-5 pt-3 border-t border-white/10 space-y-1">
          {user && (
            <div className="px-3 py-2.5 rounded-xl bg-white/5 mb-2">
              <p className="text-white text-sm font-medium truncate leading-tight">
                {(user as any).name || (user as any).username || (user as any).email || "User"}
              </p>
              <p className="text-white/35 text-xs capitalize mt-0.5">
                {(user as any).role || "Member"}
              </p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:bg-red-500/15 hover:text-red-300 transition-all duration-150 text-sm cursor-pointer"
          >
            <LogOut className="shrink-0" style={{ width: "1rem", height: "1rem" }} />
            <span>Logout</span>
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
