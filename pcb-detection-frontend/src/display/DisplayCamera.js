import React, { useState, useEffect, useRef } from "react";
import { Camera, Play, Square, Video, Radio } from "lucide-react";
import { useDisplay } from "./DisplayContext.js";

export default function DisplayCamera() {
  const { theme } = useDisplay();
  const isDark = theme === "dark";

  const [cameraFeed, setCameraFeed] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

  const processImageQueue = () => {
    if (imageQueueRef.current.length >= 2) {
      const [cameraData] = imageQueueRef.current.splice(0, 2);
      const cameraBlob = new Blob([cameraData], { type: "image/jpeg" });
      const cameraUrl = URL.createObjectURL(cameraBlob);
      setCameraFeed((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return cameraUrl;
      });
      frameCountRef.current++;
      setFrameCount((prev) => prev + 1);
    }
  };

  const startFpsCounter = () => {
    stopFpsCounter();
    timerRef.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
  };

  const stopFpsCounter = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startDetection = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("Connecting...");
    setIsStreaming(false);
    imageQueueRef.current = [];

    const ws = new WebSocket(
      `ws://${window.location.hostname}:8000/ws/pcb-detection`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsStreaming(true);
      setStatus("Connected");
      startFpsCounter();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          imageQueueRef.current.push(new Uint8Array(reader.result));
          processImageQueue();
        };
        reader.readAsArrayBuffer(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("Camera WebSocket error:", error);
      setStatus("Error");
      stopDetection();
    };

    ws.onclose = () => {
      stopDetection();
    };
  };

  const stopDetection = () => {
    stopFpsCounter();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
    setStatus("Disconnected");
    setFps(0);
    imageQueueRef.current = [];

    if (cameraFeed) {
      URL.revokeObjectURL(cameraFeed);
      setCameraFeed(null);
    }
  };

  useEffect(() => {
    return () => {
      stopDetection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold">
              กล้องตรวจจับ (Camera Live Stream & Test)
            </h2>
            <p className="text-[11px] text-slate-400">
              ทดสอบสัญญาณภาพจากกล้อง Raspberry Pi และประมวลผลเส้นโครงร่าง PCB
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <div className="text-[10px] text-slate-400">FPS</div>
            <div className="text-sm sm:text-base font-bold text-cyan-400">
              {fps}
            </div>
          </div>
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              isStreaming
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-slate-800/40 border-slate-700/60 text-slate-400"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isStreaming ? "bg-emerald-400 animate-ping" : "bg-slate-500"
              }`}
            />
            <span>{status}</span>
          </div>
        </div>
      </div>

      {/* Main Camera Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1">
        <div
          className={`lg:col-span-9 rounded-2xl border overflow-hidden flex flex-col justify-center items-center relative min-h-[300px] sm:min-h-[380px] shadow-inner ${
            isDark
              ? "bg-[#02050b] border-cyan-500/30"
              : "bg-slate-950 border-slate-300"
          }`}
        >
          {cameraFeed ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={cameraFeed}
                alt="Camera Live Stream"
                className="w-full h-auto max-h-[65vh] object-contain"
              />
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-lg border border-cyan-500/40 text-xs font-mono text-cyan-300 flex items-center gap-2 pointer-events-none">
                <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span>ONLINE</span>
                <span>|</span>
                <span>{fps} FPS</span>
              </div>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <div
                className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-3 ${
                  isDark
                    ? "bg-cyan-950/40 border-cyan-800/40 text-cyan-400"
                    : "bg-slate-800 border-slate-700 text-cyan-300"
                }`}
              >
                <Video className="w-8 h-8" />
              </div>
              <div className="text-sm sm:text-base font-semibold text-slate-200">
                {isStreaming ? "กำลังดึงข้อมูลสตรีมภาพ..." : "กล้องยังไม่เริ่มทำงาน"}
              </div>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                กดปุ่ม "เริ่มสตรีมภาพ" ด้านขวาเพื่อรับสัญญาณภาพจากกล้องแบบเรียลไทม์
              </p>
            </div>
          )}
        </div>

        {/* Right Touch Controls Panel */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Action Buttons */}
          <div
            className={`rounded-2xl border p-3.5 shadow-md space-y-3 ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
                : "bg-white border-slate-200 text-slate-800"
            }`}
          >
            <h3 className="text-xs font-bold tracking-wide">
              แผงควบคุมกล้อง (Touch Controls)
            </h3>

            {/* Start Button */}
            <button
              onClick={startDetection}
              disabled={isStreaming}
              className={`touch-btn w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                isStreaming
                  ? "bg-emerald-950/40 border border-emerald-800/40 text-emerald-600 opacity-50 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)] border border-emerald-400/40"
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>เริ่มสตรีมภาพ</span>
            </button>

            {/* Stop Button */}
            <button
              onClick={stopDetection}
              disabled={!isStreaming}
              className={`touch-btn w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                !isStreaming
                  ? "bg-rose-950/30 border border-rose-900/30 text-rose-600 opacity-50 cursor-not-allowed"
                  : "bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.35)] border border-rose-400/40"
              }`}
            >
              <Square className="w-4 h-4 fill-current" />
              <span>หยุดสตรีม</span>
            </button>
          </div>

          {/* Camera Info Card */}
          <div
            className={`rounded-2xl border p-3.5 shadow-md flex-1 text-xs space-y-2.5 ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
                : "bg-white border-slate-200 text-slate-800"
            }`}
          >
            <h3 className="text-xs font-bold tracking-wide">
              สถานะฮาร์ดแวร์
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-700/40">
                <span className="text-slate-400">โปรโตคอล</span>
                <span className="font-mono font-semibold text-cyan-400">
                  WebSocket
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/40">
                <span className="text-slate-400">Endpoint</span>
                <span className="font-mono text-[11px] text-slate-300">
                  /ws/pcb-detection
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/40">
                <span className="text-slate-400">จำนวนเฟรม</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {frameCount}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">ความเร็วเฉลี่ย</span>
                <span className="font-mono font-semibold text-cyan-300">
                  {fps} เฟรม/วินาที
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
