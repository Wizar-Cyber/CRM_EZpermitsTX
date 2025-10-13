import { MapView } from "@/components/MapView";
import { useSearchParams } from "wouter";

export default function MapPage() {
  const [params] = useSearchParams();
  const routeId = params.get("routeId"); // si vienes de /map?routeId=3

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Map View</h2>
      <div className="h-[calc(100vh-8rem)] w-full">
         <MapView routeId={routeId || undefined} />
      </div>
    </div>
  );
}