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

  const handleUpdateNote = async (noteId: number, updated: string) => {
    if (!selected) return;
    try {
      await apiPut(`/clientes/${selected.id}/notas/${noteId}`, { nota: updated });
      fetchDetails(selected.id);
      toast.success("Note updated");
      setEditingNoteId(null);
    } catch {
      toast.error("Error updating note");
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!selected) return;
    if (!confirm("Delete this note?")) return;
    try {
      await apiDelete(`/clientes/${selected.id}/notas/${noteId}`);
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
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <UserCircle2 className="w-5 h-5 opacity-80" />
              <span className="text-sm font-medium opacity-80 uppercase tracking-widest">Client Management</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Clients Pipeline</h1>
            <p className="text-emerald-100 mt-1 text-sm">Drag & drop clients between stages to update their status</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center border border-white/20">
              <p className="text-xl font-bold">{filtered.length}</p>
              <p className="text-xs opacity-75 mt-0.5">Total</p>
            </div>
            <Button
              onClick={() => setShowModal(true)}
              className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-sm border-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" /> Add Client
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-slate-200 dark:border-slate-700 focus:border-emerald-400"
        />
      </div>

      {/* ---------- KANBAN ---------- */}
      <div className="overflow-x-auto pb-2">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max">
            {(["pending", "visited", "purchased", "resolved"] as const).map((col) => {
              const colConfig = {
                pending: {
                  label: "Pending",
                  headerBg: "bg-amber-500",
                  colBg: "bg-amber-50/60 dark:bg-amber-950/10",
                  border: "border-amber-200 dark:border-amber-900",
                  dot: "bg-amber-400",
                  badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                  priorityColor: "text-amber-600 dark:text-amber-400",
                },
                visited: {
                  label: "Visited",
                  headerBg: "bg-blue-500",
                  colBg: "bg-blue-50/60 dark:bg-blue-950/10",
                  border: "border-blue-200 dark:border-blue-900",
                  dot: "bg-blue-400",
                  badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
                  priorityColor: "text-blue-600 dark:text-blue-400",
                },
                purchased: {
                  label: "Purchased",
                  headerBg: "bg-emerald-500",
                  colBg: "bg-emerald-50/60 dark:bg-emerald-950/10",
                  border: "border-emerald-200 dark:border-emerald-900",
                  dot: "bg-emerald-400",
                  badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                  priorityColor: "text-emerald-600 dark:text-emerald-400",
                },
                resolved: {
                  label: "Resolved",
                  headerBg: "bg-slate-500",
                  colBg: "bg-slate-50/60 dark:bg-slate-800/20",
                  border: "border-slate-200 dark:border-slate-700",
                  dot: "bg-slate-400",
                  badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                  priorityColor: "text-slate-500 dark:text-slate-400",
                },
              }[col];
              const count = filtered.filter((c) => c.status === col).length;
              return (
                <Droppable key={col} droppableId={col}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`${colConfig.colBg} border ${colConfig.border} rounded-2xl w-72 min-h-[65vh] shadow-sm overflow-hidden`}
                    >
                      {/* Column Header */}
                      <div className={`${colConfig.headerBg} px-4 py-3 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-white/60" />
                          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white">{colConfig.label}</h2>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colConfig.badge}`}>{count}</span>
                      </div>

                      {/* Cards */}
                      <div className="p-3">
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
                                    className="p-3 mb-2.5 cursor-pointer hover:shadow-md transition-all duration-150 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:-translate-y-0.5"
                                  >
                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{c.fullname}</p>
                                    {c.email && <p className="text-xs text-slate-400 mt-0.5 truncate">{c.email}</p>}
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                      {c.assigned_name || "Unassigned"}
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className={`text-[10px] font-bold uppercase tracking-wide ${colConfig.priorityColor}`}>
                                        {c.priority}
                                      </span>
                                      {c.phone && <span className="text-[10px] text-slate-400">{c.phone}</span>}
                                    </div>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                        {count === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                              <UserCircle2 className="w-5 h-5 text-slate-300" />
                            </div>
                            <p className="text-xs text-slate-400">No clients here</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
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
            className="bg-card border border-border rounded-2xl shadow-xl p-6 w-[700px] max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold tracking-tight mb-1">{selected.fullname}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {selected.email || "-"} • {selected.phone || "-"}
            </p>

            <div className="space-y-2 mb-4">
              <p className="text-sm"><strong>Address:</strong> {selected.address || "-"}</p>
              {selected.case_number && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border/60">
                  <p className="font-semibold text-sm">Case #: {selected.case_number}</p>
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                </div>
              )}
            </div>

            <hr className="my-4 border-border" />

            {/* Notes */}
            <div className="mt-4 border-t border-border pt-3">
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
                      className="p-2.5 bg-muted/40 border border-border/50 rounded-lg text-sm flex justify-between items-start"
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
                            <div className="text-xs text-muted-foreground/70 mt-0.5">
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
                          onClick={() => handleDeleteNote(n.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground/50">No notes yet</p>
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
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-border/60"
                    onClick={() =>
                      (window.location.href = `/appointments?id=${a.id}`)
                    }
                  >
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.date_time
                        ? new Date(a.date_time).toLocaleString()
                        : "No date"}
                    </p>
                    <p className="text-sm mt-0.5">{a.address}</p>
                    {a.note && (
                      <p className="text-xs text-muted-foreground/70 italic mt-1">
                        {a.note}
                      </p>
                    )}
                    <span className="text-xs text-primary font-medium">{a.status}</span>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50">No appointments yet</p>
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
                      <small className="text-muted-foreground/70">
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

      {showAppointmentModal && selected && (
        <AppointmentModal
          event={null}
          client={selected}
          onClose={() => setShowAppointmentModal(false)}
          onSave={() => fetchDetails(selected.id)}
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
    description: "",
  });

  const handleOverlayClick = (e: any) => {
    if (e.target.id === "overlay") onClose();
  };

  const handleValidateCase = async () => {
    if (!client.case_number.trim()) return;
    try {
      const res = await apiGet(`/clientes/validate-case/${client.case_number}`);
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
        className="bg-card border border-border rounded-2xl shadow-xl w-[500px] p-6"
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
