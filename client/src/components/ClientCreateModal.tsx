import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type NewClientData = {
  case_number: string;
  address: string;
  description: string;
  incident_address: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientData: NewClientData;
  onSuccess?: () => void;
};

const NOOP = () => {};

export function ClientCreateModal({ open, onOpenChange, clientData, onSuccess = NOOP }: Props) {
  const defaultClientState = useMemo(
    () => ({
      fullname: "",
      email: "",
      phone: "",
      address: clientData.address || clientData.incident_address || "",
      source: "",
      case_number: clientData.case_number || "",
      description: clientData.description || "",
      type: "new",
      status: "pending",
      priority: "medium",
    }),
    [clientData]
  );

  const [client, setClient] = useState(defaultClientState);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) setClient(defaultClientState);
  }, [open, defaultClientState]);

  const handleValidateCase = async () => {
    if (!client.case_number.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiGet<{ valid?: boolean; description?: string; message?: string }>(
        `/clients/validate-case/${client.case_number}`
      );
      if (res?.valid && res?.description) {
        setClient((prev) => ({ ...prev, description: res.description || "" }));
        toast.success("Case found and description loaded.");
      } else {
        setClient((prev) => ({ ...prev, description: "" }));
        toast.error(res?.message || "Case not found.");
      }
    } catch (err: any) {
      toast.error(`Error validating case: ${err?.message || "Unknown error"}`);
      setClient((prev) => ({ ...prev, description: "" }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!client.fullname.trim()) return toast.error("Full name required");
    setIsLoading(true);
    try {
      await apiPost("/clients", client);
      toast.success(`Client ${client.fullname} created successfully.`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Error creating client: ${err?.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px] border-border/50"
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border/50 pb-4">
          <DialogTitle className="text-2xl font-bold tracking-tight">👤 Add Client</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2">
            Create a new client record from Lead #{clientData.case_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-4 py-5">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">👤 Full Name *</label>
              <Input
                placeholder="Enter full name"
                value={client.fullname}
                onChange={(e) => setClient({ ...client, fullname: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                required
                className="border-border/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">📧 Email</label>
                <Input
                  placeholder="email@example.com"
                  type="email"
                  value={client.email}
                  onChange={(e) => setClient({ ...client, email: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  className="border-border/60"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">📱 Phone</label>
                <Input
                  placeholder="+1 (555) 000-0000"
                  type="tel"
                  value={client.phone}
                  onChange={(e) => setClient({ ...client, phone: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  className="border-border/60"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">📍 Address</label>
              <Input
                placeholder="Street address"
                value={client.address}
                onChange={(e) => setClient({ ...client, address: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                className="border-border/60"
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">🔗 Source</label>
              <Input
                placeholder="Lead source"
                value={client.source}
                onChange={(e) => setClient({ ...client, source: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                className="border-border/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block"># Case Number</label>
                <Input
                  placeholder="Case #"
                  value={client.case_number}
                  onChange={(e) => setClient({ ...client, case_number: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  className="border-border/60"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block"># Case Number</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Case #"
                    value={client.case_number}
                    onChange={(e) => setClient({ ...client, case_number: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    className="border-border/60 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleValidateCase}
                    disabled={isLoading || !client.case_number.trim()}
                    className="text-xs"
                  >
                    {isLoading ? "Validating..." : "Validate"}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">📝 Description / Case Info</label>
              <Textarea
                placeholder="Details loaded from Lead or Case validation"
                value={client.description}
                onChange={(e) => setClient({ ...client, description: e.target.value })}
                className="bg-slate-50 dark:bg-slate-900/30 text-foreground min-h-[100px] border-border/60"
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-border/50 flex justify-between items-center">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isLoading || !client.fullname.trim()}>
              <Save className="w-4 h-4 mr-2" /> {isLoading ? "Saving..." : "Save Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
