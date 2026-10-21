"use client";

import React, { useState } from "react";
import { ConnectionDiagnosis } from "@/lib/types";
import { AlertTriangle, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";

export interface ConnectionDiagnosticProps {
  diagnosis?: Partial<ConnectionDiagnosis> | null;
  diagnostics?:
    | (Partial<ConnectionDiagnosis> & {
        reasons?: string[];
        host?: string;
        status?: string | number;
      })
    | null;
  error?: string | null;
  onRetry?: () => void;
  onClearCache?: () => Promise<void> | void;
  isRetrying?: boolean;
}

export function ConnectionDiagnostic({
  diagnosis,
  diagnostics,
  error,
  onRetry,
  onClearCache,
  isRetrying = false,
}: ConnectionDiagnosticProps) {
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  const diag = diagnosis || diagnostics || null;
  const isOk = Boolean(diag?.ok);
  const isUsingFallback = Boolean(diag?.isUsingFallback);

  // Extract causes safely with full fallback protection
  const rawCauses = diag?.causes ?? diagnostics?.reasons;
  const causes: string[] = Array.isArray(rawCauses)
    ? rawCauses.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];

  const handleClear = async () => {
    setClearing(true);
    setClearStatus(null);
    try {
      if (onClearCache) {
        await onClearCache();
        setClearStatus("הזיכרון הזמני נוקה בהצלחה! הנתונים נטענים מחדש.");
      } else {
        const res = await fetch("/api/backend?action=clear-cache", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
          setClearStatus("הזיכרון הזמני נוקה בהצלחה. בודק מחדש...");
          if (onRetry) {
            setTimeout(() => onRetry(), 800);
          }
        } else {
          setClearStatus(data.error || "שגיאה בניקוי זיכרון מטמון");
        }
      }
    } catch {
      setClearStatus("תקלה בבקשת ניקוי הזיכרון הזמני");
    } finally {
      setClearing(false);
    }
  };

  const hostDisplay = diag?.appsScriptHost || diagnostics?.host || "Google Apps Script";
  const statusDisplay = diag?.httpStatus ?? diagnostics?.status ?? (isOk ? 200 : "ללא מענה");
  const contentTypeDisplay = diag?.contentType || "application/json";
  const errorMessage =
    error ||
    diag?.error ||
    (isUsingFallback
      ? "פעיל כעת במצב נתוני גיבוי מקומיים (ח. סבן) — אין תקשורת ישירה ל-Apps Script"
      : "תקלת תקשורת מול שרת הנתונים של גוגל");

  return (
    <div
      dir="rtl"
      className={`max-w-4xl mx-auto my-6 p-6 rounded-3xl border shadow-card transition-all ${
        isOk && !isUsingFallback
          ? "bg-card border-emerald-500/30"
          : isUsingFallback
            ? "bg-card border-amber-500/40"
            : "bg-card border-destructive/50"
      } text-card-foreground`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-xl shadow-xs shrink-0 ${
              isOk && !isUsingFallback
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : isUsingFallback
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-destructive/15 text-destructive"
            }`}
          >
            {isOk && !isUsingFallback ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isOk && !isUsingFallback
                ? "חיבור פעיל ומסונכרן ל-Google Sheets"
                : isUsingFallback
                  ? "אזהרת סנכרון: שימוש בנתוני גיבוי מקומיים"
                  : "בעיית חיבור לגיליון הנתונים"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-2xl text-xs font-bold transition shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>{isRetrying ? "בודק שוב..." : "בדוק חיבור עכשיו"}</span>
            </button>
          )}
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground rounded-2xl text-xs font-semibold transition border border-border shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{clearing ? "מנקה..." : "נקה זיכרון מטמון"}</span>
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-muted/40 rounded-2xl border border-border">
            <span className="block text-[11px] text-muted-foreground">מארח היעד (Host)</span>
            <strong className="font-mono text-xs truncate block mt-0.5">{hostDisplay}</strong>
          </div>
          <div className="p-3 bg-muted/40 rounded-2xl border border-border">
            <span className="block text-[11px] text-muted-foreground">קוד סטטוס HTTP</span>
            <strong className="font-mono text-xs block mt-0.5">{statusDisplay}</strong>
          </div>
          <div className="p-3 bg-muted/40 rounded-2xl border border-border">
            <span className="block text-[11px] text-muted-foreground">סוג תוכן (Content-Type)</span>
            <strong className="font-mono text-xs truncate block mt-0.5">
              {contentTypeDisplay}
            </strong>
          </div>
        </div>

        {diag?.first200Chars && (
          <div>
            <h4 className="font-bold mb-1.5 text-xs text-muted-foreground">
              תוכן התשובה מהשרת (Raw Snippet):
            </h4>
            <pre className="p-3 bg-neutral-900 text-emerald-400 rounded-2xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap dir-ltr text-left border border-border">
              {diag.first200Chars}
            </pre>
          </div>
        )}

        {/* 3 Causes block: Rendered ONLY if causes exist */}
        {causes.length > 0 && (
          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
            <h4 className="font-bold text-xs text-foreground">סיבות נפוצות לכשל והנחיות לפתרון:</h4>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground pr-1">
              {(causes ?? []).map((cause, i) => (
                <li key={i} className="leading-relaxed">
                  {cause}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {clearStatus && (
        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs text-center font-medium animate-in fade-in">
          {clearStatus}
        </div>
      )}
    </div>
  );
}

export default ConnectionDiagnostic;
