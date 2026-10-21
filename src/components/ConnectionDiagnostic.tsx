import { ConnectionDiagnosis } from "@/lib/types";
import { AlertTriangle, RefreshCw, Trash2, Globe, ShieldAlert, Code2, Server } from "lucide-react";

interface ConnectionDiagnosticProps {
  diagnosis?: ConnectionDiagnosis;
  onRetry?: () => void;
  onClearCache?: () => void;
  isRetrying?: boolean;
}

export function ConnectionDiagnostic({
  diagnosis,
  onRetry,
  onClearCache,
  isRetrying,
}: ConnectionDiagnosticProps) {
  if (!diagnosis) return null;

  return (
    <div
      className="rounded-3xl border-2 border-amber-500/40 bg-amber-500/5 p-6 shadow-card space-y-5 text-right"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              בעיית חיבור ל-Apps Script Web App
            </h2>
            <p className="text-xs text-muted-foreground">
              {diagnosis.isUsingFallback
                ? "המערכת מציגה נתוני גיליון אמיתיים מקובץ גיבוי מאומת של ח. סבן (ללא נתוני דוגמה)."
                : "לא ניתן לתקשר ישירות עם כתובת ה-Apps Script. להלן פרטי האבחון:"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition hover:opacity-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>בדוק שוב</span>
            </button>
          )}
          {onClearCache && (
            <button
              onClick={onClearCache}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>נקה cache</span>
            </button>
          )}
        </div>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs">
        <div className="rounded-2xl border bg-card p-3 space-y-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Globe className="h-3.5 w-3.5 text-primary" /> מארח הכתובת (Host):
          </span>
          <span
            className="font-mono font-bold text-[11px] truncate block"
            title={diagnosis.appsScriptHost}
          >
            {diagnosis.appsScriptHost || "לא הוגדר (env)"}
          </span>
        </div>

        <div className="rounded-2xl border bg-card p-3 space-y-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Server className="h-3.5 w-3.5 text-primary" /> סטטוס HTTP:
          </span>
          <span className="font-mono font-bold text-sm">
            {diagnosis.httpStatus !== undefined ? `${diagnosis.httpStatus}` : "אין תגובה (Offline)"}
          </span>
        </div>

        <div className="rounded-2xl border bg-card p-3 space-y-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Code2 className="h-3.5 w-3.5 text-primary" /> סוג תוכן (Content-Type):
          </span>
          <span className="font-mono font-semibold text-[11px] truncate block">
            {diagnosis.contentType || "לא התקבל"}
          </span>
        </div>

        <div className="rounded-2xl border bg-card p-3 space-y-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> מצב נוכחי:
          </span>
          <span className="font-semibold text-xs text-amber-700 dark:text-amber-400">
            {diagnosis.isUsingFallback ? "גיבוי גיליון מקומי פעיל" : "שגיאת תקשורת"}
          </span>
        </div>
      </div>

      {/* Raw Snippet */}
      {diagnosis.first200Chars && (
        <div className="rounded-2xl border bg-muted/40 p-3 space-y-1 text-xs">
          <div className="font-bold text-muted-foreground">200 התווים הראשונים שהתקבלו מהשרת:</div>
          <pre className="font-mono text-[11px] text-foreground bg-card p-2 rounded-xl overflow-x-auto whitespace-pre-wrap break-all">
            {diagnosis.first200Chars}
          </pre>
        </div>
      )}

      {/* 3 Common Causes in Hebrew */}
      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <h3 className="font-bold text-sm text-foreground">
          3 הסיבות הנפוצות לבעיית חיבור מול Google Apps Script:
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground leading-relaxed pr-2">
          {diagnosis.causes.map((c, i) => (
            <li key={i} className="py-0.5">
              <span className="text-foreground font-medium">{c}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
