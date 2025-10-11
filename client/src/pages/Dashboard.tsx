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
    </div>
  );
}
