import { useEffect, useState } from "react";
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
  Bell,
  Lock,
  User,
  Palette,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "@/lib/api";
import { useAuth } from "@/features/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    theme: "light",
    email_notifications: true,
    sms_notifications: false,
    language: "en",
  });

  // 🔄 Cargar configuración desde el backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await apiGet("/settings");
        setSettings(data);
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Settings className="w-8 h-8 text-primary" />
        Settings
      </h1>

      <Card className="rounded-2xl shadow-sm p-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" /> Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="w-4 h-4 mr-2" /> Security
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Link2 className="w-4 h-4 mr-2" /> Integrations
            </TabsTrigger>
          </TabsList>

          {/* 👤 Profile */}
          <TabsContent value="profile">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">User Profile</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    value={user?.fullname || ""}
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" value={user?.email || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={user?.role || "User"} disabled />
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
              <Button
                className="mt-4 rounded-xl bg-primary text-white"
                disabled={loading}
              >
                Update Password
              </Button>
            </div>
          </TabsContent>

          {/* 🔔 Notifications */}
          <TabsContent value="notifications">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Notifications</h2>
              <div className="flex items-center justify-between">
                <Label>Email Notifications</Label>
                <Switch
                  checked={settings.email_notifications}
                  onCheckedChange={(v) =>
                    setSettings({ ...settings, email_notifications: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>SMS Notifications</Label>
                <Switch
                  checked={settings.sms_notifications}
                  onCheckedChange={(v) =>
                    setSettings({ ...settings, sms_notifications: v })
                  }
                />
              </div>
              <Button
                className="mt-4 rounded-xl"
                onClick={handleSaveSettings}
                disabled={loading}
              >
                Save Preferences
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
          // 🔄 aplica el cambio visual inmediato
          localStorage.setItem("theme", newTheme);
          document.documentElement.classList.toggle("dark", newTheme === "dark");
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
              <h2 className="text-xl font-semibold mb-4">
                CRM Integrations
              </h2>
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
        </Tabs>
      </Card>
    </div>
  );
}
