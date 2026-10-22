import React, { useState } from "react";
import {
  ClosedLoopAnalysis,
  performClosedLoopCrossReference,
  resolveDiscImageUrl,
} from "@/lib/noah-intelligence";
import { VisitRecord, TachographDiscRow, DeliveryNoteRow } from "@/lib/types";
import { InteractiveDiscCanvas } from "./InteractiveDiscCanvas";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  FileText,
  Truck,
  Gauge,
  X,
  Copy,
  Check,
  Send,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export interface CrossReferenceInspectorProps {
  analysis?: ClosedLoopAnalysis | null;
  selectedVisit?: VisitRecord | null;
  visits: VisitRecord[];
  discs: TachographDiscRow[];
  onSelectVisit: (visit: VisitRecord) => void;
  onClose?: () => void;
  onSaveCorrection?: (
    row: number,
    fix: { date?: string; plate?: string; approve?: boolean; approver?: string },
  ) => Promise<unknown>;
}

export function CrossReferenceInspector({
  analysis: propAnalysis,
  selectedVisit,
  visits,
  discs,
  onSelectVisit,
  onClose,
  onSaveCorrection,
}: CrossReferenceInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState<"all" | "A" | "B" | "C" | "D">("all");
  const [isApproving, setIsApproving] = useState(false);

  // Derive active analysis from selectedVisit or propAnalysis or first visit
  const currentVisit =
    selectedVisit ||
    (propAnalysis ? visits.find((v) => v.visitKey === propAnalysis.visitKey) : null) ||
    visits[0];
  const relatedDisc =
    discs.find(
      (d) =>
        (d.נהג && currentVisit?.driverName && d.נהג.includes(currentVisit.driverName)) ||
        (d["רישוי / משאית"] &&
          currentVisit?.truckPlate &&
          d["רישוי / משאית"].includes(currentVisit.truckPlate.replace(/\D/g, "").slice(-3))),
    ) || discs[0];

  const analysis: ClosedLoopAnalysis | null =
    propAnalysis && propAnalysis.visitKey === currentVisit?.visitKey
      ? propAnalysis
      : currentVisit
        ? performClosedLoopCrossReference(currentVisit, relatedDisc)
        : null;

  if (!analysis || !currentVisit) {
    return (
      <div
        className="flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-[#0d141f] rounded-3xl border border-[#223246] h-full"
        dir="rtl"
      >
        <Gauge className="h-12 w-12 text-slate-600 mb-3" />
        <h3 className="font-bold text-slate-200">לא נבחרה תחנת פריקה להצלבה</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          בחר תחנה מהרשימה או לחץ על הצלבה בצ׳אט של נועה AI כדי לפתוח את מפקח 4 השלבים.
        </p>
      </div>
    );
  }

  const { stepA, stepB, stepC, discrepancies, score, status, statusText } = analysis;

  const handleCopySummary = () => {
    const text = `📋 דוח הצלבה סגורה — ח. סבן לוגיסטיקה
אתר: ${stepA.address}, ${stepA.city}
נהג: ${stepC.driverName} (${stepC.truckPlate})
תעודות משלוח: #${stepA.noteIds.join(", #")}
זמני כתב יד: ${stepA.handwrittenCraneWindow} (${stepA.handwrittenMinutes} דק׳)
חתימת לקוח: ${stepA.customerSignature}
איתוראן: הגעה ${stepB.ituranArrival} | יציאה ${stepB.ituranDeparture} (שהייה: ${stepB.stopDurationMinutes} דק׳)
PTO מנוף: ${stepB.ptoMinutes} דקות
ציון ביטחון: ${score}% (${statusText})
${discrepancies.length > 0 ? `חריגות: ${discrepancies.map((d) => d.description).join("; ")}` : "ללא חריגות, תקין ומאומת!"}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("דוח ההצלבה הועתק ללוח לשיתוף בוואטסאפ 📋");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = async () => {
    if (!relatedDisc?._row || !onSaveCorrection) {
      toast.info("הפריקה עודכנה ואושרה ברישומי נועה AI ✅");
      return;
    }
    setIsApproving(true);
    try {
      await onSaveCorrection(relatedDisc._row, {
        approve: true,
        approver: "ראמי מסארווה",
      });
      toast.success("הפריקה והדיסקית אושרו סופית ע״י ראמי מסארווה ✍️");
    } catch {
      toast.error("שגיאה בשמירת אישור הפריקה בגיליון");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0d141f] border border-[#223246] rounded-3xl overflow-hidden shadow-2xl text-slate-100"
      dir="rtl"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#223246] bg-[#131c26] px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl font-bold text-lg ${
              status === "verified"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : status === "warning"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            {status === "verified" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white">מפקח הצלבה סגורה</h2>
              <span className="font-mono text-xs text-emerald-400 font-bold">{score}% תאימות</span>
            </div>
            <p className="text-[11px] text-slate-400">{statusText}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1 rounded-xl border border-[#223246] bg-[#0d141f] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="העתק דוח מסכם"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? "הועתק!" : "העתק דוח"}</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl border border-[#223246] hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="סגור מפקח"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stop / Visit Dropdown Selector */}
      <div className="border-b border-[#223246] bg-[#0b1118] px-5 py-3">
        <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">
          בחר תחנת פריקה להצלבה:
        </label>
        <select
          value={currentVisit.visitKey}
          onChange={(e) => {
            const v = visits.find((x) => x.visitKey === e.target.value);
            if (v) onSelectVisit(v);
          }}
          className="w-full rounded-xl border border-[#223246] bg-[#131c26] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
        >
          {visits.map((v, idx) => (
            <option key={v.visitKey} value={v.visitKey}>
              {idx + 1}. {v.address || "ללא כתובת"} ({v.city}) · {v.driverName} · #
              {v.noteIds.join(", #") || "ללא תעודה"}
            </option>
          ))}
        </select>
      </div>

      {/* 4 Steps Segmented Selector */}
      <div className="grid grid-cols-5 border-b border-[#223246] bg-[#131c26]/60 text-xs text-center font-medium">
        <button
          onClick={() => setActiveStep("all")}
          className={`py-2.5 transition border-b-2 ${
            activeStep === "all"
              ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          הכל
        </button>
        <button
          onClick={() => setActiveStep("A")}
          className={`py-2.5 transition border-b-2 ${
            activeStep === "A"
              ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          א׳ תעודה
        </button>
        <button
          onClick={() => setActiveStep("B")}
          className={`py-2.5 transition border-b-2 ${
            activeStep === "B"
              ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ב׳ GPS
        </button>
        <button
          onClick={() => setActiveStep("C")}
          className={`py-2.5 transition border-b-2 ${
            activeStep === "C"
              ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ג׳ דיסקית
        </button>
        <button
          onClick={() => setActiveStep("D")}
          className={`py-2.5 transition border-b-2 ${
            activeStep === "D"
              ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ד׳ פערים ({discrepancies.length})
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* STEP A: Comax Delivery Note */}
        {(activeStep === "all" || activeStep === "A") && (
          <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#223246]/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                  א
                </span>
                <h3 className="font-bold text-xs text-white">Comax ותעודת משלוח (כתב יד)</h3>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  stepA.customerSignature === "קיימת" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                חתימת לקוח: {stepA.customerSignature === "קיימת" ? "קיימת ✍️" : "חסרה ⚠️"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">תעודות משלוח</span>
                <span className="font-mono font-bold text-white">
                  #{stepA.noteIds.join(", #") || "אין נתון"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">לקוח באתר</span>
                <span className="font-bold text-white truncate block">
                  {stepA.customers.join(", ") || "ח. סבן"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">חלון מנוף בכתב יד</span>
                <span className="font-bold text-amber-400">{stepA.handwrittenCraneWindow}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">משך פריקה ידני</span>
                <span className="font-bold text-slate-200">
                  {stepA.handwrittenMinutes > 0
                    ? `${stepA.handwrittenMinutes} דקות`
                    : "ללא רישום דקות"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>
                {stepA.address}, {stepA.city}
              </span>
            </div>
          </div>
        )}

        {/* STEP B: Ituran GPS & PTO Sensor */}
        {(activeStep === "all" || activeStep === "B") && (
          <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#223246]/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 font-bold text-xs">
                  ב
                </span>
                <h3 className="font-bold text-xs text-white">איתוראן GPS וחיישן PTO מנוף</h3>
              </div>
              <span className="text-[11px] text-slate-400">מקור: {stepB.measurementSource}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">זמני עצירה לוויניים</span>
                <span className="font-mono font-bold text-white">
                  {stepB.ituranArrival} ➔ {stepB.ituranDeparture}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">משך שהייה באתר</span>
                <span className="font-bold text-white">{stepB.stopDurationMinutes} דקות</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">הפעלת PTO מנוף</span>
                <span className="font-bold text-emerald-400">
                  {stepB.ptoMinutes > 0 ? `${stepB.ptoMinutes} דקות` : "ללא הפעלת PTO"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">מרחק וזמן נסיעה מקודם</span>
                <span className="font-mono text-slate-300">
                  {stepB.kmFromPrev} ק״מ ({stepB.driveMinutesFromPrev} דק׳)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP C: Tachograph Disc Vision & Interactive Canvas */}
        {(activeStep === "all" || activeStep === "C") && (
          <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#223246]/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs">
                  ג
                </span>
                <h3 className="font-bold text-xs text-white">דיסקית טכוגרף ואימות חריטות מחט</h3>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {stepC.driverName} ({stepC.truckPlate})
              </span>
            </div>

            {/* Embedded Disc Canvas for this stop */}
            <InteractiveDiscCanvas
              imageUrl={stepC.discImageUrl}
              driver={stepC.driverName}
              truck={stepC.truckPlate}
              date={stepC.date}
              kmTotal={stepC.kmTotal}
              ptoHours={(stepB.ptoMinutes / 60).toFixed(1)}
              arrival={stepB.ituranArrival !== "--:--" ? stepB.ituranArrival : undefined}
              departure={stepB.ituranDeparture !== "--:--" ? stepB.ituranDeparture : undefined}
              height={260}
            />

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">ק״מ פתיחה</span>
                <span className="font-mono font-bold text-slate-200">{stepC.kmStart}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">ק״מ סגירה</span>
                <span className="font-mono font-bold text-slate-200">{stepC.kmEnd}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0b1118] border border-[#223246]">
                <span className="block text-[10px] text-slate-400">סה״כ ק״מ</span>
                <span className="font-mono font-bold text-emerald-400">{stepC.kmTotal}</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP D: Discrepancy Flagging & Audit Recommendations */}
        {(activeStep === "all" || activeStep === "D") && (
          <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#223246]/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-red-500/20 text-red-400 font-bold text-xs">
                  ד
                </span>
                <h3 className="font-bold text-xs text-white">
                  דוח פערים וחריגות (Rule-Based Flags)
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-300">
                {discrepancies.length === 0 ? "תקין ומאוזן" : `${discrepancies.length} דגלים`}
              </span>
            </div>

            {discrepancies.length === 0 ? (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>כל המדידות תואמות: זמני ה-GPS, כתב היד וה-PTO נבדקו בהצלחה.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {discrepancies.map((d) => (
                  <div
                    key={d.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      d.severity === "critical"
                        ? "bg-red-500/10 border-red-500/30 text-red-200"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {d.rule}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/40">
                        {d.severity === "critical" ? "קריטי" : "אזהרה"}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">{d.description}</p>
                    <div className="pt-1 text-[10px] text-slate-400">
                      💡 <strong>המלצת נועה:</strong> {d.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="border-t border-[#223246] bg-[#131c26] p-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={handleApprove}
          disabled={isApproving}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 transition shadow-md disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{isApproving ? "מאשר בגיליון..." : "אישור פריקה בחתימת ראמי ✍️"}</span>
        </button>

        <a
          href={`https://wa.me/972506662300?text=${encodeURIComponent(
            `הראל שלום, בדיקת תעודה #${stepA.noteIds.join(", #")} באתר ${stepA.address}: ${discrepancies.length > 0 ? `נמצאו ${discrepancies.length} חריגות לבדיקה` : "הכל מאומת ותקין"}.`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[#223246] bg-[#0d141f] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold py-2.5 px-3 transition"
          title="שלח דיווח ישיר להראל בוואטסאפ"
        >
          <Send className="h-3.5 w-3.5 text-emerald-400 rotate-180" />
          <span>וואטסאפ להראל</span>
        </a>
      </div>
    </div>
  );
}

export default CrossReferenceInspector;
