import { useState } from "react";
import { Eye, CheckCircle, MapPin, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// TODO: remove mock functionality - this is placeholder data
const mockLeads = [
  { id: 1, case_number: "C-2024-001", incident_address: "123 Main St, City, State", status: "GREEN", priority: "High", date: "2024-01-15" },
  { id: 2, case_number: "C-2024-002", incident_address: "456 Oak Ave, City, State", status: "YELLOW", priority: "Medium", date: "2024-01-16" },
  { id: 3, case_number: "C-2024-003", incident_address: "789 Pine Rd, City, State", status: "RED", priority: "Low", date: "2024-01-17" },
  { id: 4, case_number: "C-2024-004", incident_address: "321 Elm St, City, State", status: "GREEN", priority: "High", date: "2024-01-18" },
  { id: 5, case_number: "C-2024-005", incident_address: "654 Maple Dr, City, State", status: "YELLOW", priority: "Medium", date: "2024-01-19" },
];

const statusColors = {
  GREEN: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  YELLOW: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  RED: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function LeadsTable() {
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [sortField, setSortField] = useState<string>("case_number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(mockLeads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: number, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, leadId]);
    } else {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSendToMap = () => {
    console.log("Send to map clicked", selectedLeads);
    // TODO: Implement localStorage.selectedForMap logic
  };

  const handleViewDetails = (leadId: number) => {
    console.log("View details for lead:", leadId);
    // TODO: Open modal with tabs
  };

  const handleSchedule = (leadId: number) => {
    console.log("Schedule appointment for lead:", leadId);
    // TODO: Open appointment modal
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Leads</h2>
        <Button 
          onClick={handleSendToMap} 
          disabled={selectedLeads.length === 0}
          data-testid="button-send-to-map"
          className="rounded-2xl"
        >
          <MapPin className="w-4 h-4 mr-2" />
          Send to Map ({selectedLeads.length})
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full" data-testid="table-leads">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-left">
                <Checkbox 
                  checked={selectedLeads.length === mockLeads.length}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </th>
              <th className="p-4 text-left">
                <button 
                  onClick={() => handleSort("case_number")} 
                  className="flex items-center gap-2 font-semibold text-sm hover-elevate"
                >
                  Case #
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="p-4 text-left">
                <button 
                  onClick={() => handleSort("incident_address")} 
                  className="flex items-center gap-2 font-semibold text-sm hover-elevate"
                >
                  Address
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="p-4 text-left">
                <button 
                  onClick={() => handleSort("status")} 
                  className="flex items-center gap-2 font-semibold text-sm hover-elevate"
                >
                  Status
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="p-4 text-left font-semibold text-sm">Priority</th>
              <th className="p-4 text-left font-semibold text-sm">Date</th>
              <th className="p-4 text-left font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockLeads.map((lead) => (
              <tr 
                key={lead.id} 
                className={`border-t border-border hover-elevate ${
                  selectedLeads.includes(lead.id) ? 'bg-primary/5' : ''
                }`}
                data-testid={`row-lead-${lead.id}`}
              >
                <td className="p-4">
                  <Checkbox 
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                    data-testid={`checkbox-lead-${lead.id}`}
                  />
                </td>
                <td className="p-4 font-medium">{lead.case_number}</td>
                <td className="p-4 text-muted-foreground">{lead.incident_address}</td>
                <td className="p-4">
                  <Badge className={`${statusColors[lead.status as keyof typeof statusColors]} rounded-full`}>
                    {lead.status}
                  </Badge>
                </td>
                <td className="p-4">{lead.priority}</td>
                <td className="p-4 text-muted-foreground">{lead.date}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleViewDetails(lead.id)}
                      data-testid={`button-view-${lead.id}`}
                      className="rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleSchedule(lead.id)}
                      data-testid={`button-schedule-${lead.id}`}
                      className="rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
