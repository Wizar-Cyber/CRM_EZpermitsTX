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
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">Add Client</DialogTitle>
          <DialogDescription>
            Create a new client record, pre-filled from Lead #{clientData.case_number}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-3 py-4">
            <Input
              placeholder="Full name (Required)"
              value={client.fullname}
              onChange={(e) => setClient({ ...client, fullname: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              required
            />
            <Input
              placeholder="Email"
              type="email"
              value={client.email}
              onChange={(e) => setClient({ ...client, email: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <Input
              placeholder="Phone"
              type="tel"
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <Input
              placeholder="Address"
              value={client.address}
              onChange={(e) => setClient({ ...client, address: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <Input
              placeholder="Source"
              value={client.source}
              onChange={(e) => setClient({ ...client, source: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />

            <div className="flex items-center gap-2">
              <Input
                placeholder="Case number"
                value={client.case_number}
                onChange={(e) => setClient({ ...client, case_number: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleValidateCase}
                disabled={isLoading || !client.case_number.trim()}
              >
                {isLoading ? "Validating..." : "Validate"}
              </Button>
            </div>

            <Textarea
              placeholder="Description / Case Info (loaded from Lead or Case validation)"
              value={client.description}
              onChange={(e) => setClient({ ...client, description: e.target.value })}
              className="bg-muted text-foreground min-h-[100px]"
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isLoading || !client.fullname.trim()}>
              <Save className="w-4 h-4 mr-1" /> {isLoading ? "Saving..." : "Save Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
