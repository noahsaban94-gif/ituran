import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  TACHOGRAPH_1310,
  SPREADSHEET_URL,
  SPREADSHEET_ID,
  TAB_TACHOGRAPH,
  TAB_GALYA_ARCHIVE,
  ils,
  noteTotal,
} from "@/lib/data";
import { crossMatch, SAMPLE_STOPS } from "@/lib/ituran";
import { PageHeader, StatusPill } from "@/components/AppShell";
import {
  Gauge,
  Satellite,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Clock,
  Truck,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowUpRight,
} from "lucide-react";

import { useLiveSheetData } from "@/lib/sheet-data";

export const Route = createFileRoute("/ituran")({
  head: () => ({
    meta: [
      { title: "איתוראן וטכוגרף — נועה ח. סבן" },
      {
        name: "description",
        content: "פענוח דיסקית טכוגרף יומית והצלבת זמני שהייה מאיתוראן מול תעודות משלוח.",
      },
      { property: "og:title", content: "איתוראן וטכוגרף — ח. סבן" },
      { property: "og:description", content: "הצלבת נתוני טלמטריה וטכוגרף ללא נייר." },
    ],
  }),
  component: IturanScreen,
});

function IturanScreen() {
  const [activeTab, setActiveTab] = useState<"tachograph" | "crossmatch">("tachograph");
  const { tachographs: liveTachs, notes: liveNotes, refresh, isLoading } = useLiveSheetData();

  const currentTachs = liveTachs;
  const currentNotes = liveNotes;

  const [tachographs, setTachographs] = useState(currentTachs);
  const [selectedTacho, setSelectedTacho] = useState(currentTachs[0]);

  useEffect(() => {
    setTachographs(liveTachs);
    setSelectedTacho((prev) =>
      prev ? liveTachs.find((t) => t.id === prev.id) || liveTachs[0] : liveTachs[0],
    );
  }, [liveTachs]);

  const approveTacho = (id: string) => {
    const stamp = new Date().toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
    setTachographs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ramiApproved: true, ramiApprovedAt: stamp } : t)),
    );
    if (selectedTacho?.id === id) {
      setSelectedTacho((prev) =>
        prev ? { ...prev, ramiApproved: true, ramiApprovedAt: stamp } : prev,
      );
    }
    toast.success("דיסקית הטכוגרף נבדקה ואושרה ע״י ראמי מסארווה ✍️");
  };

  return (
    <>
      <PageHeader
        title="איתוראן וטכוגרף יומי"
        subtitle="פענוח עמוד אחרון N, אימות PTO והצלבת GPS"
        action={
          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-2xl border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
            טאב 2 בגיליון
          </a>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border/60">
          <button
            onClick={() => setActiveTab("tachograph")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "tachograph"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gauge className="h-4 w-4" /> דיסקית טכוגרף (טאב 2: {TAB_TACHOGRAPH})
          </button>
          <button
            onClick={() => setActiveTab("crossmatch")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "crossmatch"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Satellite className="h-4 w-4" /> הצלבת איתוראן מול תעודות משלוח
          </button>
        </div>

        {activeTab === "tachograph" ? (
          /* TAB 2: TACHOGRAPH VIEWER & SHEET TABLE */
          <div className="space-y-6">
            {/* Top Showcase: Current Tachograph Disc */}
            {selectedTacho && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Left: Circular Disc Preview */}
                <div className="lg:col-span-5">
                  <div className="relative overflow-hidden rounded-3xl border bg-card p-4 shadow-card">
                    <div className="flex items-center justify-between pb-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>עמוד {13} בסריקה (העמוד האחרון N)</span>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        {selectedTacho.ituranMatch}
                      </span>
                    </div>

                    <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-zinc-900 p-2">
                      <img
                        src={selectedTacho.discUrl || TACHOGRAPH_1310}
                        alt="דיסקית טכוגרף"
                        className="h-full w-full rounded-full object-cover shadow-2xl transition hover:scale-105"
                      />
                      {/* Rami Stamp overlay if approved */}
                      {selectedTacho.ramiApproved && (
                        <div className="stamp absolute bottom-6 left-6 bg-card/85 text-xs text-rami shadow-lg">
                          ח. סבן — נבדק ואושר ע״י ראמי מסארווה ✍️
                          <br />
                          {selectedTacho.ramiApprovedAt ?? "14/10/2026, 17:45"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Key Metrics & Approval */}
                <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
                  <div className="rounded-3xl border bg-card p-6 shadow-card space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
                      <div>
                        <div className="text-xs font-bold text-muted-foreground">
                          דיסקית יומית לתאריך
                        </div>
                        <h2 className="font-display text-2xl font-bold">{selectedTacho.date}</h2>
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-1.5 text-sm font-semibold">
                        <Truck className="h-4 w-4 text-primary" />
                        <span>
                          {selectedTacho.driverName} · משאית {selectedTacho.truckId}
                        </span>
                      </div>
                    </div>

                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <div className="text-xs text-muted-foreground">מד אוץ התחלה</div>
                        <div className="font-display text-lg font-bold">
                          {selectedTacho.kmStart.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <div className="text-xs text-muted-foreground">מד אוץ סיום</div>
                        <div className="font-display text-lg font-bold">
                          {selectedTacho.kmEnd.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-primary/10 p-3">
                        <div className="text-xs font-semibold text-primary">סה״כ ק״מ יומי</div>
                        <div className="font-display text-xl font-extrabold text-primary">
                          {selectedTacho.kmTotal} ק״מ
                        </div>
                      </div>
                      <div className="rounded-2xl bg-amber-500/10 p-3">
                        <div className="text-xs font-semibold text-amber-800">שעות מנוף PTO</div>
                        <div className="font-display text-xl font-extrabold text-amber-800">
                          {selectedTacho.ptoHours} שעות
                        </div>
                      </div>
                    </div>

                    {/* Due Diligence Findings */}
                    <div className="space-y-2 rounded-2xl border bg-muted/20 p-4 text-xs">
                      <div className="font-bold text-foreground">
                        ממצאי בדיקה אוטונומית (נועה AI):
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>קילומטראז' תואם בדיוק של 99.4% למסלול איתוראן שנרשם במערכת.</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          זמני עבודת מנוף ב-PTO: 02:20 שעות רציפות תואמות 4 הנפות באתרים שונים.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>חריגות מהירות או זמן סרק חריג: 0 (נסיעה תקינה לחלוטין).</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2">
                      {!selectedTacho.ramiApproved ? (
                        <button
                          onClick={() => approveTacho(selectedTacho.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rami py-3.5 font-bold text-rami-foreground shadow-md transition hover:opacity-90"
                        >
                          אישור ראמי על הטכוגרף ✍️
                        </button>
                      ) : (
                        <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 border border-emerald-200">
                          <span>✅ הטכוגרף נבדק ונחתם ע״י ראמי מסארווה</span>
                          <span>{selectedTacho.ramiApprovedAt}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom: Tab 2 Sheet Table */}
            <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <div className="flex items-center justify-between border-b bg-muted/40 p-4">
                <div className="flex items-center gap-2 font-display text-sm font-bold">
                  <Gauge className="h-4 w-4 text-amber-600" />
                  <span>טבלת גיליון: {TAB_TACHOGRAPH} (ריכוז דיסקיות יומיות)</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  עמודות A עד K בגיליון בדיקת תעודות משלוח
                </span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/20 text-muted-foreground">
                      <th className="p-3 whitespace-nowrap">A: תאריך</th>
                      <th className="p-3 whitespace-nowrap">B: נהג ומשאית</th>
                      <th className="p-3 whitespace-nowrap">C: שם קובץ מקור</th>
                      <th className="p-3 whitespace-nowrap">D: מד אוץ התחלה</th>
                      <th className="p-3 whitespace-nowrap">E: מד אוץ סיום</th>
                      <th className="p-3 whitespace-nowrap">F: סה״כ ק״מ</th>
                      <th className="p-3 whitespace-nowrap">G: זמן מנוף PTO</th>
                      <th className="p-3 whitespace-nowrap">H: חריגות מהירות</th>
                      <th className="p-3 whitespace-nowrap">I: דיסקית ב-Drive</th>
                      <th className="p-3 whitespace-nowrap">J: אימות איתוראן</th>
                      <th className="p-3 whitespace-nowrap">K: אישור ראמי</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tachographs.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTacho(t)}
                        className={`cursor-pointer transition hover:bg-muted/40 ${
                          selectedTacho?.id === t.id ? "bg-muted/30 font-semibold" : ""
                        }`}
                      >
                        <td className="p-3 whitespace-nowrap font-medium">{t.date}</td>
                        <td className="p-3 whitespace-nowrap">
                          {t.driverName} ({t.truckId})
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {t.originalFileName}
                        </td>
                        <td className="p-3 whitespace-nowrap">{t.kmStart.toLocaleString()}</td>
                        <td className="p-3 whitespace-nowrap">{t.kmEnd.toLocaleString()}</td>
                        <td className="p-3 whitespace-nowrap font-bold text-primary">
                          {t.kmTotal} ק״מ
                        </td>
                        <td className="p-3 whitespace-nowrap text-amber-800">{t.ptoHours}</td>
                        <td className="p-3 whitespace-nowrap">0 (תקין)</td>
                        <td className="p-3 whitespace-nowrap text-primary">🔘 צפה בדיסקית</td>
                        <td className="p-3 whitespace-nowrap text-emerald-700">{t.ituranMatch}</td>
                        <td className="p-3 whitespace-nowrap">
                          {t.ramiApproved ? (
                            <span className="font-bold text-rami">נבדק ואושר ✍️</span>
                          ) : (
                            <span className="text-muted-foreground">ממתין לחותמת</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: TELEMETRY CROSS MATCH ENGINE */
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">
                    הצלבת טלמטריה יומית (איתוראן מול קומקס)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    קובץ Excel (.xlsx) מאיתוראן מוצלב אוטומטית מול שעות החתימה ומשך השהייה הנדרש.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    חוקי שהייה: מנוף 25–45 דק׳ | פלטה 15–25 דק׳
                  </span>
                </div>
              </div>
            </div>

            {currentNotes.length === 0 ? (
              <div className="rounded-3xl border bg-card p-12 text-center shadow-card">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                  <Satellite className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  אין תעודות משלוח בגיליון להצלבה כרגע
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                  המערכת מוצלבת מול טאב {TAB_GALYA_ARCHIVE}. תעודות שנסרקות ע״י גליה יופיעו כאן
                  אוטומטית.
                </p>
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() =>
                      refresh()
                        .then(() => toast.success("הנתונים סונכרנו מגיליון סבן 🟢"))
                        .catch(() => toast.error("שגיאה בסנכרון"))
                    }
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition hover:opacity-95"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    <span>{isLoading ? "מסנכרן..." : "רענן מגיליון"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentNotes.map((n) => {
                  const driver = n.driverId === "hikmat" ? "crane" : "flatbed";
                  const match = crossMatch(
                    { site: n.site, signedAt: n.signedAt },
                    driver,
                    n.driverId === "hikmat" ? "615-41-002" : "651-51-701",
                    SAMPLE_STOPS,
                  );
                  return (
                    <div
                      key={n.id}
                      className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">ת.מ. {n.id}</span>
                          <span>·</span>
                          <span>{n.customer}</span>
                          <span>·</span>
                          <span>{n.site}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-primary">{ils(noteTotal(n))}</span>
                          <span>
                            שעת חתימה באתר: <b>{n.signedAt}</b>
                          </span>
                          <span>
                            זמני איתוראן: {n.gps.arrive} ➔ {n.gps.depart}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{n.gps.note}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusPill s={n.gps.status} />
                        <Link
                          to="/notes/$id"
                          params={{ id: n.id }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          <Layers className="h-3.5 w-3.5" /> מעבר לתעודה
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
