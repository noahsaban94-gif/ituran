import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { TachographCanvasViewer } from "@/components/TachographCanvasViewer";
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
        content: "ניתוח דיסקיות טכוגרף בקנבס אינטראקטיבי, טבעת 24H והצלבת זמני מנוף ו-PTO.",
      },
    ],
  }),
  component: TachographScreen,
});

function TachographScreen() {
  const search = Route.useSearch();
  const { visits, sites, discs, anomalies, isLoading, isRefetching, refetch, saveDisc } =
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
              className="flex items-center gap-1.5 rounded-2xl border border-[#223246] bg-[#131c26] px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:bg-[#1f2d3d] disabled:opacity-50 shadow-md"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#10b981] ${isRefetching ? "animate-spin" : ""}`}
              />
              <span>{isRefetching ? "מסנכרן..." : "רענן מגיליון"}</span>
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-8" dir="rtl">
        {/* Date & Driver Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#223246] bg-[#131c26] p-4 shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Calendar className="h-4 w-4 text-[#10b981]" />
              <span>בחר תאריך יום עבודה:</span>
            </div>

            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-2xl border border-[#223246] bg-[#0b1118] py-2 px-3 text-xs font-bold text-white shadow-xs focus:ring-2 focus:ring-[#10b981]/50 focus:outline-none"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Driver Switcher */}
          <div className="flex items-center rounded-2xl border border-[#223246] bg-[#0b1118] p-1">
            <button
              onClick={() => setSelectedDriver("hikmat")}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                selectedDriver === "hikmat"
                  ? "bg-[#10b981] text-slate-950 font-black shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              חכמת גאבר (615-41-002)
            </button>
            <button
              onClick={() => setSelectedDriver("ali")}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                selectedDriver === "ali"
                  ? "bg-[#38bdf8] text-slate-950 font-black shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              עלי אבו עידה (651-51-701)
            </button>
          </div>
        </div>

        {/* Tachograph HTML5 Canvas & 24H Ring Viewer Component */}
        <TachographCanvasViewer
          disc={dayDisc}
          visits={dayVisits}
          sites={sites}
          anomalies={dayAnomalies}
          date={selectedDate}
          driverId={selectedDriver}
          onSaveCorrection={(row, fix) => saveDisc(row, fix)}
        />
      </div>
    </>
  );
}
