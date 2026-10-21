import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  FileText,
  Gauge,
  CheckCircle2,
  ExternalLink,
  Upload,
  Play,
  Layers,
  ArrowRight,
  Database,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  processDailyScan,
  type SplitResult,
  SPREADSHEET_URL,
  SPREADSHEET_ID,
  TAB_GALYA_ARCHIVE,
  TAB_TACHOGRAPH,
} from "@/lib/pdf-splitter";
import { PDFDocument } from "pdf-lib";

export function ScanSplitterModal({ triggerButton }: { triggerButton?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<number>(0);
  const [result, setResult] = useState<SplitResult | null>(null);
  const [fileName, setFileName] = useState("scan12026-10-14-081059.pdf");
  const [scanDate, setScanDate] = useState("14/10/2026");

  const runSplitPipeline = async () => {
    setLoading(true);
    setStep(1);
    try {
      // Create a real multi-page PDF document with pdf-lib to test splitting (5 pages: 4 delivery notes + 1 tachograph disc)
      const doc = await PDFDocument.create();
      for (let i = 0; i < 5; i++) {
        const p = doc.addPage([595, 842]);
        p.drawText(
          i === 4
            ? "H. Saban Logistics - Tachograph Disc Page 5 (Driver Hikmat)"
            : `H. Saban Logistics - Delivery Note Page ${i + 1}`,
          { x: 50, y: 800, size: 14 },
        );
      }
      const pdfBytes = await doc.save();

      setStep(2);
      await new Promise((r) => setTimeout(r, 600));
      setStep(3);
      await new Promise((r) => setTimeout(r, 600));

      const res = await processDailyScan(pdfBytes, fileName, scanDate);
      setStep(4);
      await new Promise((r) => setTimeout(r, 500));
      setStep(5);

      setResult(res);
      toast.success(
        `הפיצול הושלם בהצלחה! ${res.notesCount} תעודות ודיסקית טכוגרף אחת הוזרקו לגיליון.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בהרצת סקריפט הפיצול");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton ?? (
          <button className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:opacity-90">
            <Upload className="h-4 w-4" /> סריקה ופיצול יומי (גליה)
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-xs">
            <Sparkles className="h-4 w-4" /> מנוע קליטה, פיצול והזרקה
          </div>
          <DialogTitle className="text-xl md:text-2xl font-bold">
            פיצול סריקה יומית מגליה והזרקה לגיליון
          </DialogTitle>
          <DialogDescription>
            קובץ סריקה מרוכז מפוצל אוטומטית: עמודים 1 עד N-1 נשמרים כתעודות משלוח, והעמוד האחרון
            מנותח כדיסקית טכוגרף.
          </DialogDescription>
        </DialogHeader>

        {/* Workflow Diagram */}
        <div className="rounded-2xl border bg-muted/40 p-4">
          <div className="text-xs font-bold text-muted-foreground mb-3">ארכיטקטורת התהליך:</div>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
            <div
              className={`rounded-xl border p-2.5 ${step === 1 ? "border-primary bg-primary/10 font-bold" : "bg-card"}`}
            >
              <div className="text-muted-foreground">1. קובץ יומי</div>
              <div className="mt-1 truncate font-semibold">סריקה מרוכזת PDF</div>
            </div>
            <div
              className={`rounded-xl border p-2.5 ${step === 2 ? "border-primary bg-primary/10 font-bold" : "bg-card"}`}
            >
              <div className="text-muted-foreground">2. מנוע פיצול</div>
              <div className="mt-1 font-semibold">1..N-1 תעודות | N טכוגרף</div>
            </div>
            <div
              className={`rounded-xl border p-2.5 ${step === 3 ? "border-primary bg-primary/10 font-bold" : "bg-card"}`}
            >
              <div className="text-muted-foreground">3. OCR ו-Drive</div>
              <div className="mt-1 font-semibold">תיקיות לקוח וארכיון</div>
            </div>
            <div
              className={`rounded-xl border p-2.5 ${step === 4 ? "border-primary bg-primary/10 font-bold" : "bg-card"}`}
            >
              <div className="text-muted-foreground">4. הזרקה לגיליון</div>
              <div className="mt-1 font-semibold">טאב 1 וטאב 2</div>
            </div>
            <div
              className={`rounded-xl border p-2.5 ${step === 5 ? "border-primary bg-primary/10 font-bold" : "bg-card"}`}
            >
              <div className="text-muted-foreground">5. Delivery Canvas</div>
              <div className="mt-1 font-semibold">שכבות וחתימות</div>
            </div>
          </div>
        </div>

        {/* File Config Box */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground">
              שם קובץ מקור (מייל גליה)
            </label>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">תאריך סריקה</label>
            <input
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runSplitPipeline}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>מפצל ומזריק נתונים...</>
              ) : (
                <>
                  <Play className="h-4 w-4" /> הרץ פיצול והזרקה
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Sheet Integration Banner */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Database className="h-4 w-4 text-emerald-600" />
            <span>
              גיליון היעד: <b>בדיקת תעודות משלוח</b> ({SPREADSHEET_ID.slice(0, 12)}...)
            </span>
          </div>
          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            פתח גיליון Google Sheets <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Results Area */}
        {result && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              <span>הסריקה פוצלה בהצלחה ל-2 מסלולים:</span>
            </div>

            {/* Tab 1 Output Preview */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>
                    טאב 1: {TAB_GALYA_ARCHIVE} ({result.notesCount} תעודות משלוח)
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">עמודות A עד L</span>
              </div>
              <div className="mt-3 overflow-x-auto text-xs">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground">
                      <th className="p-2">תאריך</th>
                      <th className="p-2">ת.מ.</th>
                      <th className="p-2">הזמנה</th>
                      <th className="p-2">לקוח</th>
                      <th className="p-2">מחסן</th>
                      <th className="p-2">נהג</th>
                      <th className="p-2">צפייה ב-Canvas</th>
                      <th className="p-2">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.notesRows.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/30">
                        <td className="p-2">{row[0]}</td>
                        <td className="p-2 font-bold">{row[4]}</td>
                        <td className="p-2">{row[5]}</td>
                        <td className="p-2 font-semibold">{row[6]}</td>
                        <td className="p-2">{row[7]}</td>
                        <td className="p-2">{row[8]}</td>
                        <td className="p-2">
                          <Link
                            to="/notes/$id"
                            params={{ id: String(row[4]) }}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                          >
                            <Layers className="h-3 w-3" /> פתח תעודה
                          </Link>
                        </td>
                        <td className="p-2 text-emerald-700 font-medium">{row[11]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tab 2 Output Preview */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Gauge className="h-4 w-4 text-amber-600" />
                  <span>טאב 2: {TAB_TACHOGRAPH} (דיסקית טכוגרף עמוד אחרון N)</span>
                </div>
                <span className="text-xs text-muted-foreground">עמודות A עד K</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-muted-foreground">נהג ומשאית:</div>
                  <div className="font-bold text-sm">{result.tachoRow[1]}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-muted-foreground">מד אוץ (התחלה / סיום):</div>
                  <div className="font-bold text-sm">
                    {result.tachoRow[3]} ➔ {result.tachoRow[4]}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-muted-foreground">סה״כ ק״מ יומי:</div>
                  <div className="font-bold text-sm text-primary">{result.tachoRow[5]}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-muted-foreground">זמן מנוף PTO:</div>
                  <div className="font-bold text-sm text-amber-700">{result.tachoRow[6]}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2">
                <div className="text-xs font-semibold text-emerald-700">
                  {result.tachoRow[9]} · {result.tachoRow[10]}
                </div>
                <Link
                  to="/ituran"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  מעבר לצפייה בדיסקית הטכוגרף <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
