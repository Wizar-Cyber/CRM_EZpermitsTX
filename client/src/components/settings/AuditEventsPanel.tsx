import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet } from "@/lib/api";
import { AuditEventRow } from "./types";

type AuditResponse = {
  data: AuditEventRow[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

const compactName = (value?: string | null, fallback = "—") => {
  if (!value) return fallback;
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.join(" ") || fallback;
};

const describeAction = (event: AuditEventRow) => {
  const actor = compactName(event.actor_name, "System");
  const target = compactName(
    event.target_name,
    event.target_user_id ? `User ${event.target_user_id}` : "their account"
  );

  switch (event.action) {
    case "admin.user.approve":
      return `${actor} approved ${target}.`;
    case "admin.user.block":
      return `${actor} blocked ${target}.`;
    case "admin.user.unblock":
      return `${actor} unblocked ${target}.`;
    case "admin.user.role.update":
      return `${actor} changed ${target}'s role.`;
    case "admin.user.delete":
      return `${actor} deleted ${target}.`;
    case "auth.password.change":
      return `${actor} changed their password.`;
    case "auth.sessions.revoke-others":
      return `${actor} closed other active sessions.`;
    case "auth.sessions.revoke-all":
      return `${actor} closed all active sessions.`;
    case "settings.profile.update":
      return `${actor} updated their profile.`;
    case "settings.update":
      return `${actor} updated their settings.`;
    default:
      return `${actor} performed action ${event.action} on ${event.entity}${event.entity_id ? ` #${event.entity_id}` : ""}.`;
  }
};

export function AuditEventsPanel() {
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<AuditResponse["meta"]>({
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
  });

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadEvents = async (nextPage = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("page_size", "25");
      if (search.trim()) params.set("search", search.trim());
      if (action.trim()) params.set("action", action.trim());
      if (entity.trim()) params.set("entity", entity.trim());
      if (from.trim()) params.set("from", from.trim());
      if (to.trim()) params.set("to", to.trim());

      const res = await apiGet<AuditResponse>(`/admin/audit-events?${params.toString()}`);
      setEvents(res.data || []);
      setMeta(res.meta || { page: nextPage, page_size: 25, total: 0, total_pages: 1 });
      setPage(nextPage);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to load audit events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> Audit Trail
        </h2>
        <Button variant="outline" size="sm" onClick={() => loadEvents(page)}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <details className="rounded-xl border p-4" open>
        <summary className="cursor-pointer font-medium">Audit filters</summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <Label>Search</Label>
            <Input
              placeholder="action, entity, actor, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label>Action</Label>
            <Input placeholder="admin.user.block" value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div>
            <Label>Entity</Label>
            <Input placeholder="users" value={entity} onChange={(e) => setEntity(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => loadEvents(1)} disabled={loading}>
              Apply filters
            </Button>
          </div>

          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </details>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading audit events...</p>
      ) : (
        <>
          <details className="rounded-xl border p-4" open>
            <summary className="cursor-pointer font-medium">User activity</summary>
            <div className="mt-4 rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3">When</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t align-top">
                      <td className="p-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="p-3">
                        <div>{compactName(e.actor_name, "System")}</div>
                        {e.actor_email && <div className="text-xs text-muted-foreground">{e.actor_email}</div>}
                      </td>
                      <td className="p-3">
                        <div>{compactName(e.target_name, e.target_user_id ? `User ${e.target_user_id}` : "—")}</div>
                        {e.target_email && <div className="text-xs text-muted-foreground">{e.target_email}</div>}
                      </td>
                      <td className="p-3 min-w-[340px]">{describeAction(e)}</td>
                    </tr>
                  ))}
                  {!events.length && (
                    <tr>
                      <td className="p-4 text-sm text-muted-foreground" colSpan={4}>
                        No audit events found for current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total: <strong>{meta.total}</strong> · Page <strong>{meta.page}</strong> / <strong>{meta.total_pages}</strong>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1 || loading}
                onClick={() => loadEvents(meta.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.total_pages || loading}
                onClick={() => loadEvents(meta.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
