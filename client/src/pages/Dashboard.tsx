import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { TrendsTab } from "@/components/dashboard/TrendsTab";
import { GeographicTab } from "@/components/dashboard/GeographicTab";
import { GreenLeadsTab } from "@/components/dashboard/GreenLeadsTab";
import { MonthlyTab } from "@/components/dashboard/MonthlyTab";
import { LeadQualityDistribution } from "@/components/analytics/LeadQualityDistribution";

type Preset = 7 | 30 | 90;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

export default function Dashboard() {
  const [activePreset, setActivePreset] = useState<Preset>(30);
  const [start, setStart] = useState<Date>(() => daysAgo(30));
  const [end, setEnd] = useState<Date>(() => endOfDay(new Date()));

  const handlePreset = (days: Preset) => {
    setActivePreset(days);
    setStart(daysAgo(days));
    setEnd(endOfDay(new Date()));
  };

  const presets: Preset[] = [7, 30, 90];

  return (
    <div className="min-h-screen bg-[#F0F2F5] -m-4 md:-m-6 font-sans text-slate-800">
      {/* Dark header */}
      <header className="bg-[#0f172a] text-white px-6 py-4 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Executive CRM Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">EZpermitsTX — Houston, TX</p>
        </div>
        <div className="flex bg-slate-800 rounded-md overflow-hidden text-sm">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={`px-4 py-1.5 transition-colors ${
                activePreset === p
                  ? "bg-white text-slate-800 font-medium"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </header>

      {/* Tabs on dark bar */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="bg-[#0f172a] px-6 py-3 border-t border-slate-700">
          <TabsList className="bg-transparent p-0 h-auto gap-1">
            {[
              { value: "overview", label: "Overview" },
              { value: "trends", label: "Tendencias" },
              { value: "geographic", label: "Geográfico" },
              { value: "green-leads", label: "Green Leads → Route" },
              { value: "lead-quality", label: "Lead Quality" },
              { value: "monthly", label: "Reporte Mensual" },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="px-4 py-1.5 text-sm rounded-md transition-colors text-slate-300 hover:text-white hover:bg-slate-800 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-medium data-[state=active]:shadow-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="p-6 max-w-[1600px] mx-auto">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab start={start} end={end} />
          </TabsContent>
          <TabsContent value="trends" className="mt-0">
            <TrendsTab />
          </TabsContent>
          <TabsContent value="geographic" className="mt-0">
            <GeographicTab start={start} end={end} />
          </TabsContent>
          <TabsContent value="green-leads" className="mt-0">
            <GreenLeadsTab />
          </TabsContent>
          <TabsContent value="lead-quality" className="mt-0">
            <LeadQualityDistribution />
          </TabsContent>
          <TabsContent value="monthly" className="mt-0">
            <MonthlyTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
