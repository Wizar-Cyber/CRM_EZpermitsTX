import { useState } from "react";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// TODO: remove mock functionality - integrate react-big-calendar
const mockAppointments = [
  { id: 1, title: "Site Visit - C-2024-001", date: "2024-01-20", time: "10:00 AM", address: "123 Main St", status: "confirmed" },
  { id: 2, title: "Inspection - C-2024-005", date: "2024-01-22", time: "2:00 PM", address: "654 Maple Dr", status: "pending" },
  { id: 3, title: "Follow-up - C-2024-003", date: "2024-01-25", time: "11:30 AM", address: "789 Pine Rd", status: "confirmed" },
];

export function AppointmentCalendar() {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [appointments] = useState(mockAppointments);

  const handleNewAppointment = () => {
    console.log("New appointment clicked");
    // TODO: Open appointment modal
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Appointments</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {["month", "week", "day"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as typeof view)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === v ? 'bg-background shadow-sm' : 'hover-elevate'
                }`}
                data-testid={`button-view-${v}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <Button onClick={handleNewAppointment} className="rounded-2xl" data-testid="button-new-appointment">
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b">
            <CalendarIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Upcoming Appointments</h3>
          </div>

          <div className="space-y-3">
            {appointments.map((apt) => (
              <div 
                key={apt.id} 
                className="p-4 rounded-lg border hover-elevate cursor-pointer"
                data-testid={`appointment-${apt.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{apt.title}</h4>
                      <Badge 
                        className={`rounded-full ${
                          apt.status === "confirmed" 
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {apt.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{apt.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{apt.date}</p>
                    <p className="text-sm text-muted-foreground">{apt.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              (Full calendar view with react-big-calendar integration pending)
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
