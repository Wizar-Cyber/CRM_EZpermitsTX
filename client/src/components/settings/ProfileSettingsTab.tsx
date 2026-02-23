import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProfileState, SettingsState } from "./types";

export function ProfileSettingsTab({
  profile,
  setProfile,
  settings,
  setSettings,
  loading,
  onSave,
  onSaveAppearance,
}: {
  profile: ProfileState;
  setProfile: (next: ProfileState) => void;
  settings: SettingsState;
  setSettings: (next: SettingsState) => void;
  loading: boolean;
  onSave: () => void;
  onSaveAppearance: () => void;
}) {
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const initials = (profile.fullname || "?").trim().slice(0, 1).toUpperCase();
  const firstAndLastName = (profile.fullname || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">User Profile</h2>

      <div className="rounded-xl border p-4">
        <h3 className="font-semibold mb-3">Avatar</h3>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full border bg-muted flex items-center justify-center overflow-hidden">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-xl font-semibold text-muted-foreground">{initials}</span>
            )}
          </div>

          <div className="flex-1 space-y-2">
            {!editingAvatar ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {firstAndLastName || "Name not set"}
                </p>
                <Button type="button" variant="outline" onClick={() => setEditingAvatar(true)}>
                  Edit avatar
                </Button>
              </>
            ) : (
              <>
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input
                  id="avatar_url"
                  placeholder="https://example.com/avatar.jpg"
                  value={profile.avatar_url}
                  onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={async () => {
                    await onSave();
                    setEditingAvatar(false);
                  }} disabled={loading}>
                    Save
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingAvatar(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Personal information</h3>
          {!editingInfo ? (
            <Button type="button" variant="outline" onClick={() => setEditingInfo(true)}>
              Edit information
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" onClick={async () => {
                await onSave();
                setEditingInfo(false);
              }} disabled={loading}>
                Update information
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditingInfo(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        {!editingInfo ? (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p><strong>Full name:</strong> {profile.fullname || "—"}</p>
            <p><strong>Email:</strong> {profile.email || "—"}</p>
            <p><strong>Phone:</strong> {profile.phone || "—"}</p>
            <p><strong>Role:</strong> {profile.role || (profile.role_id === 1 ? "admin" : "user")}</p>
            <p><strong>Language:</strong> {profile.language || "—"}</p>
            <p><strong>Time zone:</strong> {profile.timezone || "—"}</p>
            <p><strong>Date format:</strong> {profile.date_format || "—"}</p>
            <p><strong>Recovery email:</strong> {profile.recovery_email || "—"}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="fullname">Full Name</Label>
              <Input id="fullname" value={profile.fullname} onChange={(e) => setProfile({ ...profile, fullname: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" value={profile.email || ""} disabled />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+1 555 123 4567" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="recovery_email">Recovery Email</Label>
              <Input id="recovery_email" placeholder="name@example.com" value={profile.recovery_email || ""} onChange={(e) => setProfile({ ...profile, recovery_email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <select id="language" className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
            <div>
              <Label htmlFor="timezone">Time zone</Label>
              <Input id="timezone" placeholder="America/Chicago" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="date_format">Date format</Label>
              <select id="date_format" className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={profile.date_format} onChange={(e) => setProfile({ ...profile, date_format: e.target.value })}>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-4">
        <h3 className="font-semibold">Appearance</h3>
        <div className="flex items-center justify-between">
          <Label>Current Theme</Label>
          <span className="capitalize">{settings.theme}</span>
        </div>
        <div className="flex items-center justify-between">
          <Label>Dark Mode</Label>
          <Switch
            checked={settings.theme === "dark"}
            onCheckedChange={(v: boolean) => {
              const newTheme = v ? "dark" : "light";
              setSettings({ ...settings, theme: newTheme });
              localStorage.setItem("theme", newTheme);
              document.documentElement.classList.toggle("dark", newTheme === "dark");
            }}
          />
        </div>
        <Button type="button" variant="outline" onClick={onSaveAppearance} disabled={loading}>
          Apply Appearance
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Last update: {profile.updated_at ? new Date(profile.updated_at).toLocaleString() : "—"} · Version: {profile.version || 1}
      </div>
    </div>
  );
}
