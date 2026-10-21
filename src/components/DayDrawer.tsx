import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  VisitRecord,
  TachographDiscRow,
  DeterministicAnomaly,
  DriverId,
  DRIVERS,
} from "@/lib/types";
import { buildDayDashboard } from "@/lib/data-parser";
import {
  X,
  Clock,
  MapPin,
  FileText,
  AlertTriangle,
  Compass,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";

interface DayDrawerProps {
  date: string;
  onClose: () => void;
  visits: VisitRecord[];
  discs: TachographDiscRow[];
  anomalies: DeterministicAnomaly[];
}

export function DayDrawer({ date, onClose, visits, discs, anomalies }: DayDrawerProps) {
  const [activeDriver, setActiveDriver] = useState<DriverId>("hikmat");

  const dashboard = buildDayDashboard(date, activeDriver, visits, discs, anomalies);

  const driver = DRIVERS[activeDriver];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
      dir="rtl"
    >
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl overflow-y-auto sm:border-r border-border animate-in slide-in-from-right duration-200">
        {/* Top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/90 px-6 py-4 backdrop-blur-md">
          <div>
            <div className="text-xs font-bold text-muted-foreground">דשבורד יומי</div>
            <h2 className="font-display text-xl font-bold text-foreground">{date}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Driver Toggle Switch */}
            <div className="flex items-center rounded-2xl border bg-muted/40 p-1">
              <button
                onClick={() => setActiveDriver("hikmat")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  activeDriver === "hikmat"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                חכמת (615-41-002)
              </button>
              <button
                onClick={() => setActiveDriver("ali")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  activeDriver === "ali"
                    ? "bg-cyan-700 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                עלי (651-51-701)
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-2xl border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="סגור שכבה"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Driver Profile Card with Real Avatar */}
          <div className="flex items-center justify-between rounded-3xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-4">
              <img
                src={driver.avatarUrl}
                alt={driver.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full object-cover border-2 shadow-sm"
                style={{ borderColor: driver.color }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {driver.fullName}
                  </h3>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: driver.color }}
                  >
                    {driver.truckType === "crane" ? "משאית מנוף" : "משאית פלטה"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  משאית {driver.plate} · {driver.truck}
                </div>
              </div>
            </div>

            <Link
              to="/tachograph"
              search={{ date, driver: activeDriver }}
              className="flex items-center gap-1 rounded-2xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90"
            >
              <span>פתח ב-Tachograph</span>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>

          {/* Daily KPI Badges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
            <div className="rounded-2xl border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground">ביקורים היום</div>
              <div className="font-display text-2xl font-extrabold text-foreground mt-1">
                {dashboard.totalVisits}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground">תעודות משלוח</div>
              <div className="font-display text-2xl font-extrabold text-foreground mt-1">
                {dashboard.notesCount}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground">שעות מנוף (PTO)</div>
              <div className="font-display text-2xl font-extrabold text-amber-600 mt-1">
                {dashboard.ptoHours}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground">ק״מ יומי בדיסקית</div>
              <div className="font-display text-2xl font-extrabold text-cyan-700 mt-1">
                {dashboard.totalKm !== undefined ? `${dashboard.totalKm} ק״מ` : "אין נתון"}
              </div>
            </div>
          </div>

          {/* Deterministic Anomalies section */}
          {dashboard.anomalies.length > 0 && (
            <div className="rounded-3xl border-2 border-amber-500/40 bg-amber-500/5 p-5 shadow-card space-y-3">
              <div className="flex items-center gap-2 font-display text-sm font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>חריגות מחושבות ליום זה ({dashboard.anomalies.length}):</span>
              </div>
              <div className="space-y-2">
                {dashboard.anomalies.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border bg-card p-3 text-xs space-y-1 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{a.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          a.severity === "critical"
                            ? "bg-red-500/15 text-red-700 dark:text-red-400"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {a.severity === "critical" ? "קריטי" : "אזהרה"}
                      </span>
                    </div>
                    <div className="text-muted-foreground">{a.evidence}</div>
                    <div className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
                      {a.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Visits & Cross-Check Timeline */}
          <div className="space-y-3">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>ציר פעילות וביקורים ({dashboard.visits.length}):</span>
            </h3>

            {dashboard.visits.length === 0 ? (
              <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground text-xs">
                אין ביקורים מדווחים או תעודות משלוח עבור {driver.name} בתאריך {date}.
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.visits.map((v, idx) => (
                  <div
                    key={v.visitKey}
                    className="rounded-2xl border bg-card p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            <span>{v.address}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {v.customers.join(", ")} · {v.notesCount} תעודות משלוח (#
                            {v.noteIds.join(", #")})
                          </div>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          v.customerSignature === "קיימת"
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {v.customerSignature === "קיימת" ? "חתימה קיימת" : "חתימה לא נמצאה"}
                      </span>
                    </div>

                    {/* Timeline cross-check row */}
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2.5 text-[11px] sm:grid-cols-4">
                      <div>
                        <span className="text-muted-foreground block">הגעה ויציאה איתוראן:</span>
                        <span className="font-bold text-foreground">
                          {v.ituranArrival || "--:--"} עד {v.ituranDeparture || "--:--"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block">מנוף בכתב יד:</span>
                        <span className="font-bold text-foreground">
                          {v.handwrittenCraneWindow || "אין נתון"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block">זמן PTO איתוראן:</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {v.ptoMinutes !== undefined ? `${v.ptoMinutes} דק׳` : "אין נתון"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block">מקור מדידה:</span>
                        <span className="font-bold text-foreground">{v.measurementSource}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
