import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Factory,
  Home,
  Camera,
  BarChart3,
  Archive,
  Settings,
  Maximize,
  Minimize,
  LogOut,
} from "lucide-react";
import { DisplayProvider, useDisplay } from "./DisplayContext.js";
import DisplayProcess from "./DisplayProcess.js";
import DisplayCamera from "./DisplayCamera.js";
import DisplayPerformance from "./DisplayPerformance.js";
import DisplayLogs from "./DisplayLogs.js";
import DisplaySettings from "./DisplaySettings.js";
import "./displayTheme.css";
import "./factoryWorkflow.css";

function DisplayLayout() {
  const { theme, brightness, activePcbId, isFullscreen, toggleFullscreen } =
    useDisplay();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  // Tab: "home" | "camera" | "performance" | "logs" | "settings"
  const [activeTab, setActiveTab] = useState("home");

  // Clock state (Thai Buddhist Era)
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const thaiMonths = [
        "ม.ค.",
        "ก.พ.",
        "มี.ค.",
        "เม.ย.",
        "พ.ค.",
        "มิ.ย.",
        "ก.ค.",
        "ส.ค.",
        "ก.ย.",
        "ต.ค.",
        "พ.ย.",
        "ธ.ค.",
      ];
      const day = now.getDate();
      const month = thaiMonths[now.getMonth()];
      const year = now.getFullYear() + 543;
      setCurrentDate(`${day} ${month} ${year}`);

      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Navigation Items matching design.png
  const navItems = [
    {
      id: "home",
      label: "หน้าหลัก",
      icon: Home,
    },
    {
      id: "camera",
      label: "กล้องตรวจจับ",
      icon: Camera,
    },
    {
      id: "performance",
      label: "ประสิทธิภาพ",
      icon: BarChart3,
    },
    {
      id: "logs",
      label: "บันทึกข้อมูล",
      icon: Archive,
    },
    {
      id: "settings",
      label: "ตั้งค่า",
      icon: Settings,
    },
  ];

  return (
    <div
      className={`min-h-screen w-full flex flex-col font-sans select-none overflow-hidden relative ${
        isDark
          ? "bg-[#050816] text-white display-grid-dark"
          : "bg-slate-100 text-slate-800 display-grid-light"
      }`}
      style={{
        filter: brightness < 100 ? `brightness(${brightness}%)` : "none",
      }}
    >
      {/* ==================== 1. TOP HEADER BAR ==================== */}
      <header
        className={`relative z-20 h-14 sm:h-16 px-3 sm:px-5 flex items-center justify-between border-b shadow-md transition-colors ${
          isDark
            ? "bg-[#050c18]/95 border-cyan-500/25 text-white"
            : "bg-white/95 border-slate-200 text-slate-800"
        }`}
      >
        {/* Left: System Title matching design.png */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shadow-sm ${
              isDark
                ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border-cyan-400/40 text-cyan-400"
                : "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300 text-blue-600"
            }`}
          >
            <Factory className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className={`text-xs sm:text-base font-bold tracking-tight ${
                  isDark
                    ? "bg-gradient-to-r from-white via-cyan-100 to-cyan-300 text-transparent bg-clip-text"
                    : "text-slate-900"
                }`}
              >
                Smart Conveyor Inspection System
              </h1>
              {activePcbId && (
                <span
                  className={`hidden md:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isDark
                      ? "bg-cyan-950/80 border-cyan-500/40 text-cyan-300"
                      : "bg-slate-100 border-slate-300 text-slate-700"
                  }`}
                >
                  PCB #{activePcbId}
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block">
              ระบบตรวจสอบวัตถุด้วยกล้องและสายพานลำเลียง (Raspberry Pi 7" Display)
            </p>
          </div>
        </div>

        {/* Right: Date/Clock & Status Badge matching design.png */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Thai Date & Live Digital Clock */}
          <div className="text-right font-mono">
            <div className="text-[10px] sm:text-[11px] text-slate-400 tracking-wider">
              {currentDate}
            </div>
            <div className="text-xs sm:text-base font-bold text-cyan-400 tracking-widest">
              {currentTime}
            </div>
          </div>

          {/* System Status Pill Badge */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-sm transition-all shadow-sm ${
              isDark
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                : "bg-emerald-50 border-emerald-300 text-emerald-700"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ระบบทำงานปกติ</span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`touch-btn p-2 rounded-xl border transition-colors ${
              isDark
                ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
            }`}
            title="สลับเต็มหน้าจอ (Kiosk Mode)"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* ==================== 2. MAIN BODY (SIDEBAR + CONTENT) ==================== */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Left Touch-Friendly Navigation Sidebar */}
        <aside
          className={`w-18 sm:w-44 border-r flex flex-col justify-between py-3 shrink-0 transition-colors ${
            isDark
              ? "bg-[#040a14]/90 backdrop-blur-md border-cyan-500/20"
              : "bg-white/95 border-slate-200"
          }`}
        >
          {/* Navigation Menu */}
          <nav className="space-y-1.5 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`touch-btn w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? isDark
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/40"
                        : "bg-blue-600 text-white shadow-md border border-blue-500"
                      : isDark
                      ? "text-slate-400 hover:text-white hover:bg-[#0c182c]/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 mx-auto sm:mx-0" />
                  <span className="hidden sm:inline-block truncate">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Link to return to main desktop factory website */}
          <div className="px-2 pt-2 border-t border-slate-700/30">
            <button
              onClick={() => navigate("/home-factory")}
              className={`touch-btn w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-100"
              }`}
              title="กลับสู่เว็บไซต์เดิม"
            >
              <LogOut className="w-4 h-4 shrink-0 mx-auto sm:mx-0" />
              <span className="hidden sm:inline truncate">กลับสู่เว็บหลัก</span>
            </button>
          </div>
        </aside>

        {/* Dynamic Content Viewport */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === "home" && (
            <DisplayProcess onNavigateTab={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === "camera" && <DisplayCamera />}
          {activeTab === "performance" && <DisplayPerformance />}
          {activeTab === "logs" && <DisplayLogs />}
          {activeTab === "settings" && <DisplaySettings />}
        </main>
      </div>
    </div>
  );
}

export default function DisplayApp() {
  const { pcb_id } = useParams();
  return (
    <DisplayProvider initialPcbId={pcb_id || "1"}>
      <DisplayLayout />
    </DisplayProvider>
  );
}
