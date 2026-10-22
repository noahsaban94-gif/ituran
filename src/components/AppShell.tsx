import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  LayoutDashboard,
  Truck,
  Disc,
  MapPin,
  Building2,
  ShieldAlert,
  Activity,
  Menu,
  X,
  Package,
  FileText,
  PenTool,
  Sparkles,
  Pin,
  PinOff,
  ChevronLeft,
  ChevronRight,
  Database,
  Clock,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import noa from "@/assets/noa.jpg";
import { ScanSplitterModal } from "./ScanSplitterModal";

export const NAV_ITEMS = [
  {
    to: "/",
    label: "דשבורד מנכ״ל",
    subLabel: "סידור חכם ובקרה",
    icon: LayoutDashboard,
    badge: "1",
  },
  {
    to: "/orders",
    label: "הזמנות חיות",
    subLabel: "מניפסט פריטים ומחסנים",
    icon: Package,
    badge: "חי",
  },
  {
    to: "/notes",
    label: "תעודות משלוח",
    subLabel: "ארכיון וסריקות גליה",
    icon: FileText,
  },
  {
    to: "/sites",
    label: "תיקי לקוחות",
    subLabel: "אתרי לקוחות וזמני פריקה",
    icon: MapPin,
  },
  {
    to: "/tachograph",
    label: "איתוראן / דיסקית טכוגרף",
    subLabel: "הצלבת מחט ו-GPS לוויני",
    icon: Disc,
  },
  {
    to: "/chat",
    label: "צ׳אט נועה AI",
    subLabel: "סדרנית AI והצלבה סגורה",
    icon: Sparkles,
    highlight: true,
  },
] as const;

export const FLEET_DRIVERS = [
  {
    to: "/hikmat",
    label: "חכמת גאבר",
    subLabel: "מרצדס מנוף · 615-41-002",
    color: "#10b981",
  },
  {
    to: "/ali",
    label: "עלי אבו עידה",
    subLabel: "איסוזו פלטה · 651-51-701",
    color: "#06b6d4",
  },
] as const;

export const SYSTEM_LINKS = [
  { to: "/ituran", label: "איתוראן יומן מסעות", icon: Activity },
  { to: "/cities", label: "ערים ומרחקים", icon: Building2 },
  { to: "/quality", label: "איכות נתונים ובקרה", icon: ShieldAlert },
  { to: "/status", label: "סטטוס חיבור ושרת", icon: Database },
] as const;

