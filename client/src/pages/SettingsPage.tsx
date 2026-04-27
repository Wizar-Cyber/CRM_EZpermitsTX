import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Settings,
  Lock,
  User,
  Palette,
  Link2,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/features/hooks/useAuth";

import { ProfileSettingsTab } from "@/components/settings/ProfileSettingsTab";
import { SecuritySettingsTab } from "@/components/settings/SecuritySettingsTab";
import { AppearanceSettingsTab } from "@/components/settings/AppearanceSettingsTab";
import { IntegrationsSettingsTab } from "@/components/settings/IntegrationsSettingsTab";
import { AdminUsersPanel } from "@/components/settings/AdminUsersPanel";
import { AuditEventsPanel } from "@/components/settings/AuditEventsPanel";
import type { ProfileState, SettingsState } from "@/components/settings/types";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

const DEFAULT_PROFILE: ProfileState = {
  fullname: "",
  email: "",
  phone: "",
  recovery_email: "",
  role: null,
  language: "en",
  timezone: "America/Chicago",
  date_format: "MM/DD/YYYY",
  avatar_url: "",
};

const DEFAULT_SETTINGS: SettingsState = {
  theme: "light",
  email_notifications: true,
  sms_notifications: false,
  language: "en",
};

export default function SettingsPage() {
  const { user, logout } = useAuth() as any;

  const [profile, setProfile] = useState<ProfileState>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [changingPassword, setChangingPassword] = useState(false);

  const [recoveryEmailDraft, setRecoveryEmailDraft] = useState("");
  const [savingRecoveryEmail, setSavingRecoveryEmail] = useState(false);

  const isAdmin = useMemo(
    () =>
      !!user &&
      ((user as any).role_id === 1 ||
        (user as any).role === "admin" ||
        (user as any).role_name === "admin"),
    [user]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [profRes, setRes] = await Promise.all([
          apiGet<any>("/settings/profile"),
          apiGet<any>("/settings"),
        ]);
        const profData = profRes?.data ?? profRes ?? {};
        setProfile((prev) => ({ ...prev, ...profData }));
        setRecoveryEmailDraft(profData.recovery_email || "");
        setSettings((prev) => ({ ...prev, ...(setRes?.data ?? setRes ?? {}) }));
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Error loading settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await apiPut("/settings/profile", profile);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAppearance = async () => {
    try {
      setSavingAppearance(true);
      await apiPut("/settings", settings);
      toast.success("Appearance saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save appearance");
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleChangePassword = async (event?: FormEvent) => {
    event?.preventDefault();
    const errs: string[] = [];
    if (!pwForm.current) errs.push("Current password is required");
    if (!STRONG_PASSWORD_REGEX.test(pwForm.next))
      errs.push("New password must have 8+ chars, uppercase, lowercase, number and symbol");
    if (pwForm.next !== pwForm.confirm) errs.push("New password and confirmation do not match");
    if (errs.length) {
      setPwErrors(errs);
      return;
    }
    setPwErrors([]);
    try {
      setChangingPassword(true);
      await apiPost("/auth/change-password", {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      });
      toast.success("Password updated");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleForceLogout = () => {
    try {
      logout?.();
    } catch {
      window.location.href = "/login";
    }
  };

  const handleSaveRecoveryEmail = async () => {
    try {
      setSavingRecoveryEmail(true);
      await apiPut("/settings/profile", { recovery_email: recoveryEmailDraft || null });
      setProfile((prev) => ({ ...prev, recovery_email: recoveryEmailDraft }));
      toast.success("Recovery email updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update recovery email");
    } finally {
      setSavingRecoveryEmail(false);
    }
  };

  // Determine grid cols dynamically
  const tabsCount = isAdmin ? 6 : 4;
  const tabsCols =
    tabsCount === 6 ? "grid-cols-6" : tabsCount === 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <div className="w-full space-y-0">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#103360] to-[#1565c0] rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-5 h-5 opacity-80" />
              <span className="text-sm font-medium opacity-80 uppercase tracking-widest">
                System
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-blue-100 mt-1 text-sm">
              Manage your account, security, integrations, and audit trail
            </p>
          </div>
          <div className="bg-white/15 rounded-xl px-4 py-2.5 text-center border border-white/20 min-w-[160px]">
            <p className="text-sm font-semibold truncate">{profile.fullname || user?.fullname || "User"}</p>
            <p className="text-[10px] opacity-75 capitalize mt-0.5">
              {(user as any)?.role_name || profile.role || "Member"}
            </p>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm p-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList
            className={`mb-6 ${tabsCols} grid bg-slate-100 dark:bg-slate-800 p-1 rounded-xl`}
          >
            <TabsTrigger
              value="profile"
              className="rounded-lg text-xs cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
            >
              <User className="w-3.5 h-3.5 mr-1.5" /> Profile
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-lg text-xs cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Security
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="rounded-lg text-xs cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
            >
              <Palette className="w-3.5 h-3.5 mr-1.5" /> Appearance
            </TabsTrigger>
            <TabsTrigger
              value="integrations"
              className="rounded-lg text-xs cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
            >
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Integrations
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger
                  value="admin"
                  className="rounded-lg text-xs cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Admin
                </TabsTrigger>
                <TabsTrigger
                  value="audit"
                  className="rounded-lg text-xs cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
                >
                  <ScrollText className="w-3.5 h-3.5 mr-1.5" /> Audit
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="profile">
            <ProfileSettingsTab
              profile={profile}
              setProfile={setProfile}
              settings={settings}
              setSettings={setSettings}
              loading={loading || savingProfile}
              onSave={handleSaveProfile}
              onSaveAppearance={handleSaveAppearance}
            />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySettingsTab
              form={pwForm}
              setForm={setPwForm}
              passwordErrors={pwErrors}
              setPasswordErrors={setPwErrors}
              changingPassword={changingPassword}
              onSubmit={handleChangePassword}
              onForceLogout={handleForceLogout}
              recoveryEmail={profile.recovery_email || ""}
              recoveryEmailDraft={recoveryEmailDraft}
              setRecoveryEmailDraft={setRecoveryEmailDraft}
              onSaveRecoveryEmail={handleSaveRecoveryEmail}
              savingRecoveryEmail={savingRecoveryEmail}
            />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettingsTab
              settings={settings}
              setSettings={setSettings}
              loading={loading || savingAppearance}
              onSave={handleSaveAppearance}
            />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsSettingsTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <AdminUsersPanel />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="audit">
              <AuditEventsPanel />
            </TabsContent>
          )}
        </Tabs>
      </Card>
    </div>
  );
}
