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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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

  return (
    <Sidebar>
      <SidebarContent className="flex flex-col">

        {/* ── Logo ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 py-4 px-2">
            <div className="w-7 h-7 rounded-lg bg-[#103360] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-[#103360] dark:text-white tracking-wide">
              EZpermitsTX
            </span>
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* ── Navigation ── */}
        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-${item.title.toLowerCase()}`}
                      className="p-0 rounded-xl"
                      style={{ background: "none" }}
                    >
                      <Link
                        href={item.url}
                        className={[
                          "flex items-center gap-3 px-3 py-2.5 w-full rounded-xl transition-all",
                          isActive
                            ? "bg-gradient-to-r from-[#103360] to-[#1565c0] text-white font-semibold"
                            : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#103360] hover:to-[#1565c0] hover:text-white",
                        ].join(" ")}
                      >
                        <item.icon
                          className="shrink-0"
                          style={{ width: "1.1rem", height: "1.1rem" }}
                        />
                        <span className="text-sm">{item.title}</span>
                        {isActive && (
                          <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60 shrink-0" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── User + Logout ── */}
        <SidebarGroup className="mt-auto border-t border-border pt-3 pb-2">
          {user && (
            <div className="px-4 py-2 mb-1">
              <p className="text-sm font-medium truncate leading-tight">
                {(user as any).name || (user as any).username || (user as any).email || "User"}
              </p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {(user as any).role || "Member"}
              </p>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={logout}
                  className="text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-xl transition-colors"
                >
                  <LogOut style={{ width: "1rem", height: "1rem" }} className="shrink-0" />
                  <span className="text-sm">Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
