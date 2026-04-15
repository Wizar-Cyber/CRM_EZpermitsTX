import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, API_BASE_URL } from "@/lib/api";

interface ZipStat {
  zip_code: string;
  count: number;
  pct: number;
}

interface GeographicTabProps {
  start: Date;
  end: Date;
}

// Generate slightly varying blue shades from dark to lighter
function getBarColor(index: number, total: number): string {
  const lightness = 28 + Math.round((index / Math.max(total - 1, 1)) * 22);
  return `hsl(214, 71%, ${lightness}%)`;
}

export function GeographicTab({ start, end }: GeographicTabProps) {
  const [stats, setStats] = useState<ZipStat[]>([]);
  const [loading, setLoading] = useState(false);

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await apiGet<ZipStat[]>(
          `/dashboard/zipcode-stats?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
        );
        setStats(data);
      } catch (err: any) {
        toast.error(err?.message ?? "Error loading geographic data");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [startStr, endStr]);

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/dashboard/csv/geographic?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `geographic_${startStr}_${endStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Error exporting CSV");
    }
  };

  const topZip = stats[0];
  const totalZips = stats.length;
  const totalCount = stats.reduce((s, z) => s + z.count, 0);
  const avgPerZip = totalZips > 0 ? (totalCount / totalZips).toFixed(1) : "—";
  const maxCount = stats.length > 0 ? Math.max(...stats.map((z) => z.count)) : 1;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Top Zipcode
            </p>
            <p className="text-2xl font-bold font-mono">
              {topZip ? topZip.zip_code : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {topZip ? `${topZip.count} leads (${topZip.pct?.toFixed(1)}%)` : "Sin datos"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Zipcodes Activos
            </p>
            <p className="text-2xl font-bold">{totalZips}</p>
            <p className="text-xs text-muted-foreground">Zonas con actividad</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Promedio por Zip
            </p>
            <p className="text-2xl font-bold">{avgPerZip}</p>
            <p className="text-xs text-muted-foreground">Leads por zona</p>
          </CardContent>
        </Card>
      </div>

      {/* Export + chart */}
      <div className="flex justify-end">
        <button
          onClick={handleExportCsv}
          className="px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Horizontal bar chart */}
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : stats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay datos geográficos para el período seleccionado.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.map((zip, idx) => {
                const barWidth = (zip.count / maxCount) * 100;
                const color = getBarColor(idx, stats.length);
                return (
                  <div key={zip.zip_code} className="flex items-center gap-2">
                    {/* Zipcode label */}
                    <div
                      className="text-xs font-mono text-right shrink-0 text-muted-foreground"
                      style={{ width: 60 }}
                    >
                      {zip.zip_code}
                    </div>
                    {/* Bar */}
                    <div className="flex-1 relative h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded transition-all duration-500"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: color,
                          minWidth: 4,
                        }}
                      />
                    </div>
                    {/* Count */}
                    <div className="text-xs font-bold text-foreground shrink-0 w-8 text-right">
                      {zip.count}
                    </div>
                    {/* Pct */}
                    <div className="text-[10px] text-muted-foreground shrink-0 w-14 text-right">
                      {zip.pct?.toFixed(1)}% total
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
