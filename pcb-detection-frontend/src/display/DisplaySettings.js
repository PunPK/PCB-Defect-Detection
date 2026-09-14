import React, { useState, useEffect } from "react";
import {
  Settings,
  Sun,
  Moon,
  Lightbulb,
  Maximize,
  Minimize,
  Sliders,
  Layers,
  Check,
  Smartphone,
} from "lucide-react";
import { useDisplay } from "./DisplayContext.js";

export default function DisplaySettings() {
  const {
    theme,
    setTheme,
    brightness,
    setBrightness,
    activePcbId,
    setActivePcbId,
    passThreshold,
    setPassThreshold,
    isFullscreen,
    toggleFullscreen,
  } = useDisplay();

  const isDark = theme === "dark";
  const [availablePcbs, setAvailablePcbs] = useState([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch available PCBs from backend
  useEffect(() => {
    const fetchPcbs = async () => {
      try {
        const response = await fetch(
          `http://${window.location.hostname}:8000/factory/get_all_pcb_results`
        );
        if (response.ok) {
          const data = await response.json();
          if (data?.results && Array.isArray(data.results)) {
            setAvailablePcbs(data.results);
          }
        }
      } catch (err) {
        console.error("Error fetching PCBs for settings:", err);
      }
    };
    fetchPcbs();
  }, []);

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-1.5 p-1.5 sm:p-2 overflow-hidden">
      {/* Top Header Card */}
      <div
        className={`rounded-xl border p-2 shadow-sm flex items-center justify-between shrink-0 ${
          isDark
            ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border shrink-0 ${
              isDark
                ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-400"
                : "bg-blue-50 border-blue-200 text-blue-600"
            }`}
          >
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold">
              ตั้งค่าระบบ (Display & System Settings)
            </h2>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
              ปรับแต่งธีมขาว-ดำ แสงสว่างหน้าจอ และค่าพารามิเตอร์บนจอสัมผัส 7 นิ้ว
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[11px] font-semibold animate-pulse">
            <Check className="w-3 h-3" />
            <span>บันทึกสำเร็จ</span>
          </div>
        )}
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0 overflow-y-auto touch-scrollbar pr-0.5">
        {/* 1. Theme Selection: Dark / Light */}
        <div
          className={`rounded-xl border p-2.5 shadow-sm space-y-1.5 flex flex-col justify-between ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="text-xs font-bold">
                ธีมการแสดงผล (Theme)
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              เลือกธีมที่เหมาะสมกับสภาพแสง
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Dark Theme Button */}
            <button
              onClick={() => setTheme("dark")}
              className={`touch-btn p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                isDark
                  ? "bg-gradient-to-br from-cyan-950 to-blue-950 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)] ring-1.5 ring-cyan-400"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Moon className="w-4 h-4 text-cyan-400" />
              <div className="text-[11px] font-bold">ธีมมืด (Dark)</div>
              <div className="text-[9px] text-slate-400">สบายตา</div>
            </button>

            {/* Light Theme Button */}
            <button
              onClick={() => setTheme("light")}
              className={`touch-btn p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                !isDark
                  ? "bg-gradient-to-br from-blue-50 to-slate-100 border-blue-500 text-slate-900 shadow-sm ring-1.5 ring-blue-500"
                  : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <div className="text-[11px] font-bold">ธีมสว่าง (Light)</div>
              <div className="text-[9px] text-slate-400">ชัดในที่สว่าง</div>
            </button>
          </div>
        </div>

        {/* 2. Screen Brightness / Dimmer */}
        <div
          className={`rounded-xl border p-2.5 shadow-sm space-y-1.5 flex flex-col justify-between ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="text-xs font-bold">
                ความสว่างหน้าจอ (Brightness)
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              ปรับแสงสว่างบนจอ 7 นิ้ว
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">ระดับความสว่าง</span>
              <span className="font-bold text-amber-400">
                {brightness}%
              </span>
            </div>

            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />

            <div className="flex justify-between text-[8.5px] text-slate-400 font-mono">
              <span>20% (หรี่)</span>
              <span>60% (ปกติ)</span>
              <span>100% (สว่าง)</span>
            </div>
          </div>
        </div>

        {/* 3. Pass / Fail Threshold */}
        <div
          className={`rounded-xl border p-2.5 shadow-sm space-y-1.5 flex flex-col justify-between ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold">
                เกณฑ์ความแม่นยำ (Pass Threshold %)
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              คะแนน &ge; เกณฑ์นี้จะถือว่าผ่าน (OK)
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">เกณฑ์ปัจจุบัน</span>
              <span className="font-bold font-mono text-emerald-400 text-xs">
                {passThreshold}%
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPassThreshold((prev) => Math.max(50, prev - 5))}
                className={`touch-btn w-8 h-7 rounded-lg font-bold text-sm border flex items-center justify-center ${
                  isDark
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "bg-slate-100 border-slate-300 hover:bg-slate-200"
                }`}
              >
                -
              </button>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={passThreshold}
                onChange={(e) => setPassThreshold(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <button
                onClick={() => setPassThreshold((prev) => Math.min(99, prev + 5))}
                className={`touch-btn w-8 h-7 rounded-lg font-bold text-sm border flex items-center justify-center ${
                  isDark
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "bg-slate-100 border-slate-300 hover:bg-slate-200"
                }`}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* 4. Active PCB Template Switcher */}
        <div
          className={`rounded-xl border p-2.5 shadow-sm space-y-1.5 flex flex-col justify-between ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold">
                เลือกต้นแบบ PCB (Active PCB ID)
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              ใช้ภาพต้นแบบนี้ในการเปรียบเทียบ
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={activePcbId}
                onChange={(e) => setActivePcbId(e.target.value)}
                className={`flex-1 py-1 px-2 rounded-lg border font-mono text-xs font-bold ${
                  isDark
                    ? "bg-[#040b17] border-cyan-500/40 text-cyan-300 focus:border-cyan-400"
                    : "bg-slate-50 border-slate-300 text-slate-800 focus:border-blue-500"
                }`}
                placeholder="PCB ID เช่น 1"
              />
              <button
                onClick={handleSave}
                className="touch-btn py-1 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm transition-all"
              >
                บันทึก
              </button>
            </div>

            {availablePcbs.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[9px] text-slate-400 self-center">
                  ในระบบ:
                </span>
                {availablePcbs.slice(0, 5).map((p) => (
                  <button
                    key={p.pcb_id}
                    onClick={() => setActivePcbId(String(p.pcb_id))}
                    className={`touch-btn text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                      String(p.pcb_id) === String(activePcbId)
                        ? "bg-cyan-600 text-white border-cyan-400 font-bold"
                        : "bg-slate-800/40 text-slate-300 border-slate-700"
                    }`}
                  >
                    #{p.pcb_id}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kiosk Mode & Touchscreen Information */}
      <div
        className={`rounded-xl border p-2 shadow-sm flex items-center justify-between shrink-0 ${
          isDark
            ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <h4 className="text-xs font-bold">
              โหมดเต็มหน้าจอสำหรับจอสัมผัส 7 นิ้ว (Kiosk Fullscreen)
            </h4>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
              ซ่อนแถบเบราว์เซอร์เพื่อแสดงผลเต็มพื้นที่จอสัมผัส Raspberry Pi
            </p>
          </div>
        </div>

        <button
          onClick={toggleFullscreen}
          className={`touch-btn py-1 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            isDark
              ? "bg-[#0e2547] border-cyan-500/50 text-cyan-300 hover:bg-[#153461]"
              : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {isFullscreen ? (
            <>
              <Minimize className="w-3.5 h-3.5" />
              <span>ย่อหน้าต่าง</span>
            </>
          ) : (
            <>
              <Maximize className="w-3.5 h-3.5" />
              <span>เต็มจอ (Fullscreen)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
