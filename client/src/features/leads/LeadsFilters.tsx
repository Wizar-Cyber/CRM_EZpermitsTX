import { useState } from "react";

export default function LeadsFilters({ onChange }: { onChange: (f: any) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const apply = () => onChange({ q, status });
  const reset = () => {
    setQ("");
    setStatus("");
    onChange({});
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <input
        className="bg-muted border border-border p-2 rounded-md text-foreground"
        placeholder="Search address"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <select
        className="bg-muted border border-border p-2 rounded-md text-foreground"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">Status</option>
        <option value="NEW">NEW</option>
        <option value="CONTACTED">CONTACTED</option>
        <option value="DELIVERED">DELIVERED</option>
        <option value="CONTRACT_SIGNED">CONTRACT_SIGNED</option>
      </select>

      <button className="bg-primary text-primary-foreground px-3 py-2 rounded" onClick={apply}>
        Apply
      </button>
      <button className="bg-secondary text-secondary-foreground px-3 py-2 rounded" onClick={reset}>
        Reset
      </button>
    </div>
  );
}
