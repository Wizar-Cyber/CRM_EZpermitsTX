import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface Trend {
  value: string;
  positive: boolean;
}

interface Sparkline {
  color: string; // tailwind-free hex color
  data: number[];
  gradientId: string;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: Trend;
  icon: React.ReactNode;
  iconBg: string;
  alert?: boolean;
  sparkline?: Sparkline;
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  iconBg,
  alert,
  sparkline,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-36 flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-px",
        alert && "border-red-200"
      )}
    >
      <div className="relative z-10">
        <div className="flex justify-between items-start">
          <p className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase">
            {title}
          </p>
          <div className={cn("p-1.5 rounded-md", iconBg)}>{icon}</div>
        </div>
        <h2 className="text-3xl font-bold mt-1 text-slate-900 leading-none">{value}</h2>
        {trend && (
          <p
            className={cn(
              "text-xs font-semibold mt-1.5",
              trend.positive ? "text-emerald-600" : "text-red-500"
            )}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
        {subtitle && !trend && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>

      {sparkline && (
        <div className="absolute -bottom-2 -left-2 -right-2 h-16 pointer-events-none opacity-60 z-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.data.map((v) => ({ value: v }))}>
              <defs>
                <linearGradient id={sparkline.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sparkline.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={sparkline.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkline.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${sparkline.gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
