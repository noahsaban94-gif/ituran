import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { PageHeader } from "@/components/AppShell";
import { Building, Search, RefreshCw, Compass } from "lucide-react";

export const Route = createFileRoute("/cities")({
  head: () => ({
    meta: [
      { title: "ערים ומרחקים — ח. סבן לוגיסטיקה" },
      {
        name: "description",
        content: "סיכום ערים ומרחקים: חציון זמני שהות, P80 וזמני נסיעה ממוצעים.",
      },
    ],
  }),
  component: CitiesScreen,
});

function CitiesScreen() {
  const { cities, isLoading, isRefetching, refetch } = useLogisticsData();
  const [search, setSearch] = useState("");

  const filteredCities = cities.filter((c) => c.city.includes(search));

  return (
    <>
      <PageHeader
        title="ערים ומרחקים"
        subtitle="סטטיסטיקת פריקה ונסיעה ממוצעת לפי ערים (טאב: סיכום_ערים)"
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
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש עיר (למשל: תל אביב, הוד השרון, רעננה)..."
            className="w-full rounded-2xl border bg-card py-2 pr-10 pl-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Cities Table */}
        <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="p-3.5 font-bold">שם עיר / אזור חלוקה</th>
                  <th className="p-3.5 font-bold text-center">כמות ביקורים</th>
                  <th className="p-3.5 font-bold text-center">מדידות בפועל</th>
                  <th className="p-3.5 font-bold text-center">חציון זמן באתר</th>
                  <th className="p-3.5 font-bold text-center">P80 באתר</th>
                  <th className="p-3.5 font-bold text-center">נסיעה (חציון)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {isLoading ? "טוען ערים..." : "לא נמצאו ערים."}
                    </td>
                  </tr>
                ) : (
                  filteredCities.map((city) => (
                    <tr key={city.city} className="hover:bg-muted/40 transition">
                      <td className="p-3.5 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-primary" />
                          <span>{city.city}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-center font-bold">{city.visitCount}</td>

                      <td className="p-3.5 text-center text-muted-foreground">
                        {city.measurementCount > 0 ? city.measurementCount : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center font-bold text-purple-700">
                        {city.medianSiteMinutes > 0 ? `${city.medianSiteMinutes} דק׳` : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center font-bold text-amber-700">
                        {city.p80SiteMinutes > 0 ? `${city.p80SiteMinutes} דק׳` : "אין מדידה"}
                      </td>

                      <td className="p-3.5 text-center font-bold text-cyan-800 dark:text-cyan-400">
                        {city.medianDriveMinutes > 0
                          ? `${city.medianDriveMinutes} דק׳`
                          : "אין מדידה"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
