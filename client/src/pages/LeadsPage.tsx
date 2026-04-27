// src/pages/LeadsPage.tsx
import { LeadsTable } from "@/components/LeadsTable";
import { FileSearch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatCompactCount } from "@/lib/utils";

export default function LeadsPage() {
  const { data } = useQuery<{ data: any[] }>({
    queryKey: ["/leads"],
    queryFn: () => apiGet("/leads"),
  });
  const total = data?.data?.length ?? 0;

  return (
    <div className="w-full space-y-0">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#103360] to-[#1565c0] rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSearch className="w-5 h-5 opacity-80" />
              <span className="text-sm font-medium opacity-80 uppercase tracking-widest">Lead Management</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Leads Pipeline</h1>
            <p className="text-blue-100 mt-1 text-sm">
              Manage, classify, and track all incoming permit leads
            </p>
          </div>
          <div className="bg-white/15 rounded-xl px-4 py-2.5 text-center border border-white/20">
            <p className="text-xl font-bold">{formatCompactCount(total)}</p>
            <p className="text-xs opacity-75 mt-0.5 flex items-center gap-1 justify-center">
              <FileSearch className="w-3 h-3" /> Leads
            </p>
          </div>
        </div>
      </div>

      <LeadsTable />
    </div>
  );
}
