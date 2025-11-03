import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { apiPost, apiPut, apiDelete } from "@/lib/api";

export function AppointmentModal({
  event,
  onClose,
  onSave,
  onDelete,
  client, // opcional, si viene desde ClientsPage
}: {
  event: any;
  onClose: () => void;
  onSave?: (event: any) => void;
  onDelete?: (id: number) => void;
  client?: { id: number; fullname: string };
}) {
  const isNew = !event?.id;

  const [form, setForm] = useState({
    title: event?.title || "",
    address: event?.address || "",
    asesor: event?.asesor || "",
    note: event?.note || "",
    date_time: event?.date_time
      ? format(new Date(event.date_time), "yyyy-MM-dd'T'HH:mm")
      : "",
    status: event?.status || "pending",
  });

  const statusOptions = ["pending", "visited", "completed", "canceled"];

  const handleSave = async () => {
    const { title, asesor, date_time } = form;
    if (!title || !asesor || !date_time)
      return toast.error("Please fill all required fields.");

    const dateObj = new Date(date_time);
    const now = new Date();
    if (dateObj < now && isNew) {
      return toast.error("Cannot schedule an appointment in the past.");
    }

    try {
      if (client) {
        // 🧭 Crear cita desde ClientsPage
        await apiPost("/appointments", {
          title: form.title,
          address: form.address,
          status: form.status,
          created_by: "system",
          client_id: client.id,
          note: form.note,
          date_time: dateObj,
        });
        toast.success(`Appointment created for ${client.fullname}`);
      } else if (isNew) {
        // 🧭 Crear cita desde calendario
        const newEvent = await apiPost("/appointments", {
          title: form.title,
          address: form.address,
          status: form.status,
          created_by: "system",
          note: form.note,
          date_time: dateObj,
        });
        onSave?.(newEvent);
        toast.success("Appointment created successfully");
      } else {
        // 🧭 Editar cita existente
        const updated = await apiPut(`/appointments/${event.id}`, {
          title: form.title,
          address: form.address,
          note: form.note,
          date_time: dateObj,
          status: form.status,
        });
        onSave?.(updated);
        toast.success("Appointment updated");
      }

      onClose();
    } catch (err) {
      console.error("❌ Error saving appointment:", err);
      toast.error("Error saving appointment");
    }
  };

  const handleDelete = async () => {
    if (!event.id) return;
    try {
      await apiDelete(`/appointments/${event.id}`);
      onDelete?.(event.id);
      toast.success("Appointment deleted");
      onClose();
    } catch (err) {
      console.error("❌ Error deleting appointment:", err);
      toast.error("Error deleting appointment");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updated = await apiPut(`/appointments/${event.id}/status`, {
        status: newStatus,
      });
      setForm((prev) => ({ ...prev, status: newStatus }));
      toast.success(`Status updated to "${newStatus}"`);
      onSave?.(updated);
    } catch (err) {
      console.error("❌ Error changing status:", err);
      toast.error("Error updating status");
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "New Appointment" : "Edit Appointment"}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? client
                ? `Creating appointment for ${client.fullname}`
                : "Fill in the appointment details"
              : `Editing appointment: ${event.title}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Appointment title"
            />
          </div>

          <div className="grid gap-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Client address or meeting location"
            />
          </div>

          <div className="grid gap-2">
            <Label>Advisor</Label>
            <Input
              value={form.asesor}
              onChange={(e) => setForm({ ...form, asesor: e.target.value })}
              placeholder="Advisor name"
            />
          </div>

          <div className="grid gap-2">
            <Label>Date and Time</Label>
            <Input
              type="datetime-local"
              value={form.date_time}
              onChange={(e) => setForm({ ...form, date_time: e.target.value })}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <select
              className="border rounded-md p-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>

            {!isNew && (
              <div className="flex gap-2 mt-2">
                {statusOptions
                  .filter((s) => s !== form.status)
                  .map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(s)}
                    >
                      {`Mark as ${s.charAt(0).toUpperCase() + s.slice(1)}`}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Add a note..."
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {isNew ? (
            <Button onClick={handleSave}>Save Appointment</Button>
          ) : (
            <div className="flex justify-between w-full">
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
              <Button onClick={handleSave}>Update</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
