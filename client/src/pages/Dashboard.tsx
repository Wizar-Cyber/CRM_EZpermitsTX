<<<<<<< HEAD
import { useEffect, useState } from "react";
import { DashboardCard } from "@/components/DashboardCard";
import { DashboardChart } from "@/components/DashboardChart";
import { Users, TrendingUp, MapPin, Calendar, CheckCircle2, CalendarRange } from "lucide-react";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface Metrics {
  total_leads: number;
  new_leads: number;
  leads_in_route: number;
  upcoming_appointments: number;
  completed_visits: number;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [start, setStart] = useState(() => new Date(new Date().setDate(new Date().getDate() - 30)));
  const [end, setEnd] = useState(() => new Date());
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      // ✅ Sin comillas en los query params
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      // Si apiGet ya antepone /api, mantén /dashboard/...
      const data = await apiGet<Metrics>(
        `/dashboard/metrics?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
      );
      setMetrics(data);
    } catch (err: any) {
      console.error("Error loading metrics:", err);
      toast.error("Error loading metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const handlePreset = (days: number) => {
    setStart(new Date(new Date().setDate(new Date().getDate() - days)));
    setEnd(new Date());
  };

  if (!metrics) return <p className="text-gray-500">Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2 items-center">
          <CalendarRange className="w-5 h-5 text-gray-600" />
          <Button variant="outline" onClick={() => handlePreset(7)}>Last 7 days</Button>
          <Button variant="outline" onClick={() => handlePreset(30)}>Last 30 days</Button>
          <Button variant="outline" onClick={() => handlePreset(90)}>Last 90 days</Button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Updating metrics...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Total Leads" value={metrics.total_leads} icon={Users} trend="+12% vs prev. period" />
        <DashboardCard title="New Leads" value={metrics.new_leads} icon={TrendingUp} trend="In selected range" iconBgColor="bg-emerald-500/10" />
        <DashboardCard title="Leads in Route" value={metrics.leads_in_route} icon={MapPin} trend="Currently active" iconBgColor="bg-blue-500/10" />
        <DashboardCard title="Upcoming Appointments" value={metrics.upcoming_appointments} icon={Calendar} trend="Next events" iconBgColor="bg-amber-500/10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard title="Completed Visits" value={metrics.completed_visits} icon={CheckCircle2} trend="Total visits completed" iconBgColor="bg-green-500/10" />
      </div>

      <DashboardChart start={start} end={end} />
=======
import { DashboardCard } from "@/components/DashboardCard";
import { DashboardChart } from "@/components/DashboardChart";
import { Users, TrendingUp, MapPin, Calendar } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Total Leads" 
          value="1,234" 
          icon={Users} 
          trend="+12% from last month"
          iconBgColor="bg-primary/10"
        />
        <DashboardCard 
          title="New Leads" 
          value="87" 
          icon={TrendingUp} 
          trend="Last 7 days"
          iconBgColor="bg-emerald-500/10"
        />
        <DashboardCard 
          title="Leads in Route" 
          value="45" 
          icon={MapPin} 
          trend="Active routes"
          iconBgColor="bg-blue-500/10"
        />
        <DashboardCard 
          title="Upcoming Appointments" 
          value="23" 
          icon={Calendar} 
          trend="Next 7 days"
          iconBgColor="bg-amber-500/10"
        />
      </div>

      <DashboardChart />
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
    </div>
  );
}
