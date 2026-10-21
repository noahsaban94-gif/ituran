import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { PageHeader } from "@/components/AppShell";
import { SiteSummary, VisitRecord } from "@/lib/types";
import {
  MapPin,
  Search,
  Clock,
  ShieldCheck,
  ChevronLeft,
  X,
  Building,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/sites")({
  head: () => ({
    meta: [
      { title: "כתובות לקוחות — ח. סבן לוגיסטיקה" },
      {
        name: "description",
        content: "מאגר אתרי לקוחות, זמני פריקה (חציון, P80 ומקס׳), ורמת ביטחון סטטיסטי.",
      },
    ],
  }),
  component: SitesScreen,
});

function SitesScreen() {
  const { sites, visits, isLoading, isRefetching, refetch } = useLogisticsData();
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [drilldownSite, setDrilldownSite] = useState<SiteSummary | null>(null);

  const cities = Array.from(new Set(sites.map((s) => s.city).filter(Boolean)));

  const filteredSites = sites.filter((s) => {
    const matchesSearch =
      s.address.includes(search) ||
      s.city.includes(search) ||
      s.customers.some((c) => c.includes(search));
    const matchesCity = selectedCity === "all" || s.city === selectedCity;
    return matchesSearch && matchesCity;
  });

  // Get visits for drilldown site
  const siteVisits = drilldownSite
    ? visits.filter(
        (v) => v.siteKey === drilldownSite.siteKey || v.address === drilldownSite.address,
      )
    : [];

  return (
    <>
      <PageHeader
        title="כתובות ואתרי לקוחות"
        subtitle="ניתוח זמני שהות ופריקה באתר (חציון, P80 ומקסימום) לפי מדידות איתוראן וכתב יד מגיליון"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isRefetching}
              className="flex items-center gap-1.5 rounded-2xl border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50 shadow-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-primary ${isRefetching ? "animate-spin" : ""}`}
              />
              <span>{isRefetching ? "מסנכרן..." : "רענן מגיליון"}</span>
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-8" dir="rtl">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border bg-card p-4 shadow-card">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי כתובת / שם לקוח / עיר..."
              className="w-full rounded-2xl border bg-card py-2 pr-10 pl-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">עיר:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="rounded-2xl border bg-card py-2 px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">כל הערים ({sites.length})</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sites Table */}
        <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="p-3.5 font-bold">כתובת ועיר</th>
                  <th className="p-3.5 font-bold">לקוחות באתר</th>
                  <th className="p-3.5 font-bold text-center">ביקורים</th>
                  <th className="p-3.5 font-bold text-center">מדידות</th>
                  <th className="p-3.5 font-bold text-center">חציון באתר</th>
                  <th className="p-3.5 font-bold text-center">P80 באתר</th>
                  <th className="p-3.5 font-bold text-center">מקס׳ באתר</th>
                  <th className="p-3.5 font-bold text-center">נסיעה (חציון)</th>
                  <th className="p-3.5 font-bold text-center">רמת ביטחון</th>
                  <th className="p-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSites.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      {isLoading ? "טוען אתרי לקוחות..." : "לא נמצאו אתרי לקוחות התואמים לחיפוש."}
                    </td>
                  </tr>
                ) : (
                  filteredSites.map((site) => (
                    <tr
                      key={site.siteKey}
                      onClick={() => setDrilldownSite(site)}
                      className="cursor-pointer hover:bg-muted/40 transition"
                    >
                      <td className="p-3.5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{site.address}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground mr-5">{site.city}</span>
                      </td>

                      <td className="p-3.5 text-muted-foreground max-w-xs truncate">
                        {site.customers.join(", ") || "אין נתון"}
                      </td>

                      <td className="p-3.5 text-center font-bold">{site.visitCount}</td>
                      <td className="p-3.5 text-center text-muted-foreground">
                        {site.measurementCount > 0 ? site.measurementCount : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center font-bold text-purple-700">
                        {site.medianSiteMinutes > 0 ? `${site.medianSiteMinutes} דק׳` : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center font-bold text-amber-700">
                        {site.p80SiteMinutes > 0 ? `${site.p80SiteMinutes} דק׳` : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center text-muted-foreground">
                        {site.maxSiteMinutes > 0 ? `${site.maxSiteMinutes} דק׳` : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center text-cyan-800 dark:text-cyan-400 font-semibold">
                        {site.medianDriveMinutes > 0
                          ? `${site.medianDriveMinutes} דק׳`
                          : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            site.confidence === "גבוה"
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                              : site.confidence === "בינוני"
                                ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {site.confidence}
                        </span>
                      </td>

                      <td className="p-3.5 text-left">
                        <span className="flex items-center gap-0.5 text-primary font-bold text-xs">
                          <span>היסטוריה</span>
                          <ChevronLeft className="h-4 w-4" />
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Site Drilldown Drawer */}
      {drilldownSite && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
          dir="rtl"
        >
          <div className="absolute inset-0" onClick={() => setDrilldownSite(null)} />
          <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-background shadow-2xl overflow-y-auto border-r animate-in slide-in-from-right duration-200">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-card px-6 py-4">
              <div>
                <span className="text-xs text-muted-foreground">היסטוריית ביקורים באתר</span>
                <h3 className="font-display font-bold text-lg text-foreground">
                  {drilldownSite.address}
                </h3>
                <span className="text-xs text-primary">{drilldownSite.city}</span>
              </div>
              <button
                onClick={() => setDrilldownSite(null)}
                className="rounded-2xl border p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border bg-card p-3">
                  <div className="text-muted-foreground">חציון באתר</div>
                  <div className="font-display text-xl font-bold text-purple-700 mt-1">
                    {drilldownSite.medianSiteMinutes > 0
                      ? `${drilldownSite.medianSiteMinutes} דק׳`
                      : "אין מדידה"}
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-3">
                  <div className="text-muted-foreground">P80 באתר</div>
                  <div className="font-display text-xl font-bold text-amber-700 mt-1">
                    {drilldownSite.p80SiteMinutes > 0
                      ? `${drilldownSite.p80SiteMinutes} דק׳`
                      : "אין מדידה"}
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-3">
                  <div className="text-muted-foreground">נסיעה (חציון)</div>
                  <div className="font-display text-xl font-bold text-cyan-700 mt-1">
                    {drilldownSite.medianDriveMinutes > 0
                      ? `${drilldownSite.medianDriveMinutes} דק׳`
                      : "אין מדידה"}
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-sm text-foreground pt-2">
                כל הביקורים שבוצעו באתר ({siteVisits.length}):
              </h4>
              <div className="space-y-2">
                {siteVisits.map((v) => (
                  <div key={v.visitKey} className="rounded-2xl border bg-card p-3.5 space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-primary">{v.date}</span>
                      <span>
                        נהג: {v.driverName} ({v.truckPlate})
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      לקוחות: {v.customers.join(", ")} · תעודות: #{v.noteIds.join(", #")}
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2 text-[11px]">
                      <div>מנוף בכתב יד: {v.handwrittenCraneWindow || "אין נתון"}</div>
                      <div>
                        PTO איתוראן:{" "}
                        {v.ptoMinutes !== undefined ? `${v.ptoMinutes} דק׳` : "אין נתון"}
                      </div>
                      <div>
                        נסיעה:{" "}
                        {v.driveMinutesFromPrev !== undefined
                          ? `${v.driveMinutesFromPrev} דק׳`
                          : "אין מדידה"}
                      </div>
                      <div>
                        ק״מ: {v.kmFromPrev !== undefined ? `${v.kmFromPrev} ק״מ` : "אין מדידה"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
