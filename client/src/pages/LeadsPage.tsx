import { LeadsTable } from "@/components/LeadsTable";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "@/features/hooks/use-toast";

export function LeadsPage() {
  useEffect(() => {
    api("/leads")
      .then((data) => {
        console.log("✅ Leads fetched:", data);
        toast({
          title: "Leads loaded successfully",
          description: `Retrieved ${data?.data?.length || 0} records.`,
        });
      })
      .catch((err) => {
        console.error("❌ Error loading leads:", err);
        toast({
          title: "Error loading leads",
          description: "Unable to connect to the server.",
          variant: "destructive",
        });
      });
  }, []);

  return (
    <div className="p-6">
      <LeadsTable />
    </div>
  );
}

export default LeadsPage;
