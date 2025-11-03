import { useState, useCallback, useEffect } from "react";
// CORREGIDO: Se vuelve a una importación nombrada directa, que es más estándar.
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { format, startOfToday } from "date-fns";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { getDay } from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { toast } from "sonner";

// Configuración del localizador para react-big-calendar
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

// Datos de ejemplo con fechas reales y asesor
const mockAppointments = [
  { id: 1, title: "Site Visit - C-2024-001", address: "123 Main St", status: "confirmed", asesor: "John Doe", start: new Date(2025, 9, 20, 10, 0, 0), end: new Date(2025, 9, 20, 11, 30, 0) },
  { id: 2, title: "Inspection - C-2024-005", address: "654 Maple Dr", status: "pending", asesor: "Jane Smith", start: new Date(2025, 9, 22, 14, 0, 0), end: new Date(2025, 9, 22, 15, 0, 0) },
  { id: 3, title: "Follow-up - C-2024-003", address: "789 Pine Rd", status: "confirmed", asesor: "John Doe", start: new Date(2025, 9, 25, 11, 30, 0), end: new Date(2025, 9, 25, 12, 0, 0) },
];

type Appointment = typeof mockAppointments[0];

// --- MODAL COMPONENT ---
function AppointmentModal({
  event,
  onClose,
  onSave,
  onDelete,
}: {
  event: Partial<Appointment> & { start?: Date; end?: Date };
  onClose: () => void;
  onSave: (event: Omit<Appointment, 'id'> & { id?: number }) => void;
  onDelete: (id: number) => void;
}) {
  const [title, setTitle] = useState(event.title || "");
  const [address, setAddress] = useState(event.address || "");
  const [asesor, setAsesor] = useState(event.asesor || "");
  
  const [date, setDate] = useState(event.start ? format(event.start, 'yyyy-MM-dd') : '');
  const [startTime, setStartTime] = useState(event.start ? format(event.start, 'HH:mm') : '');
  const [endTime, setEndTime] = useState(event.end ? format(event.end, 'HH:mm') : '');

  const isNew = !event.id;

  const handleSave = () => {
    if (title && asesor && date && startTime && endTime) {
      const start = new Date(`${date}T${startTime}`);
      const end = new Date(`${date}T${endTime}`);
      const today = startOfToday();

      if (start < today) {
        toast.error("No se pueden crear o mover citas a una fecha pasada.");
        return;
      }

      if (end < start) {
        toast.error("La fecha de fin no puede ser anterior a la de inicio.");
        return;
      }
      
      onSave({ ...event, title, address, asesor, start, end });
    } else {
      toast.error("Por favor, rellene todos los campos obligatorios.");
    }
  };

  const handleDelete = () => {
    if (event.id) {
      onDelete(event.id);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Nueva Cita" : "Editar Cita"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Rellene los detalles para la nueva cita." : `Detalles para: ${event.title}`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2"><Label htmlFor="title">Título</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Inspección Inicial"/></div>
          <div className="grid gap-2"><Label htmlFor="address">Dirección</Label><Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: 123 Main St"/></div>
          <div className="grid gap-2"><Label htmlFor="asesor">Asesor</Label><Input id="asesor" value={asesor} onChange={(e) => setAsesor(e.target.value)} placeholder="Nombre del asesor"/></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2"><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Hora de Inicio</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Hora de Fin</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter className="flex justify-between w-full">
            {isNew ? (
                <Button onClick={handleSave}>Guardar Cita</Button>
            ) : (
                <div className="flex w-full justify-between">
                    <Button variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2"/>Eliminar</Button>
                    <Button onClick={handleSave}>Actualizar Cita</Button>
                </div>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function AppointmentCalendar() {
  const [view, setView] = useState<any>(Views.MONTH);
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedEvent, setSelectedEvent] = useState<Partial<Appointment> | null>(null);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date, end: Date }) => {
    if (start < startOfToday()) {
        toast.info("No se pueden crear citas en fechas pasadas.");
        return;
    }
    setSelectedEvent({ start, end });
  }, []);

  const handleSelectEvent = useCallback((event: Appointment) => {
    setSelectedEvent(event);
  }, []);
  
  const handleSaveAppointment = (eventToSave: Omit<Appointment, 'id'> & { id?: number }) => {
    if (eventToSave.id) { // Actualizar
      setAppointments(prev => prev.map(apt => apt.id === eventToSave.id ? { ...apt, ...eventToSave } as Appointment : apt));
      toast.success("Cita actualizada con éxito!");
    } else { // Crear
      const newAppointment = { ...eventToSave, id: Date.now(), status: "pending" } as Appointment;
      setAppointments(prev => [...prev, newAppointment]);
      toast.success("Cita creada con éxito!");
    }
    setSelectedEvent(null);
  };

  const handleDeleteAppointment = (id: number) => {
    setAppointments(prev => prev.filter(apt => apt.id !== id));
    setSelectedEvent(null);
    toast.success("Cita eliminada con éxito.");
  };

  const eventPropGetter = useCallback(
    (event: Appointment) => ({
      className: event.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-500',
      style: { color: 'white', borderRadius: '5px', border: 'none' }
    }),
    []
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Citas</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setView(Views.MONTH)} className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === Views.MONTH ? 'bg-background shadow-sm' : ''}`}>Mes</button>
            <button onClick={() => setView(Views.WEEK)} className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === Views.WEEK ? 'bg-background shadow-sm' : ''}`}>Semana</button>
            <button onClick={() => setView(Views.DAY)} className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === Views.DAY ? 'bg-background shadow-sm' : ''}`}>Día</button>
          </div>
          <Button onClick={() => setSelectedEvent({start: new Date(), end: new Date()})} className="rounded-2xl">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cita
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm p-4 h-[75vh]">
        <BigCalendar
          localizer={localizer}
          events={appointments}
          view={view}
          onView={(view) => setView(view)}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          eventPropGetter={eventPropGetter}
          titleAccessor={(event) => `${event.title} (${event.asesor})`}
        />
      </Card>
      
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

export { AppointmentCalendar };
