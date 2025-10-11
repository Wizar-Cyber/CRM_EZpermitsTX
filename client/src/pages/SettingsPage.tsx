import { Card } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      <Card className="rounded-2xl shadow-sm p-12">
        <div className="text-center">
          <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Settings Page</h3>
          <p className="text-muted-foreground">
            Settings and configuration options will be implemented here
          </p>
        </div>
      </Card>
    </div>
  );
}
