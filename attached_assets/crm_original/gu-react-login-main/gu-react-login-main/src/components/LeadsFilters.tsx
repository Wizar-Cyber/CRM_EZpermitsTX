import { useState } from "react";

export default function LeadsFilters({ onChange }: { onChange: (f: any) => void }) {
  const [q, setQ] = useState("");
  const [color, setColor] = useState("");
  const [status, setStatus] = useState("");

  const apply = () => onChange({ q, color, status });
  const reset = () => {
    setQ("");
    setColor("");
    setStatus("");
    onChange({});
  };

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <input
        className="bg-gray-800 p-2 rounded text-white"
        placeholder="Search address"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="bg-gray-800 p-2 rounded text-white"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      >
        <option value="">Color</option>
        <option value="GREEN">Green</option>
        <option value="YELLOW">Yellow</option>
        <option value="RED">Red</option>
      </select>
      <select
        className="bg-gray-800 p-2 rounded text-white"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">Status</option>
        <option value="NEW">NEW</option>
        <option value="AWAITING_INSPECTION">AWAITING_INSPECTION</option>
        <option value="CONTACTED">CONTACTED</option>
        <option value="ROUTE_PLANNED">ROUTE_PLANNED</option>
        <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
        <option value="DELIVERED">DELIVERED</option>
        <option value="APPOINTMENT_SCHEDULED">APPOINTMENT_SCHEDULED</option>
        <option value="CONTRACT_SIGNED">CONTRACT_SIGNED</option>
      </select>
      <button
        className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={apply}
      >
        Apply
      </button>
      <button
        className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        onClick={reset}
      >
        Reset
      </button>
    </div>
  );
}
