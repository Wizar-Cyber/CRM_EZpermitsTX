import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiGet, apiPatch } from "@/lib/api";
import { RoleOption, UserRow } from "./types";

type PendingSecureAction = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  run: (current_password: string) => Promise<void>;
};

export function AdminUsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "blocked">("all");
  const [pendingAction, setPendingAction] = useState<PendingSecureAction | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [executingSecureAction, setExecutingSecureAction] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const openSecureAction = (action: PendingSecureAction) => {
    setPendingAction(action);
    setAdminPassword("");
    setCapsLockOn(false);
  };

  const closeSecureAction = () => {
    if (executingSecureAction) return;
    setPendingAction(null);
    setAdminPassword("");
    setCapsLockOn(false);
  };

  const executeSecureAction = async () => {
    const current_password = adminPassword.trim();
    if (!current_password) {
      toast.error("Admin password is required");
      return;
    }
    if (!pendingAction) return;

    try {
      setExecutingSecureAction(true);
      await pendingAction.run(current_password);
      closeSecureAction();
    } catch (err: any) {
      toast.error(err?.message || "Action failed");
    } finally {
      setExecutingSecureAction(false);
    }
  };

  const formatLastSeen = (value?: string | null) => {
    if (!value) return { absolute: "No recent activity", relative: "No recent activity" };

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return { absolute: "No recent activity", relative: "No recent activity" };
    }

    const absolute = date.toLocaleString();
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) return { absolute, relative: "just now" };
    if (diffMinutes < 60) return { absolute, relative: `${diffMinutes}m ago` };

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return { absolute, relative: `${diffHours}h ago` };

    const diffDays = Math.floor(diffHours / 24);
    return { absolute, relative: `${diffDays}d ago` };
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await apiGet<{ data: UserRow[] }>("/admin/users");
      setUsers(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to load users (are you an admin?)");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadRoles = async () => {
    try {
      setLoadingRoles(true);
      const res = await apiGet<{ roles: RoleOption[] }>("/admin/roles");
      setRoles(res.roles || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to load roles");
    } finally {
      setLoadingRoles(false);
    }
  };

  const changeRole = async (userId: number, roleId: number) => {
    const target = users.find((u) => u.id === userId);
    if (!target || target.role_id === roleId) return;

    const roleName = roles.find((r) => r.id === roleId)?.name || `role #${roleId}`;
    openSecureAction({
      title: "Confirm role change",
      description: `You are about to assign ${target.fullname} to ${roleName}. Enter your admin password to continue.`,
      confirmLabel: "Change role",
      run: async (current_password) => {
        try {
          setChangingRoleId(userId);
          await apiPatch(`/admin/users/${userId}/role`, { role_id: roleId, current_password });
          toast.success("Role updated");
          await loadUsers();
        } catch (err: any) {
          console.error(err);
          throw err;
        } finally {
          setChangingRoleId(null);
        }
      },
    });
  };

  useEffect(() => {
    loadUsers();
    loadRoles();

    const interval = window.setInterval(() => {
      loadUsers();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const approved = users.filter((u) => u.is_approved && !u.is_blocked).length;
    const blocked = users.filter((u) => u.is_blocked).length;
    const pending = users.filter((u) => !u.is_approved && !u.is_blocked).length;
    const onlineNow = users.filter((u) => u.is_online).length;
    return {
      total: users.length,
      approved,
      blocked,
      pending,
      onlineNow,
    };
  }, [users]);

  const visibleUsers = useMemo(() => {
    if (statusFilter === "approved") return users.filter((u) => u.is_approved && !u.is_blocked);
    if (statusFilter === "pending") return users.filter((u) => !u.is_approved && !u.is_blocked);
    if (statusFilter === "blocked") return users.filter((u) => u.is_blocked);
    return users;
  }, [statusFilter, users]);

  const approve = async (id: number) => {
    const target = users.find((u) => u.id === id);
    openSecureAction({
      title: "Approve user",
      description: `Approve ${target?.fullname || "this user"}? Enter your admin password to confirm.`,
      confirmLabel: "Approve",
      run: async (current_password) => {
        await apiPatch(`/admin/users/${id}/approve`, { current_password });
        toast.success("User approved");
        await loadUsers();
      },
    });
  };

  const block = async (id: number) => {
    const target = users.find((u) => u.id === id);
    openSecureAction({
      title: "Block user",
      description: `Block ${target?.fullname || "this user"}? They will lose access until unblocked.`,
      confirmLabel: "Block",
      run: async (current_password) => {
        await apiPatch(`/admin/users/${id}/block`, { blocked: true, current_password });
        toast.success("User blocked");
        await loadUsers();
      },
    });
  };

  const unblock = async (id: number) => {
    const target = users.find((u) => u.id === id);
    openSecureAction({
      title: "Unblock user",
      description: `Unblock ${target?.fullname || "this user"}? Enter your admin password to continue.`,
      confirmLabel: "Unblock",
      run: async (current_password) => {
        await apiPatch(`/admin/users/${id}/block`, { blocked: false, current_password });
        toast.success("User unblocked");
        await loadUsers();
      },
    });
  };

  const remove = async (id: number) => {
    const target = users.find((u) => u.id === id);
    openSecureAction({
      title: "Delete user permanently",
      description: `This action cannot be undone. ${target?.fullname || "This user"} will be removed permanently. Enter your admin password to confirm.`,
      confirmLabel: "Delete user",
      destructive: true,
      run: async (current_password) => {
        await api("DELETE", `/admin/users/${id}`, { current_password });
        toast.success("User deleted");
        await loadUsers();
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> User Administration
        </h2>
        <Button variant="outline" size="sm" onClick={loadUsers}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <details className="rounded-xl border p-4" open>
        <summary className="cursor-pointer font-medium">Active sections overview</summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Total users</p>
              <p className="text-xl font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Online now</p>
              <p className="text-xl font-semibold text-emerald-600">{stats.onlineNow}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Approved</p>
              <p className="text-xl font-semibold">{stats.approved}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Pending</p>
              <p className="text-xl font-semibold">{stats.pending}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Blocked</p>
              <p className="text-xl font-semibold">{stats.blocked}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
            <Button size="sm" variant={statusFilter === "approved" ? "default" : "outline"} onClick={() => setStatusFilter("approved")}>Approved</Button>
            <Button size="sm" variant={statusFilter === "pending" ? "default" : "outline"} onClick={() => setStatusFilter("pending")}>Pending</Button>
            <Button size="sm" variant={statusFilter === "blocked" ? "default" : "outline"} onClick={() => setStatusFilter("blocked")}>Blocked</Button>
          </div>
        </div>
      </details>

      <details className="rounded-xl border p-4" open>
        <summary className="cursor-pointer font-medium">User management</summary>
        <div className="mt-4">
          {loadingUsers ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Online</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u) => {
                const roleLabel =
                  u.role_name || (u.role_id === 1 ? "admin" : u.role_id === null ? "no role" : "user");
                const currentRoleValue = u.role_id !== null ? String(u.role_id) : "";
                const disableRoleSelect = changingRoleId === u.id || loadingRoles;
                const statusLabel = u.is_blocked ? "Blocked" : u.is_approved ? "Approved" : "Pending";
                const lastSeen = formatLastSeen(u.last_seen_at);

                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">{u.fullname}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <div
                        className="flex flex-col gap-0.5"
                        title={u.is_online ? "Active now" : `Last activity: ${lastSeen.absolute}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${u.is_online ? "bg-emerald-500" : "bg-zinc-400"}`}
                            aria-hidden="true"
                          />
                          <span className={u.is_online ? "text-emerald-700" : "text-muted-foreground"}>
                            {u.is_online ? "Online" : "Offline"}
                          </span>
                        </div>
                        {!u.is_online && u.last_seen_at && (
                          <span className="pl-4 text-[11px] leading-tight text-muted-foreground">
                            Last active {lastSeen.relative} · {lastSeen.absolute}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {roles.length ? (
                        <select
                          className="w-full rounded-md border bg-background px-2 py-1 text-sm capitalize"
                          value={currentRoleValue}
                          disabled={disableRoleSelect}
                          onChange={(e) => {
                            const selectedRole = Number(e.target.value);
                            if (Number.isNaN(selectedRole)) return;
                            changeRole(u.id, selectedRole);
                          }}
                        >
                          <option value="" disabled>
                            Select a role
                          </option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="capitalize">{roleLabel}</span>
                      )}
                    </td>
                    <td className="p-3">{statusLabel}</td>
                    <td className="p-3">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2 justify-end">
                        {!u.is_approved && !u.is_blocked && (
                          <Button variant="secondary" size="sm" onClick={() => approve(u.id)} title="Approve">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                        )}
                        {!u.is_blocked ? (
                          <Button variant="outline" size="sm" onClick={() => block(u.id)} title="Block">
                            <Ban className="w-4 h-4 mr-2 text-red-600" />
                            Block
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => unblock(u.id)} title="Unblock">
                            <Ban className="w-4 h-4 mr-2" />
                            Unblock
                          </Button>
                        )}
                        {u.role_id !== 1 && (
                          <Button variant="destructive" size="sm" onClick={() => remove(u.id)} title="Delete">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                  })}
                  {visibleUsers.length === 0 && (
                    <tr>
                      <td className="p-4 text-sm text-muted-foreground" colSpan={7}>
                        No users found for this section.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      <Dialog open={!!pendingAction} onOpenChange={(open) => !open && closeSecureAction()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingAction?.title || "Confirm action"}</DialogTitle>
            <DialogDescription>{pendingAction?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="admin-password-confirm" className="text-sm font-medium">
              Admin password
            </label>
            <Input
              id="admin-password-confirm"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
              onKeyDown={(e) => {
                setCapsLockOn(e.getModifierState("CapsLock"));
                if (e.key === "Enter") {
                  e.preventDefault();
                  executeSecureAction();
                }
              }}
            />
            {capsLockOn && (
              <p className="text-xs text-amber-600">Caps Lock is on</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeSecureAction} disabled={executingSecureAction}>
              Cancel
            </Button>
            <Button
              variant={pendingAction?.destructive ? "destructive" : "default"}
              onClick={executeSecureAction}
              disabled={executingSecureAction}
            >
              {executingSecureAction ? "Processing..." : pendingAction?.confirmLabel || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
