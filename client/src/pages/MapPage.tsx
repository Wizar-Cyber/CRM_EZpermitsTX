import { MapView } from "@/components/MapView";
<<<<<<< HEAD
import { useRoute } from "wouter"; 

export default function MapPage() {
  // Wouter nos permite hacer match a la ruta para obtener los parámetros
  const [match, params] = useRoute("/map/:routeId");

  const routeId = match ? params.routeId : undefined;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Map View</h2>
      <div className="h-[calc(100vh-8rem)] w-full">
        {/* La lógica aquí no cambia, sigue pasando el routeId a MapView */}
        <MapView routeId={routeId} />
      </div>
    </div>
  );
}
=======

export default function MapPage() {
  // TODO: Get routeId from URL params when editing
  return <MapView />;
}
>>>>>>> 8341f75009abe16d7b6d48cd07b748544c6d436e
