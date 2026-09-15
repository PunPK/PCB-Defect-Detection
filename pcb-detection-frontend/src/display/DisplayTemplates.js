import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Camera,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  BarChart3,
  Layers,
  Plus,
  Eye,
  Play,
  Check,
  AlertCircle,
  X,
  Sparkles,
  StopCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDisplay } from "./DisplayContext.js";

export default function DisplayTemplates({ onNavigateTab }) {
  const { theme, activePcbId, setActivePcbId, passThreshold } = useDisplay();
  const isDark = theme === "dark";

  // Results / Templates list from backend
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add new template states
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "camera"
  const [stagedImage, setStagedImage] = useState(null); // { file, url, name }
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");
  const fileInputRef = useRef(null);

  // Camera capture states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Preview & Delete Modals
  const [previewImage, setPreviewImage] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Fetch all PCB template results from backend
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_all_pcb_results`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.results && Array.isArray(data.results)) {
          const formatted = data.results.map((r) => {
            const isPass = (r.sum_accuracy ?? 0) >= passThreshold;
            return {
              ...r,
              status: isPass ? "pass" : "fail",
            };
          });
          setTemplates(formatted);

          // If no active PCB, default to the first one
          if (!activePcbId && formatted.length > 0) {
            setActivePcbId(String(formatted[0].pcb_id));
          }
        } else {
          setTemplates([]);
        }
      }
    } catch (err) {
      console.error("Error fetching PCB templates:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activePcbId, passThreshold, setActivePcbId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle File Input Change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์ภาพเท่านั้น (.jpg, .jpeg, .png)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setStagedImage({
        file,
        url: event.target.result,
        name: file.name,
      });
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  // Handle Camera Stop
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
    setCameraError("");
  }, []);

  // Handle Camera Start with robust multi-constraint fallback
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    setIsCameraLoading(true);
    setIsCameraActive(true);
    setUploadMode("camera");

    try {
      let stream;
      try {
        // Try ideal resolution first
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (err1) {
        console.warn("Retrying with simple video constraint:", err1);
        // Fallback constraint without strict resolution or facingMode
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Camera play warning:", playErr);
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์"
          : "ไม่สามารถเปิดกล้องได้ หรือไม่มีกล้องเชื่อมต่ออยู่"
      );
      setIsCameraActive(false);
    } finally {
      setIsCameraLoading(false);
    }
  }, [stopCamera]);

  // Synchronize stream with videoRef when element mounts
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch((e) => console.log("Video play error:", e));
      }
    }
  }, [isCameraActive]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Capture photo from video feed
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `pcb_capture_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        setStagedImage({
          file,
          url,
          name: file.name,
        });
        stopCamera();
      }
    }, "image/jpeg", 0.95);
  };

  // Save new PCB Template to Backend
  const handleSaveTemplate = async () => {
    if (!stagedImage || !stagedImage.file) {
      alert("กรุณาเลือกหรือถ่ายภาพต้นแบบ PCB ก่อน");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", stagedImage.file, stagedImage.name);

      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/create_pcb`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (response.ok) {
        const newPcbId = data.result?.pcb_id;
        setUploadSuccessMsg(`บันทึกต้นแบบ PCB #${newPcbId} สำเร็จ!`);
        if (newPcbId) {
          setActivePcbId(String(newPcbId));
        }
        setStagedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchTemplates();
        setTimeout(() => setUploadSuccessMsg(""), 3500);
      } else {
        alert(`เกิดข้อผิดพลาดในการบันทึก: ${data.detail || data.message || "ไม่ทราบสาเหตุ"}`);
      }
    } catch (err) {
      console.error("Error saving PCB template:", err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete PCB Template
  const handleDeletePcb = async (pcbId) => {
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/delete_pcb/${pcbId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setItemToDelete(null);
        if (String(activePcbId) === String(pcbId)) {
          setActivePcbId("");
        }
        await fetchTemplates();
      } else {
        alert("ไม่สามารถลบต้นแบบ PCB นี้ได้");
      }
    } catch (err) {
      console.error("Error deleting PCB:", err);
    }
  };

  // Compute Metrics
  const totalSets = templates.length;
  const passSets = templates.filter((t) => t.status === "pass").length;
  const failSets = totalSets - passSets;
  const avgAccuracy =
    totalSets > 0
      ? (
          templates.reduce((sum, t) => sum + (Number(t.sum_accuracy) || 0), 0) /
          totalSets
        ).toFixed(1)
      : "0.0";

  return (
    <div className="h-full min-h-0 flex flex-col gap-1.5 p-1.5 sm:p-2 overflow-hidden select-none">
      {/* ==================== 1. TOP STATS BAR ==================== */}
      <div
        className={`rounded-xl border px-2.5 sm:px-3 py-1.5 shadow-sm flex items-center justify-between gap-2 shrink-0 overflow-hidden ${
          isDark
            ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border shrink-0 ${
              isDark
                ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-400"
                : "bg-blue-50 border-blue-200 text-blue-600"
            }`}
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <h2
                className={`text-xs sm:text-sm font-bold truncate ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
                title="ชุดข้อมูลต้นแบบแผ่นวงจร (Master PCB Templates)"
              >
                ชุดข้อมูลต้นแบบ PCB
              </h2>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                  isDark
                    ? "bg-cyan-950/80 border-cyan-500/40 text-cyan-300"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                {totalSets} ชุด
              </span>
              {activePcbId && (
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                    isDark
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                      : "bg-blue-100 border-blue-300 text-blue-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
                  ใช้งานอยู่: #{activePcbId}
                </span>
              )}
            </div>
            <p
              className={`text-[9px] sm:text-[10px] truncate hidden md:block ${
                isDark ? "text-slate-400" : "text-slate-500 font-medium"
              }`}
            >
              จัดการและเลือกชุดข้อมูลต้นฉบับ PCB สำหรับการตรวจสอบอัตโนมัติบนสายพาน
            </p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-mono font-semibold">
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border shrink-0 ${
                isDark
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>OK: {passSets}</span>
            </div>
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border shrink-0 ${
                isDark
                  ? "bg-rose-950/40 border-rose-500/30 text-rose-400"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>NG: {failSets}</span>
            </div>
            <div
              className={`hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded-md border shrink-0 ${
                isDark
                  ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-400"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>เฉลี่ย: {avgAccuracy}%</span>
            </div>
          </div>

          <button
            onClick={fetchTemplates}
            disabled={isLoading}
            className={`touch-btn px-2 sm:px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
              isDark
                ? "bg-[#0b1e38] border-cyan-500/40 text-cyan-300 hover:bg-[#122e54]"
                : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* ==================== 2. MAIN 2-COLUMN LAYOUT ==================== */}
      <div className="flex-1 min-h-0 flex gap-2 overflow-hidden">
        {/* ==================== LEFT AREA: PCB TEMPLATES LIST ==================== */}
        <div
          className={`flex-1 min-h-0 rounded-xl border p-2 shadow-sm flex flex-col overflow-hidden ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30"
              : "bg-white border-slate-200"
          }`}
        >
          {/* List Header */}
          <div
            className={`flex items-center justify-between pb-1.5 border-b mb-1.5 shrink-0 min-w-0 ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDark ? "text-cyan-400" : "text-blue-600"
                }`}
              />
              <span
                className={`text-xs font-bold truncate ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                รายการต้นแบบ PCB ({templates.length} ชุด)
              </span>
            </div>
            {activePcbId && (
              <div
                className={`text-[10px] font-mono flex items-center gap-1 shrink-0 ml-2 ${
                  isDark ? "text-cyan-400" : "text-blue-600"
                }`}
              >
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  เลือกอยู่:
                </span>
                <span className="font-bold">PCB #{activePcbId}</span>
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto touch-scrollbar pr-1.5 sm:pr-2">
            {templates.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Layers
                  className={`w-10 h-10 mb-2 opacity-40 ${
                    isDark ? "text-cyan-400" : "text-blue-600"
                  }`}
                />
                <div
                  className={`text-xs font-semibold ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  ยังไม่มีชุดข้อมูลต้นแบบ PCB
                </div>
                <p
                  className={`text-[10px] mt-1 max-w-xs ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  เพิ่มต้นแบบแรกได้ทันทีจากแผง "เพิ่มต้นแบบใหม่" ด้านขวามือ
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {templates.map((pcb) => {
                  const isActive = String(activePcbId) === String(pcb.pcb_id);
                  const isPass = pcb.status === "pass";

                  return (
                    <div
                      key={pcb.pcb_id}
                      className={`rounded-xl border p-2 flex flex-col justify-between transition-all ${
                        isActive
                          ? isDark
                            ? "bg-[#08182b] border-cyan-400 ring-1.5 ring-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                            : "bg-blue-50/90 border-blue-500 ring-1.5 ring-blue-500 shadow-sm"
                          : isDark
                          ? "bg-[#040b17] hover:bg-[#071324] border-slate-800 hover:border-slate-700"
                          : "bg-slate-50/80 hover:bg-slate-100/90 border-slate-200 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      {/* Top Row: PCB ID & Status Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5 min-w-0">
                        <div className="flex items-center gap-1 min-w-0 shrink-0">
                          <span
                            className={`text-xs font-black font-mono shrink-0 ${
                              isDark ? "text-cyan-400" : "text-blue-700"
                            }`}
                          >
                            PCB #{pcb.pcb_id}
                          </span>
                          {isActive && (
                            <span
                              className={`text-[8px] sm:text-[8.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 whitespace-nowrap ${
                                isDark
                                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                  : "bg-blue-100 text-blue-800 border-blue-300"
                              }`}
                            >
                              ใช้งานอยู่
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          <span
                            className={`text-[8px] sm:text-[8.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                              isPass
                                ? isDark
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : isDark
                                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                : "bg-rose-100 text-rose-800 border-rose-300"
                            }`}
                          >
                            {isPass ? "PASS" : "FAIL"}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold shrink-0 ${
                              isDark ? "text-slate-200" : "text-slate-700"
                            }`}
                          >
                            {pcb.sum_accuracy
                              ? `${Number(pcb.sum_accuracy).toFixed(0)}%`
                              : "-"}
                          </span>
                        </div>
                      </div>

                      {/* Image Thumbnail Container */}
                      <div
                        onClick={() => {
                          if (pcb.originalPcb?.image_data) {
                            setPreviewImage({
                              title: `ภาพต้นแบบแผ่นวงจร PCB #${pcb.pcb_id}`,
                              data: pcb.originalPcb.image_data,
                            });
                          }
                        }}
                        className="relative w-full h-24 sm:h-28 bg-black/90 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800/80 cursor-pointer group"
                      >
                        {pcb.originalPcb?.image_data ? (
                          <>
                            <img
                              src={`data:image/jpeg;base64,${pcb.originalPcb.image_data}`}
                              alt={`PCB ${pcb.pcb_id}`}
                              className="w-full h-full object-contain p-1"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-mono">
                            ไม่มีภาพต้นแบบ
                          </div>
                        )}
                      </div>

                      {/* Bottom Info & Action Buttons */}
                      <div className="mt-1.5 space-y-1">
                        <div
                          className={`flex items-center justify-between text-[9px] gap-1 ${
                            isDark ? "text-slate-400" : "text-slate-600 font-medium"
                          }`}
                        >
                          <span className="shrink-0 truncate">ตรวจแล้ว: {pcb.result_ids?.length || 0} ชิ้น</span>
                          <span className="truncate max-w-[90px] font-mono text-right" title={pcb.originalPcb?.filename}>
                            {pcb.originalPcb?.filename || "-"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          {/* Select and Go to Conveyor Button */}
                          <button
                            onClick={() => {
                              setActivePcbId(String(pcb.pcb_id));
                              if (onNavigateTab) {
                                onNavigateTab("process");
                              }
                            }}
                            className={`touch-btn flex-1 min-h-[32px] sm:min-h-[34px] py-1 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer min-w-0 ${
                              isActive
                                ? isDark
                                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                                  : "bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 shadow-sm"
                                : isDark
                                ? "bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white"
                                : "bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-300 hover:border-blue-600 shadow-xs font-semibold"
                            }`}
                          >
                            <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
                            <span className="truncate text-[11px] sm:text-xs">
                              {isActive ? "ตรวจจับต่อ" : "เลือกตรวจจับ"}
                            </span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() =>
                              setItemToDelete({
                                pcbId: pcb.pcb_id,
                                name: `PCB #${pcb.pcb_id}`,
                              })
                            }
                            className={`touch-btn min-h-[32px] min-w-[32px] sm:min-h-[34px] sm:min-w-[34px] p-1.5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                              isDark
                                ? "bg-rose-950/40 hover:bg-rose-900 border-rose-800/40 text-rose-400"
                                : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600"
                            }`}
                            title="ลบต้นแบบ PCB นี้"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ==================== RIGHT AREA: ADD NEW TEMPLATE ==================== */}
        <div
          className={`w-60 sm:w-64 md:w-72 lg:w-80 shrink-0 rounded-xl border p-2 shadow-sm flex flex-col justify-between overflow-hidden ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30"
              : "bg-white border-slate-200"
          }`}
        >
          {/* Header */}
          <div
            className={`pb-1.5 border-b shrink-0 ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Plus
                className={`w-4 h-4 ${
                  isDark ? "text-cyan-400" : "text-blue-600"
                }`}
              />
              <h3
                className={`text-xs font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                เพิ่มต้นแบบใหม่ (Add Template)
              </h3>
            </div>
            <p
              className={`text-[9px] mt-0.5 ${
                isDark ? "text-slate-400" : "text-slate-500 font-medium"
              }`}
            >
              บันทึกภาพแผ่นวงจรต้นฉบับเข้าสู่ฐานข้อมูล
            </p>
          </div>

          {/* Success Notification */}
          {uploadSuccessMsg && (
            <div className="my-1 p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-500 text-[10px] font-semibold flex items-center gap-1.5 animate-pulse shrink-0">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{uploadSuccessMsg}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          {!stagedImage && (
            <div
              className={`grid grid-cols-2 gap-1 p-0.5 rounded-lg border text-[11px] my-1 shrink-0 ${
                isDark
                  ? "bg-black/40 border-slate-700/60"
                  : "bg-slate-100 border-slate-300"
              }`}
            >
              <button
                onClick={() => {
                  setUploadMode("file");
                  stopCamera();
                }}
                className={`touch-btn py-1.5 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  uploadMode === "file" && !isCameraActive
                    ? isDark
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "bg-blue-600 text-white shadow-sm"
                    : isDark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>อัปโหลดไฟล์</span>
              </button>
              <button
                onClick={() => {
                  setUploadMode("camera");
                  startCamera();
                }}
                className={`touch-btn py-1.5 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  uploadMode === "camera" || isCameraActive
                    ? isDark
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "bg-blue-600 text-white shadow-sm"
                    : isDark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>ถ่ายจากกล้อง</span>
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 min-h-0 flex flex-col justify-center py-1 overflow-hidden">
            {/* 1. Staged Image Preview (Ready to Save) */}
            {stagedImage ? (
              <div className="h-full flex flex-col justify-between overflow-hidden">
                <div
                  className={`relative w-full flex-1 min-h-0 bg-black/90 rounded-lg overflow-hidden border flex items-center justify-center p-1 ${
                    isDark ? "border-cyan-500/40" : "border-slate-300"
                  }`}
                >
                  <img
                    src={stagedImage.url}
                    alt="Staged Preview"
                    className="w-full h-full object-contain rounded"
                  />
                  <button
                    onClick={() => {
                      setStagedImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow cursor-pointer"
                    title="ลบภาพนี้"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-1 flex items-center justify-between text-[9px] shrink-0">
                  <span
                    className={`truncate max-w-[140px] font-mono ${
                      isDark ? "text-slate-300" : "text-slate-700 font-semibold"
                    }`}
                  >
                    {stagedImage.name}
                  </span>
                  <span
                    className={`font-bold ${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  >
                    พร้อมบันทึก
                  </span>
                </div>

                {/* Save & Reset Buttons */}
                <div className="flex items-center gap-1.5 mt-1.5 shrink-0">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={isUploading}
                    className={`touch-btn flex-1 min-h-[36px] py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer ${
                      isUploading
                        ? isDark
                          ? "bg-cyan-950/60 border border-cyan-800 text-cyan-600 opacity-60 cursor-not-allowed"
                          : "bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed"
                        : isDark
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>บันทึกต้นแบบ</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setStagedImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      if (uploadMode === "camera") {
                        startCamera();
                      }
                    }}
                    className={`touch-btn min-h-[36px] py-1.5 px-2.5 rounded-lg border text-xs flex items-center justify-center cursor-pointer ${
                      isDark
                        ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                        : "border-slate-300 hover:bg-slate-100 text-slate-700"
                    }`}
                    title="ถ่ายใหม่ / เลือกใหม่"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : isCameraActive ? (
              /* 2. Live Camera View & Capture */
              <div className="h-full flex flex-col justify-between overflow-hidden">
                <div
                  className={`relative w-full flex-1 min-h-0 bg-black rounded-lg overflow-hidden border flex items-center justify-center ${
                    isDark ? "border-cyan-500/40" : "border-slate-400"
                  }`}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  {isCameraLoading ? (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1.5 text-cyan-300 text-xs font-semibold">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>กำลังเชื่อมต่อกล้อง...</span>
                    </div>
                  ) : (
                    <div className="absolute top-1.5 left-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[8.5px] font-mono text-cyan-300">
                      LIVE VIEW
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-1.5 shrink-0">
                  <button
                    onClick={capturePhoto}
                    disabled={isCameraLoading}
                    className={`touch-btn flex-1 min-h-[36px] py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                      isDark
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-600"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>ถ่ายภาพ (Capture)</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className={`touch-btn min-h-[36px] py-1.5 px-2.5 rounded-lg border text-xs flex items-center justify-center cursor-pointer ${
                      isDark
                        ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                        : "border-slate-300 hover:bg-slate-100 text-slate-700"
                    }`}
                    title="ปิดกล้อง"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : cameraError ? (
              /* 3. Camera Error / Retry State */
              <div
                className={`h-full flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed text-center ${
                  isDark
                    ? "border-rose-500/40 bg-rose-950/20"
                    : "border-rose-300 bg-rose-50/50"
                }`}
              >
                <AlertCircle className="w-8 h-8 text-rose-500 mb-1.5" />
                <div
                  className={`text-xs font-bold mb-1 ${
                    isDark ? "text-rose-400" : "text-rose-700"
                  }`}
                >
                  ไม่สามารถเปิดกล้องได้
                </div>
                <p
                  className={`text-[9.5px] max-w-[200px] mb-2.5 ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {cameraError}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={startCamera}
                    className="touch-btn py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>ลองใหม่อีกครั้ง</span>
                  </button>
                  <button
                    onClick={() => {
                      setUploadMode("file");
                      setCameraError("");
                    }}
                    className={`touch-btn py-1.5 px-2.5 rounded-lg border text-xs cursor-pointer ${
                      isDark
                        ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    ใช้อัปโหลดไฟล์แทน
                  </button>
                </div>
              </div>
            ) : uploadMode === "camera" ? (
              /* 4. Trigger Camera Mode */
              <div
                onClick={startCamera}
                className={`h-full flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all text-center ${
                  isDark
                    ? "border-cyan-500/30 hover:border-cyan-400/70 hover:bg-cyan-950/20"
                    : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/40"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-1.5 ${
                    isDark
                      ? "bg-cyan-950/50 border-cyan-800/40 text-cyan-400"
                      : "bg-blue-50 border-blue-200 text-blue-600"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                </div>
                <div
                  className={`text-[11px] font-bold ${
                    isDark ? "text-slate-200" : "text-slate-800"
                  }`}
                >
                  เปิดกล้องถ่ายภาพ PCB
                </div>
                <p
                  className={`text-[9px] mt-0.5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  คลิกเพื่อเปิดกล้อง Raspberry Pi / Webcam
                </p>
              </div>
            ) : (
              /* 5. File Upload Mode */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setStagedImage({
                        file,
                        url: ev.target.result,
                        name: file.name,
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`h-full flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all text-center ${
                  isDark
                    ? "border-cyan-500/30 hover:border-cyan-400/70 hover:bg-cyan-950/20"
                    : "border-slate-300 hover:border-blue-500 hover:bg-blue-50/40"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-1.5 ${
                    isDark
                      ? "bg-cyan-950/50 border-cyan-800/40 text-cyan-400"
                      : "bg-blue-50 border-blue-200 text-blue-600"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                </div>
                <div
                  className={`text-[11px] font-bold ${
                    isDark ? "text-slate-200" : "text-slate-800"
                  }`}
                >
                  เลือกหรือลากไฟล์ภาพ PCB
                </div>
                <p
                  className={`text-[9px] mt-0.5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  รองรับ JPG, PNG (แนะนำพื้นหลังขาว)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Instructions Footer */}
          <div
            className={`mt-1 p-1.5 rounded-lg border text-[9px] shrink-0 ${
              isDark
                ? "bg-[#040a14]/60 border-slate-800 text-slate-400"
                : "bg-slate-50 border-slate-200 text-slate-600 font-medium"
            }`}
          >
            <div
              className={`flex items-center gap-1 font-semibold mb-0.5 ${
                isDark ? "text-cyan-400" : "text-blue-600"
              }`}
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>คำแนะนำ</span>
            </div>
            <span>วางแผ่น PCB บนพื้นผิวเรียบสีขาว เพื่อการตัดขอบและวิเคราะห์ที่แม่นยำ</span>
          </div>
        </div>
      </div>

      {/* ==================== MODALS ==================== */}

      {/* 1. Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-lg w-full rounded-2xl border p-4 shadow-2xl ${
                isDark
                  ? "bg-[#081220] border-cyan-500/40 text-white"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-2 border-b mb-2 ${
                  isDark ? "border-slate-700/50" : "border-slate-200"
                }`}
              >
                <h3
                  className={`text-xs sm:text-sm font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {previewImage.title}
                </h3>
                <button
                  onClick={() => setPreviewImage(null)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? "bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white"
                      : "bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-black/90 rounded-xl p-2 flex items-center justify-center max-h-[55vh] overflow-hidden">
                <img
                  src={`data:image/jpeg;base64,${previewImage.data}`}
                  alt="Full Preview"
                  className="max-h-[50vh] max-w-full object-contain rounded"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setItemToDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-sm w-full rounded-2xl border p-4 shadow-2xl ${
                isDark
                  ? "bg-[#081220] border-rose-500/40 text-white"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 text-rose-500">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold">ยืนยันการลบต้นแบบ</h3>
              </div>

              <p
                className={`text-xs ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                คุณแน่ใจหรือไม่ว่าต้องการลบต้นแบบ{" "}
                <span
                  className={`font-bold font-mono ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {itemToDelete.name}
                </span>{" "}
                และประวัติผลการตรวจสอบทั้งหมดที่เกี่ยวข้อง?
              </p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setItemToDelete(null)}
                  className={`touch-btn py-1.5 px-3 rounded-lg border text-xs cursor-pointer ${
                    isDark
                      ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                      : "border-slate-300 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleDeletePcb(itemToDelete.pcbId)}
                  className="touch-btn py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                >
                  ยืนยันลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
