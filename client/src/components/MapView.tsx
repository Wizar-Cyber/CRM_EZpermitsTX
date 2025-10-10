import { useState } from "react";
import { MapPin, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// TODO: remove mock functionality - placeholder for map integration
const mockAddresses = [
  { id: "1", address: "123 Main St, City, State", lat: 40.7128, lng: -74.0060, case_number: "C-2024-001", color: "green" },
  { id: "2", address: "456 Oak Ave, City, State", lat: 40.7580, lng: -73.9855, case_number: "C-2024-002", color: "yellow" },
  { id: "3", address: "789 Pine Rd, City, State", lat: 40.7489, lng: -73.9680, case_number: "C-2024-003", color: "red" },
];

interface MapViewProps {
  routeId?: string;
}

export function MapView({ routeId }: MapViewProps) {
  const [addresses, setAddresses] = useState(mockAddresses);
  const [routeName, setRouteName] = useState("");
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const handleRemoveAddress = (id: string) => {
    setAddresses(addresses.filter(addr => addr.id !== id));
    console.log("Removed address:", id);
  };

  const handleSaveRoute = () => {
    console.log("Saving route:", { name: routeName, addresses });
    // TODO: Implement API call to save route
  };

  return (
    <div className="flex h-full gap-4">
      {/* Address List Sidebar */}
      <Card className="w-80 rounded-2xl shadow-sm p-4 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-lg mb-2">Selected Addresses</h3>
          <p className="text-sm text-muted-foreground">{addresses.length} locations</p>
        </div>

        <div className="flex-1 overflow-auto space-y-2">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No addresses selected. Go to Leads to select locations.
            </p>
          ) : (
            addresses.map((addr) => (
              <div 
                key={addr.id} 
                className={`p-3 rounded-lg border hover-elevate cursor-pointer ${
                  selectedMarker === addr.id ? 'bg-primary/10 border-primary' : 'bg-card border-border'
                }`}
                onClick={() => setSelectedMarker(addr.id)}
                data-testid={`address-item-${addr.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className={`w-4 h-4 text-${addr.color}-500`} />
                      <span className="text-xs font-medium text-muted-foreground">{addr.case_number}</span>
                    </div>
                    <p className="text-sm">{addr.address}</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAddress(addr.id);
                    }}
                    data-testid={`button-remove-${addr.id}`}
                    className="rounded-lg h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 pt-3 border-t">
          <Input 
            placeholder="Route name"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            data-testid="input-route-name"
            className="rounded-lg"
          />
          <Button 
            onClick={handleSaveRoute} 
            disabled={addresses.length < 2 || !routeName}
            className="w-full rounded-2xl"
            data-testid="button-save-route"
          >
            <Save className="w-4 h-4 mr-2" />
            {routeId ? 'Update Route' : 'Save Route'}
          </Button>
        </div>
      </Card>

      {/* Map Area */}
      <Card className="flex-1 rounded-2xl shadow-sm p-4">
        <div className="w-full h-full bg-muted/30 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Map view with {addresses.length} markers
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              (react-leaflet integration pending)
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
