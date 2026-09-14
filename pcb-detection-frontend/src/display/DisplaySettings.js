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
    <div className="flex-1 flex flex-col gap-3 p-3 sm:p-4 overflow-y-auto touch-scrollbar">
      {/* Top Header Card */}
      <div
        className={`rounded-2xl border p-3 sm:p-4 shadow-md flex items-center justify-between ${
          isDark
            ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isDark
                ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-400"
                : "bg-blue-50 border-blue-200 text-blue-600"
            }`}
          >
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold">
              ตั้งค่าระบบ (Display & System Settings)
            </h2>
            <p className="text-[11px] text-slate-400">
              ปรับแต่งธีมขาว-ดำ แสงสว่างหน้าจอ และค่าพารามิเตอร์การคัดแยกบนจอสัมผัส 7 นิ้ว
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-xs font-semibold animate-pulse">
            <Check className="w-3.5 h-3.5" />
            <span>บันทึกสำเร็จ</span>
          </div>
        )}
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* 1. Theme Selection: Dark / Light */}
        <div
          className={`rounded-2xl border p-4 shadow-md space-y-3 ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-bold">
              ธีมการแสดงผล (Theme: ขาว / ดำ)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            เลือกธีมการแสดงผลที่เหมาะสมกับสภาพแสงในโรงงาน
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Dark Theme Button */}
            <button
              onClick={() => setTheme("dark")}
              className={`touch-btn p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                isDark
                  ? "bg-gradient-to-br from-cyan-950 to-blue-950 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-2 ring-cyan-400"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Moon className="w-6 h-6 text-cyan-400" />
              <div className="text-xs font-bold">ธีมมืด (Cyber Dark)</div>
              <div className="text-[10px] text-slate-400">พื้นหลังสีเข้ม สบายตา</div>
            </button>

            {/* Light Theme Button */}
            <button
              onClick={() => setTheme("light")}
              className={`touch-btn p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                !isDark
                  ? "bg-gradient-to-br from-blue-50 to-slate-100 border-blue-500 text-slate-900 shadow-md ring-2 ring-blue-500"
                  : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Sun className="w-6 h-6 text-amber-500" />
              <div className="text-xs font-bold">ธีมสว่าง (Clean Light)</div>
              <div className="text-[10px] text-slate-400">พื้นหลังสีขาว ชัดเจนในที่สว่าง</div>
            </button>
          </div>
        </div>

        {/* 2. Screen Brightness / Dimmer (ธีม / แสง option) */}
        <div
          className={`rounded-2xl border p-4 shadow-md space-y-3 ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-bold">
              ความสว่างหน้าจอ (Screen Brightness / Dimmer)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            ปรับระดับแสงสว่างเพื่อความเหมาะสมบนจอ 7 นิ้ว Raspberry Pi
          </p>

          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">ระดับความสว่าง</span>
              <span className="font-bold text-amber-400 text-sm">
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
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>20% (หรี่แสง)</span>
              <span>60% (มาตรฐาน)</span>
              <span>100% (สว่างสุด)</span>
            </div>
          </div>
        </div>

        {/* 3. Pass / Fail Threshold */}
        <div
          className={`rounded-2xl border p-4 shadow-md space-y-3 ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-bold">
              เกณฑ์ความแม่นยำในการผ่าน (Pass Threshold %)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            ชิ้นงานที่ได้คะแนน &ge; เกณฑ์นี้จะถือว่าผ่านการตรวจสอบ (OK)
          </p>

          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">เกณฑ์ปัจจุบัน</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {passThreshold}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPassThreshold((prev) => Math.max(50, prev - 5))}
                className={`touch-btn w-12 h-10 rounded-xl font-bold text-base border flex items-center justify-center ${
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
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <button
                onClick={() => setPassThreshold((prev) => Math.min(99, prev + 5))}
                className={`touch-btn w-12 h-10 rounded-xl font-bold text-base border flex items-center justify-center ${
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
          className={`rounded-2xl border p-4 shadow-md space-y-3 ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-bold">
              เลือกต้นแบบ PCB ที่กำลังตรวจจับ (Active PCB ID)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            ระบบจะใช้ภาพต้นแบบของ PCB นี้ในการเปรียบเทียบบนสายพาน
          </p>

          <div className="pt-2 flex items-center gap-3">
            <input
              type="text"
              value={activePcbId}
              onChange={(e) => setActivePcbId(e.target.value)}
              className={`flex-1 py-2.5 px-3 rounded-xl border font-mono text-sm font-bold ${
                isDark
                  ? "bg-[#040b17] border-cyan-500/40 text-cyan-300 focus:border-cyan-400"
                  : "bg-slate-50 border-slate-300 text-slate-800 focus:border-blue-500"
              }`}
              placeholder="ระบุ PCB ID เช่น 1"
            />
            <button
              onClick={handleSave}
              className="touch-btn py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all"
            >
              บันทึก
            </button>
          </div>

          {availablePcbs.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-slate-400 self-center">
                PCB ในระบบ:
              </span>
              {availablePcbs.slice(0, 5).map((p) => (
                <button
                  key={p.pcb_id}
                  onClick={() => setActivePcbId(String(p.pcb_id))}
                  className={`touch-btn text-[11px] px-2 py-0.5 rounded-lg border font-mono ${
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

      {/* Kiosk Mode & Touchscreen Information */}
      <div
        className={`rounded-2xl border p-4 shadow-md flex items-center justify-between ${
          isDark
            ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-cyan-400" />
          <div>
            <h4 className="text-xs sm:text-sm font-bold">
              โหมดเต็มหน้าจอสำหรับจอสัมผัส 7 นิ้ว (Kiosk Fullscreen Mode)
            </h4>
            <p className="text-[11px] text-slate-400">
              ซ่อนแถบเบราว์เซอร์เพื่อแสดงผลเต็มพื้นที่จอสัมผัส Raspberry Pi
            </p>
          </div>
        </div>

        <button
          onClick={toggleFullscreen}
          className={`touch-btn py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
            isDark
              ? "bg-[#0e2547] border-cyan-500/50 text-cyan-300 hover:bg-[#153461]"
              : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {isFullscreen ? (
            <>
              <Minimize className="w-4 h-4" />
              <span>ย่อหน้าต่าง</span>
            </>
          ) : (
            <>
              <Maximize className="w-4 h-4" />
              <span>เปิดเต็มจอ (Fullscreen)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
