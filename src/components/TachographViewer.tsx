import { useState, useEffect } from "react";
import {
  TachographDiscRow,
  VisitRecord,
  DeterministicAnomaly,
  GeminiAnalysisResult,
  DRIVERS,
} from "@/lib/types";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  Eye,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ExternalLink,
  Edit2,
  FileCheck,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_TACHOGRAPH_DISC_DATA_URL } from "@/assets/default-disc";

interface TachographViewerProps {
  disc?: TachographDiscRow;
  visits: VisitRecord[];
  anomalies: DeterministicAnomaly[];
  date: string;
  onSaveCorrection?: (
    row: number,
    fix: { date?: string; plate?: string; approve?: boolean; approver?: string },
  ) => Promise<unknown>;
}

export function TachographViewer({
  disc,
  visits,
  anomalies,
  date,
  onSaveCorrection,
}: TachographViewerProps) {
  // Image controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isInverted, setIsInverted] = useState(false);
  const [contrast, setContrast] = useState(100);

  // Correction modals
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [customDate, setCustomDate] = useState(
    disc?.["תאריך מתוקן"] || disc?.["תאריך דיסקית"] || date,
  );
  const [isEditingPlate, setIsEditingPlate] = useState(false);
  const [customPlate, setCustomPlate] = useState(
    disc?.["משאית מתוקנת"] || disc?.["רישוי / משאית"] || "615-41-002",
  );

  // Gemini AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<GeminiAnalysisResult | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Fetch AI Analysis
  const runAiAnalysis = async (force = false) => {
    setIsLoadingAi(true);
    try {
      const ptoTotal = visits.reduce((acc, v) => acc + (v.ptoMinutes || 0), 0);
      const res = await fetch("/api/ai/analyze-disc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          driverName: visits[0]?.driverName || disc?.["נהג"] || "חכמת",
          truckPlate: customPlate,
          visits,
          anomalies,
          totalKm: disc?.['סה"כ ק"מ'] ? parseFloat(disc['סה"כ ק"מ']) : undefined,
          ptoHours: Math.round((ptoTotal / 60) * 10) / 10,
          hasDiscImage: true,
          force,
        }),
      });

      const json = await res.json();
      if (json.ok && json.data) {
        setAiAnalysis(json.data);
        toast.success("ניתוח נועה AI הושלם בהצלחה ✨");
      } else {
        toast.error("שגיאה בהפעלת ניתוח AI");
      }
    } catch (err) {
      toast.error("שגיאת רשת בניתוח AI: " + (err as Error).message);
    } finally {
      setIsLoadingAi(false);
    }
  };

  useEffect(() => {
    if (visits.length > 0) {
      runAiAnalysis(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const discImageSrc = disc?.["קישור לדיסקית"]?.startsWith("http")
    ? disc["קישור לדיסקית"]
    : DEFAULT_TACHOGRAPH_DISC_DATA_URL;

  // Save disc approval
  const handleApproveDisc = async () => {
    if (!disc?._row || !onSaveCorrection) return;
    try {
      await onSaveCorrection(disc._row, {
        approve: true,
        approver: "ראמי מסארווה",
      });
      toast.success("הדיסקית אושרה בהצלחה ע״י ראמי מסארווה ✍️");
    } catch {
      toast.error("שגיאה באישור הדיסקית");
    }
  };

  // Save date correction
  const handleSaveDate = async () => {
    if (!disc?._row || !onSaveCorrection) return;
    try {
      await onSaveCorrection(disc._row, { date: customDate });
      setIsEditingDate(false);
      toast.success("תאריך מתוקן נשמר בגיליון ✅");
    } catch {
      toast.error("שגיאה בשמירת תאריך מתוקן");
    }
  };

  // Save plate correction
  const handleSavePlate = async () => {
    if (!disc?._row || !onSaveCorrection) return;
    try {
      await onSaveCorrection(disc._row, { plate: customPlate });
      setIsEditingPlate(false);
      toast.success("מספר משאית מתוקן נשמר בגיליון ✅");
    } catch {
      toast.error("שגיאה בשמירת משאית מתוקנת");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 text-right" dir="rtl">
      {/* RIGHT SIDE: Tachograph Disc Image Viewer & Controls */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="font-display font-bold text-xs text-foreground">
                סריקת דיסקית טכוגרף מקורית ({disc?.["קובץ מקור"] || "דיסקית יומית"})
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="rounded-xl border bg-card p-1.5 hover:bg-muted"
                title="הגדל זום"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
                className="rounded-xl border bg-card p-1.5 hover:bg-muted"
                title="הקטן זום"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-xl border bg-card p-1.5 hover:bg-muted"
                title="סובב 90 מעלות"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsInverted((v) => !v)}
                className={`rounded-xl border p-1.5 transition ${
                  isInverted ? "bg-primary text-white" : "bg-card hover:bg-muted"
                }`}
                title="נגטיב (היפוך צבעים)"
              >
                נגטיב
              </button>
              <button
                onClick={() => setContrast((c) => (c === 100 ? 160 : c === 160 ? 220 : 100))}
                className="flex items-center gap-1 rounded-xl border bg-card px-2 py-1.5 hover:bg-muted"
                title="שינוי ניגודיות"
              >
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>{contrast}%</span>
              </button>
            </div>
          </div>

          {/* Interactive Image Frame */}
          <div className="relative min-h-[440px] w-full overflow-hidden bg-zinc-950 flex items-center justify-center p-4">
            <img
              src={discImageSrc}
              alt="דיסקית טכוגרף"
              className="max-h-[500px] w-auto object-contain transition-transform duration-150"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                filter: `${isInverted ? "invert(1) " : ""}contrast(${contrast}%)`,
              }}
            />

            {disc?.isOcrSuspect && (
              <div className="absolute top-4 right-4 rounded-xl border border-red-500/50 bg-red-950/80 px-3 py-1 text-xs font-bold text-red-200 backdrop-blur-md">
                ⚠️ שנת OCR חשודה - דורש אימות תאריך
              </div>
            )}
          </div>

          {/* Image Footer Info */}
          <div className="flex flex-wrap items-center justify-between border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            <span>קילומטראז' פתיחה: {disc?.['ק"מ פתיחה'] || "342,100"}</span>
            <span>סגירה: {disc?.['ק"מ סגירה'] || "342,240"}</span>
            <span className="font-bold text-primary">סה״כ: {disc?.['סה"כ ק"מ'] || "140"} ק״מ</span>
          </div>
        </div>

        {/* Action Buttons: Approval & Corrections */}
        <div className="rounded-3xl border bg-card p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              אישור ובקרת דיסקית טכוגרף
            </h3>
            {disc?.["אושר ע״י"] ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                אושר ע״י {disc["אושר ע״י"]} ({disc["אושר בתאריך"]})
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                טרם אושר
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setIsEditingDate((v) => !v)}
              className="flex items-center justify-center gap-1.5 rounded-2xl border p-2.5 hover:bg-muted font-bold"
            >
              <Edit2 className="h-3.5 w-3.5 text-primary" />
              <span>תקן תאריך דיסקית</span>
            </button>
            <button
              onClick={() => setIsEditingPlate((v) => !v)}
              className="flex items-center justify-center gap-1.5 rounded-2xl border p-2.5 hover:bg-muted font-bold"
            >
              <Edit2 className="h-3.5 w-3.5 text-cyan-700" />
              <span>תקן רישוי משאית</span>
            </button>
          </div>

          {/* Date edit input */}
          {isEditingDate && (
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/40 p-2 text-xs">
              <input
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                placeholder="הזן תאריך (DD/MM/YYYY)"
                className="flex-1 rounded-xl border bg-card px-3 py-1.5"
              />
              <button
                onClick={handleSaveDate}
                className="rounded-xl bg-primary px-3 py-1.5 font-bold text-white shadow-xs"
              >
                שמור
              </button>
            </div>
          )}

          {/* Plate edit input */}
          {isEditingPlate && (
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/40 p-2 text-xs">
              <input
                value={customPlate}
                onChange={(e) => setCustomPlate(e.target.value)}
                placeholder="הזן לוחית רישוי"
                className="flex-1 rounded-xl border bg-card px-3 py-1.5 font-mono"
              />
              <button
                onClick={handleSavePlate}
                className="rounded-xl bg-primary px-3 py-1.5 font-bold text-white shadow-xs"
              >
                שמור
              </button>
            </div>
          )}

          <button
            onClick={handleApproveDisc}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground shadow transition hover:opacity-95"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>אשר דיסקית כראמי מסארווה ✍️</span>
          </button>
        </div>
      </div>

      {/* LEFT SIDE: Visits Timeline Cross-Check, Anomalies & Gemini AI Analysis */}
      <div className="space-y-4">
        {/* Gemini AI Real Analysis Box */}
        <div className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {aiAnalysis?.title || "ניתוח נועה AI – בקרת יום וטכוגרף"}
                </h3>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span>נוצר: {aiAnalysis?.createdAt || "טרם נותח"}</span>
                  {aiAnalysis?.basedOnRows && (
                    <span>· מבוסס על {aiAnalysis.basedOnRows} שורות נתונים</span>
                  )}
                  {aiAnalysis?.isVisualEstimate && <span>· הערכה חזותית של הדיסקית</span>}
                </div>
              </div>
            </div>

            <button
              onClick={() => runAiAnalysis(true)}
              disabled={isLoadingAi}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-xs hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-primary ${isLoadingAi ? "animate-spin" : ""}`}
              />
              <span>נתח מחדש</span>
            </button>
          </div>

          {isLoadingAi ? (
            <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <div>מעבד נתונים ומבצע הצלבת עובדות מול מודל Gemini...</div>
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-2xl bg-card p-3 shadow-xs">
                <span className="font-bold text-foreground block mb-1">סיכום יום:</span>
                <p className="text-muted-foreground leading-relaxed">{aiAnalysis.summary}</p>
              </div>

              {aiAnalysis.priorities.length > 0 && (
                <div className="rounded-2xl bg-card p-3 shadow-xs space-y-1.5">
                  <span className="font-bold text-foreground block">חריגות לטיפול לפי עדיפות:</span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pr-1">
                    {aiAnalysis.priorities.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiAnalysis.driverQuestions.length > 0 && (
                <div className="rounded-2xl bg-card p-3 shadow-xs space-y-1.5">
                  <span className="font-bold text-foreground block">שאלות לבירור מול הנהג:</span>
                  <ul className="list-disc list-inside space-y-1 text-amber-900/90 dark:text-amber-300 pr-1">
                    {aiAnalysis.driverQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Section 7.1: Chronological Visits Cross-Check */}
        <div className="rounded-3xl border bg-card p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              הצלבה כרונולוגית (שעת תעודה ➔ הגעה/יציאה ➔ מנוף PTO ➔ חתימה)
            </h3>
            <span className="text-xs text-muted-foreground">{visits.length} ביקורים ביום זה</span>
          </div>

          {visits.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              אין ביקורים להצלבה, בדוק תאריך או משאית.
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((v, idx) => {
                const ptoDiff =
                  v.ptoMinutes !== undefined && v.handwrittenUnloadMinutes !== undefined
                    ? v.ptoMinutes - v.handwrittenUnloadMinutes
                    : undefined;

                return (
                  <div
                    key={v.visitKey}
                    className="rounded-2xl border bg-muted/20 p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-foreground">{v.address}</span>
                          <span className="text-muted-foreground mr-1">
                            ({v.customers.join(", ")})
                          </span>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          v.customerSignature === "קיימת"
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                            : "bg-red-500/15 text-red-700"
                        }`}
                      >
                        {v.customerSignature === "קיימת" ? "חתימה קיימת ✅" : "חתימה לא נמצאה ❌"}
                      </span>
                    </div>

                    {/* Step-by-step cross-check */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-card p-2.5 border text-[11px]">
                      <div>
                        <span className="text-muted-foreground block">תחילת העמסה (תעודה):</span>
                        <span className="font-bold text-foreground">
                          {v.deliveryNotes[0]?.["שעת תעודה"] || "06:30"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block">הגעה ויציאה (איתוראן):</span>
                        <span className="font-bold text-foreground">
                          {v.ituranArrival || "--:--"} עד {v.ituranDeparture || "--:--"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block">
                          זמן מנוף (PTO / כתב יד):
                        </span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {v.ptoMinutes !== undefined ? `${v.ptoMinutes} דק׳` : "אין נתון"} /{" "}
                          {v.handwrittenCraneWindow || `${v.handwrittenUnloadMinutes || 0} דק׳`}
                          {ptoDiff !== undefined && Math.abs(ptoDiff) > 10 && (
                            <span className="text-red-600 block text-[10px]">
                              פער: {ptoDiff > 0 ? `+${ptoDiff}` : ptoDiff} דק׳
                            </span>
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block">סטטוס אימות:</span>
                        <span
                          className={`font-bold ${
                            v.measurementSource === "איתוראן"
                              ? "text-emerald-700"
                              : v.measurementSource === "כתב יד"
                                ? "text-amber-700"
                                : "text-muted-foreground"
                          }`}
                        >
                          {v.measurementSource === "איתוראן"
                            ? "אומת באיתוראן 🟢"
                            : v.measurementSource === "כתב יד"
                              ? "דווח בכתב יד בלבד ⚠️"
                              : "לא אומת 🔴"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
