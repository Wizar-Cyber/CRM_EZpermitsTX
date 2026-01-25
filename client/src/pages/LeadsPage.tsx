// src/pages/LeadsPage.tsx
import { LeadsTable } from "@/components/LeadsTable";
import { useEffect } from "react";
import { apiGet } from "@/lib/api";

// ✅ Usa el hook de shadcn/ui (si tu proyecto lo tiene)
import { useToast } from "@/features/hooks/use-toast";

export default function LeadsPage() {
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ data: any[] }>("/leads");
        console.log("✅ Leads fetched:", data);
        toast({
          title: "Leads loaded successfully",
          description: `Retrieved ${data?.data?.length ?? 0} records.`,
        });
      } catch (err: any) {
        console.error("❌ Error loading leads:", err);
        toast({
          title: "Error loading leads",
          description: err?.message || "Unable to connect to the server.",
          variant: "destructive",
        });
      }
    })();
  }, [toast]);

  return (
    <div className="p-6">
      <LeadsTable />
    </div>
  );
}
