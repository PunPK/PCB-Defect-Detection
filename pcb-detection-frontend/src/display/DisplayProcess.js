import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Video,
  Camera,
  Layers,
  Play,
  Square,
  BarChart3,
  CheckCircle2,
  XCircle,
  Archive,
  ChevronDown,
  Sparkles,
  Sliders,
  Lightbulb,
  Radio,
  Cpu,
  X,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDisplay } from "./DisplayContext.js";

export default function DisplayProcess({ onNavigateTab }) {
  const { theme, activePcbId, passThreshold } = useDisplay();
  const isDark = theme === "dark";

  // Control & Streaming States
  const [isRunning, setIsRunning] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraFeed, setCameraFeed] = useState(null);
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState("Disconnected");
  const [sensorTriggered, setSensorTriggered] = useState(false);

  // PCB On Conveyor State: "none" | "approaching" | "inspecting" | "ejecting"
  // User note: "โดยจะมีการตรวจจับ PCB ทีละแผ่น ถ้ามี PCB จะแสดงบนสายพาน และเมื่อประมวลผลเสร็จ จะขึ้นมาที่ด้านข้าง"
  const [conveyorPcbState, setConveyorPcbState] = useState("none");

  // Backend Result Data
  const [resultData, setResultData] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [previewSample, setPreviewSample] = useState(null);
  const [isMoreSamplesOpen, setIsMoreSamplesOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Refs
  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

  // Fetch Result Data for current PCB
  const fetchResultData = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result_pcb_working/${id}`
      );
      if (response.ok) {
        const data = await response.json();
        setResultData(data);
      }
    } catch (error) {
      console.error("Error fetching display result data:", error);
    }
  }, []);

  // Fetch Original PCB Template
  const fetchOriginalImage = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_images/${id}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          setOriginalImage(data);
        }
      }
    } catch (error) {
      console.error("Error fetching original PCB image:", error);
    }
  }, []);

  useEffect(() => {
    if (activePcbId) {
      fetchResultData(activePcbId);
      fetchOriginalImage(activePcbId);
    }
  }, [activePcbId, fetchResultData, fetchOriginalImage]);

  // WebSocket Image Queue Processor
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
    }
  };

  // FPS Counter
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

  // Start Detection WebSocket
  const startDetection = () => {
    if (!activePcbId) {
      alert("กรุณาระบุหรือเลือกหมายเลข PCB ก่อนเริ่มตรวจจับ");
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("Connecting...");
    setIsStreaming(false);
    setIsRunning(true);
    setConveyorPcbState("approaching");
    imageQueueRef.current = [];

    const ws = new WebSocket(
      `ws://${window.location.hostname}:8000/factory/ws/factory-workflow?pcb_id=${activePcbId}`
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
      } else {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "new_result") {
            // A PCB is detected and inspected!
            setSensorTriggered(true);
            setConveyorPcbState("inspecting");

            setTimeout(() => {
              setConveyorPcbState("ejecting");
              setSensorTriggered(false);
            }, 800);

            setTimeout(() => {
              // After ejecting, refresh backend results and reset for next PCB
              fetchResultData(activePcbId);
              setConveyorPcbState("approaching");
            }, 1800);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Error");
      stopDetection();
    };

    ws.onclose = () => {
      stopDetection();
    };
  };

  // Stop Detection WebSocket
  const stopDetection = () => {
    stopFpsCounter();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
    setIsRunning(false);
    setStatus("Disconnected");
    setConveyorPcbState("none");
    setFps(0);
    imageQueueRef.current = [];

    if (cameraFeed) {
      URL.revokeObjectURL(cameraFeed);
      setCameraFeed(null);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopFpsCounter();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Compute Metrics from Backend Data
  const hasResults = Boolean(
    resultData?.result_List && resultData.result_List.length > 0
  );
  const totalCount = hasResults ? resultData.result_List.length : 0;
  const passedItems = hasResults
    ? resultData.result_List.filter(
        (item) => (item.accuracy ?? 0) >= passThreshold
      )
    : [];
  const failedItems = hasResults
    ? resultData.result_List.filter(
        (item) => (item.accuracy ?? 0) < passThreshold
      )
    : [];
  const okCount = hasResults ? passedItems.length : 0;
  const ngCount = hasResults ? failedItems.length : 0;
  const okPercent =
    totalCount > 0 ? ((okCount / totalCount) * 100).toFixed(1) : "0.0";
  const ngPercent =
    totalCount > 0 ? ((ngCount / totalCount) * 100).toFixed(1) : "0.0";
  const avgAccuracy =
    totalCount > 0
      ? (
          resultData.result_List.reduce(
            (sum, item) => sum + (item.accuracy || 0),
            0
          ) / totalCount
        ).toFixed(1)
      : "0.0";

  // Recent Samples List (Latest first)
  const recentSamples = hasResults
    ? [...resultData.result_List].reverse().map((item, idx) => ({
        id: item.results_id,
        results_id: item.results_id,
        name: item.name || `PCB #${item.results_id || idx + 1}`,
        accuracy:
          item.accuracy !== null && item.accuracy !== undefined
            ? Number(item.accuracy).toFixed(1)
            : null,
        status: (item.accuracy ?? 0) >= passThreshold ? "OK" : "NG",
        description:
          item.description ||
          ((item.accuracy ?? 0) >= passThreshold
            ? "ผ่านเกณฑ์คุณภาพ"
            : "พบข้อบกพร่อง"),
        time: item.imageList?.uploaded_at
          ? new Date(item.imageList.uploaded_at).toLocaleTimeString("th-TH")
          : "-",
        imageData: item.imageList?.image_data || null,
      }))
    : [];

  return (
    <div className="h-full min-h-0 flex flex-col gap-1.5 p-1.5 sm:p-2 overflow-hidden">
      {/* ==================== 2-COLUMN MAIN LAYOUT ==================== */}
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 flex-1 min-h-0">
        {/* ==================== LEFT AREA (8 COLUMNS) ==================== */}
        <div className="col-span-8 flex flex-col gap-1.5 min-h-0">
          {/* 1. TOP CARD: "ภาพจากกล้อง (Live)" */}
          <div
            className={`flex-[1.15] min-h-0 rounded-xl border p-2 shadow-sm flex flex-col ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30"
                : "bg-white border-slate-200"
            }`}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <Video
                  className={`w-3.5 h-3.5 ${
                    isDark ? "text-cyan-400" : "text-blue-600"
                  }`}
                />
                <h2
                  className={`text-xs font-bold tracking-wide ${
                    isDark ? "text-white" : "text-slate-800"
                  }`}
                >
                  ภาพจากกล้อง (Live)
                </h2>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Template PCB button */}
                <button
                  onClick={() => setIsTemplateModalOpen(true)}
                  className={`touch-btn px-2 py-0.5 rounded-lg border text-[10px] flex items-center gap-1 transition-all ${
                    isDark
                      ? "bg-cyan-950/60 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>ภาพต้นแบบ</span>
                </button>

                {/* Camera Status Pill */}
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isStreaming ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span
                    className={
                      isStreaming
                        ? "text-emerald-500 font-semibold"
                        : isDark
                        ? "text-slate-400"
                        : "text-slate-500"
                    }
                  >
                    {isStreaming ? `Live (${fps} FPS)` : status}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Content: Live Viewport + Sample Thumbnails */}
            <div className="flex-1 min-h-0 flex gap-1.5 sm:gap-2">
              {/* Camera Stream Viewport */}
              <div
                className={`flex-1 min-h-0 relative rounded-lg overflow-hidden border flex items-center justify-center ${
                  isDark
                    ? "bg-[#02050b] border-cyan-500/30"
                    : "bg-slate-900 border-slate-300"
                }`}
              >
                {cameraFeed ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                    <img
                      src={cameraFeed}
                      alt="Live Camera Feed"
                      className="w-full h-full object-contain"
                    />

                    {/* HUD Status Overlay */}
                    <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md border border-cyan-500/40 text-[9px] font-mono text-cyan-300 flex items-center gap-1.5 pointer-events-none">
                      <Radio className="w-2.5 h-2.5 text-rose-500 animate-pulse" />
                      <span>LIVE</span>
                      <span>|</span>
                      <span>{fps} FPS</span>
                    </div>

                    {/* Green Inspection Bounding Box on Detected PCB */}
                    {sensorTriggered && (
                      <div className="absolute inset-x-[25%] inset-y-[15%] border-2 border-emerald-400 rounded-lg pointer-events-none animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.5)]">
                        <span className="absolute -top-4 left-1 bg-emerald-500 text-black text-[8px] font-bold px-1 rounded">
                          PCB DETECTED
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Inactive Camera View */
                  <div className="relative w-full h-full flex flex-col items-center justify-center p-2 text-center">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center mb-1 ${
                        isDark
                          ? "bg-cyan-950/40 border-cyan-800/40 text-cyan-400"
                          : "bg-slate-800 border-slate-700 text-cyan-300"
                      }`}
                    >
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-300">
                      {isStreaming
                        ? "กำลังรอสัญญาณภาพ..."
                        : "กล้องยังไม่ได้เริ่มทำงาน"}
                    </div>
                    <p className="text-[9px] text-slate-400 max-w-xs mt-0.5">
                      กดปุ่ม{" "}
                      <span className="text-emerald-400 font-bold">
                        "เริ่มการทำงาน"
                      </span>{" "}
                      ด้านล่างเพื่อเริ่มการตรวจจับ
                    </p>
                  </div>
                )}
              </div>

              {/* Sample Previews Sidebar: "ภาพตัวอย่าง" */}
              <div
                className={`w-32 sm:w-36 md:w-40 shrink-0 flex flex-col justify-between rounded-lg border p-1.5 ${
                  isDark
                    ? "bg-[#040c18] border-cyan-500/20"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-700/30 shrink-0">
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    ภาพตัวอย่าง
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-emerald-400 font-mono">
                    {isStreaming ? "Live" : (hasResults ? "ล่าสุด" : "-")}
                  </span>
                </div>

                {/* Thumbnails Stack */}
                <div className="flex-1 flex flex-col justify-between py-1 min-h-0 space-y-1">
                  {!hasResults || recentSamples.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700/60 p-1 text-center text-slate-400">
                      <span className="text-[9px] font-mono">รอผลการตรวจ</span>
                      <span className="text-[8px] text-slate-500 mt-0.5">
                        แสดงที่นี่เมื่อตรวจเสร็จ
                      </span>
                    </div>
                  ) : (
                    recentSamples.slice(0, 3).map((sample, idx) => (
                      <div
                        key={sample.id || idx}
                        onClick={() => setPreviewSample(sample)}
                        className={`touch-btn p-1 rounded-md border cursor-pointer transition-all flex flex-col justify-between flex-1 min-h-0 ${
                          isDark
                            ? "bg-[#061122] hover:bg-[#0b1b34] border-cyan-500/30"
                            : "bg-white hover:bg-slate-100 border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between leading-none">
                          <span
                            className={`text-[7.5px] sm:text-[8px] font-bold px-1 rounded ${
                              sample.status === "OK"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            }`}
                          >
                            {sample.status}
                          </span>
                          <span className="text-[8.5px] sm:text-[9px] font-mono font-bold text-cyan-400">
                            {sample.accuracy ? `${sample.accuracy}%` : "-"}
                          </span>
                        </div>

                        {/* Thumbnail */}
                        <div className="w-full flex-1 min-h-0 my-0.5 bg-black/80 rounded flex items-center justify-center overflow-hidden">
                          {sample.imageData ? (
                            <img
                              src={`data:image/jpeg;base64,${sample.imageData}`}
                              alt={sample.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Cpu className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[7.5px] sm:text-[8px] text-slate-400 leading-none">
                          <span className="truncate max-w-[55px]">
                            {sample.name}
                          </span>
                          <span className="font-mono">{sample.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* "ดูเพิ่มเติม v" Button */}
                <button
                  onClick={() => setIsMoreSamplesOpen(true)}
                  className={`touch-btn w-full py-0.5 sm:py-1 rounded-md border text-[9px] sm:text-[10px] font-semibold flex items-center justify-center gap-1 shrink-0 transition-colors ${
                    isDark
                      ? "bg-cyan-950/50 hover:bg-cyan-900 border-cyan-500/30 text-cyan-300"
                      : "bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700"
                  }`}
                >
                  <span>ดูเพิ่มเติม</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. BOTTOM CARD: "ภาพรวมระบบ" (Conveyor Belt Simulation with 1 PCB detection) */}
          <div
            className={`flex-1 min-h-0 rounded-xl border p-2 shadow-sm flex flex-col ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <Layers
                  className={`w-3.5 h-3.5 ${
                    isDark ? "text-cyan-400" : "text-blue-600"
                  }`}
                />
                <h2
                  className={`text-xs font-bold tracking-wide ${
                    isDark ? "text-white" : "text-slate-800"
                  }`}
                >
                  ภาพรวมระบบ (Smart Conveyor Belt)
                </h2>
              </div>
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-emerald-500 font-mono font-semibold">
                <span>ทิศทางการลำเลียง</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Industrial Conveyor SVG with 1 Single PCB Detection */}
            <div
              className={`flex-1 min-h-0 w-full rounded-lg overflow-hidden border flex items-center justify-center ${
                isDark
                  ? "bg-gradient-to-b from-[#02050f] via-[#040c1c] to-[#01040a] border-cyan-500/20"
                  : "bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-300"
              }`}
            >
              <svg viewBox="0 0 900 200" className="w-full h-full object-contain">
                <defs>
                  {/* Spotlight Gradient from Camera/Sensor */}
                  <linearGradient
                    id="displayConveyorSpotlight"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor={sensorTriggered ? "#10b981" : "#38bdf8"}
                      stopOpacity={sensorTriggered ? 0.75 : 0.35}
                    />
                    <stop
                      offset="80%"
                      stopColor={sensorTriggered ? "#10b981" : "#38bdf8"}
                      stopOpacity={sensorTriggered ? 0.3 : 0.1}
                    />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>

                  {/* Metal Gradients for Stand Legs */}
                  <linearGradient
                    id="metalStand"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#64748b" />
                    <stop offset="50%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                </defs>

                {/* Camera Overhead Housing & Light Beam */}
                <polygon
                  points="420,25 480,25 550,140 350,140"
                  fill="url(#displayConveyorSpotlight)"
                  className={sensorTriggered ? "laser-scanner" : ""}
                />

                <g transform="translate(425, 4)">
                  <rect
                    x="0"
                    y="0"
                    width="50"
                    height="18"
                    rx="3"
                    fill="#0284c7"
                  />
                  <rect
                    x="10"
                    y="18"
                    width="30"
                    height="8"
                    rx="2"
                    fill={sensorTriggered ? "#10b981" : "#38bdf8"}
                    className={isRunning ? "animate-pulse" : ""}
                  />
                  <circle cx="25" cy="22" r="3" fill="#ffffff" />
                </g>

                {/* Support Legs */}
                <rect x="160" y="130" width="14" height="55" rx="2" fill="url(#metalStand)" stroke="#334155" />
                <rect x="145" y="180" width="44" height="8" rx="2" fill="#0f172a" />

                <rect x="443" y="130" width="14" height="55" rx="2" fill="url(#metalStand)" stroke="#334155" />
                <rect x="428" y="180" width="44" height="8" rx="2" fill="#0f172a" />

                <rect x="724" y="130" width="14" height="55" rx="2" fill="url(#metalStand)" stroke="#334155" />
                <rect x="709" y="180" width="44" height="8" rx="2" fill="#0f172a" />

                {/* Conveyor Bed Rail */}
                <rect
                  x="70"
                  y="120"
                  width="760"
                  height="22"
                  rx="11"
                  fill="#0b1322"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                />

                {/* End Rollers */}
                <circle cx="82" cy="131" r="9" fill="#334155" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="818" cy="131" r="9" fill="#334155" stroke="#38bdf8" strokeWidth="2" />

                {/* Conveyor Moving Belt Surface */}
                <line
                  x1="92"
                  y1="131"
                  x2="808"
                  y2="131"
                  stroke="#1e293b"
                  strokeWidth="14"
                  strokeDasharray="16 8"
                  className={isRunning && isStreaming ? "conveyor-belt-animated" : ""}
                />

                {/* Sensor Post at Center */}
                <g transform="translate(485, 90)">
                  <rect x="0" y="0" width="6" height="42" rx="1" fill="#475569" />
                  <circle
                    cx="3"
                    cy="8"
                    r="5"
                    fill={sensorTriggered ? "#ef4444" : "#10b981"}
                    className={sensorTriggered ? "animate-ping" : ""}
                  />
                  <circle
                    cx="3"
                    cy="8"
                    r="3"
                    fill={sensorTriggered ? "#fca5a5" : "#6ee7b7"}
                  />
                  {sensorTriggered && (
                    <line
                      x1="3"
                      y1="8"
                      x2="-35"
                      y2="40"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  )}
                </g>

                {/* SINGLE PCB ON CONVEYOR (ตรวจจับ PCB ทีละแผ่น) */}
                {/* Dynamically position the single PCB depending on state */}
                {(conveyorPcbState !== "none" || isStreaming) && (
                  <g
                    transform={`translate(${
                      conveyorPcbState === "approaching"
                        ? 250
                        : conveyorPcbState === "inspecting"
                        ? 420
                        : conveyorPcbState === "ejecting"
                        ? 680
                        : 420
                    }, 108)`}
                    className="transition-all duration-700 ease-in-out"
                  >
                    {/* PCB Body */}
                    <rect
                      x="0"
                      y="0"
                      width="60"
                      height="22"
                      rx="4"
                      fill={sensorTriggered ? "#064e3b" : "#0d332d"}
                      stroke={sensorTriggered ? "#34d399" : "#06b6d4"}
                      strokeWidth="2"
                      className={sensorTriggered ? "animate-pulse" : ""}
                    />
                    {/* Chip / IC */}
                    <rect x="20" y="5" width="20" height="12" rx="2" fill="#0284c7" />
                    <circle cx="10" cy="11" r="3" fill="#38bdf8" />
                    <circle cx="50" cy="11" r="3" fill="#38bdf8" />
                    {/* Label Tag */}
                    <text
                      x="30"
                      y="14"
                      fill="#ffffff"
                      fontSize="7"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {conveyorPcbState === "inspecting" ? "INSPECT" : "PCB"}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* 3. BOTTOM CONTROL BAR: Start & Stop (Clean touch buttons matching design.png) */}
          <div
            className={`h-9 sm:h-10 shrink-0 rounded-xl border px-2 sm:px-3 shadow-sm flex items-center justify-between gap-2 ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 flex-1 h-full py-0.5">
              {/* Start Button - Green */}
              <button
                onClick={startDetection}
                disabled={isStreaming}
                className={`touch-btn flex-1 h-full rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                  isStreaming
                    ? "bg-emerald-950/40 border border-emerald-800/40 text-emerald-600 opacity-50 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)] border border-emerald-400/40"
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>เริ่มการทำงาน</span>
              </button>

              {/* Stop Button - Red */}
              <button
                onClick={stopDetection}
                disabled={!isStreaming}
                className={`touch-btn flex-1 h-full rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                  !isStreaming
                    ? "bg-rose-950/30 border border-rose-900/30 text-rose-600 opacity-50 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.35)] border border-rose-400/40"
                }`}
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>หยุดการทำงาน</span>
              </button>
            </div>

            {/* Quick Refresh Data button */}
            <button
              onClick={() => fetchResultData(activePcbId)}
              className={`touch-btn h-full px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                isDark
                  ? "bg-[#0b1e38] border-cyan-500/40 text-cyan-300 hover:bg-[#122e54]"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
              }`}
              title="รีเฟรชข้อมูล"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>

        {/* ==================== RIGHT SIDEBAR (4 COLUMNS) ==================== */}
        <div className="col-span-4 flex flex-col gap-1.5 min-h-0">
          {/* CARD 1: "ผลการตรวจสอบ (ล่าสุด)" */}
          <div
            className={`rounded-xl border p-2 shadow-sm shrink-0 ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <BarChart3
                className={`w-3.5 h-3.5 ${
                  isDark ? "text-cyan-400" : "text-blue-600"
                }`}
              />
              <h2
                className={`text-xs font-bold tracking-wide ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                ผลการตรวจสอบ (ล่าสุด)
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* OK Tile */}
              <div
                className={`rounded-lg p-1.5 border flex flex-col justify-between ${
                  isDark
                    ? "bg-[#041a14]/90 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                    : "bg-emerald-50 border-emerald-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-500 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-500 leading-tight">
                      OK
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-slate-400 leading-none">
                      ผ่านการตรวจ
                    </div>
                  </div>
                </div>

                <div className="mt-1 flex items-baseline justify-between">
                  <span
                    className={`text-lg sm:text-xl font-black font-mono leading-none ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {okCount}
                  </span>
                  <span className="text-[9.5px] sm:text-[10px] font-mono text-emerald-500 font-bold">
                    ({okPercent}%)
                  </span>
                </div>
              </div>

              {/* NG Tile */}
              <div
                className={`rounded-lg p-1.5 border flex flex-col justify-between ${
                  isDark
                    ? "bg-[#1e070c]/90 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.15)]"
                    : "bg-rose-50 border-rose-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-500 shrink-0">
                    <XCircle className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-rose-500 leading-tight">
                      NG
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-slate-400 leading-none">
                      ไม่ผ่านการตรวจ
                    </div>
                  </div>
                </div>

                <div className="mt-1 flex items-baseline justify-between">
                  <span
                    className={`text-lg sm:text-xl font-black font-mono leading-none ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {ngCount}
                  </span>
                  <span className="text-[9.5px] sm:text-[10px] font-mono text-rose-500 font-bold">
                    ({ngPercent}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: "ประสิทธิภาพการตรวจจับ" */}
          <div
            className={`rounded-xl border p-2 shadow-sm shrink-0 ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles
                className={`w-3.5 h-3.5 ${
                  isDark ? "text-cyan-400" : "text-blue-600"
                }`}
              />
              <h2
                className={`text-xs font-bold tracking-wide ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                ประสิทธิภาพการตรวจจับ
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Donut Progress Ring */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={isDark ? "#0f1f38" : "#e2e8f0"}
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="url(#displayAccuracyGrad)"
                    strokeWidth="10"
                    strokeDasharray={251.2}
                    strokeDashoffset={
                      totalCount > 0
                        ? 251.2 - (251.2 * Number(avgAccuracy)) / 100
                        : 251.2
                    }
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient
                      id="displayAccuracyGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span
                    className={`text-xs sm:text-sm font-black font-mono leading-none ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {totalCount > 0 ? `${avgAccuracy}%` : "-"}
                  </span>
                </div>
              </div>

              {/* Rows */}
              <div className="flex-1 space-y-0.5 text-[10px] sm:text-[11px]">
                <div
                  className={`flex items-center justify-between pb-0.5 border-b ${
                    isDark ? "border-slate-800" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1 text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span>ตรวจจับสำเร็จ</span>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      isDark ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {okCount}
                  </span>
                </div>

                <div
                  className={`flex items-center justify-between pb-0.5 border-b ${
                    isDark ? "border-slate-800" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1 text-slate-400">
                    <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>ตรวจจับผิดพลาด</span>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      isDark ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {ngCount}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Archive className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>รวมทั้งหมด</span>
                  </div>
                  <span className="font-mono font-bold text-cyan-400">
                    {totalCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: "สถานะระบบ" */}
          <div
            className={`flex-1 min-h-0 rounded-xl border p-2 shadow-sm flex flex-col justify-between ${
              isDark
                ? "bg-[#07111e]/95 border-cyan-500/30"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 shrink-0">
              <Sliders
                className={`w-3.5 h-3.5 ${
                  isDark ? "text-cyan-400" : "text-blue-600"
                }`}
              />
              <h2
                className={`text-xs font-bold tracking-wide ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                สถานะระบบ
              </h2>
            </div>

            <div className="flex-1 min-h-0 flex flex-col justify-around py-0.5 text-xs">
              {[
                {
                  label: "กล้องตรวจจับ",
                  icon: Camera,
                  statusText: isStreaming ? "ปกติ" : "ไม่ทำงาน",
                  isOk: isStreaming,
                },
                {
                  label: "สายพานลำเลียง",
                  icon: Radio,
                  statusText: isStreaming ? "ปกติ" : "หยุดทำงาน",
                  isOk: isStreaming && isRunning,
                },
                {
                  label: "เซ็นเซอร์ตรวจจับ",
                  icon: Radio,
                  statusText: sensorTriggered ? "ตรวจพบวัตถุ" : "ปกติ",
                  isOk: isStreaming,
                },
                {
                  label: "ระบบควบคุม",
                  icon: Sliders,
                  statusText: isStreaming ? "ปกติ" : "สแตนด์บาย",
                  isOk: isStreaming,
                },
                {
                  label: "ไฟส่องสว่าง",
                  icon: Lightbulb,
                  statusText: isStreaming ? "ปกติ" : "สแตนด์บาย",
                  isOk: isStreaming,
                },
              ].map((row, idx) => {
                const RowIcon = row.icon;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-1 px-2 rounded-md ${
                      isDark
                        ? "bg-[#040a14]/50"
                        : "bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <RowIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="text-[10px] sm:text-[11px] truncate">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px]">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          row.isOk ? "bg-emerald-400" : "bg-slate-400"
                        }`}
                      />
                      <span
                        className={
                          row.isOk ? "text-emerald-500 font-bold" : "text-slate-400"
                        }
                      >
                        {row.statusText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODALS ==================== */}

      {/* 1. Sample Preview Modal */}
      <AnimatePresence>
        {previewSample && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewSample(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-lg w-full rounded-2xl border p-5 shadow-2xl ${
                isDark
                  ? "bg-[#081220] border-cyan-500/40 text-white"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b mb-3 border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      previewSample.status === "OK"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    }`}
                  >
                    {previewSample.status}
                  </span>
                  <h3 className="text-sm font-bold">{previewSample.name}</h3>
                </div>
                <button
                  onClick={() => setPreviewSample(null)}
                  className="w-7 h-7 rounded-full bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Image Preview */}
              <div className="bg-black/90 rounded-xl p-2 flex items-center justify-center max-h-[45vh] overflow-hidden">
                {previewSample.imageData ? (
                  <img
                    src={`data:image/jpeg;base64,${previewSample.imageData}`}
                    alt={previewSample.name}
                    className="max-h-[40vh] max-w-full object-contain rounded"
                  />
                ) : (
                  <div className="text-slate-500 font-mono text-xs py-8">
                    ไม่มีข้อมูลภาพ
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {previewSample.description}
                </span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {previewSample.accuracy ? `${previewSample.accuracy}%` : "-"}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. All Samples History Modal */}
      <AnimatePresence>
        {isMoreSamplesOpen && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsMoreSamplesOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-2xl w-full max-h-[85vh] rounded-2xl border p-5 shadow-2xl flex flex-col ${
                isDark
                  ? "bg-[#081220] border-cyan-500/40 text-white"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b mb-3 border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold">
                    ประวัติผลการตรวจสอบ ({recentSamples.length} รายการ)
                  </h3>
                </div>
                <button
                  onClick={() => setIsMoreSamplesOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 touch-scrollbar pr-1">
                {recentSamples.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-mono text-xs">
                    ยังไม่มีข้อมูลประวัติการตรวจ
                  </div>
                ) : (
                  recentSamples.map((sample, idx) => (
                    <div
                      key={sample.id || idx}
                      onClick={() => {
                        setIsMoreSamplesOpen(false);
                        setPreviewSample(sample);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isDark
                          ? "bg-[#040b17] hover:bg-[#0b1b34] border-slate-800"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            sample.status === "OK"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          }`}
                        >
                          {sample.status}
                        </span>
                        <div>
                          <div className="text-xs font-semibold">{sample.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {sample.description}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-cyan-400">
                          {sample.accuracy ? `${sample.accuracy}%` : "-"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {sample.time}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Original PCB Template Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsTemplateModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-lg w-full rounded-2xl border p-5 shadow-2xl ${
                isDark
                  ? "bg-[#081220] border-cyan-500/40 text-white"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b mb-3 border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold">
                    ภาพต้นแบบแผ่นวงจร (PCB Template #{activePcbId})
                  </h3>
                </div>
                <button
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {originalImage?.image_data ? (
                <div className="space-y-3">
                  <div className="bg-black/80 rounded-xl p-2 flex items-center justify-center max-h-[45vh] overflow-hidden">
                    <img
                      src={`data:image/jpeg;base64,${originalImage.image_data}`}
                      alt="Original PCB Template"
                      className="max-h-[40vh] max-w-full object-contain rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>{originalImage.filename || "template.jpg"}</span>
                    <span>
                      {originalImage.uploaded_at
                        ? new Date(originalImage.uploaded_at).toLocaleDateString("th-TH")
                        : "-"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">
                  ไม่พบภาพต้นแบบ PCB #{activePcbId}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
