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
  Save,
  Edit3,
} from "lucide-react";
import { AppointmentModal } from "@/components/AppointmentModal";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";

type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

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
  description?: string;
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
  date_time?: string | null;
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

  // Estados de edición de notas
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editedNoteText, setEditedNoteText] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const columns = ["pending", "visited", "purchased", "resolved"];

  const fetchClients = async () => {
    try {
      const data = await apiGet<Client[]>("/clients");
      setClients(data);
    } catch {
      toast.error("Error loading clients");
    }
  };

  const fetchDetails = async (clientId: number) => {
    try {
      const [ev, nt, ap] = await Promise.all([
        apiGet<Event[]>(`/clients/${clientId}/eventos`),
        apiGet<Note[]>(`/clients/${clientId}/notas`),
        apiGet<Appointment[]>(`/clients/${clientId}/appointments`),
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
    const previousClients = clients;

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
    );

    try {
      await apiPut(`/clients/${clientId}`, { status: newStatus });
      toast.success("Status updated");
    } catch {
      setClients(previousClients);
      toast.error("Error updating status");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/clients/${id}`);
      toast.success("Client deleted");
      setSelected(null);
      setShowAppointmentModal(false);
      setEvents([]);
      setNotes([]);
      setAppointments([]);
      fetchClients();
    } catch {
      toast.error("Error deleting client");
    }
  };

  const handleAddNote = async () => {
    if (!selected || !newNote.trim()) return;
    try {
      await apiPost(`/clients/${selected.id}/notas`, { nota: newNote });
      setNewNote("");
      fetchDetails(selected.id);
      toast.success("Note added");
    } catch {
      toast.error("Error adding note");
    }
  };

  const handleUpdateNote = async (noteId: number, updated: string) => {
    if (!selected) return;
    try {
      await apiPut(`/clients/${selected.id}/notas/${noteId}`, { nota: updated });
      fetchDetails(selected.id);
      toast.success("Note updated");
      setEditingNoteId(null);
    } catch {
      toast.error("Error updating note");
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!selected) return;
    try {
      await apiDelete(`/clients/${selected.id}/notas/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch {
      toast.error("Error deleting note");
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
      {/* Header */}
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserCircle2 className="w-8 h-8 text-primary" />
          Clients
        </h1>
        <Button onClick={() => setShowModal(true)}>
          <PlusCircle className="w-4 h-4 mr-1" /> Add Client
        </Button>
      </header>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-muted-foreground" />
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
                    className="bg-muted/50 p-4 rounded-xl w-72 min-h-[70vh] shadow-sm"
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
                                className="p-3 mb-3 cursor-pointer hover:bg-muted"
                              >
                                <p className="font-medium">{c.fullname}</p>
                                <p className="text-xs text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">No clients</p>
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
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div
            className="bg-card rounded-2xl shadow-xl p-6 w-[700px] max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold mb-2">{selected.fullname}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {selected.email || "-"} • {selected.phone || "-"}
            </p>

            <div className="space-y-2 mb-4">
              <p>
                <strong>Address:</strong> {selected.address || "-"}
              </p>
              {selected.case_number && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="font-semibold">Case #: {selected.case_number}</p>
                  <p className="text-sm">{selected.description}</p>
                </div>
              )}
            </div>

            <hr className="my-4" />

            {/* Notes */}
            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Notes
              </h4>

              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button size="sm" onClick={handleAddNote}>
                  Add
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notes.length > 0 ? (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 bg-muted/50 rounded-md text-sm flex justify-between items-start"
                    >
                      <div className="flex-1 mr-2">
                        {editingNoteId === n.id ? (
                          <Textarea
                            className="text-sm w-full"
                            value={editedNoteText}
                            onChange={(e) =>
                              setEditedNoteText(e.target.value)
                            }
                          />
                        ) : (
                          <>
                            <p>{n.nota}</p>
                            <div className="text-xs text-muted-foreground">
                              {n.author_name || "System"} •{" "}
                              {new Date(n.fecha).toLocaleString()}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {editingNoteId === n.id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleUpdateNote(n.id, editedNoteText)
                            }
                          >
                            <Save className="w-4 h-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingNoteId(n.id);
                              setEditedNoteText(n.nota);
                            }}
                          >
                            <Edit3 className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setConfirmAction({
                              title: "Delete note",
                              description: "Are you sure you want to delete this note?",
                              confirmLabel: "Delete note",
                              destructive: true,
                              onConfirm: () => {
                                handleDeleteNote(n.id);
                                setConfirmAction(null);
                              },
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                )}
              </div>
            </div>

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
                  <Card
                    key={a.id}
                    className="p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      (window.location.href = `/appointments?id=${a.id}`)
                    }
                  >
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.date_time
                        ? new Date(a.date_time).toLocaleString()
                        : "No date"}
                    </p>
                    <p className="text-sm">{a.address}</p>
                    {a.note && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        🗒️ {a.note}
                      </p>
                    )}
                    <span className="text-xs text-blue-600">{a.status}</span>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No appointments yet</p>
            )}

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
                      <small className="text-muted-foreground">
                        {e.author_name} •{" "}
                        {new Date(e.fecha).toLocaleString()}
                      </small>
                    </Card>
                  ))}
                </div>
              </>
            )}

            <Button
              variant="destructive"
              className="mt-6 w-full"
              onClick={() =>
                setConfirmAction({
                  title: "Delete client",
                  description: `Are you sure you want to delete ${selected.fullname}? This action cannot be undone.`,
                  confirmLabel: "Delete client",
                  destructive: true,
                  onConfirm: () => {
                    handleDelete(selected.id);
                    setConfirmAction(null);
                  },
                })
              }
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

      {showAppointmentModal && selected && (
        <AppointmentModal
          event={null}
          client={selected}
          onClose={() => setShowAppointmentModal(false)}
          onSave={() => fetchDetails(selected.id)}
        />
      )}

      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmAction?.title || "Confirm action"}
        description={confirmAction?.description || "Are you sure you want to continue?"}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        destructive={!!confirmAction?.destructive}
        onConfirm={() => confirmAction?.onConfirm()}
      />
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
    description: "",
  });

  const handleOverlayClick = (e: any) => {
    if (e.target.id === "overlay") onClose();
  };

  const handleValidateCase = async () => {
    if (!client.case_number.trim()) return;
    try {
      const res = await apiGet(`/clients/validate-case/${client.case_number}`);
      if (res.valid && res.description) {
        setClient((prev) => ({ ...prev, description: res.description }));
        toast.success("Case found");
      } else {
        setClient((prev) => ({ ...prev, description: "" }));
        toast.error("Case not found");
      }
    } catch (err) {
      console.error("❌ Error validating case:", err);
      toast.error("Error validating case");
      setClient((prev) => ({ ...prev, description: "" }));
    }
  };

  const handleSubmit = async () => {
    if (!client.fullname.trim()) return toast.error("Full name required");
    try {
      await apiPost("/clients", client);
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
        className="bg-card rounded-2xl shadow-lg w-[500px] p-6"
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

          {client.description && (
            <Textarea
              readOnly
              value={client.description}
              className="bg-muted text-foreground"
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
