<<<<<<< HEAD
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
=======
import { Home, Map, Route as RouteIcon, Calendar, Settings } from "lucide-react";
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
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
<<<<<<< HEAD
import { useAuth } from "@/features/hooks/useAuth";
=======
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e

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
<<<<<<< HEAD
  // ✨ 4. Nuevo botón para "Leads Clasificados"
 
  // ✨ 5. Nuevo botón para "Clientes"
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
  },
=======
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
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
<<<<<<< HEAD
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
=======

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold text-primary mb-2">
            EZ CRM
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
<<<<<<< HEAD
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-${item.title.toLowerCase()}`}
                    >
=======
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`link-${item.title.toLowerCase()}`}>
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
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
<<<<<<< HEAD

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
=======
      </SidebarContent>
    </Sidebar>
  );
}
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
