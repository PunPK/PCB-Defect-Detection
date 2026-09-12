import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Factory,
  CheckCircle2,
  XCircle,
  Video,
  Camera,
  Layers,
  Gauge,
  Lightbulb,
  Play,
  Square,
  RotateCcw,
  Settings,
  BarChart3,
  Sliders,
  Cpu,
  ChevronDown,
  ArrowRight,
  Home,
  LogOut,
  X,
  Radio,
  Sparkles,
  ExternalLink,
  Archive,
  Trash2,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import "../page/uploadPage.css";
import "./factoryWorkflow.css";
import Delete from "../components/Delete.js";

export default function ProcessFactoryWorkflow() {
  const { pcb_id } = useParams();
  const navigate = useNavigate();

  // Clock & Thai Date State
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // Control & Operation States
  const [isRunning, setIsRunning] = useState(false);
  const [conveyorSpeed, setConveyorSpeed] = useState(50);
  const [lightBrightness, setLightBrightness] = useState(70);
  const [operationMode, setOperationMode] = useState("auto"); // "auto" | "manual"
  const [activeNav, setActiveNav] = useState("home");

  // Template / Original PCB State
  const [originalImageFactory, setOriginalImageFactory] = useState(null);
  const [isOriginalModalOpen, setIsOriginalModalOpen] = useState(false);

  // Live Camera / WebSocket Feed State
  const [cameraFeed, setCameraFeed] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [fps, setFps] = useState(0);
  const [sensorTriggered, setSensorTriggered] = useState(false);

  // Backend Result Data
  const [resultData, setResultData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals & Actions
  const [previewImage, setPreviewImage] = useState(null);
  const [isMoreSamplesOpen, setIsMoreSamplesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Refs for WebSocket, FPS and Queue
  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

  // Live Clock & Date Update (Thai Buddhist Era)
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
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Original PCB Image from Backend
  const fetchOriginalImages = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_images/${id}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          setOriginalImageFactory(data);
        }
      } else {
        console.warn("Could not fetch original PCB image for id:", id);
      }
    } catch (error) {
      console.error("Error fetching original image:", error);
    }
  }, []);

  // Fetch Inspection Results from Backend
  const fetchResultData = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result_pcb_working/${id}`
      );
      if (response.ok) {
        const data = await response.json();
        setResultData(data);
      } else {
        console.warn("Could not fetch result data for pcb id:", id);
      }
    } catch (error) {
      console.error("Error fetching results:", error);
    }
  }, []);

  useEffect(() => {
    if (pcb_id) {
      fetchOriginalImages(pcb_id);
      fetchResultData(pcb_id);
    }
  }, [pcb_id, fetchOriginalImages, fetchResultData]);

  // WebSocket Process Image Queue
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
  const startDetection = (result_Id) => {
    const targetId = result_Id || pcb_id;
    if (!targetId) {
      alert("ไม่พบหมายเลข PCB กรุณากลับไปเลือกหรือสร้าง PCB ก่อน");
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("Connecting...");
    setIsStreaming(false);
    setIsRunning(true);
    imageQueueRef.current = [];

    const ws = new WebSocket(
      `ws://${window.location.hostname}:8000/factory/ws/factory-workflow?pcb_id=${targetId}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsStreaming(true);
      setStatus("Connected - Detecting PCB...");
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
            // Trigger sensor light pulse
            setSensorTriggered(true);
            setTimeout(() => setSensorTriggered(false), 1200);
            // Refresh results list from backend
            fetchResultData(pcb_id);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus(`Error: Connection failed`);
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
    setFps(0);
    imageQueueRef.current = [];

    if (cameraFeed) {
      URL.revokeObjectURL(cameraFeed);
      setCameraFeed(null);
    }
  };

  // Cleanup on Unmount
  useEffect(() => {
    return () => {
      stopFpsCounter();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Delete Handlers
  const handleRequestDelete = (
    itemName = "Item",
    confirmText = "Are you sure you want to delete this Item?",
    functions
  ) => {
    setItemToDelete({ itemName, confirmText, functions });
    setIsDeleteOpen(true);
  };

  const deleteResult = async (result_Id) => {
    setIsProcessing(true);
    try {
      await fetch(
        `http://${window.location.hostname}:8000/factory/delete_result/${result_Id}`,
        { method: "DELETE" }
      );
      fetchResultData(pcb_id);
    } catch (error) {
      console.error("Error deleting result:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const deletePcb = async (pcb_Id) => {
    setIsProcessing(true);
    try {
      await fetch(
        `http://${window.location.hostname}:8000/factory/delete_pcb/${pcb_Id}`,
        { method: "DELETE" }
      );
      sessionStorage.removeItem("OriginalImageFactory");
      sessionStorage.removeItem("PreOriginalImageFactory");
      navigate("/home-factory");
    } catch (error) {
      console.error("Error deleting PCB:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Computed Metrics from Backend Data
  const hasResults = Boolean(
    resultData?.result_List && resultData.result_List.length > 0
  );
  const totalCount = hasResults ? resultData.result_List.length : null;
  const passedItems = hasResults
    ? resultData.result_List.filter((item) => (item.accuracy ?? 0) >= 80)
    : [];
  const failedItems = hasResults
    ? resultData.result_List.filter((item) => (item.accuracy ?? 0) < 80)
    : [];
  const okCount = hasResults ? passedItems.length : null;
  const ngCount = hasResults ? failedItems.length : null;
  const okPercent =
    hasResults && totalCount > 0
      ? ((okCount / totalCount) * 100).toFixed(1)
      : null;
  const ngPercent =
    hasResults && totalCount > 0
      ? ((ngCount / totalCount) * 100).toFixed(1)
      : null;
  const avgAccuracy =
    hasResults && totalCount > 0
      ? (
          resultData.result_List.reduce(
            (sum, item) => sum + (item.accuracy || 0),
            0
          ) / totalCount
        ).toFixed(1)
      : null;

  // Recent Samples List (Latest first)
  const recentSamples = hasResults
    ? [...resultData.result_List].reverse().map((item, idx) => ({
        id: item.results_id,
        results_id: item.results_id,
        name: item.name || `PCB Module #${item.results_id || idx + 1}`,
        accuracy:
          item.accuracy !== null && item.accuracy !== undefined
            ? Number(item.accuracy).toFixed(1)
            : null,
        status: (item.accuracy ?? 0) >= 80 ? "OK" : "NG",
        label: (item.accuracy ?? 0) >= 80 ? "OK" : "NG",
        description:
          item.description ||
          ((item.accuracy ?? 0) >= 80
            ? "ผ่านการตรวจสอบคุณภาพ"
            : "พบข้อบกพร่องในชิ้นงาน"),
        time: item.imageList?.uploaded_at
          ? new Date(item.imageList.uploaded_at).toLocaleTimeString("th-TH")
          : null,
        imageData: item.imageList?.image_data || null,
        filename: item.imageList?.filename || null,
      }))
    : [];

  return (
    <div className="min-h-screen bg-[#050816] text-white flex flex-col font-sans select-none overflow-x-hidden relative">
      {/* Background Cyber Tech Elements matching original theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full grid-bg opacity-30" />
        <div className="absolute top-0 left-0 w-full h-full circuit-pattern opacity-20" />
        <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-cyan-950/20 via-blue-950/10 to-transparent" />
      </div>

      {/* ==================== 1. TOP HEADER BAR ==================== */}
      <header className="relative z-20 h-16 bg-[#050c18]/95 backdrop-blur-md border-b border-cyan-500/20 px-4 lg:px-6 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        {/* Left: System Title & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-300 text-transparent bg-clip-text">
                Smart Conveyor Inspection System
              </h1>
              {pcb_id && (
                <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  PCB ID: #{pcb_id}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              ระบบตรวจสอบวัตถุด้วยกล้องและสายพานลำเลียง (Intelligent Quality
              Control)
            </p>
          </div>
        </div>

        {/* Right: Date, Live Clock, and Status Badge */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="text-right font-mono">
            <div className="text-xs text-slate-300 tracking-wider">
              {currentDate || "not data"}
            </div>
            <div className="text-sm sm:text-base font-bold text-cyan-400 tracking-widest drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              {currentTime || "not data"}
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden md:inline">กำลังประมวลผล...</span>
            </div>
          )}

          {/* System Status Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-sm transition-all shadow-md ${
              isStreaming
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : status === "Connecting..."
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-slate-800/60 border-slate-700/60 text-slate-400"
            }`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isStreaming
                  ? "bg-emerald-400 animate-pulse"
                  : status === "Connecting..."
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-500"
              }`}
            />
            <span>{isStreaming ? "ระบบทำงานปกติ" : "not data"}</span>
          </div>
        </div>
      </header>

      {/* ==================== 2. MAIN LAYOUT (SIDEBAR + CONTENT) ==================== */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar matching image.png */}
        <aside className="w-16 sm:w-48 bg-[#040a14]/90 backdrop-blur-md border-r border-cyan-500/20 flex flex-col justify-between py-4 shrink-0">
          <nav className="space-y-1.5 px-2">
            {[
              {
                id: "home",
                label: "หน้าหลัก",
                icon: Home,
                action: () => navigate("/home-factory"),
              },
              {
                id: "camera",
                label: "กล้องตรวจจับ",
                icon: Camera,
                action: () => setActiveNav("camera"),
              },
              {
                id: "performance",
                label: "ประสิทธิภาพ",
                icon: BarChart3,
                action: () => setActiveNav("performance"),
              },
              {
                id: "conveyor",
                label: "สายพาน",
                icon: Radio,
                action: () => setActiveNav("conveyor"),
              },
              {
                id: "system",
                label: "ระบบ",
                icon: Sliders,
                action: () => setActiveNav("system"),
              },
              {
                id: "records",
                label: "บันทึกข้อมูล",
                icon: Archive,
                action: () => navigate("/results"),
              },
              {
                id: "settings",
                label: "ตั้งค่า",
                icon: Settings,
                action: () => setIsSettingsOpen(true),
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/30"
                      : "text-slate-400 hover:text-white hover:bg-[#0c182c]/70"
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="hidden sm:inline-block truncate">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Return to Home Site */}
          <div className="px-2 pt-2 border-t border-cyan-500/10">
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline truncate">กลับสู่หน้าแรก</span>
            </button>
          </div>
        </aside>

        {/* Center & Right Main Workspace */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* ==================== LEFT / CENTER AREA (8 COLUMNS) ==================== */}
            <div className="xl:col-span-8 flex flex-col gap-4">
              {/* TOP CARD: "ภาพจากกล้อง (Live)" */}
              <div className="bg-[#07111e]/90 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Video className="w-5 h-5" />
                    <h2 className="text-sm sm:text-base font-bold tracking-wide text-white">
                      ภาพจากกล้อง (Live)
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Template PCB Preview Trigger */}
                    <button
                      onClick={() => setIsOriginalModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>ต้นแบบ PCB</span>
                    </button>

                    {/* Camera Online Status */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isStreaming
                            ? "bg-emerald-400 animate-ping"
                            : "bg-slate-500"
                        }`}
                      />
                      <span
                        className={`font-mono ${
                          isStreaming ? "text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        {isStreaming
                          ? `Camera Online (${fps} FPS)`
                          : "not data"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Body: Live Viewport + Sample Previews */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[290px]">
                  {/* Main Inspection Viewport (9 cols) */}
                  <div className="lg:col-span-9 relative bg-[#02050b] rounded-xl overflow-hidden border border-cyan-500/30 flex items-center justify-center group shadow-inner">
                    {cameraFeed ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-black min-h-[280px]">
                        <img
                          src={cameraFeed}
                          alt="Live Camera Feed"
                          className="w-full h-auto max-h-[360px] object-contain"
                        />
                        {/* High-tech HUD Overlay */}
                        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-cyan-500/30 text-[10px] font-mono text-cyan-300 flex items-center gap-2 pointer-events-none">
                          <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                          <span>LIVE STREAM</span>
                          <span>|</span>
                          <span>{fps} FPS</span>
                        </div>
                        <div className="scanline-effect pointer-events-none" />
                      </div>
                    ) : (
                      /* Standby / No Stream Viewport */
                      <div className="relative w-full h-[280px] bg-gradient-to-b from-[#020713] to-[#01040a] flex flex-col items-center justify-center p-6 text-center">
                        {isStreaming ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                            <p className="text-xs text-cyan-300 font-mono">
                              กำลังรอสัญญาณภาพจากกล้อง...
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-slate-500">
                            <div className="w-16 h-16 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 flex items-center justify-center text-cyan-400/60 shadow-lg">
                              <Camera className="w-8 h-8" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-300 mb-1">
                                not data
                              </div>
                              <p className="text-xs text-slate-400 max-w-xs">
                                กล้องยังไม่ได้เริ่มทำงาน กดปุ่ม{" "}
                                <span className="text-emerald-400 font-bold">
                                  "เริ่มการทำงาน"
                                </span>{" "}
                                ด้านล่างเพื่อเริ่มการตรวจจับ
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="scanline-effect pointer-events-none opacity-40" />
                      </div>
                    )}
                  </div>

                  {/* Right Subpanel: "ภาพตัวอย่าง" (3 cols) */}
                  <div className="lg:col-span-3 flex flex-col justify-between bg-[#030914] rounded-xl border border-cyan-500/20 p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300">
                        ภาพตัวอย่าง
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {hasResults ? "ล่าสุด" : "not data"}
                      </span>
                    </div>

                    {/* Stacked Sample Thumbnails matching image.png */}
                    <div className="space-y-2 flex-1">
                      {!hasResults || recentSamples.length === 0 ? (
                        <div className="h-full min-h-[160px] flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-slate-800 text-center">
                          <span className="text-xs font-mono text-slate-400">
                            not data
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">
                            ยังไม่มีผลการตรวจสอบ
                          </span>
                        </div>
                      ) : (
                        recentSamples.slice(0, 3).map((sample, idx) => (
                          <div
                            key={sample.id || idx}
                            onClick={() => setPreviewImage(sample)}
                            className="relative group bg-[#061122] hover:bg-[#0b1b34] rounded-lg border border-cyan-500/30 p-1.5 cursor-pointer transition-all duration-200 overflow-hidden shadow-sm"
                          >
                            {/* Status Badge Tag on Top Left */}
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  sample.status === "OK"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                    : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                }`}
                              >
                                {sample.status || "not data"}
                              </span>
                              <span className="text-[10px] font-mono text-cyan-300 font-bold">
                                {sample.accuracy !== null
                                  ? `${sample.accuracy}%`
                                  : "not data"}
                              </span>
                            </div>

                            {/* Thumbnail Image */}
                            <div className="w-full h-14 bg-black/80 rounded flex items-center justify-center overflow-hidden border border-slate-800/80">
                              {sample.imageData ? (
                                <img
                                  src={`data:image/jpeg;base64,${sample.imageData}`}
                                  alt={sample.name}
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <Cpu className="w-6 h-6 text-slate-600" />
                              )}
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="truncate max-w-[90px]">
                                {sample.name || "not data"}
                              </span>
                              <span className="font-mono">
                                {sample.time || "not data"}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* "ดูเพิ่มเติม v" Button */}
                    <button
                      onClick={() => setIsMoreSamplesOpen(true)}
                      className="w-full mt-2 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>ดูเพิ่มเติม</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* BOTTOM CARD: "ภาพรวมระบบ" (Conveyor Overview Illustration) */}
              <div className="bg-[#07111e]/90 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Layers className="w-4 h-4" />
                    <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white">
                      ภาพรวมระบบ (Smart Conveyor Belt Simulation)
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium font-mono">
                    <span>ทิศทางการลำเลียง</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* SVG Industrial Conveyor Illustration matching image.png */}
                <div className="relative w-full h-44 sm:h-52 bg-gradient-to-b from-[#02050f] via-[#040c1c] to-[#01040a] rounded-xl overflow-hidden border border-cyan-500/20 flex items-center justify-center">
                  <svg
                    viewBox="0 0 900 240"
                    className="w-full h-full object-contain"
                  >
                    <defs>
                      <linearGradient
                        id="conveyorSpotlight"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#38bdf8"
                          stopOpacity={lightBrightness / 100 * 0.45}
                        />
                        <stop
                          offset="80%"
                          stopColor="#38bdf8"
                          stopOpacity={lightBrightness / 100 * 0.15}
                        />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                      </linearGradient>

                      <linearGradient
                        id="metalGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="50%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>

                      <pattern
                        id="beltGrooves"
                        width="18"
                        height="20"
                        patternUnits="userSpaceOnUse"
                      >
                        <line
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="20"
                          stroke="#334155"
                          strokeWidth="2"
                        />
                        <line
                          x1="9"
                          y1="0"
                          x2="9"
                          y2="20"
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                      </pattern>
                    </defs>

                    {/* Overhead Light Cone */}
                    <polygon
                      points="420,30 480,30 550,170 350,170"
                      fill="url(#conveyorSpotlight)"
                    />

                    {/* Overhead Camera & Lamp Housing */}
                    <g transform="translate(425, 5)">
                      <rect
                        x="0"
                        y="0"
                        width="50"
                        height="20"
                        rx="4"
                        fill="#0284c7"
                      />
                      <rect
                        x="10"
                        y="20"
                        width="30"
                        height="10"
                        rx="2"
                        fill="#38bdf8"
                        className={isRunning ? "animate-pulse" : ""}
                      />
                      <circle cx="25" cy="25" r="4" fill="#ffffff" />
                    </g>

                    {/* Support Legs */}
                    <rect
                      x="160"
                      y="160"
                      width="16"
                      height="60"
                      rx="2"
                      fill="url(#metalGradient)"
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="145"
                      y="216"
                      width="46"
                      height="8"
                      rx="2"
                      fill="#0f172a"
                      stroke="#475569"
                    />

                    <rect
                      x="442"
                      y="160"
                      width="16"
                      height="60"
                      rx="2"
                      fill="url(#metalGradient)"
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="427"
                      y="216"
                      width="46"
                      height="8"
                      rx="2"
                      fill="#0f172a"
                      stroke="#475569"
                    />

                    <rect
                      x="724"
                      y="160"
                      width="16"
                      height="60"
                      rx="2"
                      fill="url(#metalGradient)"
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="709"
                      y="216"
                      width="46"
                      height="8"
                      rx="2"
                      fill="#0f172a"
                      stroke="#475569"
                    />

                    {/* Terminal Control Box on Leg */}
                    <g transform="translate(195, 175)">
                      <rect
                        x="0"
                        y="0"
                        width="24"
                        height="32"
                        rx="3"
                        fill="#1e293b"
                        stroke="#0ea5e9"
                        strokeWidth="1"
                      />
                      <circle
                        cx="12"
                        cy="10"
                        r="3.5"
                        fill={isRunning ? "#10b981" : "#ef4444"}
                        className={isRunning ? "animate-pulse" : ""}
                      />
                      <circle cx="12" cy="20" r="3.5" fill="#38bdf8" />
                    </g>

                    {/* Main Conveyor Bed / Rail */}
                    <rect
                      x="70"
                      y="148"
                      width="760"
                      height="24"
                      rx="12"
                      fill="#0b1322"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                    />

                    {/* End Rollers */}
                    <circle
                      cx="82"
                      cy="160"
                      r="10"
                      fill="#334155"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    <circle
                      cx="818"
                      cy="160"
                      r="10"
                      fill="#334155"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />

                    {/* Conveyor Belt Surface with animated grooves */}
                    <rect
                      x="92"
                      y="152"
                      width="716"
                      height="16"
                      fill="url(#beltGrooves)"
                      className={
                        isRunning && isStreaming ? "conveyor-animated" : ""
                      }
                    />

                    {/* Object Detection Sensor Post */}
                    <g transform="translate(480, 115)">
                      <rect
                        x="0"
                        y="0"
                        width="8"
                        height="45"
                        rx="1"
                        fill="#475569"
                      />
                      <circle
                        cx="4"
                        cy="10"
                        r="5"
                        fill={sensorTriggered ? "#ef4444" : "#10b981"}
                        className={sensorTriggered ? "animate-ping" : ""}
                      />
                      <circle
                        cx="4"
                        cy="10"
                        r="3"
                        fill={sensorTriggered ? "#fca5a5" : "#6ee7b7"}
                      />
                      {sensorTriggered && (
                        <line
                          x1="4"
                          y1="10"
                          x2="-35"
                          y2="42"
                          stroke="#ef4444"
                          strokeWidth="2"
                          strokeDasharray="3,3"
                        />
                      )}
                    </g>

                    {/* Conveyor Items (PCBs moving along the belt) */}
                    {[140, 260, 390, 520, 650].map((xPos, i) => (
                      <g
                        key={i}
                        transform={`translate(${xPos}, 132)`}
                        className={
                          isRunning && isStreaming
                            ? "transition-transform duration-1000"
                            : ""
                        }
                      >
                        <rect
                          x="0"
                          y="0"
                          width="52"
                          height="18"
                          rx="3"
                          fill="#0f2b2b"
                          stroke="#06b6d4"
                          strokeWidth="1.5"
                        />
                        <rect
                          x="16"
                          y="4"
                          width="20"
                          height="10"
                          rx="2"
                          fill="#0284c7"
                        />
                        <circle cx="8" cy="9" r="2.5" fill="#38bdf8" />
                        <circle cx="44" cy="9" r="2.5" fill="#38bdf8" />
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            </div>

            {/* ==================== RIGHT COLUMN (4 COLUMNS) ==================== */}
            <div className="xl:col-span-4 flex flex-col gap-4">
              {/* CARD 1: "ผลการตรวจสอบ (ล่าสุด)" */}
              <div className="bg-[#07111e]/90 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 text-cyan-400 mb-3">
                  <BarChart3 className="w-4 h-4" />
                  <h2 className="text-sm font-bold tracking-wide text-white">
                    ผลการตรวจสอบ (ล่าสุด)
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* OK Tile */}
                  <div className="bg-[#041a14]/80 border border-emerald-500/40 rounded-xl p-3 flex flex-col justify-between shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:border-emerald-400 transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-400">
                          OK
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ผ่านการตรวจสอบ
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                        {hasResults ? okCount : "not data"}
                      </span>
                      {hasResults && (
                        <span className="text-[11px] font-mono text-emerald-400/90 font-semibold">
                          ({okPercent}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* NG Tile */}
                  <div className="bg-[#1e070c]/80 border border-rose-500/40 rounded-xl p-3 flex flex-col justify-between shadow-[0_0_12px_rgba(244,63,94,0.15)] hover:border-rose-400 transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-rose-400">
                          NG
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ไม่ผ่านการตรวจสอบ
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                        {hasResults ? ngCount : "not data"}
                      </span>
                      {hasResults && (
                        <span className="text-[11px] font-mono text-rose-400/90 font-semibold">
                          ({ngPercent}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: "ประสิทธิภาพการตรวจจับ" */}
              <div className="bg-[#07111e]/90 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 text-cyan-400 mb-3">
                  <Sparkles className="w-4 h-4" />
                  <h2 className="text-sm font-bold tracking-wide text-white">
                    ประสิทธิภาพการตรวจจับ
                  </h2>
                </div>

                <div className="flex items-center gap-4">
                  {/* Left: Donut Chart with Progress Ring */}
                  <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#0f1f38"
                        strokeWidth="10"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="url(#accuracyGradient)"
                        strokeWidth="10"
                        strokeDasharray={251.2}
                        strokeDashoffset={
                          hasResults && avgAccuracy
                            ? 251.2 - (251.2 * Number(avgAccuracy)) / 100
                            : 251.2
                        }
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient
                          id="accuracyGradient"
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
                      <span className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                        {hasResults && avgAccuracy ? `${avgAccuracy}%` : "not data"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Detailed Metric Rows */}
                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>ตรวจจับสำเร็จ</span>
                      </div>
                      <span className="font-mono font-bold text-white">
                        {hasResults ? okCount : "not data"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>ตรวจจับผิดพลาด</span>
                      </div>
                      <span className="font-mono font-bold text-white">
                        {hasResults ? ngCount : "not data"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Archive className="w-3.5 h-3.5 text-cyan-400" />
                        <span>รวมทั้งหมด</span>
                      </div>
                      <span className="font-mono font-bold text-cyan-300">
                        {hasResults ? totalCount : "not data"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: "สถานะระบบ" */}
              <div className="bg-[#07111e]/90 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 text-cyan-400 mb-3">
                  <Sliders className="w-4 h-4" />
                  <h2 className="text-sm font-bold tracking-wide text-white">
                    สถานะระบบ
                  </h2>
                </div>

                <div className="space-y-2 text-xs">
                  {[
                    {
                      label: "กล้องตรวจจับ",
                      icon: Camera,
                      statusText: isStreaming ? "ปกติ" : "not data",
                      isOk: isStreaming,
                    },
                    {
                      label: "สายพานลำเลียง",
                      icon: Radio,
                      statusText: isStreaming
                        ? isRunning
                          ? "ปกติ"
                          : "หยุดทำงาน"
                        : "not data",
                      isOk: isStreaming && isRunning,
                    },
                    {
                      label: "เซ็นเซอร์ตรวจจับวัตถุ",
                      icon: Radio,
                      statusText: isStreaming
                        ? sensorTriggered
                          ? "ตรวจพบวัตถุ"
                          : "ปกติ"
                        : "not data",
                      isOk: isStreaming,
                    },
                    {
                      label: "ระบบควบคุม",
                      icon: Sliders,
                      statusText: isStreaming
                        ? status.includes("Connected")
                          ? "ปกติ"
                          : status
                        : "not data",
                      isOk: isStreaming,
                    },
                    {
                      label: "ไฟส่องสว่าง",
                      icon: Lightbulb,
                      statusText: isStreaming ? "ปกติ" : "not data",
                      isOk: isStreaming,
                    },
                  ].map((row, idx) => {
                    const RowIcon = row.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#040a14]/60 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2 text-slate-300">
                          <RowIcon className="w-3.5 h-3.5 text-cyan-400/80" />
                          <span>{row.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              row.isOk ? "bg-emerald-400" : "bg-slate-500"
                            }`}
                          />
                          <span
                            className={
                              row.isOk ? "text-emerald-400" : "text-slate-400"
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
        </main>
      </div>

      {/* ==================== 3. BOTTOM CONTROL BAR ==================== */}
      <footer className="relative z-20 bg-[#050c18]/95 backdrop-blur-md border-t border-cyan-500/20 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left Action Buttons: Start, Stop, Reset matching image.png */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Start Button */}
            <button
              onClick={() => startDetection(pcb_id)}
              disabled={isStreaming}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md ${
                isStreaming
                  ? "bg-emerald-950/40 border border-emerald-800/40 text-emerald-600 cursor-not-allowed opacity-60"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)] border border-emerald-400/40 active:scale-95"
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>เริ่มการทำงาน</span>
            </button>

            {/* Stop Button */}
            <button
              onClick={stopDetection}
              disabled={!isStreaming}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md ${
                !isStreaming
                  ? "bg-rose-950/30 border border-rose-900/30 text-rose-600 cursor-not-allowed opacity-50"
                  : "bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.35)] border border-rose-400/40 active:scale-95"
              }`}
            >
              <Square className="w-4 h-4 fill-current" />
              <span>หยุดการทำงาน</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={() => {
                fetchResultData(pcb_id);
                fetchOriginalImages(pcb_id);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#0e2547] hover:bg-[#153461] border border-cyan-500/40 text-cyan-300 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>รีเซ็ต</span>
            </button>
          </div>

          {/* Right Parameters: Conveyor Speed, Light Brightness, Mode */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* 1. ความเร็วสายพาน */}
            <div className="flex items-center gap-2.5 bg-[#030914] px-3 py-1.5 rounded-xl border border-cyan-500/20">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">ความเร็วสายพาน</span>
              </div>
              <div className="w-20 sm:w-28">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={conveyorSpeed}
                  onChange={(e) => setConveyorSpeed(Number(e.target.value))}
                  className="factory-slider"
                />
              </div>
              <span className="font-mono text-xs font-bold text-cyan-300 w-9 text-right">
                {conveyorSpeed}%
              </span>
            </div>

            {/* 2. ความสว่างไฟ */}
            <div className="flex items-center gap-2.5 bg-[#030914] px-3 py-1.5 rounded-xl border border-cyan-500/20">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">ความสว่างไฟ</span>
              </div>
              <div className="w-20 sm:w-28">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={lightBrightness}
                  onChange={(e) => setLightBrightness(Number(e.target.value))}
                  className="factory-slider"
                />
              </div>
              <span className="font-mono text-xs font-bold text-amber-300 w-9 text-right">
                {lightBrightness}%
              </span>
            </div>

            {/* 3. โหมดการทำงาน */}
            <div className="flex items-center gap-1 bg-[#030914] p-1 rounded-xl border border-cyan-500/20 text-xs">
              <button
                onClick={() => setOperationMode("auto")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  operationMode === "auto"
                    ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                อัตโนมัติ
              </button>
              <button
                onClick={() => setOperationMode("manual")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  operationMode === "manual"
                    ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                แมนนวล
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ==================== 4. MODALS & POPUPS ==================== */}

      {/* Full Resolution Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full bg-[#081220] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      previewImage.status === "OK"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    }`}
                  >
                    {previewImage.status || "not data"}
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {previewImage.name || "not data"}
                  </h3>
                </div>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="w-8 h-8 rounded-full bg-[#12223a] hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-black/90 rounded-xl p-4 flex items-center justify-center max-h-[60vh] overflow-hidden border border-slate-800">
                {previewImage.imageData ? (
                  <img
                    src={`data:image/jpeg;base64,${previewImage.imageData}`}
                    alt={previewImage.name}
                    className="max-h-[55vh] max-w-full object-contain rounded"
                  />
                ) : (
                  <div className="text-slate-500 font-mono text-xs">
                    not data
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <div>
                  <span className="text-slate-500">คำอธิบาย: </span>
                  <span className="text-slate-200">
                    {previewImage.description || "not data"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-slate-500">ความถูกต้อง: </span>
                    <span className="font-mono font-bold text-cyan-400">
                      {previewImage.accuracy !== null
                        ? `${previewImage.accuracy}%`
                        : "not data"}
                    </span>
                  </div>
                  {previewImage.results_id && (
                    <button
                      onClick={() =>
                        navigate(`/details/${previewImage.results_id}`)
                      }
                      className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>ดูรายงานผลเชิงลึก</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* "ดูเพิ่มเติม" All Samples History Modal */}
      <AnimatePresence>
        {isMoreSamplesOpen && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setIsMoreSamplesOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-3xl w-full bg-[#081220] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl p-6 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Archive className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-white">
                    ประวัติผลการตรวจสอบ PCB ({recentSamples.length} รายการ)
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsMoreSamplesOpen(false);
                      navigate("/results");
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <span>ดูบันทึกทั้งหมด</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsMoreSamplesOpen(false)}
                    className="w-8 h-8 rounded-full bg-[#12223a] hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sample Items List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {recentSamples.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-mono text-sm">
                    not data
                  </div>
                ) : (
                  recentSamples.map((sample, idx) => (
                    <div
                      key={sample.id || idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#040b17] hover:bg-[#0b1b34] border border-slate-800 transition-colors"
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => {
                          setIsMoreSamplesOpen(false);
                          setPreviewImage(sample);
                        }}
                      >
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            sample.status === "OK"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          }`}
                        >
                          {sample.status || "not data"}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {sample.name || "not data"}
                          </div>
                          <div className="text-xs text-slate-400">
                            {sample.description || "not data"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-cyan-400">
                            {sample.accuracy !== null
                              ? `${sample.accuracy}%`
                              : "not data"}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {sample.time || "not data"}
                          </div>
                        </div>

                        {sample.results_id && (
                          <div className="flex items-center gap-1.5 ml-2">
                            <button
                              onClick={() => {
                                setIsMoreSamplesOpen(false);
                                navigate(`/details/${sample.results_id}`);
                              }}
                              className="p-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-800 text-cyan-300 text-xs flex items-center gap-1"
                              title="ดูรายละเอียด"
                            >
                              <BadgeCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleRequestDelete(
                                  `ผลการทดสอบ #${sample.results_id}`,
                                  `คุณแน่ใจหรือไม่ว่าต้องการลบผลการทดสอบ #${sample.results_id}?`,
                                  () => deleteResult(sample.results_id)
                                )
                              }
                              className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-800 text-rose-300 text-xs flex items-center gap-1"
                              title="ลบรายการนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Template / Original PCB Modal */}
      <AnimatePresence>
        {isOriginalModalOpen && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setIsOriginalModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full bg-[#081220] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Layers className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-white">
                    ภาพต้นแบบแผ่นวงจร (Original PCB Template)
                  </h3>
                </div>
                <button
                  onClick={() => setIsOriginalModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#12223a] hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {originalImageFactory?.image_data ? (
                <div className="space-y-4">
                  <div className="bg-black/80 rounded-xl p-3 flex items-center justify-center max-h-[50vh] overflow-hidden border border-slate-800">
                    <img
                      src={`data:image/jpeg;base64,${originalImageFactory.image_data}`}
                      alt={originalImageFactory.filename || "Original PCB"}
                      className="max-h-[45vh] max-w-full object-contain rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span>ชื่อไฟล์: </span>
                      <span className="font-mono text-white">
                        {originalImageFactory.filename || "not data"}
                      </span>
                    </div>
                    <div>
                      <span>อัปโหลดเมื่อ: </span>
                      <span className="font-mono text-cyan-400">
                        {originalImageFactory.uploaded_at
                          ? new Date(
                              originalImageFactory.uploaded_at
                            ).toLocaleString("th-TH")
                          : "not data"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() =>
                        handleRequestDelete(
                          `ต้นแบบ PCB #${pcb_id}`,
                          `คุณแน่ใจหรือไม่ว่าต้องการลบต้นแบบ PCB นี้? ระบบจะกลับไปยังหน้าอัปโหลด`,
                          () => deletePcb(pcb_id)
                        )
                      }
                      className="w-full py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>ลบภาพต้นแบบ PCB</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm font-mono">
                  not data
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-md w-full bg-[#081220] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Settings className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-white">
                    ตั้งค่าระบบตรวจสอบ
                  </h3>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#12223a] hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">
                    เกณฑ์ความถูกต้องขั้นต่ำในการผ่าน (Pass Threshold %)
                  </label>
                  <input
                    type="number"
                    defaultValue={80}
                    className="w-full bg-[#040b17] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">
                    Backend API Host
                  </label>
                  <input
                    type="text"
                    defaultValue={`http://${window.location.hostname}:8000`}
                    className="w-full bg-[#040b17] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors"
                  >
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <Delete
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={
          itemToDelete?.functions || (() => console.log("No delete action"))
        }
        itemName={itemToDelete?.itemName || "not data"}
        confirmText={itemToDelete?.confirmText || "not data"}
      />
    </div>
  );
}
