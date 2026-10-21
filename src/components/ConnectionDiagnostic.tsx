'use client';

import React, { useState } from 'react';
import { ConnectionDiagnostic as DiagnosticType } from '@/types/api';

interface Props {
  error: string;
  diagnostics?: DiagnosticType;
  onRetry: () => void;
}

export default function ConnectionDiagnosticView({ error, diagnostics, onRetry }: Props) {
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/backend?action=clear-cache', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setClearStatus('הזיכרון הזמני נוקה בהצלחה. בודק מחדש...');
        setTimeout(() => {
          onRetry();
        }, 800);
      } else {
        setClearStatus('שגיאה בניקוי זיכרון מטמון');
      }
    } catch (e) {
      setClearStatus('תקלה בבקשת ניקוי הזיכרון');
    } finally {
      setClearing(false);
    }
  };

  // חילוץ בטוח של רשימת הסיבות עם הגנה מפני undefined
  const reasonsList = diagnostics?.reasons || [
    'כתובת הפריסה (APPS_SCRIPT_URL) שונתה או אינה מצביעה על גרסה עדכנית של ה-Web App.',
    'הרשאות הגישה ב-Apps Script אינן מוגדרות כ-"Anyone" (דורש גישה ציבורית ללא התחברות לחשבון).',
    'פונקציית doGet ב-Apps Script מחזירה פלט HTML של שגיאת מערכת במקום אובייקט JSON תקני.'
  ];

  return (
    <div dir="rtl" className="max-w-3xl mx-auto my-8 p-6 bg-card border border-red-600/50 rounded-2xl shadow-lg text-card-foreground">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xl">!</div>
        <div>
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400">בעיית חיבור לגיליון הנתונים</h2>
          <p className="text-sm text-muted-foreground">{error || 'תקלת תקשורת מול השרת'}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-muted/40 rounded-xl border border-border">
            <span className="block text-xs text-muted-foreground">מארח היעד (Host)</span>
            <strong className="font-mono text-xs truncate block">{diagnostics?.appsScriptHost || diagnostics?.host || 'Google Apps Script'}</strong>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl border border-border">
            <span className="block text-xs text-muted-foreground">קוד סטטוס HTTP</span>
            <strong className="font-mono text-xs">{diagnostics?.httpStatus || diagnostics?.status || '500 / שגיאה'}</strong>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl border border-border">
            <span className="block text-xs text-muted-foreground">סוג תוכן (Content-Type)</span>
            <strong className="font-mono text-xs truncate block">{diagnostics?.contentType || 'application/json'}</strong>
          </div>
        </div>

        {diagnostics?.first200Chars && (
          <div>
            <h4 className="font-bold mb-2 text-xs text-muted-foreground">תוכן התשובה מהשרת (Raw Snippet):</h4>
            <pre className="p-3 bg-black text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap dir-ltr text-left border border-border">
              {diagnostics.first200Chars}
            </pre>
          </div>
        )}

        <div>
          <h4 className="font-bold mb-2 text-xs">סיבות נפוצות לכשל והנחיות לפתרון:</h4>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            {reasonsList.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      {clearStatus && (
        <div className="mt-4 p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs text-center font-medium">
          {clearStatus}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 pt-4 border-t border-border">
        <button
          onClick={onRetry}
          className="px-5 py-2.5 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm font-semibold transition-all shadow"
        >
          בדוק שוב עכשיו
        </button>
        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="px-5 py-2.5 bg-transparent border border-border hover:bg-muted text-foreground rounded-xl text-sm font-semibold transition-all"
        >
          {clearing ? 'מנקה זיכרון...' : 'נקה זיכרון מטמון (Cache)'}
        </button>
      </div>
    </div>
  );
}