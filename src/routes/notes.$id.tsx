import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  auditNote,
  ils,
  noteTotal,
  driverOf,
  SPREADSHEET_URL,
  TAB_GALYA_ARCHIVE,
} from "@/lib/data";
import { approvals, useApprovals, playAlert } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/AppShell";
import {
  ExternalLink,
  Layers,
  FolderArchive,
  CheckCircle2,
  FileCheck,
  Building2,
  Truck,
  RotateCcw,
  Package,
  AlertTriangle,
  Download,
  Send,
  MessageCircle,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { fetchLiveDeliveriesAndOrders, getSheetDataSnapshot } from "@/lib/sheet-data";
import { extractDriveFileId } from "@/lib/scan-proxy-handler";

export const Route = createFileRoute("/notes/$id")({
  loader: async ({ params }) => {
    const snapshot = getSheetDataSnapshot();
    let n = snapshot.notes.find((x) => x.id === params.id || x.comaxOrder === params.id);

    if (!n) {
      try {
        const { notes } = await fetchLiveDeliveriesAndOrders();
        n = notes.find((x) => x.id === params.id || x.comaxOrder === params.id);
      } catch (err) {
        console.warn("Could not fetch note from sheet:", err);
      }
    }

    if (!n) {
      n = {
        id: params.id,
        customerNo: "---",
        customer: `תעודת משלוח ${params.id}`,
        site: "אתר פריקה (ללא נתוני גיליון)",
        date: new Date().toISOString().split("T")[0]!,
        yard: "מחסן 4 החרש 10",
        driverId: "hikmat",
        signedAt: "08:30",
        comaxOrder: params.id,
        isRealScan: false,
        scans: [],
        items: [],
        gps: {
          arrive: "--:--",
          depart: "--:--",
          status: "warn",
          note: "לא מקושר לגיליון חי",
        },
        deposits: {
          bales60002: { delivered: 0, billed: 0 },
          pallets60060: { delivered: 0, billed: 0 },
        },
      };
    }
    return n;
  },
  head: ({ params }) => ({
    meta: [
      { title: `תעודה ${params.id} — נועה ח. סבן` },
      { name: "description", content: "תצוגת תעודת משלוח עם שכבות בקרה וחותמות." },
      { property: "og:title", content: `תעודה ${params.id}` },
      { property: "og:description", content: "בקרת נועה AI, חותמת ראמי וחותמת מנכ״ל." },
    ],
  }),
  component: Viewer,
});

function Viewer() {
  const n = Route.useLoaderData();
  const ap = useApprovals()[n.id];
  const a = auditNote(n);
  const driver = driverOf(n.driverId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileId = n.driveFileId || (n.driveLink ? extractDriveFileId(n.driveLink) : null);
  const scanProxyUrl = fileId ? `/api/scan/${fileId}` : n.scans?.[0] || "";
  const isScanVerified = Boolean(n.isRealScan && fileId);

  const customerFolder = `תיקיות לקוחות / ${n.customerNo} - ${n.customer} / 2. תעודות משלוח /`;
  const pdfFileName = `תמ_${n.id}_הזמנה_${n.comaxOrder}.pdf`;

  // Handle Rami's Approval & Save Layer
  const handleRamiApproval = async () => {
    if (!isScanVerified) {
      toast.error("חסימת אישור: התעודה אינה מקושרת לסריקת Drive מקורית!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: n.id,
          customerNo: n.customerNo,
          customer: n.customer,
          orderId: n.comaxOrder,
          date: n.date,
          yard: n.yard,
          driverName: driver.name,
          approvalType: "rami",
          totalAmount: ils(noteTotal(n)),
          signedAt: n.signedAt,
          findings: a.findings.map((f) => f.text),
          sourceScanUrl: n.driveLink,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast.error(`השמירה נכשלה: ${data.error || "שגיאת שרת"}`);
        approvals.rami(n.id, { error: data.error });
        return;
      }

      approvals.rami(n.id, {
        signedPdfBase64: data.pdfBase64,
        folderPath: data.folderPath,
        driveUploaded: data.driveUploaded,
        pushSent: data.push?.sent,
        driveUrl: data.driveUrl,
      });

      playAlert();
      toast.success("תעודת המשלוח נבדקה ונחתמה ע״י ראמי ✍️");

      if (data.warning) {
        toast.info(data.warning, { duration: 6000 });
      }
      if (data.push?.message) {
        toast.success(data.push.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("שגיאת תקשורת בשמירת התעודה");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Harel's CEO Sign-Off
  const handleHarelApproval = async () => {
    if (!isScanVerified) {
      toast.error("חסימת אישור: התעודה אינה מקושרת לסריקת Drive מקורית!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: n.id,
          customerNo: n.customerNo,
          customer: n.customer,
          orderId: n.comaxOrder,
          date: n.date,
          yard: n.yard,
          driverName: driver.name,
          approvalType: "harel",
          totalAmount: ils(noteTotal(n)),
          signedAt: n.signedAt,
          findings: a.findings.map((f) => f.text),
          sourceScanUrl: n.driveLink,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast.error(`אישור מנכ״ל נכשל: ${data.error || "שגיאת שרת"}`);
        approvals.harel(n.id, { error: data.error });
        return;
      }

      approvals.harel(n.id, {
        signedPdfBase64: data.pdfBase64,
        folderPath: data.folderPath,
        driveUploaded: data.driveUploaded,
        accountingSent: data.accounting?.sent,
        driveUrl: data.driveUrl,
      });

      playAlert();
      toast.success("אושר סופית לחיוב ע״י מנכ״ל הראל 👑 — סטטוס: אספקה מאומתת!");

      if (data.accounting?.message) {
        toast.info(data.accounting.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("שגיאת תקשורת באישור מנכ״ל");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Generated Signed PDF
  const downloadSignedPdf = () => {
    if (!ap?.signedPdfBase64) {
      toast.info("קובץ ה-PDF נוצר לאחר אישור ראמי או מנכ״ל");
      return;
    }
    const byteCharacters = atob(ap.signedPdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    const aEl = document.createElement("a");
    aEl.href = blobUrl;
    aEl.download = pdfFileName;
    document.body.appendChild(aEl);
    aEl.click();
    document.body.removeChild(aEl);
    URL.revokeObjectURL(blobUrl);
    toast.success("ה-PDF החתום הורד למחשב 📄");
  };

  const whatsappMessage = encodeURIComponent(
    `שלום הראל 👑,\nתעודת משלוח *${n.id}* עבור *${n.customer}* על סך *${ils(noteTotal(n))}* נבדקה ע״י ראמי וממתינה לאישורך בקישור:\nhttps://ais-dev-jjqvfpyij2seoc5nvfmkoj-812919982163.europe-west2.run.app/notes/${n.id}`,
  );

  return (
    <>
      <PageHeader
        title={`ת.מ. ${n.id}`}
        subtitle={`${n.customer} (${n.customerNo}) · הזמנה: ${n.comaxOrder}`}
        action={
          <div className="flex items-center gap-2">
            <StatusPill s={a.status} />
            {n.driveLink && (
              <a
                href={n.driveLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-2xl border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                סריקה ב-Drive
              </a>
            )}
            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-2xl border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
              טאב: {TAB_GALYA_ARCHIVE}
            </a>
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        {/* Anti-Mock / Disconnection Banner */}
        {!isScanVerified && (
          <div className="mb-6 rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-4 text-red-900 dark:text-red-200">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              <span>לא נטען מ-Google Drive / המערכת אינה מחוברת לסריקה חיה</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-red-800 dark:text-red-300">
              חל איסור על שימוש בתעודת דמה או אישור תעודה שלא נטענה מסריקת Drive מאומתת. כפתורי
              החתימה חסומים עד לקישור סריקת מקור תקינה מטאב &quot;{TAB_GALYA_ARCHIVE}&quot;.
            </p>
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-2 pb-12 md:grid-cols-[1fr_360px] md:px-8">
        {/* Main Document Viewer with Stamped Overlays */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  {isScanVerified
                    ? `קובץ סריקה מאומת מ-Drive (שרת Proxy מאותו דומיין)`
                    : "אין קובץ סריקה מקושר"}
                </span>
              </div>
              {scanProxyUrl && (
                <a
                  href={scanProxyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> פתח קובץ מקור
                </a>
              )}
            </div>

            <div className="relative min-h-[520px] w-full bg-muted/10 flex items-center justify-center p-2">
              {isScanVerified ? (
                <iframe
                  src={scanProxyUrl}
                  title={`סריקת תעודה ${n.id}`}
                  className="h-[600px] w-full rounded-2xl border-0 bg-white"
                />
              ) : (
                <div className="text-center p-12 space-y-2">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                  <p className="font-bold text-foreground">לא נמצאה סריקה מקורית ב-Drive</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    תעודה זו אינה מכילה קישור לקובץ סריקה מאומת בגיליון. לפיכך, אין תצוגת דמה ומערכת
                    הבקרה חוסמת אישור.
                  </p>
                </div>
              )}

              {/* Layer 3: Rami Review Stamp */}
              {ap?.rami && (
                <div className="stamp absolute bottom-16 left-6 bg-card/90 text-xs text-rami shadow-lg backdrop-blur-sm pointer-events-none">
                  ח. סבן — נבדק ואושר ע״י ראמי מסארווה ✍️
                  <br />
                  {ap.rami.at}
                </div>
              )}

              {/* Layer 4: Harel CEO Final Sign-Off Stamp */}
              {ap?.harel && (
                <div className="stamp absolute bottom-36 right-6 bg-card/95 text-xs text-ceo shadow-xl font-bold backdrop-blur-sm pointer-events-none border-ceo">
                  ח. סבן (1994) בע״מ — אושר סופית לחיוב 👑
                  <br />
                  הראל אידלסון · {ap.harel.at}
                </div>
              )}
            </div>
          </div>

          {/* Items breakdown card */}
          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-3">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              פירוט פריטי תעודה והזמנה #{n.comaxOrder} (מגיליון)
            </h3>
            {n.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                אין פירוט פריטים בגיליון לתעודה זו.
              </p>
            ) : (
              <div className="divide-y text-xs">
                {n.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{it.sku}</span>
                      <span className="font-semibold text-foreground">{it.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">
                        {it.qty} {it.unit}
                      </span>
                      <span className="text-muted-foreground">{ils(it.qty * it.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aside: Metadata, AI Audit & Sign-off Controls */}
        <aside className="space-y-4">
          {/* Layer 2: Noa AI Due Diligence Audit Box */}
          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                שכבה 2: בקרת נועה AI
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">הצלבת 1:1</span>
            </div>

            <ul className="space-y-2 text-xs">
              {a.findings.map((f, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-xl p-2.5 ${
                    f.status === "ok"
                      ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                      : f.status === "warn"
                        ? "bg-amber-500/10 text-amber-900 dark:text-amber-300"
                        : "bg-red-500/10 text-red-900 dark:text-red-300"
                  }`}
                >
                  <span className="shrink-0">
                    {f.status === "ok" ? "🟢" : f.status === "warn" ? "⚠️" : "🔴"}
                  </span>
                  <span className="leading-snug">{f.text}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl bg-muted/40 p-3 pt-2">
              <div className="text-xs text-muted-foreground">סה״כ לתשלום לחיוב:</div>
              <div className="font-display text-3xl font-extrabold text-primary">
                {ils(noteTotal(n))}
              </div>
            </div>
          </div>

          {/* Drive & Filing Location */}
          <div className="rounded-3xl border bg-card p-4 shadow-card text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <FolderArchive className="h-4 w-4 text-emerald-600" />
              <span>יעד תיוק ב-Google Drive:</span>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5 font-mono text-[11px] text-muted-foreground break-all">
              {customerFolder}
              <span className="font-bold text-foreground">{pdfFileName}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t">
              <span className="text-muted-foreground">סטטוס מסירה:</span>
              <span className="font-bold text-primary">
                {ap?.status ||
                  (ap?.harel
                    ? "✅ אספקה מאומתת"
                    : ap?.rami
                      ? "ממתין לאישור מנכ״ל"
                      : "ממתין לבדיקת ראמי")}
              </span>
            </div>
          </div>

          {/* Logistics & Driver Details */}
          <div className="rounded-3xl border bg-card p-4 shadow-card text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-primary" /> נהג ומשאית:
              </span>
              <span className="font-bold">
                {driver.name} ({driver.plate})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-primary" /> מחסן יוצא:
              </span>
              <span className="font-bold">{n.yard}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">שעת חתימה בשטח:</span>
              <span className="font-bold">{n.signedAt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">כתובת אספקה:</span>
              <span className="font-bold truncate max-w-[180px]">{n.site}</span>
            </div>
          </div>

          {/* Action Sign-Off & Workflow Controls */}
          <div className="space-y-2 pt-1">
            {!ap?.rami && (
              <button
                onClick={handleRamiApproval}
                disabled={!isScanVerified || isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rami py-3.5 font-display text-base font-bold text-rami-foreground shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>חתימת ראמי ✍️ (שכבה 3)</span>
                  </>
                )}
              </button>
            )}

            {ap?.rami && !ap?.harel && (
              <>
                <button
                  onClick={handleHarelApproval}
                  disabled={!isScanVerified || isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ceo py-3.5 font-display text-base font-bold text-ceo-foreground shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>אישור מנכ״ל 👑 (שכבה 4)</span>
                    </>
                  )}
                </button>

                {/* WhatsApp secondary channel */}
                <a
                  href={`https://wa.me/?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-emerald-600/40 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  <span>ערוץ משני: שלח תזכורת להראל בוואטסאפ</span>
                </a>
              </>
            )}

            {ap?.signedPdfBase64 && (
              <button
                onClick={downloadSignedPdf}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 py-3 text-xs font-bold text-primary hover:bg-primary/20"
              >
                <Download className="h-4 w-4" /> הורד PDF חתום עם כל השכבות
              </button>
            )}

            {ap && (
              <button
                onClick={() => {
                  approvals.reset(n.id);
                  toast.info("חתימות התעודה אופסו");
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" /> איפוס חתימות
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
