import {
  Home,
  Map,
  Route as RouteIcon,
  Calendar,
  Settings,
  LogOut,
  Users, // ✨ 1. Icon for Clients
  KanbanSquare, // ✨ 2. Icon for Classified Leads
  Shield, // ✨ 3. Icon for Admin panel
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
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Leads",
    url: "/leads",
    icon: Home,
  },
  {
    title: "Delivery",
    url: "/leads-delivery",
    icon: RouteIcon,
  },
  // ✨ 4. New button for "Classified Leads"
 
  // ✨ 5. New button for "Clients"
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
  },
  {
    title: "Map",
    url: "/map",
    icon: Map,
  },
  {
    title: "Routes",
    url: "/routes",
    icon: RouteIcon,
  },
  {
    title: "Appointments",
    url: "/appointments",
    icon: Calendar,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  // ✨ 6. Get 'user' object in addition to 'logout'
  const { user, logout } = useAuth();

  // ✨ 7. Check if the user is administrator (adjust 'admin' if your role name differs)
  const isAdmin = user && user.role === 'admin';

  return (
    <Sidebar>
      <SidebarContent className="flex flex-col">
        {/* Main menu group (unchanged) */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold text-primary mb-2">
            EZpermitsTX
          </SidebarGroupLabel>
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
                    >
                      <Link href={item.url}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout button group (pushed to bottom) */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} className="w-full">
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}