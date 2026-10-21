import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { PageHeader } from "@/components/AppShell";
import { DRIVERS } from "@/lib/types";
import { DayDrawer } from "@/components/DayDrawer";
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/ali")({
  head: () => ({
    meta: [
      { title: "עלי אבו עידה (651-51-701) — ח. סבן לוגיסטיקה" },
      { name: "description", content: "דשבורד ביצועי נהג: עלי אבו עידה, משאית פלטה 651-51-701." },
    ],
  }),
  component: AliDriverScreen,
});

function AliDriverScreen() {
  const driver = DRIVERS.ali;
  const { visits, anomalies, discs, isLoading, refetch, isRefetching } = useLogisticsData();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Filter visits for Ali
  const aliVisits = visits.filter((v) => v.driverId === "ali");
  const aliNotesCount = aliVisits.reduce((acc, v) => acc + v.notesCount, 0);

  const aliPtoMinutes = aliVisits.reduce((acc, v) => acc + (v.ptoMinutes || 0), 0);
  const aliPtoHours = Math.round((aliPtoMinutes / 60) * 10) / 10;

  const validDurations = aliVisits
    .map((v) => v.siteDurationMinutes)
    .filter((d): d is number => d !== undefined && d > 0);
  const medianSiteDuration =
    validDurations.length > 0
      ? validDurations.sort((a, b) => a - b)[Math.floor(validDurations.length / 2)]!
      : 0;

  const aliAnomalies = anomalies.filter((a) => a.driverId === "ali");

  const dates = Array.from(new Set(aliVisits.map((v) => v.date)));

  return (
    <>
      <PageHeader
        title={`${driver.fullName} · משאית ${driver.plate}`}
        subtitle="משאית איסוזו פלטה · היסטוריית חלוקות וביצועים מגיליון"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isRefetching}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50 shadow-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-cyan-700 ${isRefetching ? "animate-spin" : ""}`}
              />
              <span>רענן נתונים</span>
            </button>
            <Link
              to="/tachograph"
              search={{ driver: "ali" }}
              className="flex items-center gap-1 rounded-2xl bg-cyan-700 px-3.5 py-2 text-xs font-bold text-white shadow hover:opacity-90"
            >
              <span>דיסקיות עלי</span>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-8" dir="rtl">
        {/* Driver Profile Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-5">
            <img
              src={driver.avatarUrl}
              alt={driver.name}
              referrerPolicy="no-referrer"
              className="h-20 w-20 rounded-full object-cover border-4 shadow-sm"
              style={{ borderColor: driver.color }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-2xl font-extrabold text-foreground">
                  {driver.fullName}
                </h2>
                <span className="rounded-full bg-cyan-700/15 px-3 py-1 text-xs font-bold text-cyan-800 dark:text-cyan-400">
                  משאית פלטה
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                לוחית רישוי:{" "}
                <span className="font-mono font-bold text-foreground">{driver.plate}</span> ·{" "}
                {driver.truck}
              </div>
            </div>
          </div>
        </div>

        {/* Driver KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center">
          <div className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground">סך ביקורים</div>
            <div className="font-display text-2xl font-extrabold text-foreground mt-1">
              {isLoading ? "..." : aliVisits.length}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground">תעודות משלוח</div>
            <div className="font-display text-2xl font-extrabold text-foreground mt-1">
              {isLoading ? "..." : aliNotesCount}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground">שעות מנוף (PTO)</div>
            <div className="font-display text-2xl font-extrabold text-amber-600 mt-1">
              {isLoading ? "..." : aliPtoHours}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground">חציון זמן באתר</div>
            <div className="font-display text-2xl font-extrabold text-purple-700 mt-1">
              {isLoading ? "..." : `${medianSiteDuration} דק׳`}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground">חריגות פתוחות</div>
            <div className="font-display text-2xl font-extrabold text-foreground mt-1">
              {isLoading ? "..." : aliAnomalies.length}
            </div>
          </div>
        </div>

        {/* Days History Table */}
        <div className="rounded-3xl border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-700" />
              <span>ימי פעילות ורישום של עלי בגיליון ({dates.length} ימים):</span>
            </h3>
            <span className="text-xs text-muted-foreground">לחץ על יום לפתיחת דשבורד מפורט</span>
          </div>

          {dates.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              אין תעודות משלוח או דיסקיות רשומות עבור עלי אבו עידה בגיליון הנוכחי.
            </div>
          ) : (
            <div className="divide-y text-xs">
              {dates.map((d) => {
                const dayVisits = aliVisits.filter((v) => v.date === d);
                const dayAnomalies = aliAnomalies.filter((a) => a.date === d);

                return (
                  <div
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className="flex cursor-pointer items-center justify-between py-3.5 px-3 rounded-2xl hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-cyan-800 dark:text-cyan-400">
                        {d}
                      </span>
                      <span className="text-muted-foreground">
                        {dayVisits.length} ביקורים (
                        {dayVisits.reduce((acc, v) => acc + v.notesCount, 0)} תעודות)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {dayAnomalies.length > 0 && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                          {dayAnomalies.length} חריגות
                        </span>
                      )}
                      <span className="font-bold text-cyan-700 flex items-center">
                        פתח יום <ChevronLeft className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Day Drawer on select */}
      {selectedDay && (
        <DayDrawer
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
          visits={visits}
          discs={discs}
          anomalies={anomalies}
        />
      )}
    </>
  );
}
