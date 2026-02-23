import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Lock, Settings, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/features/hooks/useAuth";
import { ProfileSettingsTab } from "@/components/settings/ProfileSettingsTab";
import { SecuritySettingsTab, PasswordFormState } from "@/components/settings/SecuritySettingsTab";
import { IntegrationsSettingsTab } from "@/components/settings/IntegrationsSettingsTab";
import { AdminUsersPanel } from "@/components/settings/AdminUsersPanel";
import { AuditEventsPanel } from "@/components/settings/AuditEventsPanel";
import { ProfileState, SettingsState } from "@/components/settings/types";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One digit", test: (value: string) => /\d/.test(value) },
  { label: "One special character", test: (value: string) => /[^\w\s]/.test(value) },
];

const getPasswordViolations = (value: string) =>
  PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);

const ALLOWED_THEMES = new Set(["light", "dark", "system"]);
const ALLOWED_LANGUAGES = new Set(["en", "es"]);
const ALLOWED_DATE_FORMATS = new Set(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]);

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({
    theme: "light",
    email_notifications: true,
    sms_notifications: false,
    language: "en",
  });
  const [profile, setProfile] = useState<ProfileState>({
    fullname: "",
    email: "",
    phone: "",
    recovery_email: "",
    role_id: null,
    role: null,
    language: "en",
    timezone: "America/Chicago",
    date_format: "YYYY-MM-DD",
    avatar_url: "",
    version: 1,
  });
  const [recoveryEmailDraft, setRecoveryEmailDraft] = useState("");
  const [savingRecoveryEmail, setSavingRecoveryEmail] = useState(false);

  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    current: "",
    next: "",
    confirm: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const isAdmin = useMemo(
    () =>
      !!user &&
      ((user as any).role_id === 1 ||
        (user as any).role === "admin" ||
        (user as any).role_name === "admin"),
    [user]
  );

  useEffect(() => {
    const fetchSettingsAndProfile = async () => {
      try {
        setLoading(true);
        const [settingsData, profileData] = await Promise.all([
          apiGet<Partial<SettingsState>>("/settings"),
          apiGet<Partial<ProfileState>>("/settings/profile"),
        ]);

        setSettings((prev) => ({ ...prev, ...settingsData }));
        setProfile((prev) => ({
          ...prev,
          ...profileData,
          phone: String(profileData?.phone || ""),
          recovery_email: String(profileData?.recovery_email || ""),
          avatar_url: String(profileData?.avatar_url || ""),
        }));
        setRecoveryEmailDraft(String(profileData?.recovery_email || ""));
      } catch (err: any) {
        console.error("Error fetching settings:", err);
        toast.error("Error loading settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettingsAndProfile();
  }, []);

  const validateLocalSettings = () => {
    const nextTheme = String(settings.theme || "").toLowerCase().trim();
    const nextLanguage = String(settings.language || "").toLowerCase().trim();

    if (!ALLOWED_THEMES.has(nextTheme)) {
      return "Theme must be light, dark or system";
    }
    if (!ALLOWED_LANGUAGES.has(nextLanguage)) {
      return "Language must be en or es";
    }
    return null;
  };

  const validateLocalProfile = () => {
    const fullname = String(profile.fullname || "").trim();
    if (fullname.length < 2 || fullname.length > 120) {
      return "Full name must be between 2 and 120 characters";
    }

    const phone = String(profile.phone || "").trim();
    if (phone && !/^\+?[0-9()\-\s]{7,20}$/.test(phone)) {
      return "Phone format is invalid";
    }

    const lang = String(profile.language || "").toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.has(lang)) {
      return "Language must be en or es";
    }

    const tz = String(profile.timezone || "").trim();
    if (!tz) {
      return "Timezone is required";
    }

    const df = String(profile.date_format || "").trim();
    if (!ALLOWED_DATE_FORMATS.has(df)) {
      return "Date format is invalid";
    }

    const avatar = String(profile.avatar_url || "").trim();
    if (avatar) {
      try {
        const parsed = new URL(avatar);
        if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
          return "Avatar URL must be http(s)";
        }
      } catch {
        return "Avatar URL is invalid";
      }
    }

    const recoveryEmail = String(profile.recovery_email || "").trim().toLowerCase();
    if (recoveryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      return "Recovery email is invalid";
    }

    return null;
  };

  const handleSaveRecoveryEmail = async () => {
    const recoveryEmail = String(recoveryEmailDraft || "").trim().toLowerCase();
    if (recoveryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      toast.error("Recovery email is invalid");
      return;
    }

    try {
      setSavingRecoveryEmail(true);
      const response = await apiPut<{ success: boolean; profile: ProfileState }>(
        "/settings/profile",
        {
          recovery_email: recoveryEmail,
          version: profile.version,
        }
      );

      if (response?.profile) {
        setProfile((prev) => ({
          ...prev,
          ...response.profile,
          phone: String(response.profile.phone || ""),
          recovery_email: String(response.profile.recovery_email || ""),
          avatar_url: String(response.profile.avatar_url || ""),
        }));
        setRecoveryEmailDraft(String(response.profile.recovery_email || ""));
      }
      toast.success("Recovery email updated");
    } catch (err: any) {
      console.error("Error saving recovery email:", err);
      toast.error(err?.message || "Failed to update recovery email");
    } finally {
      setSavingRecoveryEmail(false);
    }
  };

  const handleSaveProfile = async () => {
    const localError = validateLocalProfile();
    if (localError) {
      toast.error(localError);
      return;
    }

    try {
      setSavingProfile(true);
      const payload = {
        fullname: String(profile.fullname || "").trim(),
        phone: String(profile.phone || "").trim(),
        recovery_email: String(profile.recovery_email || "").trim().toLowerCase(),
        language: String(profile.language || "").toLowerCase().trim(),
        timezone: String(profile.timezone || "").trim(),
        date_format: String(profile.date_format || "").trim(),
        avatar_url: String(profile.avatar_url || "").trim(),
        version: profile.version,
      };

      const response = await apiPut<{ success: boolean; profile: ProfileState }>(
        "/settings/profile",
        payload
      );

      if (response?.profile) {
        setProfile((prev) => ({
          ...prev,
          ...response.profile,
          phone: String(response.profile.phone || ""),
          recovery_email: String(response.profile.recovery_email || ""),
          avatar_url: String(response.profile.avatar_url || ""),
        }));
        setRecoveryEmailDraft(String(response.profile.recovery_email || ""));
        setSettings((prev) => ({ ...prev, language: response.profile.language }));
      }

      toast.success("Profile updated successfully!");
    } catch (err: any) {
      console.error("Error saving profile:", err);
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("invalid profile payload")) {
        toast.error("Invalid profile data. Please review your inputs.");
      } else if (message.toLowerCase().includes("another session")) {
        toast.error("Profile was updated from another session. Refresh and try again.");
      } else {
        toast.error(message || "Failed to save profile");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSettings = async () => {
    const localError = validateLocalSettings();
    if (localError) {
      toast.error(localError);
      return;
    }

    try {
      setSavingSettings(true);
      const payload = {
        theme: String(settings.theme).toLowerCase(),
        language: String(settings.language).toLowerCase(),
        email_notifications: !!settings.email_notifications,
        sms_notifications: !!settings.sms_notifications,
        version: settings.version,
      };

      const response = await apiPut<{ success: boolean; settings: SettingsState }>(
        "/settings",
        payload
      );

      if (response?.settings) {
        setSettings((prev) => ({ ...prev, ...response.settings }));
      }
      toast.success("Settings updated successfully!");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("invalid settings payload")) {
        toast.error("Invalid settings payload. Please review theme/language values.");
      } else if (message.toLowerCase().includes("another session")) {
        toast.error("Settings were updated from another session. Reload settings and try again.");
      } else {
        toast.error(message || "Failed to save settings");
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePasswordChange = async (event?: FormEvent) => {
    event?.preventDefault();
    const { current, next, confirm } = passwordForm;

    if (!current || !next || !confirm) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (next !== confirm) {
      toast.error("Password confirmation does not match");
      return;
    }
    if (current === next) {
      toast.error("New password must be different from current password");
      return;
    }

    const violations = getPasswordViolations(next);
    if (violations.length) {
      setPasswordErrors(violations);
      toast.error("New password does not meet the security requirements");
      return;
    }

    try {
      setPasswordErrors([]);
      setChangingPassword(true);
      await apiPost("/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      toast.success("Password updated successfully");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      console.error("Error updating password:", err);
      toast.error(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const tabsCols = isAdmin ? "grid-cols-4" : "grid-cols-3";

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
            {isAdmin && (
              <TabsTrigger value="admin">
                <ShieldCheck className="w-4 h-4 mr-2" /> Admin
              </TabsTrigger>
            )}
            <TabsTrigger value="integrations">
              <Link2 className="w-4 h-4 mr-2" /> Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileSettingsTab
              profile={profile}
              setProfile={setProfile}
              settings={settings}
              setSettings={setSettings}
              loading={loading || savingProfile}
              onSave={handleSaveProfile}
              onSaveAppearance={handleSaveSettings}
            />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySettingsTab
              form={passwordForm}
              setForm={setPasswordForm}
              passwordErrors={passwordErrors}
              setPasswordErrors={setPasswordErrors}
              changingPassword={changingPassword}
              onSubmit={handlePasswordChange}
              onForceLogout={logout}
              recoveryEmail={profile.recovery_email || ""}
              recoveryEmailDraft={recoveryEmailDraft}
              setRecoveryEmailDraft={setRecoveryEmailDraft}
              onSaveRecoveryEmail={handleSaveRecoveryEmail}
              savingRecoveryEmail={savingRecoveryEmail}
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <div className="space-y-8">
                <AdminUsersPanel />
                <AuditEventsPanel />
              </div>
            </TabsContent>
          )}

          <TabsContent value="integrations">
            <IntegrationsSettingsTab />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
