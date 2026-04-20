import { MapView } from "@/components/MapView";
import { useRoute } from "wouter";
import { Map, Navigation } from "lucide-react";

export default function MapPage() {
  const [match, params] = useRoute("/map/:routeId");
  const routeId = match ? params.routeId : undefined;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 rounded-2xl px-6 py-4 text-white shadow-lg flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Map className="w-4 h-4 opacity-70" />
            <span className="text-xs font-medium opacity-70 uppercase tracking-widest">Operations</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Map View</h2>
          {routeId && (
            <p className="text-slate-300 text-xs mt-0.5 flex items-center gap-1">
              <Navigation className="w-3 h-3" /> Showing route #{routeId}
            </p>
          )}
        </div>
        <div className="bg-white/10 rounded-xl px-4 py-2 border border-white/20">
          <p className="text-xs opacity-70">Interactive Map</p>
        </div>
      </div>

      <div className="flex-1 h-[calc(100vh-10rem)] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
        <MapView routeId={routeId} />
      </div>
    </div>
  );
}
