import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BootstrapData } from "@/lib/sheets-api";
import { normalizeDiagnosis } from "@/lib/types";
import { toast } from "sonner";

async function fetchBootstrap(force = false): Promise<BootstrapData> {
  const url = force ? "/api/backend?action=bootstrap&force=true" : "/api/backend?action=bootstrap";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`שגיאת שרת (${res.status}) בטעינת נתוני לוגיסטיקה`);
  }
  const json = await res.json();
  if (!json.ok || !json.data) {
    throw new Error(json.error || "נתוני הלוגיסטיקה ריקים");
  }
  return json.data;
}

export function useLogisticsData() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["logistics-data"],
    queryFn: () => fetchBootstrap(false),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetchBootstrap(true),
    onSuccess: (fresh) => {
      queryClient.setQueryData(["logistics-data"], fresh);
      toast.success("נתוני הלוגיסטיקה רועננו בהצלחה 🔄");
    },
    onError: (err) => {
      toast.error("שגיאה ברענון הנתונים: " + (err as Error).message);
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/backend?action=clear-cache", { method: "POST" });
      const json = await res.json();
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-data"] });
      toast.success("הזיכרון הזמני נוקה בהצלחה! הנתונים נטענים מחדש.");
    },
  });

  const saveDiscMutation = useMutation({
    mutationFn: async ({
      row,
      fix,
    }: {
      row: number;
      fix: { date?: string; plate?: string; approve?: boolean; approver?: string };
    }) => {
      const res = await fetch("/api/backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveDisc", row, fix }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "שגיאה בשמירת נתוני הדיסקית");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-data"] });
      toast.success("התיקון נשמר בהצלחה בגיליון ✅");
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  return {
    data: query.data,
    visits: query.data?.visits || [],
    sites: query.data?.sites || [],
    cities: query.data?.cities || [],
    discs: query.data?.discs || [],
    deliveryNotes: query.data?.deliveryNotes || [],
    anomalies: query.data?.anomalies || [],
    diagnosis: query.data?.diagnosis ? normalizeDiagnosis(query.data.diagnosis) : undefined,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching || refreshMutation.isPending,
    error: query.error as Error | null,
    refetch: () => refreshMutation.mutate(),
    clearCache: () => clearCacheMutation.mutate(),
    saveDisc: (
      row: number,
      fix: { date?: string; plate?: string; approve?: boolean; approver?: string },
    ) => saveDiscMutation.mutateAsync({ row, fix }),
  };
}
