import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  iconBgColor?: string;
}

export function DashboardCard({ title, value, icon: Icon, trend, iconBgColor = "bg-primary/10" }: DashboardCardProps) {
  return (
    <Card className="rounded-2xl shadow-sm p-6" data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-4xl font-bold text-foreground mt-2">{value}</p>
          {trend && (
            <p className="text-xs text-muted-foreground mt-2">{trend}</p>
          )}
        </div>
        <div className={`${iconBgColor} p-3 rounded-2xl`}>
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
