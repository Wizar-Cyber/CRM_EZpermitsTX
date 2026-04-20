import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse, startOfWeek, getDay, startOfToday } from "date-fns";
import { enUS } from "date-fns/locale/en-US";

import { AppointmentModal } from "@/components/AppointmentModal";
import {
  Plus,
  Filter,
  X,
  Mail,
  MapPin,
  Phone,
  CalendarCheck,
  Trash2,
  Save,
  Edit3,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

interface Note {
  id: number;
  nota: string;
  fecha: string;
  author_name?: string;
}

interface Appointment {
  id: number;
  title: string;
  address?: string;
  asesor?: string;
  note?: string;
  status?: string;
  date_time: string;
  client_id?: number;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  case_number?: string;
  start: Date;
  end: Date;
  notes?: Note[];
}

export default function AppointmentsPage() {
  const [view, setView] = useState(Views.MONTH);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Partial<Appointment> | null>(null);
  const [clientInfo, setClientInfo] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingNote, setEditingNote] = useState(false);
  const [tempNote, setTempNote] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newNote, setNewNote] = useState("");

  // 🔄 Cargar citas
  const refreshAppointments = useCallback(async () => {
    try {
      const data = await apiGet<Appointment[]>("/appointments");
      const parsed = data.map((a) => ({
        ...a,
        start: new Date(a.date_time),
        end: new Date(a.date_time),
      }));
      setAppointments(parsed);
    } catch (err) {
      console.error("❌ Error loading appointments:", err);
      toast.error("Error loading appointments");
    }
  }, []);

  useEffect(() => {
  refreshAppointments();
}, [refreshAppointments]);

