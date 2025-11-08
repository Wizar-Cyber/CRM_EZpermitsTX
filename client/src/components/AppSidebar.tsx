import {
  Home,
  Map,
  Route as RouteIcon,
  Calendar,
  Settings,
  LogOut,
  Users, // ✨ 1. Ícono para Clientes
  KanbanSquare, // ✨ 2. Ícono para Leads Clasificados
  Shield, // ✨ 3. Ícono para el panel de Admin
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
  // ✨ 4. Nuevo botón para "Leads Clasificados"
 
  // ✨ 5. Nuevo botón para "Clientes"
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
  // ✨ 6. Obtenemos el objeto 'user' además de 'logout'
  const { user, logout } = useAuth();

  // ✨ 7. Verificamos si el usuario es administrador (ajusta 'admin' si tu rol se llama diferente)
  const isAdmin = user && user.role === 'admin';

  return (
    <Sidebar>
      <SidebarContent className="flex flex-col">
        {/* Grupo de menú principal (sin cambios) */}
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

        {/* Grupo para el botón de logout (lo empujamos al fondo) */}
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