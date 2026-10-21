import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  auditNote,
  fmtDate,
  ils,
  noteTotal,
  driverOf,
  SPREADSHEET_URL,
  SPREADSHEET_ID,
  TAB_GALYA_ARCHIVE,
} from "@/lib/data";
import { useLiveSheetData } from "@/lib/sheet-data";
import { PageHeader, StatusPill } from "@/components/AppShell";
import { ScanSplitterModal } from "./ScanSplitterModal";
import {
  Table as TableIcon,
  LayoutGrid,
  ExternalLink,
  Search,
  FileText,
  Layers,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export function NotesArchive() {
  const [q, setQ] = useState(() => {
    if (typeof window !== "undefined") {
      const urlQ = new URLSearchParams(window.location.search).get("q");
      if (urlQ) return urlQ;
    }
    return "";
  });
  const [viewMode, setViewMode] = useState<"cards" | "sheet">("cards");
  const { notes: liveNotes, isLoading, isLive, lastSync, refresh } = useLiveSheetData();

  const searchFilter = (q || "").trim().toLowerCase();
  const list = currentNotes.filter(
    (n) =>
      !searchFilter ||
      [n.customer, n.id, n.yard, n.date, n.customerNo, n.comaxOrder, n.site]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchFilter),
  );

  const handleRefresh = async () => {
    try {
      await refresh();
      toast.success("הנתונים סונכרנו בהצלחה מגיליון Google Sheets 🟢");
    } catch {
      toast.error("שגיאה בסנכרון מול הגיליון");
    }
  };

  return (
    <>
      <PageHeader
        title="ארכיון תעודות משלוח"
        subtitle="נתונים חיים מגיליון · סריקות גליה ופיצול ישיר"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
              title="רענן נתונים ישירות מהגיליון"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-primary ${isLoading ? "animate-spin" : ""}`}
              />
              <span>{isLoading ? "מסנכרן..." : "רענן מגיליון"}</span>
            </button>
            <ScanSplitterModal />
            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
              גיליון ראשי
            </a>
          </div>
        }
      />

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-8">
        {/* Live sync banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-xs text-muted-foreground shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-foreground">נתונים חיים מגיליון סבן:</span>
            <span>{currentNotes.length} תעודות משלוח מאומתות</span>
            {lastSync && <span>· סנכרון אחרון: {lastSync}</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>סנכרון פעיל (טאב {TAB_GALYA_ARCHIVE})</span>
          </div>
        </div>

        {/* Top Controls: Search + View Switcher */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש לפי לקוח / מספר תעודה / הזמנת קומקס / מחסן / אתר"
              className="w-full rounded-2xl border bg-card py-2.5 pr-10 pl-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-1 self-end rounded-2xl border bg-muted/40 p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                viewMode === "cards" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> כרטיסים מהירים
            </button>
            <button
              onClick={() => setViewMode("sheet")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                viewMode === "sheet" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" /> טאב 1: {TAB_GALYA_ARCHIVE}
            </button>
          </div>
        </div>

        {/* View Mode 1: Cards */}
        {list.length === 0 ? (
          <div className="rounded-3xl border bg-card p-12 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3">
              <FileText className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {q ? "לא נמצאו תעודות התואמות לחיפוש" : "אין תעודות משלוח בגיליון כרגע"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              {q
                ? "נסה לשנות את מילת החיפוש או לנקות את שדה החיפוש."
                : `המערכת מסונכרנת בזמן אמת מול טאב "${TAB_GALYA_ARCHIVE}". תעודות חדשות שנסרקות ע״י גליה יופיעו כאן מיד.`}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition hover:opacity-95"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>{isLoading ? "מסנכרן..." : "רענן מגיליון"}</span>
              </button>
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="rounded-2xl border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
                >
                  נקה חיפוש
                </button>
              )}
            </div>
          </div>
        ) : viewMode === "cards" ? (
          <div className="space-y-3">
            {list.map((n) => {
              const audit = auditNote(n);
              return (
                <Link
                  key={n.id}
                  to="/notes/$id"
                  params={{ id: n.id }}
                  className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card transition hover:border-primary/50 sm:flex-row sm:items-center"
                >
                  {n.scans?.[0] && !n.scans[0].includes("drive.google.com") && (
                    <img
                      src={n.scans[0]}
                      alt=""
                      loading="lazy"
                      className="h-24 w-20 shrink-0 rounded-xl border object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.style.display = "none";
                      }}
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">ת.מ. {n.id}</span>
                      <span>·</span>
                      <span>הזמנה: {n.comaxOrder}</span>
                      <span>·</span>
                      <span>{fmtDate(n.date)}</span>
                      <span>·</span>
                      <span>{n.yard}</span>
                      <span>·</span>
                      <span>נהג: {driverOf(n.driverId).name}</span>
                    </div>
                    <div className="font-display text-lg font-bold">{n.customer}</div>
                    <div className="text-xs text-muted-foreground">{n.site}</div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="font-display text-base font-bold text-primary">
                        {ils(noteTotal(n))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {n.items.length} שורות מוצר
                      </span>
                      {n.filingStatus && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {n.filingStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                    <StatusPill s={audit.status} />
                    <span className="flex items-center gap-1 text-xs font-bold text-primary">
                      <Layers className="h-3.5 w-3.5" /> פתח Delivery Canvas
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* View Mode 2: Full Google Sheet Tab View (A to L columns) */
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span className="font-display font-bold text-sm">
                  מבנה גיליון: {TAB_GALYA_ARCHIVE}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  סנכרון חי מגיליון
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                מזהה גיליון: {SPREADSHEET_ID.slice(0, 16)}...
              </span>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground">
                    <th className="p-3 whitespace-nowrap">A: תאריך ויום</th>
                    <th className="p-3 whitespace-nowrap">B: שם מסמך מקור (גליה)</th>
                    <th className="p-3 whitespace-nowrap">C: מסמך מקור</th>
                    <th className="p-3 whitespace-nowrap">D: כמות בקובץ</th>
                    <th className="p-3 whitespace-nowrap">E: ת.מ.</th>
                    <th className="p-3 whitespace-nowrap">F: בגין הזמנה</th>
                    <th className="p-3 whitespace-nowrap">G: לקוח ומספר</th>
                    <th className="p-3 whitespace-nowrap">H: מחסן</th>
                    <th className="p-3 whitespace-nowrap">I: נהג ומשאית</th>
                    <th className="p-3 whitespace-nowrap">J: כתובת אספקה</th>
                    <th className="p-3 whitespace-nowrap">K: צפייה בתעודה</th>
                    <th className="p-3 whitespace-nowrap">L: סטטוס תיוק</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((n) => {
                    const driver = driverOf(n.driverId);
                    return (
                      <tr key={n.id} className="hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap font-medium">{fmtDate(n.date)}</td>
                        <td className="p-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {n.sourceFileName || "scan-daily.pdf"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {n.sourceFileLink ? (
                            <a
                              href={n.sourceFileLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              📂 מסמך מקור
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">{n.items.length} פריטים</td>
                        <td className="p-3 whitespace-nowrap font-bold">{n.id}</td>
                        <td className="p-3 whitespace-nowrap font-mono">{n.comaxOrder}</td>
                        <td className="p-3 whitespace-nowrap font-semibold">
                          {n.customer} ({n.customerNo})
                        </td>
                        <td className="p-3 whitespace-nowrap">{n.yard}</td>
                        <td className="p-3 whitespace-nowrap">
                          {driver.name} ({driver.plate})
                        </td>
                        <td className="p-3 whitespace-nowrap max-w-xs truncate">{n.site}</td>
                        <td className="p-3 whitespace-nowrap">
                          <Link
                            to="/notes/$id"
                            params={{ id: n.id }}
                            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                          >
                            <Layers className="h-3 w-3" /> 📄 צפה בתעודה
                          </Link>
                        </td>
                        <td className="p-3 whitespace-nowrap font-medium text-emerald-700">
                          {n.filingStatus || "✅ פוצל ותוייק בתיק לקוח"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
