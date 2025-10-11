import { API } from "../lib/api";

export default function CopyAddresses({ ids, rows }: { ids:number[]; rows:any[] }) {
  const handleCopy = async () => {
    if (ids.length===0) return;
    // Como estamos en mock, ensamblamos las líneas directo desde rows:
    const lines = rows
      .filter(r => ids.includes(r.id))
      .map(r => `${r.address_line}, ${r.city}, ${r.state} ${r.zip || ""}`.trim())
      .join("\n");
    await navigator.clipboard.writeText(lines);
    alert("Addresses copied to clipboard");
  };
  return (
    <button className="px-3 py-2 bg-emerald-600 rounded" onClick={handleCopy}>
      Copy addresses
    </button>
  );
}
