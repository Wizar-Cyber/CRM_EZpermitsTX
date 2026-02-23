import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";

export type PasswordFormState = {
  current: string;
  next: string;
  confirm: string;
};

type ActiveSession = {
  session_id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  current: boolean;
};

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One digit", test: (value: string) => /\d/.test(value) },
  { label: "One special character", test: (value: string) => /[^\w\s]/.test(value) },
];

const getPasswordChecklist = (value: string) =>
  PASSWORD_RULES.map((rule) => ({
    label: rule.label,
    met: rule.test(value),
  }));

export function SecuritySettingsTab({
  form,
  setForm,
  passwordErrors,
  setPasswordErrors,
  changingPassword,
  onSubmit,
  onForceLogout,
  recoveryEmail,
  recoveryEmailDraft,
  setRecoveryEmailDraft,
  onSaveRecoveryEmail,
  savingRecoveryEmail,
}: {
  form: PasswordFormState;
  setForm: (updater: (prev: PasswordFormState) => PasswordFormState) => void;
  passwordErrors: string[];
  setPasswordErrors: (errors: string[]) => void;
  changingPassword: boolean;
  onSubmit: (event?: FormEvent) => Promise<void>;
  onForceLogout: () => void;
  recoveryEmail: string;
  recoveryEmailDraft: string;
  setRecoveryEmailDraft: (value: string) => void;
  onSaveRecoveryEmail: () => Promise<void>;
  savingRecoveryEmail: boolean;
}) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmRevokeAllOpen, setConfirmRevokeAllOpen] = useState(false);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await apiGet<{ sessions: ActiveSession[] }>("/auth/sessions");
      setSessions(res.sessions || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to load active sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevokeOthers = async () => {
    try {
      setRevokingOthers(true);
      const res = await apiPost<{ success: boolean; revoked: number }>("/auth/sessions/revoke-others", {});
      toast.success(`Revoked ${Number(res?.revoked || 0)} session(s)`);
      loadSessions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to revoke other sessions");
    } finally {
      setRevokingOthers(false);
    }
  };

  const handleRevokeAll = async () => {
    try {
      setRevokingAll(true);
      await apiPost("/auth/sessions/revoke-all", {});
      toast.success("All sessions were revoked. Please login again.");
      onForceLogout();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to revoke all sessions");
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Security Settings</h2>

      <div className="rounded-xl border p-4 text-sm space-y-2">
        <p><strong>Recovery email:</strong> {recoveryEmail || "Not configured"}</p>
        <p><strong>Password:</strong> Protected • Last update tracked in audit trail</p>
      </div>

      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">Update recovery email</summary>
        <div className="mt-4 space-y-3">
          <Label htmlFor="recoveryEmail">Recovery Email</Label>
          <Input
            id="recoveryEmail"
            placeholder="name@example.com"
            value={recoveryEmailDraft}
            onChange={(e) => setRecoveryEmailDraft(e.target.value)}
          />
          <Button type="button" onClick={onSaveRecoveryEmail} disabled={savingRecoveryEmail}>
            {savingRecoveryEmail ? "Saving..." : "Update recovery email"}
          </Button>
        </div>
      </details>

      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">Change password</summary>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={form.current}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    current: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={form.next}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    next: value,
                  }));
                  if (passwordErrors.length) setPasswordErrors([]);
                }}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirm}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    confirm: value,
                  }));
                  if (passwordErrors.length) setPasswordErrors([]);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Password requirements:</p>
            <ul className="space-y-1 rounded-xl border p-3 text-sm">
              {getPasswordChecklist(form.next).map(({ label, met }) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 ${
                    met ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      met ? "bg-emerald-500" : "bg-muted-foreground"
                    }`}
                  />
                  {label}
                </li>
              ))}
            </ul>

            {passwordErrors.length > 0 && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-semibold mb-1">Please meet the following requirements:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {passwordErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Button className="rounded-xl" disabled={changingPassword} type="submit">
            {changingPassword ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </details>

      <details className="rounded-xl border p-4" open>
        <summary className="cursor-pointer font-medium">Active Sessions</summary>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={loadSessions} disabled={loadingSessions}>
              Refresh
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleRevokeOthers} disabled={revokingOthers || loadingSessions}>
              {revokingOthers ? "Revoking..." : "Close other sessions"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setConfirmRevokeAllOpen(true)}
              disabled={revokingAll || loadingSessions}
            >
              {revokingAll ? "Closing..." : "Close all sessions"}
            </Button>
          </div>

          {loadingSessions ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : !sessions.length ? (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Session</th>
                    <th className="p-2">IP</th>
                    <th className="p-2">Created</th>
                    <th className="p-2">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.session_id} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{s.current ? "Current session" : "Active session"}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{s.user_agent || "Unknown device"}</div>
                      </td>
                      <td className="p-2">{s.ip_address || "—"}</td>
                      <td className="p-2 whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="p-2 whitespace-nowrap">{new Date(s.last_seen_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      <ConfirmActionDialog
        open={confirmRevokeAllOpen}
        onOpenChange={setConfirmRevokeAllOpen}
        title="Close all sessions"
        description="This will close all sessions, including your current one. You will need to log in again."
        confirmLabel={revokingAll ? "Closing..." : "Close all"}
        destructive
        disabled={revokingAll}
        onConfirm={handleRevokeAll}
      />
    </div>
  );
}
