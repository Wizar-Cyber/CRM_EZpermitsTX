// src/pages/LeadsPage.tsx
import { LeadsTable } from "@/components/LeadsTable";
import { BarChart3, TrendingUp, FileSearch } from "lucide-react";

export default function LeadsPage() {
  return (
    <div className="w-full space-y-0">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
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
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-center border border-white/20">
              <BarChart3 className="w-4 h-4 mx-auto mb-0.5 opacity-80" />
              <p className="text-xs opacity-75">Pipeline</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-center border border-white/20">
              <TrendingUp className="w-4 h-4 mx-auto mb-0.5 opacity-80" />
              <p className="text-xs opacity-75">Analytics</p>
            </div>
          </div>
        </div>
      </div>

      <LeadsTable />
    </div>
  );
}
