import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import BackButton from "../components/BackButton";

type Appt = { id:number; lead_id:number; scheduled_at:string; notes?:string; };

export default function AppointmentsPage() {
  const [rows, setRows] = useState<Appt[]>([]);
  useEffect(() => {
    apiGet<{ data: Appt[] }>("/api/mock/appointments").then(r => setRows(r.data));
  }, []);
  return (
    <div className="p-4 space-y-3">
      <BackButton />
      <h1 className="text-2xl font-bold mb-4">📅 Appointments</h1>
      <div className="bg-gray-900 rounded p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400">
              <th>ID</th>
              <th>Lead</th>
              <th>Scheduled</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-gray-800">
                <td>{r.id}</td>
                <td>{r.lead_id}</td>
                <td>{new Date(r.scheduled_at).toLocaleString()}</td>
                <td>{r.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}