// 🔗 NUEVO BLOQUE: abre la cita si llegas con ?id=###
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const appointmentId = params.get("id");
  if (appointmentId) {
    (async () => {
      try {
        const data = await apiGet<Appointment>(`/appointments/${appointmentId}`);
        setClientInfo({
          ...data,
          start: new Date(data.date_time),
          end: new Date(data.date_time),
        });
        setTempNote(data.note || "");
      } catch {
        toast.error("Error loading appointment from link");
      }
    })();
  }
}, []);

  // 📅 Crear cita
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    if (start < startOfToday()) {
      toast.info("Cannot create appointments in the past.");
      return;
    }
    setSelectedEvent({ date_time: start });
    setShowModal(true);
  }, []);

  // ✏️ Ver cita (trae también todas las notas del cliente)
  const handleSelectEvent = useCallback(async (event: Appointment) => {
    try {
      const data = await apiGet<Appointment>(`/appointments/${event.id}`);
      setClientInfo({
        ...data,
        start: new Date(data.date_time),
        end: new Date(data.date_time),
      });
      setTempNote(data.note || "");
    } catch {
      toast.error("Error loading appointment details");
    }
  }, []);

  // 💾 Guardar cita
  const handleSaveAppointment = async (eventToSave: any) => {
    const payload = {
      title: eventToSave.title,
      date_time: eventToSave.date_time,
      address: eventToSave.address,
      note: eventToSave.note,
      status: eventToSave.status,
      client_id: eventToSave.client_id,
    };

    try {
      if (eventToSave.id) {
        await apiPut(`/appointments/${eventToSave.id}`, payload);
        toast.success("Appointment updated ✅");
      } else {
        await apiPost("/appointments", payload);
        toast.success("Appointment created ✅");
      }
      setShowModal(false);
      setClientInfo(null);
      refreshAppointments();
    } catch (err) {
      console.error("❌ Error saving appointment:", err);
      toast.error("Error saving appointment");
    }
  };

  // 🗑️ Eliminar cita
  const handleDeleteAppointment = async (id: number) => {
    try {
      await apiDelete(`/appointments/${id}`);
      toast.success("Appointment deleted ✅");
      setClientInfo(null);
      refreshAppointments();
    } catch {
      toast.error("Error deleting appointment");
    }
  };

  // 🔄 Cambiar estado
  const handleStatusChange = async (newStatus: string) => {
    if (!clientInfo?.id) return;
    try {
      const updated = await apiPut(`/appointments/${clientInfo.id}/status`, { status: newStatus });
      toast.success(`Marked as ${newStatus}`);
      setClientInfo({
        ...updated,
        start: new Date(updated.date_time),
        end: new Date(updated.date_time),
      });
      refreshAppointments();
    } catch {
      toast.error("Error updating status");
    }
  };

  // 📝 Guardar nota principal
  const handleSaveNote = async () => {
    if (!clientInfo?.id) return;
    try {
      const updated = await apiPut(`/appointments/${clientInfo.id}`, { note: tempNote });
      toast.success("Main note updated ✅");
      setClientInfo({
        ...updated,
        start: new Date(updated.date_time),
        end: new Date(updated.date_time),
      });
      setEditingNote(false);
      refreshAppointments();
    } catch {
      toast.error("Error saving note");
    }
  };

  // ➕ Agregar nota (todas se asocian al cliente, visibles en todas las citas del cliente)
  const handleAddExtraNote = async () => {
    if (!newNote.trim() || !clientInfo?.id) return;
    try {
      const res = await apiPost(`/appointments/${clientInfo.id}/notes`, {
        nota: newNote.trim(),
      });
      const updatedClient = {
        ...clientInfo,
        notes: [...(clientInfo.notes || []), res],
      } as Appointment;
      setClientInfo(updatedClient);
      setNewNote("");
      toast.success("Note added ✅");
    } catch {
      toast.error("Error adding note");
    }
  };

  // ❌ Eliminar nota adicional
  const handleDeleteExtraNote = async (noteId: number) => {
    if (!clientInfo?.id) return;
    if (!confirm("Delete this note?")) return;
    try {
      await apiDelete(`/appointments/${clientInfo.id}/notes/${noteId}`);
      const updatedNotes = clientInfo.notes?.filter((n) => n.id !== noteId) || [];
      setClientInfo({ ...clientInfo, notes: updatedNotes });
      toast.success("Note deleted ✅");
    } catch {
      toast.error("Error deleting note");
    }
  };

  // 🎨 Colores del calendario
  const eventPropGetter = useCallback((event: Appointment) => {
    let backgroundColor = "#f3f4f6";
    let borderColor = "#9ca3af";
    switch (event.status) {
      case "pending":
        backgroundColor = "#fef3c7";
        borderColor = "#f59e0b";
        break;
      case "visited":
        backgroundColor = "#dbeafe";
        borderColor = "#3b82f6";
        break;
      case "completed":
        backgroundColor = "#dcfce7";
        borderColor = "#16a34a";
        break;
      case "canceled":
        backgroundColor = "#fee2e2";
        borderColor = "#dc2626";
        break;
    }
    return {
      style: {
        backgroundColor,
        color: "#111",
        border: `2px solid ${borderColor}`,
        borderRadius: "6px",
        padding: "2px 4px",
        fontSize: "0.8rem",
        fontWeight: 500,
      },
    };
  }, []);

  const summary = useMemo(() => {
    const counts = { pending: 0, visited: 0, completed: 0, canceled: 0 };
    appointments.forEach((a) => {
      if (a.status && counts[a.status as keyof typeof counts] !== undefined) {
        counts[a.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "all") return appointments;
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  return (
    <div className="w-full space-y-4 relative">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CalendarCheck className="w-4 h-4 opacity-70" />
              <span className="text-xs font-medium opacity-70 uppercase tracking-widest">Schedule</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Appointments</h2>
            <p className="text-violet-200 text-sm mt-0.5">Manage client visits and scheduled appointments</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-white/15 backdrop-blur-sm rounded-xl p-1 border border-white/20">
              {[{ name: "Month", view: Views.MONTH }, { name: "Week", view: Views.WEEK }, { name: "Day", view: Views.DAY }].map(({ name, view: v }) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                    view === v ? "bg-white text-violet-700 shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                setSelectedEvent({ date_time: new Date().toISOString() });
                setShowModal(true);
              }}
              className="bg-white text-violet-700 hover:bg-violet-50 font-semibold border-0 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <Card className="rounded-2xl shadow-sm p-4 h-[75vh] overflow-hidden">
        <BigCalendar
          localizer={localizer}
          events={filteredAppointments}
          view={view}
          onView={(v) => setView(v)}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          eventPropGetter={eventPropGetter}
          titleAccessor={(event) =>
            `${event.title} ${event.status ? `(${event.status})` : ""}`
          }
        />
      </Card>

      {/* Sidebar */}
      {clientInfo && (
        <div className="fixed top-0 right-0 h-full w-96 bg-card shadow-xl border-l border-border p-6 overflow-y-auto z-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-500" />
              {clientInfo.title}
            </h3>
            <button
              onClick={() => setClientInfo(null)}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Botón editar */}
          <Button
            onClick={() => {
              setSelectedEvent(clientInfo);
              setShowModal(true);
            }}
            className="mb-4"
          >
            <Edit3 className="w-4 h-4 mr-2" /> Edit Appointment
          </Button>

          {/* Info cliente */}
          <div className="space-y-2 text-sm mb-4">
            {clientInfo.client_name && <p><strong>Client:</strong> {clientInfo.client_name}</p>}
            {clientInfo.client_email && <p><Mail className="inline w-4 h-4 text-muted-foreground mr-1" />{clientInfo.client_email}</p>}
            {clientInfo.client_phone && <p><Phone className="inline w-4 h-4 text-muted-foreground mr-1" />{clientInfo.client_phone}</p>}
            {clientInfo.client_address && <p><MapPin className="inline w-4 h-4 text-muted-foreground mr-1" />{clientInfo.client_address}</p>}
          </div>

          {/* Nota principal */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <strong>Appointment Note:</strong>
              {!editingNote ? (
                <Button variant="ghost" size="sm" onClick={() => setEditingNote(true)}>
                  <Edit3 className="w-4 h-4 mr-1" /> Edit
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleSaveNote}>
                  <Save className="w-4 h-4 mr-1" /> Save
                </Button>
              )}
            </div>
            {editingNote ? (
              <Textarea
                className="text-sm"
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="Write an optional note..."
              />
            ) : (
              <p className="text-sm bg-muted/50 border border-border/60 p-2.5 rounded-lg">
                {clientInfo.note || "No notes yet"}
              </p>
            )}
          </div>

          {/* Notas del cliente (visibles en todas sus citas) */}
          <div className="mt-4 border-t pt-3">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Notes
            </h4>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add new note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button size="sm" onClick={handleAddExtraNote}>
                Add
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {clientInfo.notes?.length ? (
                clientInfo.notes.map((n) => (
                  <div key={n.id} className="p-2.5 bg-muted/40 border border-border/50 rounded-lg text-sm flex justify-between items-start">
                    <div>
                      <p>{n.nota}</p>
                      <div className="text-xs text-muted-foreground/70 mt-0.5">
                        {n.author_name || "System"} • {new Date(n.fecha).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExtraNote(n.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground/50">No notes yet</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => handleStatusChange("visited")} variant="outline">
              Mark as Visited
            </Button>
            <Button onClick={() => handleStatusChange("completed")} variant="outline">
              Mark as Completed
            </Button>
            <Button onClick={() => handleStatusChange("canceled")} variant="outline">
              Mark as Canceled
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteAppointment(clientInfo.id!)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Appointment
            </Button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedEvent && (
        <AppointmentModal
          event={selectedEvent}
          onClose={() => setShowModal(false)}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
        />
      )}
    </div>
  );
}
