import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Lock,
  User,
  Palette,
  Link2,
  ShieldCheck,
  Ban,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/features/hooks/useAuth";

type UserRow = {
  id: number;
  fullname: string;
  email: string;
  phone: string | null;
  role_id: number | null;
  document_type: string | null;
  document_number: string | null;
  created_at: string;
  is_approved: boolean;
  is_blocked: boolean;
  role_name?: string | null;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    theme: "light",
    email_notifications: true,   // <- ya no se muestra en UI
    sms_notifications: false,    // <- ya no se muestra en UI
    language: "en",
  });

  // 🔐 Detectar admin de forma robusta
  const isAdmin = useMemo(
    () =>
      !!user &&
      (
        (user as any).role_id === 1 ||
        (user as any).role === "admin" ||
        (user as any).role_name === "admin"
      ),
    [user]
  );

  // 🔄 Cargar configuración desde el backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await apiGet("/settings");
        setSettings((prev) => ({ ...prev, ...data }));
      } catch (err: any) {
        console.error("Error fetching settings:", err);
        toast.error("Error loading settings");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // 💾 Guardar cambios en el backend
  const handleSaveSettings = async () => {
    try {
      await apiPut("/settings", settings);
      toast.success("Settings updated successfully!");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      toast.error("Failed to save settings");
    }
  };

  // ================================
  // Panel de Admin (inline component)
  // ================================
  function AdminUsersPanel() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await apiGet<{ data: UserRow[] }>("/admin/users");
        setUsers(res.data || []);
      } catch (err: any) {
        console.error(err);
        toast.error("No se pudieron cargar los usuarios (¿eres admin?)");
      } finally {
        setLoadingUsers(false);
      }
    };

    useEffect(() => {
      loadUsers();
    }, []);

    const approve = async (id: number) => {
      try {
        await apiPatch(`/admin/users/${id}/approve`, {});
        toast.success("Usuario aprobado");
        loadUsers();
      } catch (err: any) {
        toast.error(err.message || "Error aprobando usuario");
      }
    };

    const block = async (id: number) => {
      try {
        await apiPatch(`/admin/users/${id}/block`, { blocked: true });
        toast.success("Usuario bloqueado");
        loadUsers();
      } catch (err: any) {
        toast.error(err.message || "Error bloqueando usuario");
      }
    };

    const unblock = async (id: number) => {
      try {
        await apiPatch(`/admin/users/${id}/block`, { blocked: false });
        toast.success("Usuario desbloqueado");
        loadUsers();
      } catch (err: any) {
        toast.error(err.message || "Error desbloqueando usuario");
      }
    };

    const remove = async (id: number) => {
      if (!confirm("¿Eliminar este usuario definitivamente?")) return;
      try {
        await apiDelete(`/admin/users/${id}`);
        toast.success("Usuario eliminado");
        loadUsers();
      } catch (err: any) {
        toast.error(err.message || "Error eliminando usuario");
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Administración de usuarios
          </h2>
          <Button variant="outline" size="sm" onClick={loadUsers}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refrescar
          </Button>
        </div>

        {loadingUsers ? (
          <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Creado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleLabel =
                    u.role_name || (u.role_id === 1 ? "admin" : "user");
                  const estado =
                    u.is_blocked
                      ? "Bloqueado"
                      : u.is_approved
                      ? "Aprobado"
                      : "Pendiente";
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="p-3">{u.fullname}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3 capitalize">{roleLabel}</td>
                      <td className="p-3">{estado}</td>
                      <td className="p-3">
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          {!u.is_approved && !u.is_blocked && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => approve(u.id)}
                              title="Aprobar"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Aprobar
                            </Button>
                          )}
                          {!u.is_blocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => block(u.id)}
                              title="Bloquear"
                            >
                              <Ban className="w-4 h-4 mr-2 text-red-600" />
                              Bloquear
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unblock(u.id)}
                              title="Desbloquear"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Desbloquear
                            </Button>
                          )}
                          {u.role_id !== 1 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => remove(u.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td className="p-4 text-sm text-muted-foreground" colSpan={6}>
                      No hay usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Para la grilla de Tabs: 4 tabs base; si es admin mostramos 5
  const tabsCols = isAdmin ? "grid-cols-5" : "grid-cols-4";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Settings className="w-8 h-8 text-primary" />
        Settings
      </h1>

      <Card className="rounded-2xl shadow-sm p-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className={`mb-6 ${tabsCols} grid`}>
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" /> Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="w-4 h-4 mr-2" /> Security
            </TabsTrigger>
            {/* 🔕 Eliminado Notifications */}
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Link2 className="w-4 h-4 mr-2" /> Integrations
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin">
                <ShieldCheck className="w-4 h-4 mr-2" /> Admin
              </TabsTrigger>
            )}
          </TabsList>

          {/* 👤 Profile */}
          <TabsContent value="profile">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">User Profile</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input id="fullname" value={user?.fullname || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" value={user?.email || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={
                      ((user as any)?.role_name as string) ??
                      ((user as any)?.role as string) ??
                      ((user as any)?.role_id === 1 ? "admin" : "user")
                    }
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    placeholder="en / es"
                    value={settings.language}
                    onChange={(e) =>
                      setSettings({ ...settings, language: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button
                className="mt-4 rounded-xl"
                onClick={handleSaveSettings}
                disabled={loading}
              >
                Save Changes
              </Button>
            </div>
          </TabsContent>

          {/* 🔒 Security */}
          <TabsContent value="security">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" />
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" />
                </div>
              </div>
              <Button className="mt-4 rounded-xl" disabled={loading}>
                Update Password
              </Button>
            </div>
          </TabsContent>

          {/* 🎨 Appearance */}
          <TabsContent value="appearance">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Theme</h2>

              <div className="flex items-center justify-between">
                <Label>Current Theme</Label>
                <span className="capitalize">{settings.theme}</span>
              </div>

              <div className="flex items-center justify-between mt-4">
                <Label>Dark Mode</Label>
                <Switch
                  checked={settings.theme === "dark"}
                  onCheckedChange={(v) => {
                    const newTheme = v ? "dark" : "light";
                    setSettings({ ...settings, theme: newTheme });
                    localStorage.setItem("theme", newTheme);
                    document.documentElement.classList.toggle(
                      "dark",
                      newTheme === "dark"
                    );
                  }}
                />
              </div>

              <Button
                className="mt-6 rounded-xl"
                onClick={handleSaveSettings}
                disabled={loading}
              >
                Apply Theme
              </Button>
            </div>
          </TabsContent>

          {/* 🔗 Integrations */}
          <TabsContent value="integrations">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">CRM Integrations</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Manage connected services and third-party tools.
              </p>

              <ul className="space-y-3">
                <li className="flex justify-between items-center border rounded-xl p-3">
                  <div>
                    <span className="font-medium">Google Calendar</span>
                    <p className="text-xs text-muted-foreground">
                      Sync meetings and schedules.
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-xl">
                    Connect
                  </Button>
                </li>

                <li className="flex justify-between items-center border rounded-xl p-3">
                  <div>
                    <span className="font-medium">Slack</span>
                    <p className="text-xs text-muted-foreground">
                      Receive CRM notifications directly.
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-xl">
                    Connect
                  </Button>
                </li>

                <li className="flex justify-between items-center border rounded-xl p-3">
                  <div>
                    <span className="font-medium">WhatsApp Business</span>
                    <p className="text-xs text-muted-foreground">
                      Enable message-based client interactions.
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-xl">
                    Connect
                  </Button>
                </li>
              </ul>
            </div>
          </TabsContent>

          {/* 🛡️ Admin (solo si isAdmin) */}
          {isAdmin && (
            <TabsContent value="admin">
              <AdminUsersPanel />
            </TabsContent>
          )}
        </Tabs>
      </Card>
    </div>
  );
}
