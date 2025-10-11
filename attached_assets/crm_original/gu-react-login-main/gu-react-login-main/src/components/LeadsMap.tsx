// src/components/LeadsMap.tsx
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type MapPoint = {
  id: string | number;
  lat: number;
  lng: number;
  address?: string;
};

// arreglo para arreglar iconos que salen rotos en Leaflet con Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function LeadsMap({ points }: { points: MapPoint[] }) {
  const defaultCenter: [number, number] = [29.7604, -95.3698]; // Houston
  const hasPoints = points.length > 0;
  const center: [number, number] = hasPoints
    ? [points[0].lat, points[0].lng]
    : defaultCenter;

  return (
    <MapContainer
      center={center}
      zoom={hasPoints ? 12 : 10}
      style={{ height: "100%", width: "100%" }}
    >
      {/* capa base de OpenStreetMap */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      />
      {/* marcadores */}
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]}>
          <Popup>
            {p.address || "No address"} <br />
            ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
