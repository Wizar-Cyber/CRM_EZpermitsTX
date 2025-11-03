import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { useAuth } from "@/features/hooks/useAuth";
import {
  UserCircle2,
  PlusCircle,
  Trash2,
  MessageSquare,
  X,
  Search,
  CalendarPlus,
  CalendarDays,
} from "lucide-react";

/* ---------- TYPES ---------- */
interface Client {
  id: number;
  fullname: string;
  email?: string;
  phone?: string;
  address?: string;
  type: string;
  status: string;
  priority: string;
  source?: string;
  assigned_name?: string;
  case_number?: string;
  resolution?: string;
  created_at?: string;
}

interface Event {
  id: number;
  tipo: string;
  descripcion: string;
  fecha: string;
  author_name?: string;
}

interface Note {
  id: number;
  nota: string;
  fecha: string;
  author_name?: string;
}

interface Appointment {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  address: string;
  status: string;
  note?: string;
}

/* =========================================================
   MAIN PAGE
   ========================================================= */
export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [newNote, setNewNote] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [search, setSearch] = useState("");

  const columns = ["pending", "visited", "purchased", "resolved"];

  const fetchClients = async () => {
    try {
      const data = await apiGet<Client[]>("/clientes");
      setClients(data);
    } catch {
      toast.error("Error loading clients");
    }
  };

  const fetchDetails = async (clientId: number) => {
    try {
      const [ev, nt, ap] = await Promise.all([
        apiGet<Event[]>(`/clientes/${clientId}/eventos`),
        apiGet<Note[]>(`/clientes/${clientId}/notas`),
        apiGet<Appointment[]>(`/clientes/${clientId}/appointments`),
      ]);
      setEvents(ev);
      setNotes(nt);
      setAppointments(ap);
    } catch {
      toast.error("Error loading client details");
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const clientId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    try {
      await apiPut(`/clientes/${clientId}`, { status: newStatus });
      toast.success("Status updated");
      fetchClients();
    } catch {
      toast.error("Error updating status");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    try {
      await apiDelete(`/clientes/${id}`);
      toast.success("Client deleted");
      fetchClients();
    } catch {
      toast.error("Error deleting client");
    }
  };

  const handleAddNote = async () => {
    if (!selected || !newNote.trim()) return;
    try {
      await apiPost(`/clientes/${selected.id}/notas`, { nota: newNote });
      setNewNote("");
      fetchDetails(selected.id);
      toast.success("Note added");
    } catch {
      toast.error("Error adding note");
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.fullname?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserCircle2 className="w-8 h-8 text-primary" />
          Clients
        </h1>
        <Button onClick={() => setShowModal(true)}>
          <PlusCircle className="w-4 h-4 mr-1" /> Add Client
        </Button>
      </header>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-gray-500" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ---------- KANBAN ---------- */}
      <div className="overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max">
            {columns.map((col) => (
              <Droppable key={col} droppableId={col}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="bg-gray-50 p-4 rounded-xl w-72 min-h-[70vh] shadow-sm"
                  >
                    <h2 className="font-semibold capitalize mb-3">{col}</h2>
                    {filtered
                      .filter((c) => c.status === col)
                      .map((c, index) => (
                        <Draggable
                          key={c.id}
                          draggableId={c.id.toString()}
                          index={index}
                        >
                          {(prov) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                            >
                              <Card
                                onClick={() => {
                                  setSelected(c);
                                  fetchDetails(c.id);
                                }}
                                className="p-3 mb-3 cursor-pointer hover:bg-gray-100"
                              >
                                <p className="font-medium">{c.fullname}</p>
                                <p className="text-xs text-gray-500">
                                  {c.assigned_name || "Unassigned"}
                                </p>
                                <span className="text-xs text-primary">
                                  {c.priority}
                                </span>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                    {filtered.filter((c) => c.status === col).length === 0 && (
                      <p className="text-sm text-gray-400">No clients</p>
                    )}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* ---------- CLIENT DETAILS MODAL ---------- */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[700px] max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold mb-2">{selected.fullname}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {selected.email || "-"} • {selected.phone || "-"}
            </p>

            <div className="space-y-2 mb-4">
              <p>
                <strong>Address:</strong> {selected.address || "-"}
              </p>
              {selected.case_number && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold">
                    Case #: {selected.case_number}
                  </p>
                  <p className="text-sm">{selected.resolution}</p>
                </div>
              )}
            </div>

            <hr className="my-4" />

            {/* Notes */}
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Notes
            </h3>
            <Textarea
              placeholder="Write a new note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <Button className="mt-2" onClick={handleAddNote}>
              Save Note
            </Button>

            <div className="mt-4 space-y-3">
              {notes.map((n) => (
                <Card key={n.id} className="p-3">
                  <p className="text-sm">{n.nota}</p>
                  <small className="text-gray-500">
                    {n.author_name} • {new Date(n.fecha).toLocaleString()}
                  </small>
                </Card>
              ))}
            </div>

            {/* Events */}
            {events.length > 0 && (
              <>
                <hr className="my-4" />
                <h3 className="font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Events
                </h3>
                <div className="mt-2 space-y-3">
                  {events.map((e) => (
                    <Card
                      key={e.id}
                      className="p-3 border-l-4 border-primary/60"
                    >
                      <p className="text-sm">{e.descripcion}</p>
                      <small className="text-gray-500">
                        {e.author_name} • {new Date(e.fecha).toLocaleString()}
                      </small>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* Appointments */}
            <hr className="my-4" />
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarPlus className="w-4 h-4" /> Appointments
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAppointmentModal(true)}
              >
                + Add Appointment
              </Button>
            </div>

            {appointments.length > 0 ? (
              <div className="space-y-2">
                {appointments.map((a) => (
                  <Card key={a.id} className="p-3">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(a.start_time).toLocaleString()} -{" "}
                      {new Date(a.end_time).toLocaleString()}
                    </p>
                    <p className="text-sm">{a.address}</p>
                    {a.note && (
                      <p className="text-xs text-gray-500 italic mt-1">
                        🗒️ {a.note}
                      </p>
                    )}
                    <span className="text-xs text-blue-600">{a.status}</span>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No appointments yet</p>
            )}

            <Button
              variant="destructive"
              className="mt-6 w-full"
              onClick={() => handleDelete(selected.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Client
            </Button>
          </div>
        </div>
      )}

      {showModal && (
        <ClientModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchClients}
        />
      )}

      {showAppointmentModal && (
        <AppointmentModal
          client={selected}
          onClose={() => setShowAppointmentModal(false)}
          onSuccess={() => fetchDetails(selected?.id || 0)}
        />
      )}
    </div>
  );
}

/* =========================================================
   CLIENT MODAL
   ========================================================= */
function ClientModal({ onClose, onSuccess }: any) {
  const [client, setClient] = useState({
    fullname: "",
    email: "",
    phone: "",
    address: "",
    source: "",
    case_number: "",
    resolution: "",
  });

  const handleOverlayClick = (e: any) => {
    if (e.target.id === "overlay") onClose();
  };

  const handleValidateCase = async () => {
    if (!client.case_number.trim()) return;
    try {
      const res = await apiGet(`/clientes/validate-case/${client.case_number}`);
      if (res.valid) {
        setClient({ ...client, resolution: res.resolution });
        toast.success("Case found");
      }
    } catch {
      toast.error("Case not found");
      setClient({ ...client, resolution: "" });
    }
  };

  const handleSubmit = async () => {
    if (!client.fullname.trim()) return toast.error("Full name required");
    try {
      await apiPost("/clientes", client);
      toast.success("Client created");
      onSuccess();
      onClose();
    } catch {
      toast.error("Error creating client");
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
        <h2 className="text-xl font-semibold mb-4">Add Client</h2>

        <div className="grid gap-3">
          <Input
            placeholder="Full name"
            value={client.fullname}
            onChange={(e) => setClient({ ...client, fullname: e.target.value })}
          />
          <Input
            placeholder="Email"
            value={client.email}
            onChange={(e) => setClient({ ...client, email: e.target.value })}
          />
          <Input
            placeholder="Phone"
            value={client.phone}
            onChange={(e) => setClient({ ...client, phone: e.target.value })}
          />
          <Input
            placeholder="Address"
            value={client.address}
            onChange={(e) => setClient({ ...client, address: e.target.value })}
          />
          <Input
            placeholder="Source"
            value={client.source}
            onChange={(e) => setClient({ ...client, source: e.target.value })}
          />

          <div className="flex items-center gap-2">
            <Input
              placeholder="Case number (optional)"
              value={client.case_number}
              onChange={(e) =>
                setClient({ ...client, case_number: e.target.value })
              }
            />
            <Button variant="outline" onClick={handleValidateCase}>
              Validate
            </Button>
          </div>

          {client.resolution && (
            <Textarea
              readOnly
              value={client.resolution}
              className="bg-gray-100 text-gray-700"
            />
          )}
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

/* =========================================================
   APPOINTMENT MODAL (UNIFICADO)
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
      toast.success("Appointment saved");
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
