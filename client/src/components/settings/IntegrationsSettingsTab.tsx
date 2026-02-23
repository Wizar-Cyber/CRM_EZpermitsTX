import { Button } from "@/components/ui/button";

export function IntegrationsSettingsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">CRM Integrations</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Manage connected services and third-party tools.
      </p>

      <ul className="space-y-3">
        <li className="flex justify-between items-center border rounded-xl p-3">
          <div>
            <span className="font-medium">Google Calendar</span>
            <p className="text-xs text-muted-foreground">Sync meetings and schedules.</p>
          </div>
          <Button variant="outline" className="rounded-xl">Connect</Button>
        </li>

        <li className="flex justify-between items-center border rounded-xl p-3">
          <div>
            <span className="font-medium">Slack</span>
            <p className="text-xs text-muted-foreground">Receive CRM notifications directly.</p>
          </div>
          <Button variant="outline" className="rounded-xl">Connect</Button>
        </li>

        <li className="flex justify-between items-center border rounded-xl p-3">
          <div>
            <span className="font-medium">WhatsApp Business</span>
            <p className="text-xs text-muted-foreground">Enable message-based client interactions.</p>
          </div>
          <Button variant="outline" className="rounded-xl">Connect</Button>
        </li>
      </ul>
    </div>
  );
}
