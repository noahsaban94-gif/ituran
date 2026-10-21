import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { TachographViewer } from "@/components/TachographViewer";
import { PageHeader } from "@/components/AppShell";
import { DriverId, DRIVERS } from "@/lib/types";
import { Disc, Calendar, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/tachograph")({
  validateSearch: (search: Record<string, unknown>): { date?: string; driver?: DriverId } => {
    return {
      date: typeof search.date === "string" ? search.date : undefined,
      driver: search.driver === "ali" || search.driver === "hikmat" ? search.driver : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Tachograph · איתוראן GPS — ח. סבן לוגיסטיקה" },
      {
        name: "description",
        content: "ניתוח דיסקיות טכוגרף, הצלבת איתוראן GPS ותעודות משלוח בכתב יד.",
      },
    ],
  }),
  component: TachographScreen,
});

function TachographScreen() {
  const search = Route.useSearch();
  const { visits, discs, anomalies, isLoading, isRefetching, refetch, saveDisc } =
    useLogisticsData();

  // Find all available dates
  const availableDates = Array.from(new Set(visits.map((v) => v.date)))
    .sort()
    .reverse();
  const defaultDate = availableDates[0] || "2026-10-18";

  const [selectedDate, setSelectedDate] = useState<string>(search.date || defaultDate);
  const [selectedDriver, setSelectedDriver] = useState<DriverId>(search.driver || "hikmat");

  // Filter for currently selected date and driver
  const dayVisits = visits.filter((v) => v.date === selectedDate && v.driverId === selectedDriver);

  const dayDisc =
    discs.find((d) => {
      const dDate = d["תאריך מתוקן"] || d["תאריך דיסקית"] || "";
      return dDate.includes(selectedDate) || selectedDate.includes(dDate);
    }) || discs[0];

  const dayAnomalies = anomalies.filter((a) => a.date === selectedDate);

  return (
    <>
      <PageHeader
        title="Tachograph · איתוראן GPS וטכוגרף"
        subtitle="הצלבה כרונולוגית: שעת העמסה ➔ הגעה/יציאה איתוראן ➔ זמני מנוף PTO מול כתב יד ➔ חתימת לקוח"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isRefetching}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50 shadow-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-primary ${isRefetching ? "animate-spin" : ""}`}
              />
              <span>{isRefetching ? "מסנכרן..." : "רענן מגיליון"}</span>
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-8" dir="rtl">
        {/* Date & Driver Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>בחר תאריך:</span>
            </div>

            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-2xl border bg-card py-2 px-3 text-xs font-bold text-foreground shadow-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Driver Switcher */}
          <div className="flex items-center rounded-2xl border bg-muted/40 p-1">
            <button
              onClick={() => setSelectedDriver("hikmat")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedDriver === "hikmat"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              חכמת גאבר (615-41-002)
            </button>
            <button
              onClick={() => setSelectedDriver("ali")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedDriver === "ali"
                  ? "bg-cyan-700 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              עלי אבו עידה (651-51-701)
            </button>
          </div>
        </div>

        {/* Tachograph Viewer Component */}
        <TachographViewer
          disc={dayDisc}
          visits={dayVisits}
          anomalies={dayAnomalies}
          date={selectedDate}
          onSaveCorrection={(row, fix) => saveDisc(row, fix)}
        />
      </div>
    </>
  );
}
