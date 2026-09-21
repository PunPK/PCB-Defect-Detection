import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import {
  Cpu,
  Home,
  ClipboardList,
  Cctv,
  Monitor,
  Redo2,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useFactoryTheme } from "../factoryPage/theme.js";

const navigation = [
  { name: "สถานีตรวจสอบ", en: "Station", href: "/home-factory", icon: Home, match: ["/home-factory", "/factoryWorkflow", "/camDetectPCB", "/fileDetectPCB"] },
  { name: "บันทึกผลการตรวจ", en: "Records", href: "/results", icon: ClipboardList, match: ["/results", "/details"] },
  { name: "ทดสอบกล้อง", en: "Camera", href: "/testcam", icon: Cctv, match: ["/testcam"] },
  { name: "จอแสดงผล 7\"", en: "Display", href: "/display", icon: Monitor, match: ["/display"] },
  { name: "หน้าหลัก", en: "Home", href: "/", icon: Redo2, match: [] },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
      {now.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" })}{" "}
      {now.toLocaleTimeString("th-TH", { hour12: false })}
    </span>
  );
}

function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useFactoryTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={classNames(
        "inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
        className
      )}
      aria-label={isDark ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

export default function FactoryBar() {
  const { pathname } = useLocation();
  const isActive = (item) =>
    item.match.some((m) => pathname.toLowerCase().startsWith(m.toLowerCase()));

  return (
    <Disclosure
      as="nav"
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 print:hidden"
    >
      {({ close }) => (
        <>
          <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 lg:px-6">
            <Link to="/home-factory" className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
                <Cpu className="h-5 w-5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold text-slate-900 sm:text-base dark:text-white">
                  This PCB is suspicious
                </span>
                <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  PCB Quality Inspection System
                </span>
              </span>
            </Link>

            <div className="hidden items-center gap-1 lg:flex">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={classNames(
                      "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden xl:block">
                <Clock />
              </span>
              <ThemeToggle />
              <DisclosureButton className="group inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <span className="sr-only">เปิดเมนู</span>
                <Menu className="h-5 w-5 group-data-[open]:hidden" />
                <X className="hidden h-5 w-5 group-data-[open]:block" />
              </DisclosureButton>
            </div>
          </div>

          <DisclosurePanel className="border-t border-slate-200 lg:hidden dark:border-slate-800">
            <div className="grid grid-cols-1 gap-1 px-3 py-3 sm:grid-cols-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => close()}
                    className={classNames(
                      "flex h-12 items-center gap-3 rounded-md px-3 text-sm font-medium",
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                    <span className="ml-auto text-[11px] uppercase tracking-wider text-slate-400">{item.en}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800">
              <Clock />
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}
