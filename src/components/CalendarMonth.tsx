import { useState, useMemo } from "react";
import { VisitRecord, DeterministicAnomaly } from "@/lib/types";
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";

interface CalendarMonthProps {
  visits: VisitRecord[];
  anomalies: DeterministicAnomaly[];
  onSelectDay: (date: string) => void;
  selectedDate?: string;
}

export function CalendarMonth({
  visits,
  anomalies,
  onSelectDay,
  selectedDate,
}: CalendarMonthProps) {
  // Determine available dates from visits (e.g. October 2026)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    if (visits.length > 0 && visits[0]?.date) {
      const d = new Date(visits[0].date);
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(2026, 9, 1); // October 2026
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const monthNames = [
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "ספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayWeekIndex = new Date(year, month, 1).getDay(); // 0 is Sunday in JS

  // Map visits and anomalies by day string: "YYYY-MM-DD"
  const dayStats = useMemo(() => {
    const map = new Map<
      string,
      {
        visitsCount: number;
        hasAli: boolean;
        hasHikmat: boolean;
        anomaliesCount: number;
      }
    >();

    visits.forEach((v) => {
      const curr = map.get(v.date) || {
        visitsCount: 0,
        hasAli: false,
        hasHikmat: false,
        anomaliesCount: 0,
      };
      curr.visitsCount++;
      if (v.driverId === "ali") curr.hasAli = true;
      if (v.driverId === "hikmat") curr.hasHikmat = true;
      map.set(v.date, curr);
    });

    anomalies.forEach((a) => {
      if (a.date && map.has(a.date)) {
        map.get(a.date)!.anomaliesCount++;
      }
    });

    return map;
  }, [visits, anomalies]);

  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const weekDayLabels = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-card space-y-4" dir="rtl">
      {/* Month Navigator Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h2 className="font-display font-bold text-lg text-foreground">
            {monthNames[month]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Driver Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground mr-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> חכמת (615-41-002)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-700" /> עלי (651-51-701)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> חריגות
            </span>
          </div>

          <button
            onClick={prevMonth}
            className="rounded-xl border p-2 hover:bg-muted transition"
            title="חודש קודם"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="rounded-xl border p-2 hover:bg-muted transition"
            title="חודש הבא"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-muted-foreground">
        {weekDayLabels.map((w, idx) => (
          <div key={idx} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Grid of days */}
      <div className="grid grid-cols-7 gap-2">
        {/* Leading empty cells for offset */}
        {Array.from({ length: firstDayWeekIndex }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-20 rounded-2xl bg-muted/10 opacity-40" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const stat = dayStats.get(dateStr);
          const hasData = Boolean(stat && stat.visitsCount > 0);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDay(dateStr)}
              className={`relative flex flex-col justify-between rounded-2xl border p-2 text-right transition h-20 sm:h-24 ${
                isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-md"
                  : hasData
                    ? "bg-card hover:border-primary/50 hover:bg-muted/30 shadow-sm"
                    : "bg-muted/15 text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`font-display text-sm font-bold ${
                    isSelected
                      ? "text-primary"
                      : hasData
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {dayNum}
                </span>

                {stat?.anomaliesCount ? (
                  <span
                    className="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400"
                    title={`${stat.anomaliesCount} חריגות`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span>{stat.anomaliesCount}</span>
                  </span>
                ) : null}
              </div>

              {hasData && stat && (
                <div className="w-full space-y-1">
                  <div className="text-[11px] font-semibold text-foreground">
                    {stat.visitsCount} ביקורים
                  </div>
                  {/* Driver Dots */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {stat.hasHikmat && (
                      <span className="h-2 w-2 rounded-full bg-primary" title="חכמת (מרצדס מנוף)" />
                    )}
                    {stat.hasAli && (
                      <span
                        className="h-2 w-2 rounded-full bg-cyan-700"
                        title="עלי (איסוזו פלטה)"
                      />
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
