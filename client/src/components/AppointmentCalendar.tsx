import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfToday,
} from "date-fns";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

// 📅 Localizer Config
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

interface Appointment {
  id: number;
  title: string;
  address?: string;
  asesor?: string;
  note?: string;
  status?: string;
  date_time: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  case_number?: string;
  start: Date;
  end: Date;
}

export function AppointmentCalendar() {
  const [view, setView] = useState(Views.MONTH);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Partial<Appointment> | null>(
    null
  );
  const [clientInfo, setClientInfo] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 🧭 Fetch appointments
  const fetchAppointments = async () => {
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
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // 📅 Crear cita nueva desde clic vacío
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    if (start < startOfToday()) {
      toast.info("Cannot create appointments in the past.");
      return;
    }
    setSelectedEvent({ date_time: start });
  }, []);

  // ✏️ Editar cita existente + mostrar panel lateral
  const handleSelectEvent = useCallback(async (event: Appointment) => {
    setSelectedEvent(event);
    try {
      const data = await apiGet<Appointment>(`/appointments/${event.id}`);
      setClientInfo({
        ...data,
        start: new Date(data.date_time),
        end: new Date(data.date_time),
      });
    } catch {
      toast.error("Error loading client info");
    }
  }, []);

  // 💾 Guardar / actualizar cita
  const handleSaveAppointment = async (
    eventToSave: Omit<Appointment, "id"> & { id?: number }
  ) => {
    const payload = {
      title: eventToSave.title,
      address: eventToSave.address,
      status: eventToSave.status || "pending",
      note: eventToSave.note,
      asesor: eventToSave.asesor,
      date_time:
        eventToSave.date_time ||
        eventToSave.start?.toISOString() ||
        new Date().toISOString(),
      created_by: "system",
    };

    try {
      if (eventToSave.id) {
        await apiPut(`/appointments/${eventToSave.id}`, payload);
        toast.success("Appointment updated");
      } else {
        await apiPost("/appointments", payload);
        toast.success("Appointment created");
      }
      setSelectedEvent(null);
      setClientInfo(null);
      fetchAppointments();
    } catch (err) {
      console.error("❌ Error saving appointment:", err);
      toast.error("Error saving appointment");
    }
  };

  // 🗑️ Eliminar cita
  const handleDeleteAppointment = async (id: number) => {
    try {
      await apiDelete(`/appointments/${id}`);
      toast.success("Appointment deleted");
      setSelectedEvent(null);
      setClientInfo(null);
      fetchAppointments();
    } catch {
      toast.error("Error deleting appointment");
    }
  };

  // 🔄 Cambiar estado desde el panel lateral
  const handleStatusChange = async (newStatus: string) => {
    if (!clientInfo?.id) return;
    try {
      await apiPut(`/appointments/${clientInfo.id}`, { status: newStatus });
      toast.success(`Appointment marked as ${newStatus}`);
      fetchAppointments();
      setClientInfo((prev) => prev && { ...prev, status: newStatus });
    } catch {
      toast.error("Error updating status");
    }
  };

  // 🎨 Colores de estado
  const eventPropGetter = useCallback((event: Appointment) => {
    let backgroundColor = "#6b7280"; // default gray
    switch (event.status) {
      case "pending":
        backgroundColor = "#f59e0b"; // amber
        break;
      case "visited":
        backgroundColor = "#3b82f6"; // blue
        break;
      case "completed":
        backgroundColor = "#16a34a"; // green
        break;
      case "canceled":
        backgroundColor = "#dc2626"; // red
        break;
    }
    return {
      style: {
        backgroundColor,
        color: "white",
        borderRadius: "6px",
        border: "none",
        padding: "2px 4px",
      },
    };
  }, []);

  // 📊 Contadores por estado
  const summary = useMemo(() => {
    const counts = { pending: 0, visited: 0, completed: 0, canceled: 0 };
    appointments.forEach((a) => {
      if (a.status && counts[a.status as keyof typeof counts] !== undefined) {
        counts[a.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [appointments]);

  // 🔍 Filtrar citas según estado
  const filteredAppointments = useMemo(() => {
    if (statusFilter === "all") return appointments;
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  return (
    <div className="w-full space-y-4 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-semibold">Appointments</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {[
              { name: "Month", view: Views.MONTH },
              { name: "Week", view: Views.WEEK },
              { name: "Day", view: Views.DAY },
            ].map(({ name, view: v }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                  view === v ? "bg-background shadow-sm" : ""
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <Button
            onClick={() =>
              setSelectedEvent({ date_time: new Date().toISOString() })
            }
            className="rounded-2xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>
      {/* Filters + Summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Appointments</option>
            <option value="pending">Pending</option>
            <option value="visited">Visited</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        {/* Summary Badges */}
        <div className="flex flex-wrap gap-3">
          <Badge className="bg-amber-500 text-white cursor-default">
            Pending: {summary.pending}
          </Badge>
          <Badge className="bg-blue-500 text-white cursor-default">
            Visited: {summary.visited}
          </Badge>
          <Badge className="bg-green-600 text-white cursor-default">
            Completed: {summary.completed}
          </Badge>
          <Badge className="bg-red-600 text-white cursor-default">
            Canceled: {summary.canceled}
          </Badge>
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
            `${event.title} ${
              event.status ? `(${event.status.toUpperCase()})` : ""
            }`
          }
        />
      </Card>

      {/* Client Info Sidebar */}
      {clientInfo && (
        <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-xl border-l border-gray-200 p-6 overflow-y-auto z-50 animate-slide-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-500" />
              {clientInfo.title}
            </h3>
            <button
              onClick={() => setClientInfo(null)}
              className="text-gray-500 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            <strong>Status:</strong>{" "}
            <span
              className={`capitalize ${
                clientInfo.status === "completed"
                  ? "text-green-600"
                  : clientInfo.status === "visited"
                  ? "text-blue-600"
                  : clientInfo.status === "pending"
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {clientInfo.status}
            </span>
          </p>

          <div className="space-y-2 text-sm">
            {clientInfo.client_name && (
              <p>
                <strong>Client:</strong> {clientInfo.client_name}
              </p>
            )}
            {clientInfo.client_email && (
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                {clientInfo.client_email}
              </p>
            )}
            {clientInfo.client_phone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                {clientInfo.client_phone}
              </p>
            )}
            {clientInfo.client_address && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                {clientInfo.client_address}
              </p>
            )}
          </div>

          {clientInfo.note && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm">
              <strong>Note:</strong>
              <p>{clientInfo.note}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => handleStatusChange("visited")} variant="outline">
              Mark as Visited
            </Button>
            <Button onClick={() => handleStatusChange("completed")} variant="outline">
              Mark as Completed
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteAppointment(clientInfo.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Appointment
            </Button>
          </div>
        </div>
      )}

      {/* Modal for create/edit */}
      {selectedEvent && (
        <AppointmentModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
        />
      )}
    </div>
  );
}
