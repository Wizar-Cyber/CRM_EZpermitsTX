import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Trend {
  value: string;
  positive: boolean;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: Trend;
  icon: React.ReactNode;
  iconBg: string;
  alert?: boolean;
}

export function KpiCard({ title, value, subtitle, trend, icon, iconBg, alert }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-px",
        alert && "border-destructive/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {title}
          </p>
          <p className="text-3xl font-extrabold text-foreground leading-none">{value}</p>
          {trend && (
            <p className={cn("text-xs font-semibold mt-1.5", trend.positive ? "text-emerald-600" : "text-destructive")}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </p>
          )}
          {subtitle && !trend && (
            <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
