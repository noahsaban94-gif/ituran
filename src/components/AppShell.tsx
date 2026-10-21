import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Truck,
  Disc,
  MapPin,
  Building,
  ShieldAlert,
  Activity,
  Menu,
} from "lucide-react";
import noa from "@/assets/noa.jpg";

export const NAV_ITEMS = [
  { to: "/", label: "ראשי", icon: LayoutDashboard },
  { to: "/ali", label: "עלי", icon: Truck },
  { to: "/hikmat", label: "חכמת", icon: Truck },
  { to: "/tachograph", label: "Tachograph · איתוראן GPS", icon: Disc },
  { to: "/sites", label: "כתובות לקוחות", icon: MapPin },
  { to: "/cities", label: "ערים ומרחקים", icon: Building },
  { to: "/quality", label: "איכות נתונים", icon: ShieldAlert },
  { to: "/status", label: "סטטוס חיבור", icon: Activity },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const isActive = (to: string) => {
    if (to === "/") return pathname === "/";
    return pathname.startsWith(to);
  };

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#f4f1ea] dark:bg-zinc-950 text-foreground"
      dir="rtl"
    >
      {/* Top Header with 8 Navigation Tabs */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={noa}
              alt="נועה"
              width={38}
              height={38}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-primary shadow-xs"
            />
            <div>
              <div className="font-display text-base font-extrabold text-foreground leading-tight">
                ח. סבן לוגיסטיקה
              </div>
              <div className="text-[11px] font-semibold text-primary">
                סידור חכם &amp; בקרה דיגיטלית
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs (8 tabs) */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-primary-foreground" : "text-muted-foreground"}`}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Quick status badge */}
          <div className="flex items-center gap-2">
            <Link
              to="/status"
              className="flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
              title="סטטוס חיבור גיליון ו-Apps Script"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="hidden sm:inline">גיליון חי</span>
            </Link>
          </div>
        </div>

        {/* Tablet / Mobile Horizontal Scrollable Tab Bar */}
        <div className="flex lg:hidden overflow-x-auto border-t bg-card px-2 py-1.5 scrollbar-none">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1 shrink-0 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 pb-16">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-card/60 py-4 text-center text-xs text-muted-foreground">
        ח. סבן חומרי בניין (1994) בע״מ · סידור חכם ובקרת תעודות משלוח וטכוגרף
      </footer>
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
    <div className="border-b bg-card/40 px-4 py-5 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function StatusPill({ s }: { s: "ok" | "warn" | "fail" }) {
  const m = {
    ok: ["bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", "🟢 מאומת"],
    warn: ["bg-amber-500/20 text-amber-800 dark:text-amber-300", "⚠️ חריגה"],
    fail: ["bg-red-500/15 text-red-700 dark:text-red-300", "🔴 נכשל"],
  }[s];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${m[0]}`}>
      {m[1]}
    </span>
  );
}
