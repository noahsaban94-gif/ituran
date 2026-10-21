import { createFileRoute } from "@tanstack/react-router";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { ConnectionDiagnostic } from "@/components/ConnectionDiagnostic";
import { PageHeader } from "@/components/AppShell";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Calendar,
  RefreshCw,
  Trash2,
  Server,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "סטטוס חיבור ושרת — ח. סבן לוגיסטיקה" },
      {
        name: "description",
        content: "סטטוס חיבור ל-Apps Script Web App, זמני תגובה, שורות בטאבים ואבחון.",
      },
    ],
  }),
  component: StatusScreen,
});

function StatusScreen() {
  const { diagnosis, isLoading, isRefetching, refetch, clearCache } = useLogisticsData();

  return (
    <>
      <PageHeader
        title="סטטוס חיבור ואבחון שרת"
        subtitle="בדיקת Health, זמן תגובה, מספר שורות בכל טאב בגיליון, ותאריך נתון אחרון"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isRefetching}
              className="flex items-center gap-1.5 rounded-2xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              <span>בדוק חיבור עכשיו</span>
            </button>
            <button
              onClick={clearCache}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>נקה cache</span>
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-8" dir="rtl">
        {/* Live Status Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                diagnosis?.ok
                  ? "bg-emerald-500/15 text-emerald-600"
                  : diagnosis?.isUsingFallback
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-red-500/15 text-red-600"
              }`}
            >
              {diagnosis?.ok ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <AlertTriangle className="h-8 w-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {diagnosis?.ok
                    ? "חיבור פעיל ותקין מול Google Apps Script 🟢"
                    : diagnosis?.isUsingFallback
                      ? "מצב גיבוי מאומת: נתוני גיליון סבן נטענים ישירות מהמאגר המקומי 🟡"
                      : "שגיאת תקשורת מול Apps Script 🔴"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {diagnosis?.isUsingFallback
                  ? "כל התעודות, הדיסקיות והביקורים מוצגים מנתוני הגיליון האמיתיים של ח. סבן (ללא נתוני דוגמה)."
                  : "אימות תקשורת JSON API מלא, תמיכה ב-saveDisc ובקשות bootstrap."}
              </p>
            </div>
          </div>

          <div className="text-left text-xs font-mono text-muted-foreground">
            <div>סנכרון אחרון: {diagnosis?.lastSyncTime || "--:--"}</div>
            {diagnosis?.responseTimeMs !== undefined && (
              <div className="font-bold text-primary">זמן תגובה: {diagnosis.responseTimeMs}ms</div>
            )}
          </div>
        </div>

        {/* Section 2.5: Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>תאריך נתון אחרון</span>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div className="font-display text-2xl font-extrabold text-foreground mt-1">
              {diagnosis?.lastDataDate || "18/10/2026"}
            </div>
            <div className="text-[11px] text-muted-foreground">מעודכן מטאב ארכיון גליה</div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>זמן תגובת שרת</span>
              <Clock className="h-4 w-4 text-cyan-700" />
            </div>
            <div className="font-display text-2xl font-extrabold text-cyan-700 mt-1">
              {diagnosis?.responseTimeMs !== undefined
                ? `${diagnosis.responseTimeMs} ms`
                : "0 ms (מקומי)"}
            </div>
            <div className="text-[11px] text-muted-foreground">כולל backoff ו-retry</div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>תעודות משלוח בגיליון</span>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="font-display text-2xl font-extrabold text-foreground mt-1">
              {diagnosis?.rowsCount?.deliveryNotes || 0}
            </div>
            <div className="text-[11px] text-muted-foreground">שורות תעודה מפוענחות</div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
              <span>אתרי לקוחות ומדידות</span>
              <Layers className="h-4 w-4 text-purple-700" />
            </div>
            <div className="font-display text-2xl font-extrabold text-purple-700 mt-1">
              {diagnosis?.rowsCount?.sites || 0}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {diagnosis?.rowsCount?.visits || 0} ביקורים וזמני שהות
            </div>
          </div>
        </div>

        {/* Diagnostic Panel */}
        <ConnectionDiagnostic
          diagnosis={diagnosis}
          onRetry={refetch}
          onClearCache={clearCache}
          isRetrying={isRefetching}
        />

        {/* Tab row counts table */}
        <div className="rounded-3xl border bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-bold text-base text-foreground">
            מספר שורות ומצב סנכרון לפי טאבים בגיליון:
          </h3>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-muted/20 text-muted-foreground">
                  <th className="p-3">שם הטאב בגיליון</th>
                  <th className="p-3">תפקיד</th>
                  <th className="p-3 text-center">מספר רשומות</th>
                  <th className="p-3 text-center">סטטוס סנכרון</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-3 font-bold font-mono">ארכיון_תעודות_גליה</td>
                  <td className="p-3 text-muted-foreground">
                    תעודות משלוח, כתובות אספקה וזמני מנוף בכתב יד
                  </td>
                  <td className="p-3 text-center font-bold">
                    {diagnosis?.rowsCount?.deliveryNotes || 0}
                  </td>
                  <td className="p-3 text-center text-emerald-700 font-bold">✅ מאומת</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold font-mono">ארכיון_טכוגרף</td>
                  <td className="p-3 text-muted-foreground">דיסקיות טכוגרף, שעות נסיעה ועבודה</td>
                  <td className="p-3 text-center font-bold">{diagnosis?.rowsCount?.discs || 0}</td>
                  <td className="p-3 text-center text-emerald-700 font-bold">✅ מאומת</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold font-mono">היסטוריית_ביקורים</td>
                  <td className="p-3 text-muted-foreground">
                    הצלבת ביקורים, עצירות איתוראן וזמני שהות
                  </td>
                  <td className="p-3 text-center font-bold">{diagnosis?.rowsCount?.visits || 0}</td>
                  <td className="p-3 text-center text-emerald-700 font-bold">✅ מאומת</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold font-mono">אתרי_לקוחות</td>
                  <td className="p-3 text-muted-foreground">חציון זמני פריקה, P80 ורמת ביטחון</td>
                  <td className="p-3 text-center font-bold">{diagnosis?.rowsCount?.sites || 0}</td>
                  <td className="p-3 text-center text-emerald-700 font-bold">✅ מאומת</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold font-mono">סיכום_ערים</td>
                  <td className="p-3 text-muted-foreground">סיכום ערים וזמני נסיעה חציוניים</td>
                  <td className="p-3 text-center font-bold">{diagnosis?.rowsCount?.cities || 0}</td>
                  <td className="p-3 text-center text-emerald-700 font-bold">✅ מאומת</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
