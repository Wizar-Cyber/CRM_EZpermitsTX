import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { TrendsTab } from "@/components/dashboard/TrendsTab";
import { GeographicTab } from "@/components/dashboard/GeographicTab";
import { GreenLeadsTab } from "@/components/dashboard/GreenLeadsTab";
import { MonthlyTab } from "@/components/dashboard/MonthlyTab";

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
  const [activePreset, setActivePreset] = useState<Preset | null>(30);
  const [start, setStart] = useState<Date>(() => daysAgo(30));
  const [end, setEnd] = useState<Date>(() => endOfDay(new Date()));

  const handlePreset = (days: Preset) => {
    setActivePreset(days);
    setStart(daysAgo(days));
    setEnd(endOfDay(new Date()));
  };

  const presets: { label: string; value: Preset }[] = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">EZpermitsTX — Houston, TX</p>
        </div>

        {/* Date filter presets */}
        <div className="flex items-center gap-1.5 bg-muted rounded-lg p-1">
          <CalendarRange className="w-4 h-4 text-muted-foreground ml-1 mr-0.5" />
          {presets.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={activePreset === p.value ? "default" : "ghost"}
              className="h-7 px-3 text-xs"
              onClick={() => handlePreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-9 gap-0.5">
          <TabsTrigger value="overview" className="text-xs px-3">
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs px-3">
            Tendencias
          </TabsTrigger>
          <TabsTrigger value="geographic" className="text-xs px-3">
            Geográfico
          </TabsTrigger>
          <TabsTrigger value="green-leads" className="text-xs px-3">
            Green Leads → Route
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs px-3">
            Reporte Mensual
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="monthly" className="mt-0">
          <MonthlyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
