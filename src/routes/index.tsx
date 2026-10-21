import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { CalendarMonth } from "@/components/CalendarMonth";
import { DayDrawer } from "@/components/DayDrawer";
import { ConnectionDiagnostic } from "@/components/ConnectionDiagnostic";
import { PageHeader } from "@/components/AppShell";
import {
  Truck,
  Disc,
  Clock,
  AlertTriangle,
  RefreshCw,
  MapPin,
  ExternalLink,
  ChevronLeft,
  Calendar,
} from "lucide-react";
import { DRIVERS } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "סידור חכם — ח. סבן לוגיסטיקה" },
      {
        name: "description",
        content: "מערכת סידור חכם, בקרת תעודות משלוח ואיתוראן טכוגרף של ח. סבן.",
      },
      { property: "og:title", content: "סידור חכם — ח. סבן" },
      { property: "og:description", content: "בקרת לוגיסטיקה, טכוגרף וניהול ציי משאיות." },
    ],
  }),
  component: DashboardScreen,
});

function DashboardScreen() {
  const { visits, anomalies, discs, diagnosis, isLoading, isRefetching, refetch, clearCache } =
    useLogisticsData();

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Calculate live summary metrics
  const totalVisitsCount = visits.length;
  const criticalAnomaliesCount = anomalies.filter((a) => a.severity === "critical").length;
  const totalPtoMinutes = visits.reduce((acc, v) => acc + (v.ptoMinutes || 0), 0);
  const totalPtoHours = Math.round((totalPtoMinutes / 60) * 10) / 10;

  // Recent active days
  const uniqueDates = Array.from(new Set(visits.map((v) => v.date))).slice(0, 5);

  return (
    <>
      <PageHeader
        title="סידור חכם – ח. סבן חומרי בנין"
        subtitle="בקרת תעודות משלוח, דיסקיות טכוגרף והצלבת איתוראן בזמן אמת"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isRefetching}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50 shadow-xs"
              title="רענן נתונים מ-Apps Script / גיליון"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-primary ${isRefetching ? "animate-spin" : ""}`}
              />
              <span>{isRefetching ? "מסנכרן..." : "רענן מגיליון"}</span>
            </button>
            <Link
              to="/status"
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted shadow-xs"
            >
              <span>סטטוס חיבור</span>
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-8">
        {/* Connection Diagnosis Banner if any issue exists */}
        {diagnosis && (!diagnosis.ok || diagnosis.isUsingFallback) && (
          <ConnectionDiagnostic
            diagnosis={diagnosis}
            onRetry={refetch}
            onClearCache={clearCache}
            isRetrying={isRefetching}
          />
        )}

        {/* Section 5.1: Live Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>ביקורים מתועדים</span>
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="font-display text-3xl font-extrabold text-foreground">
              {isLoading ? "..." : totalVisitsCount}
            </div>
            <div className="text-[11px] text-muted-foreground">הוצלבו בגיליון סבן</div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>שעות עבודת מנוף (PTO)</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="font-display text-3xl font-extrabold text-amber-600">
              {isLoading ? "..." : `${totalPtoHours} שעות`}
            </div>
            <div className="text-[11px] text-muted-foreground">נמדדו בחיישני משאית</div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>דיסקיות טכוגרף</span>
              <Disc className="h-4 w-4 text-cyan-700" />
            </div>
            <div className="font-display text-3xl font-extrabold text-cyan-700">
              {isLoading ? "..." : discs.length}
            </div>
            <div className="text-[11px] text-muted-foreground">בקרת נסיעה וק״מ</div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>חריגות פתוחות</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="font-display text-3xl font-extrabold text-foreground">
              {isLoading ? "..." : anomalies.length}
            </div>
            <div className="text-[11px] text-red-600 font-semibold">
              {criticalAnomaliesCount} קריטיות לבדיקה
            </div>
          </div>
        </div>

        {/* Driver Quick Access Cards (Ali & Hikmat) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Hikmat Card */}
          <Link
            to="/hikmat"
            className="flex items-center justify-between rounded-3xl border bg-card p-5 shadow-card transition hover:border-primary/60 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <img
                src={DRIVERS.hikmat.avatarUrl}
                alt={DRIVERS.hikmat.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full object-cover border-2 shadow-xs"
                style={{ borderColor: DRIVERS.hikmat.color }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {DRIVERS.hikmat.fullName}
                  </h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                    מנוף 615-41-002
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  משאית מרצדס מנוף · צוות מסארווה ראמי
                </div>
              </div>
            </div>
            <div className="flex items-center text-xs font-bold text-primary">
              <span>לפרופיל נהג</span>
              <ChevronLeft className="h-4 w-4" />
            </div>
          </Link>

          {/* Ali Card */}
          <Link
            to="/ali"
            className="flex items-center justify-between rounded-3xl border bg-card p-5 shadow-card transition hover:border-cyan-700/60 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <img
                src={DRIVERS.ali.avatarUrl}
                alt={DRIVERS.ali.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full object-cover border-2 shadow-xs"
                style={{ borderColor: DRIVERS.ali.color }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {DRIVERS.ali.fullName}
                  </h3>
                  <span className="rounded-full bg-cyan-700/10 px-2 py-0.5 text-[11px] font-bold text-cyan-800 dark:text-cyan-400">
                    פלטה 651-51-701
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  משאית איסוזו פלטה · אספקות מהירות
                </div>
              </div>
            </div>
            <div className="flex items-center text-xs font-bold text-cyan-700">
              <span>לפרופיל נהג</span>
              <ChevronLeft className="h-4 w-4" />
            </div>
          </Link>
        </div>

        {/* Section 5.1: Monthly Calendar with driver dots & anomaly badges */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>לוח שנה תפעולי (לחץ על יום לפתיחת דשבורד מפורט):</span>
            </h3>
            {selectedDay && (
              <span className="text-xs font-bold text-primary">נבחר: {selectedDay}</span>
            )}
          </div>

          <CalendarMonth
            visits={visits}
            anomalies={anomalies}
            selectedDate={selectedDay || undefined}
            onSelectDay={(d) => setSelectedDay(d)}
          />
        </div>

        {/* Recent Days Quick List */}
        <div className="rounded-3xl border bg-card p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-display font-bold text-sm text-foreground">
              ימי עבודה אחרונים בגיליון
            </h3>
            <span className="text-xs text-muted-foreground">לחץ על יום לפרטים מלאים</span>
          </div>

          <div className="divide-y text-xs">
            {uniqueDates.map((d) => {
              const dayVisits = visits.filter((v) => v.date === d);
              const dayAnomalies = anomalies.filter((a) => a.date === d);

              return (
                <div
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className="flex cursor-pointer items-center justify-between py-3 hover:bg-muted/30 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-primary">{d}</span>
                    <span className="text-muted-foreground">
                      {dayVisits.length} ביקורים (
                      {dayVisits.reduce((acc, v) => acc + v.notesCount, 0)} תעודות)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {dayAnomalies.length > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{dayAnomalies.length} חריגות</span>
                      </span>
                    )}
                    <span className="font-semibold text-primary flex items-center gap-0.5">
                      פתח יום <ChevronLeft className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 5.1/5.2: Day Drawer Layer */}
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