const AUTO_HIDE_SECONDS = 5;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  // Load pinned preference from localStorage (default: false -> auto-hide active)
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("saban_sidebar_pinned");
      return stored === "true";
    }
    return false;
  });

  // Sidebar open state
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(AUTO_HIDE_SECONDS);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Toggle Pin & persist
  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("saban_sidebar_pinned", String(next));
      }
      if (next) {
        setIsOpen(true);
      }
      return next;
    });
  };

  // Reset auto-hide countdown
  const resetInactivityTimer = useCallback(() => {
    if (isPinned) return; // Never hide if pinned

    setIsOpen(true);
    setSecondsRemaining(AUTO_HIDE_SECONDS);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Countdown interval for visual progress bar
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-hide trigger
    timerRef.current = setTimeout(() => {
      if (!isHovered && !isPinned) {
        setIsOpen(false);
      }
    }, AUTO_HIDE_SECONDS * 1000);
  }, [isPinned, isHovered]);

  // Global user activity listeners
  useEffect(() => {
    if (isPinned) {
      setIsOpen(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const handleUserActivity = (e: MouseEvent | TouchEvent | KeyboardEvent) => {
      // If moving mouse near the right edge (< 40px from right screen edge in RTL), always reveal
      if ("clientX" in e && e.clientX >= window.innerWidth - 45) {
        setIsOpen(true);
      }
      resetInactivityTimer();
    };

    window.addEventListener("mousemove", handleUserActivity, { passive: true });
    window.addEventListener("mousedown", handleUserActivity, { passive: true });
    window.addEventListener("touchstart", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity, { passive: true });

    // Initial countdown on mount
    resetInactivityTimer();

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("mousedown", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPinned, resetInactivityTimer]);

  // Mouse hover handlers for the sidebar container
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!isPinned) {
      setIsOpen(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!isPinned) {
      resetInactivityTimer();
    }
  };

  const isActive = (to: string) => {
    if (to === "/") return pathname === "/";
    return pathname.startsWith(to);
  };

  return (
    <div
      className="min-h-screen bg-[#0a0f16] text-slate-100 flex flex-col font-sans relative overflow-x-hidden"
      dir="rtl"
    >
      {/* Invisible Screen-Edge Hover Zone (Right side in RTL) to wake up sidebar immediately */}
      {!isOpen && !isPinned && (
        <div
          onMouseEnter={() => {
            setIsOpen(true);
            resetInactivityTimer();
          }}
          className="fixed top-0 right-0 h-full w-4 z-40 cursor-pointer transition-colors hover:bg-emerald-500/10"
          title="רחף כאן לפתיחת סרגל הניווט"
        />
      )}

      {/* Floating Edge Trigger Pill (visible when sidebar is hidden on desktop) */}
      {!isOpen && !isPinned && (
        <div className="fixed top-3.5 right-3.5 z-40 hidden lg:flex items-center gap-2 animate-in fade-in slide-in-from-right duration-200">
          <button
            onClick={() => {
              setIsOpen(true);
              resetInactivityTimer();
            }}
            className="flex items-center gap-2.5 rounded-2xl border border-[#223246] bg-[#131c26]/90 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md hover:bg-slate-800 hover:border-emerald-500 transition group"
          >
            <div className="relative">
              <img
                src={noa}
                alt="נועה"
                className="h-6 w-6 rounded-full object-cover ring-1 ring-emerald-500"
              />
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span>סרגל ניווט</span>
            <ChevronLeft className="h-4 w-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* MAIN LAYOUT WRAPPER */}
      <div className="flex-1 flex w-full relative">
        {/* DESKTOP SIDEBAR (RTL Right Hand Side) */}
        <aside
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`hidden lg:flex flex-col fixed top-0 right-0 z-50 h-screen w-72 bg-[#131c26] border-l border-[#223246] shadow-2xl transition-transform duration-300 ease-in-out ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Subtle auto-hide progress indicator bar */}
          {!isPinned && (
            <div className="h-1 w-full bg-[#1b2636] overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(secondsRemaining / AUTO_HIDE_SECONDS) * 100}%` }}
                title={`הסתרה אוטומטית בעוד ${secondsRemaining} שניות (לחץ על הנעץ להצמדה קבועה)`}
              />
            </div>
          )}

          {/* Sidebar Header */}
          <div className="p-4 border-b border-[#223246] flex items-center justify-between bg-[#162230]">
            <Link to="/" className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={noa}
                  alt="נועה"
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-500 shadow-sm"
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#162230]" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight">
                  ח. סבן לוגיסטיקה
                </h1>
                <p className="text-[11px] font-semibold text-emerald-400">סידור חכם &amp; בקרה</p>
              </div>
            </Link>

            {/* Pin / Auto-Hide Mode Toggle */}
            <div className="flex items-center gap-1">
              <button
                onClick={togglePin}
                className={`p-1.5 rounded-xl border transition text-xs flex items-center gap-1 ${
                  isPinned
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "border-[#223246] text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title={isPinned ? "הסר נעץ (הפעל הסתרה אוטומטית)" : "הצמד סרגל קבוע על המסך"}
              >
                {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Auto-Hide Status Banner (Unpinned Mode) */}
          {!isPinned && (
            <div className="px-4 py-1.5 bg-[#0e1622] border-b border-[#223246]/60 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-emerald-400" />
                <span>הסתרה בעוד {secondsRemaining} שנ׳</span>
              </span>
              <button
                onClick={togglePin}
                className="text-[10px] text-emerald-400 hover:underline font-semibold"
              >
                הצמד קבוע
              </button>
            </div>
          )}

          {/* Navigation Links Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
            {/* Primary Navigation Items (Requested list) */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                פעולות מרכזיות
              </span>

              {NAV_ITEMS.map(({ to, label, subLabel, icon: Icon, badge, highlight }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-bold transition group ${
                      active
                        ? "bg-emerald-600 text-white shadow-md font-extrabold"
                        : highlight
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
                          : "text-slate-300 hover:bg-[#1a2636] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                          active
                            ? "bg-white/20 text-white"
                            : highlight
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-[#0b1118] text-slate-400 group-hover:text-emerald-400"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-right">
                        <div className="leading-tight">{label}</div>
                        {subLabel && (
                          <div
                            className={`text-[10px] font-normal leading-tight ${
                              active ? "text-white/80" : "text-slate-400"
                            }`}
                          >
                            {subLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {badge && (
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          active
                            ? "bg-white/25 text-white"
                            : "bg-[#0b1118] text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Special Action: עריכת תעודה (קנבס) with modal trigger */}
              <ScanSplitterModal
                triggerButton={
                  <button
                    type="button"
                    className="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-bold transition text-slate-300 hover:bg-[#1a2636] hover:text-white group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0b1118] text-slate-400 group-hover:text-emerald-400 transition">
                        <PenTool className="h-4 w-4" />
                      </div>
                      <div className="text-right">
                        <div className="leading-tight">עריכת תעודה (קנבס)</div>
                        <div className="text-[10px] font-normal text-slate-400 leading-tight">
                          חיתוך סריקות וחתימות
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-amber-400">
                      קנבס
                    </span>
                  </button>
                }
              />
            </div>

            {/* Drivers Direct Shortcuts */}
            <div className="space-y-1 pt-2 border-t border-[#223246]/60">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                נהגי הצי
              </span>
              {FLEET_DRIVERS.map(({ to, label, subLabel, color }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-[#1a2636] text-white border border-[#223246]"
                        : "text-slate-300 hover:bg-[#1a2636] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <div className="font-bold text-xs">{label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{subLabel}</div>
                      </div>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
                  </Link>
                );
              })}
            </div>

            {/* System Utilities */}
            <div className="space-y-1 pt-2 border-t border-[#223246]/60">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                מערכת ובקרה
              </span>
              {SYSTEM_LINKS.map(({ to, label, icon: Icon }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition ${
                      active
                        ? "text-emerald-400 font-bold bg-[#1a2636]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-[#1a2636]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sidebar Footer User Card */}
          <div className="p-3.5 border-t border-[#223246] bg-[#101823] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                רמ
              </div>
              <div>
                <div className="font-bold text-white leading-tight">ראמי מסארווה</div>
                <div className="text-[10px] text-slate-400">סדרן עבודה ואיש שטח</div>
              </div>
            </div>

            <Link
              to="/status"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition"
              title="סטטוס חיבור לגיליון"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>גיליון חי</span>
            </Link>
          </div>
        </aside>

        {/* MAIN CONTENT AREA: Expands to 100% width when sidebar auto-hides ("כל דף נפרס מלא") */}
        <div
          className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
            isPinned ? "lg:mr-72" : "mr-0"
          }`}
        >
          {/* Mobile Top Header (Small Screens Only) */}
          <header className="lg:hidden sticky top-0 z-40 border-b border-[#223246] bg-[#131c26]/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="p-2 rounded-xl border border-[#223246] text-slate-300 hover:text-white hover:bg-slate-800"
                title="פתח תפריט"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link to="/" className="flex items-center gap-2">
                <img
                  src={noa}
                  alt="נועה"
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-emerald-500"
                />
                <span className="font-bold text-sm text-white">ח. סבן לוגיסטיקה</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/chat"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>נועה AI</span>
              </Link>
            </div>
          </header>

          {/* Page Content: Expands to full screen width */}
          <main className="flex-1 w-full pb-20 lg:pb-8">{children}</main>

          {/* Desktop Compact Footer */}
          <footer className="border-t border-[#223246]/60 bg-[#0d141f] py-3.5 px-6 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <div>ח. סבן חומרי בניין (1994) בע״מ · מערכת סידור חכם ובקרת תעודות משלוח וטכוגרף</div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <Link to="/status" className="hover:text-emerald-400 transition">
                מצב שרת: תקין 🟢
              </Link>
              <span>·</span>
              <button onClick={togglePin} className="hover:text-white transition">
                מצב סרגל: {isPinned ? "מוצמד" : "הסתרה אוטומטית"}
              </button>
            </div>
          </footer>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Thumb Friendly) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#131c26]/95 backdrop-blur-md border-t border-[#223246] px-2 py-1 flex items-center justify-around shadow-2xl">
        <Link
          to="/"
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[11px] font-semibold transition ${
            isActive("/") && pathname === "/"
              ? "text-emerald-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>דשבורד</span>
        </Link>

        <Link
          to="/orders"
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[11px] font-semibold transition ${
            isActive("/orders")
              ? "text-emerald-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Package className="h-5 w-5" />
          <span>הזמנות</span>
        </Link>

        {/* Noah AI Center Button */}
        <Link
          to="/chat"
          className={`relative -top-3 flex flex-col items-center justify-center h-12 w-12 rounded-full shadow-lg transition border-2 ${
            isActive("/chat")
              ? "bg-emerald-600 border-white text-white shadow-emerald-500/30 scale-105"
              : "bg-[#162230] border-emerald-500 text-emerald-400 hover:scale-105"
          }`}
        >
          <Sparkles className="h-6 w-6" />
        </Link>

        <Link
          to="/notes"
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[11px] font-semibold transition ${
            isActive("/notes")
              ? "text-emerald-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="h-5 w-5" />
          <span>תעודות</span>
        </Link>

        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition"
        >
          <Menu className="h-5 w-5" />
          <span>עוד</span>
        </button>
      </nav>

      {/* MOBILE FULL DRAWER MODAL */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs lg:hidden"
          dir="rtl"
        >
          <div className="absolute inset-0" onClick={() => setIsMobileDrawerOpen(false)} />
          <div className="relative z-10 w-full max-w-xs h-full bg-[#131c26] border-r border-[#223246] p-5 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-[#223246] pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <img
                  src={noa}
                  alt="נועה"
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-emerald-500"
                />
                <span className="font-bold text-white text-sm">ח. סבן לוגיסטיקה</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-xl border border-[#223246] text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 flex-1">
              {NAV_ITEMS.map(({ to, label, subLabel, icon: Icon, badge }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                    isActive(to)
                      ? "bg-emerald-600 text-white"
                      : "text-slate-300 hover:bg-[#1a2636] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-emerald-400" />
                    <div>
                      <div>{label}</div>
                      {subLabel && (
                        <div className="text-[10px] font-normal text-slate-400">{subLabel}</div>
                      )}
                    </div>
                  </div>
                  {badge && (
                    <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-emerald-400">
                      {badge}
                    </span>
                  )}
                </Link>
              ))}

              <div className="pt-3 border-t border-[#223246] space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block px-2">
                  נהגים
                </span>
                {FLEET_DRIVERS.map(({ to, label, subLabel, color }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-[#1a2636]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span>{label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{subLabel}</span>
                  </Link>
                ))}
              </div>

              <div className="pt-3 border-t border-[#223246] space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block px-2">
                  מערכת
                </span>
                {SYSTEM_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-[#223246]/70 bg-[#101823] px-4 py-4 sm:px-8">
      <div className="w-full flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-slate-400 font-sans leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function StatusPill({ s }: { s: "ok" | "warn" | "fail" }) {
  const m = {
    ok: ["bg-emerald-500/15 text-emerald-400 border border-emerald-500/30", "🟢 מאומת"],
    warn: ["bg-amber-500/20 text-amber-300 border border-amber-500/30", "⚠️ חריגה"],
    fail: ["bg-red-500/15 text-red-400 border border-red-500/30", "🔴 נכשל"],
  }[s];
  return (
    <span className={`inline-flex items-center rounded-xl px-2.5 py-0.5 text-xs font-bold ${m[0]}`}>
      {m[1]}
    </span>
  );
}

export default AppShell;
