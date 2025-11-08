import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import {
  CalendarDays,
  CalendarPlus,
  Trash2,
  Search,
  X,
} from "lucide-react";

/* ---------- TYPES ---------- */
interface Appointment {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  address?: string;
  status: string;
  note?: string;
  client_id?: number;
  client_name?: string;
}

/* =========================================================
   MAIN PAGE
   ========================================================= */
export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchAppointments = async () => {
    try {
      const data = await apiGet<Appointment[]>("/appointments");
      setAppointments(data);
    } catch {
      toast.error("Error loading appointments");
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await apiDelete(`/appointments/${id}`);
      toast.success("Appointment deleted");
      fetchAppointments();
    } catch {
      toast.error("Error deleting appointment");
    }
  };

  const filtered = appointments.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.client_name?.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CalendarDays className="w-8 h-8 text-primary" />
          Appointments
        </h1>
        <Button onClick={() => setShowModal(true)}>
          <CalendarPlus className="w-4 h-4 mr-1" /> Add Appointment
        </Button>
      </header>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-gray-500" />
        <Input
          placeholder="Search by title, client, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ---------- APPOINTMENTS LIST ---------- */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length > 0 ? (
          filtered.map((a) => (
            <Card
              key={a.id}
              className="p-4 cursor-pointer hover:bg-gray-50 transition"
              onClick={() => setSelected(a)}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">{a.title}</h3>
                <span className="text-xs text-blue-600">{a.status}</span>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(a.start_time).toLocaleString()} -{" "}
                {new Date(a.end_time).toLocaleString()}
              </p>
              {a.client_name && (
                <p className="text-sm text-gray-500">👤 {a.client_name}</p>
              )}
              {a.note && (
                <p className="text-xs text-gray-500 italic mt-1">
                  🗒️ {a.note}
                </p>
              )}
            </Card>
          ))
        ) : (
          <p className="text-gray-400">No appointments found</p>
        )}
      </div>

      {/* ---------- DETAIL MODAL ---------- */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[500px] relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-semibold mb-2">{selected.title}</h2>
            <p className="text-sm text-gray-600 mb-2">
              {new Date(selected.start_time).toLocaleString()} -{" "}
              {new Date(selected.end_time).toLocaleString()}
            </p>
            <p className="text-sm mb-1">
              <strong>Client:</strong> {selected.client_name || "Unlinked"}
            </p>
            <p className="text-sm mb-1">
              <strong>Address:</strong> {selected.address || "-"}
            </p>
            <p className="text-sm mb-1">
              <strong>Status:</strong>{" "}
              <span className="text-blue-600">{selected.status}</span>
            </p>
            {selected.note && (
              <p className="text-sm mt-2 italic border-t pt-2">
                🗒️ {selected.note}
              </p>
            )}

            <div className="flex justify-end mt-6">
              <Button
                variant="destructive"
                onClick={() => handleDelete(selected.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- CREATE MODAL ---------- */}
      {showModal && (
        <AppointmentModal
          client={null}
          onClose={() => setShowModal(false)}
          onSuccess={fetchAppointments}
        />
      )}
    </div>
  );
}

/* =========================================================
   UNIFIED APPOINTMENT MODAL (SAME AS CLIENTS)
   ========================================================= */
function AppointmentModal({ client, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    title: "",
    start_time: "",
    end_time: "",
    address: "",
    note: "",
    status: "pending",
    client_id: client?.id || "",
  });

  const [clients, setClients] = useState<{ id: number; fullname: string }[]>([]);

  useEffect(() => {
    if (!client) {
      (async () => {
        try {
          const data = await apiGet<{ id: number; fullname: string }[]>("/clientes");
          setClients(data);
        } catch {
          toast.error("Error loading clients");
        }
      })();
    }
  }, [client]);

  const handleOverlayClick = (e: any) => {
    if (e.target.id === "overlay") onClose();
  };

  const handleSubmit = async () => {
    const { title, start_time, end_time, client_id } = form;
    if (!title || !start_time || !end_time)
      return toast.error("Please fill all required fields");
    if (!client_id) return toast.error("Please select a client");

    try {
      await apiPost("/appointments", {
        ...form,
        created_by: "system",
      });
      toast.success("Appointment created");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("❌ Error creating appointment:", err);
      toast.error("Error creating appointment");
    }
  };

  return (
    <div
      id="overlay"
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div
        className="bg-white rounded-2xl shadow-lg w-[500px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">
          {client ? `New Appointment for ${client.fullname}` : "New Appointment"}
        </h2>

        <div className="grid gap-3">
          {!client && (
            <div>
              <label className="text-sm font-medium">Select Client</label>
              <select
                className="w-full border rounded-md p-2 mt-1"
                value={form.client_id}
                onChange={(e) =>
                  setForm({ ...form, client_id: parseInt(e.target.value) })
                }
              >
                <option value="">-- Select client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullname}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
          <Input
            type="datetime-local"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
          <Input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Textarea
            placeholder="Optional note..."
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </div>
      </div>
    </div>
  );
}

