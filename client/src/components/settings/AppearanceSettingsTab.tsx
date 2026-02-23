import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsState } from "./types";

export function AppearanceSettingsTab({
  settings,
  setSettings,
  loading,
  onSave,
}: {
  settings: SettingsState;
  setSettings: (next: SettingsState) => void;
  loading: boolean;
  onSave: () => void;
}) {
  return (
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
            document.documentElement.classList.toggle("dark", newTheme === "dark");
          }}
        />
      </div>

      <Button className="mt-6 rounded-xl" onClick={onSave} disabled={loading}>
        Apply Theme
      </Button>
    </div>
  );
}
