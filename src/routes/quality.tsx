import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { PageHeader } from "@/components/AppShell";
import { DeterministicAnomaly } from "@/lib/types";
import {
  ShieldAlert,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Edit2,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title: "איכות נתונים ובקרה — ח. סבן לוגיסטיקה" },
      {
        name: "description",
        content: "דשבורד איכות נתונים: זיהוי שגיאות OCR, חלונות מנוף הפוכים וחריגות.",
      },
    ],
  }),
  component: QualityScreen,
});

function QualityScreen() {
  const { anomalies, discs, visits, isLoading, isRefetching, refetch, saveDisc } =
    useLogisticsData();
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [fixModalAnomaly, setFixModalAnomaly] = useState<DeterministicAnomaly | null>(null);
  const [fixDateInput, setFixDateInput] = useState("18/10/2026");
  const [fixPlateInput, setFixPlateInput] = useState("615-41-002");

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterSeverity === "all") return true;
    return a.severity === filterSeverity;
  });

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const warningCount = anomalies.filter((a) => a.severity === "warning").length;
  const infoCount = anomalies.filter((a) => a.severity === "info").length;

  const handleFixSubmit = async () => {
    if (!fixModalAnomaly) return;

    // Find disc row if applicable
    const disc = discs.find((d) => d["תאריך דיסקית"]?.includes(fixModalAnomaly.date));
    const row = disc?._row || 2;

    try {
      await saveDisc(row, {
        date: fixDateInput,
        plate: fixPlateInput,
        approve: true,
        approver: "ראמי מסארווה",
      });
      setFixModalAnomaly(null);
      toast.success("פעולת התיקון נרשמה בהצלחה בגיליון ✅");
    } catch {
      toast.error("שגיאה ברישום התיקון");
    }
  };

  return (
    <>
      <PageHeader
        title="איכות נתונים ודגלי בקרה"
        subtitle="זיהוי שגיאות OCR, תעודות ללא התאמת איתוראן, חלונות מנוף הפוכים ופעולות תיקון"
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
        {/* Quality Severity Counters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground font-bold">סך הכל דגלים</div>
            <div className="font-display text-2xl font-extrabold text-foreground mt-1">
              {anomalies.length}
            </div>
          </div>

          <div className="rounded-3xl border-2 border-red-500/30 bg-red-500/5 p-4 shadow-card">
            <div className="text-xs text-red-700 dark:text-red-400 font-bold">
              חריגות קריטיות (OCR / חלון הפוך)
            </div>
            <div className="font-display text-2xl font-extrabold text-red-700 dark:text-red-400 mt-1">
              {criticalCount}
            </div>
          </div>

          <div className="rounded-3xl border-2 border-amber-500/30 bg-amber-500/5 p-4 shadow-card">
            <div className="text-xs text-amber-700 dark:text-amber-400 font-bold">
              אזהרות זמנים (מעל 10 דק׳)
            </div>
            <div className="font-display text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">
              {warningCount}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground font-bold">מידע (חתימות חסרות)</div>
            <div className="font-display text-2xl font-extrabold text-muted-foreground mt-1">
              {infoCount}
            </div>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-xs">
          <button
            onClick={() => setFilterSeverity("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterSeverity === "all"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            כל החריגות ({anomalies.length})
          </button>
          <button
            onClick={() => setFilterSeverity("critical")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterSeverity === "critical"
                ? "bg-red-600 text-white"
                : "text-red-700 dark:text-red-400 hover:bg-red-500/10"
            }`}
          >
            קריטי ({criticalCount})
          </button>
          <button
            onClick={() => setFilterSeverity("warning")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterSeverity === "warning"
                ? "bg-amber-600 text-white"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            אזהרה ({warningCount})
          </button>
          <button
            onClick={() => setFilterSeverity("info")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterSeverity === "info"
                ? "bg-zinc-700 text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            מידע ({infoCount})
          </button>
        </div>

        {/* Anomalies List */}
        <div className="space-y-3">
          {filteredAnomalies.length === 0 ? (
            <div className="rounded-3xl border bg-card p-12 text-center text-xs text-muted-foreground">
              אין חריגות בקטגוריה זו. כל הנתונים תקינים!
            </div>
          ) : (
            filteredAnomalies.map((a) => (
              <div
                key={a.id}
                className={`rounded-3xl border p-5 shadow-card transition space-y-2.5 ${
                  a.severity === "critical"
                    ? "border-red-500/40 bg-red-500/5"
                    : a.severity === "warning"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        a.severity === "critical"
                          ? "bg-red-600 text-white"
                          : a.severity === "warning"
                            ? "bg-amber-500 text-white"
                            : "bg-muted text-foreground"
                      }`}
                    >
                      !
                    </span>
                    <h3 className="font-display font-bold text-sm text-foreground">{a.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{a.date}</span>
                    <button
                      onClick={() => setFixModalAnomaly(a)}
                      className="flex items-center gap-1 rounded-xl bg-card border px-3 py-1 text-xs font-bold text-primary shadow-xs hover:bg-muted"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>פעולת תיקון</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-foreground font-semibold bg-card/60 p-2.5 rounded-xl border">
                  ראיה: {a.evidence}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{a.explanation}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fix Modal */}
      {fixModalAnomaly && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-lg text-foreground">
              פעולת תיקון ואישור בגיליון
            </h3>
            <p className="text-xs text-muted-foreground">
              {fixModalAnomaly.title} ({fixModalAnomaly.evidence})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-bold">תאריך מתוקן:</label>
                <input
                  value={fixDateInput}
                  onChange={(e) => setFixDateInput(e.target.value)}
                  className="w-full rounded-xl border bg-muted/30 p-2.5 font-mono"
                  placeholder="DD/MM/YYYY"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-bold">משאית מתוקנת:</label>
                <input
                  value={fixPlateInput}
                  onChange={(e) => setFixPlateInput(e.target.value)}
                  className="w-full rounded-xl border bg-muted/30 p-2.5 font-mono"
                  placeholder="615-41-002"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setFixModalAnomaly(null)}
                className="rounded-xl border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                ביטול
              </button>
              <button
                onClick={handleFixSubmit}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90"
              >
                שמור תיקון בגיליון
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
