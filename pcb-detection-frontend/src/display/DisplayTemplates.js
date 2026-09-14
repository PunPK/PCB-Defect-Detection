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
    };
    reader.readAsDataURL(file);
  };

  // Handle Camera Capture
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาตการใช้กล้อง");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
        className={`rounded-xl border px-3 py-1.5 shadow-sm flex items-center justify-between shrink-0 ${
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
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-bold">
                ชุดข้อมูลต้นแบบแผ่นวงจร (Master PCB Templates)
              </h2>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border ${
                  isDark
                    ? "bg-cyan-950/80 border-cyan-500/40 text-cyan-300"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                {totalSets} ชุด
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
              จัดการและเลือกชุดข้อมูลต้นฉบับ PCB สำหรับการตรวจสอบอัตโนมัติบนสายพาน
            </p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>OK: {passSets}</span>
            </div>
            <div className="flex items-center gap-1 text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
              <span>NG: {failSets}</span>
            </div>
            <div className="flex items-center gap-1 text-cyan-400">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>เฉลี่ย: {avgAccuracy}%</span>
            </div>
          </div>

          <button
            onClick={fetchTemplates}
            disabled={isLoading}
            className={`touch-btn px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all ${
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
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/40 mb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold">
                รายการต้นแบบ PCB ({templates.length} ชุด)
              </span>
            </div>
            {activePcbId && (
              <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                <span className="text-slate-400">เลือกอยู่:</span>
                <span className="font-bold">PCB #{activePcbId}</span>
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto touch-scrollbar pr-0.5">
            {templates.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Layers className="w-10 h-10 mb-2 opacity-40 text-cyan-400" />
                <div className="text-xs font-semibold text-slate-300">
                  ยังไม่มีชุดข้อมูลต้นแบบ PCB
                </div>
                <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                  เพิ่มต้นแบบแรกได้ทันทีจากแผง "เพิ่มต้นแบบใหม่" ด้านขวามือ
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
                            : "bg-blue-50/70 border-blue-500 ring-1.5 ring-blue-500 shadow-sm"
                          : isDark
                          ? "bg-[#040b17] hover:bg-[#071324] border-slate-800 hover:border-slate-700"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      {/* Top Row: PCB ID & Status Badge */}
                      <div className="flex items-center justify-between mb-1.5 leading-none">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black font-mono text-cyan-400">
                            PCB #{pcb.pcb_id}
                          </span>
                          {isActive && (
                            <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              ใช้งานอยู่
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded ${
                              isPass
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            }`}
                          >
                            {isPass ? "PASS" : "FAIL"}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-slate-300">
                            {pcb.sum_accuracy ? `${Number(pcb.sum_accuracy).toFixed(0)}%` : "-"}
                          </span>
                        </div>
                      </div>

                      {/* Image Thumbnail Container */}
                      <div
                        onClick={() => {
                          if (pcb.originalPcb?.image_data) {
                            setPreviewImage({
                              title: `PCB Template #${pcb.pcb_id}`,
                              data: pcb.originalPcb.image_data,
                            });
                          }
                        }}
                        className="relative w-full h-24 sm:h-28 bg-black/80 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 cursor-pointer group"
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
                        <div className="flex items-center justify-between text-[9px] text-slate-400">
                          <span>ตรวจแล้ว: {pcb.result_ids?.length || 0} ชิ้น</span>
                          <span className="truncate max-w-[90px] font-mono">
                            {pcb.originalPcb?.filename || "-"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 pt-0.5">
                          {/* Select and Go to Conveyor Button */}
                          <button
                            onClick={() => {
                              setActivePcbId(String(pcb.pcb_id));
                              if (onNavigateTab) {
                                onNavigateTab("process");
                              }
                            }}
                            className={`touch-btn flex-1 py-1 px-2 rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all ${
                              isActive
                                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white border border-cyan-400/50"
                                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white"
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{isActive ? "ตรวจจับต่อ" : "เลือกตรวจจับ"}</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() =>
                              setItemToDelete({
                                pcbId: pcb.pcb_id,
                                name: `PCB #${pcb.pcb_id}`,
                              })
                            }
                            className={`touch-btn p-1 rounded-lg border transition-colors ${
                              isDark
                                ? "bg-rose-950/40 hover:bg-rose-900 border-rose-800/40 text-rose-400"
                                : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600"
                            }`}
                            title="ลบต้นแบบ PCB นี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          className={`w-64 sm:w-72 md:w-80 shrink-0 rounded-xl border p-2 shadow-sm flex flex-col justify-between overflow-hidden ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30"
              : "bg-white border-slate-200"
          }`}
        >
          {/* Header */}
          <div className="pb-1.5 border-b border-slate-700/40 shrink-0">
            <div className="flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold">เพิ่มต้นแบบใหม่ (Add Template)</h3>
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">
              บันทึกภาพแผ่นวงจรต้นฉบับเข้าสู่ฐานข้อมูล
            </p>
          </div>

          {/* Success Notification */}
          {uploadSuccessMsg && (
            <div className="my-1 p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[10px] font-semibold flex items-center gap-1.5 animate-pulse shrink-0">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{uploadSuccessMsg}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          {!stagedImage && !isCameraActive && (
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-black/20 border border-slate-700/40 text-[11px] my-1 shrink-0">
              <button
                onClick={() => setUploadMode("file")}
                className={`py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${
                  uploadMode === "file"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Upload className="w-3 h-3" />
                <span>อัปโหลดไฟล์</span>
              </button>
              <button
                onClick={() => setUploadMode("camera")}
                className={`py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${
                  uploadMode === "camera"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Camera className="w-3 h-3" />
                <span>ถ่ายจากกล้อง</span>
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 min-h-0 flex flex-col justify-center py-1 overflow-hidden">
            {/* 1. Staged Image Preview (Ready to Save) */}
            {stagedImage ? (
              <div className="h-full flex flex-col justify-between overflow-hidden">
                <div className="relative w-full flex-1 min-h-0 bg-black/90 rounded-lg overflow-hidden border border-cyan-500/40 flex items-center justify-center p-1">
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
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow"
                    title="ลบภาพนี้"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 shrink-0">
                  <span className="truncate max-w-[140px] font-mono">
                    {stagedImage.name}
                  </span>
                  <span className="text-emerald-400 font-bold">พร้อมบันทึก</span>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveTemplate}
                  disabled={isUploading}
                  className={`touch-btn w-full mt-1.5 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all shrink-0 ${
                    isUploading
                      ? "bg-cyan-950/60 border border-cyan-800 text-cyan-600 opacity-60 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  }`}
                >
                  {isUploading ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>บันทึกเป็นต้นแบบใหม่</span>
                    </>
                  )}
                </button>
              </div>
            ) : isCameraActive ? (
              /* 2. Live Camera View & Capture */
              <div className="h-full flex flex-col justify-between overflow-hidden">
                <div className="relative w-full flex-1 min-h-0 bg-black rounded-lg overflow-hidden border border-cyan-500/40 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[8.5px] font-mono text-cyan-300">
                    CAMERA ACTIVE
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-1.5 shrink-0">
                  <button
                    onClick={capturePhoto}
                    className="touch-btn flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>จับภาพ (Capture)</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="touch-btn py-1.5 px-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs"
                    title="ยกเลิกกล้อง"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : uploadMode === "file" ? (
              /* 3. File Upload Mode */
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
                    : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
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
                <div className="text-[11px] font-semibold">
                  เลือกหรือลากไฟล์ภาพ PCB
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5">
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
            ) : (
              /* 4. Start Camera Mode */
              <div
                onClick={startCamera}
                className={`h-full flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all text-center ${
                  isDark
                    ? "border-cyan-500/30 hover:border-cyan-400/70 hover:bg-cyan-950/20"
                    : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
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
                <div className="text-[11px] font-semibold">
                  เปิดกล้องถ่ายภาพ PCB
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  คลิกเพื่อเปิดกล้อง Raspberry Pi / Webcam
                </p>
              </div>
            )}
          </div>

          {/* Instructions Footer */}
          <div
            className={`mt-1 p-1.5 rounded-lg border text-[9px] text-slate-400 shrink-0 ${
              isDark
                ? "bg-[#040a14]/60 border-slate-800"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1 text-cyan-400 font-semibold mb-0.5">
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
              <div className="flex items-center justify-between pb-2 border-b mb-2 border-slate-700/50">
                <h3 className="text-xs sm:text-sm font-bold">{previewImage.title}</h3>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="w-6 h-6 rounded-full bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
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

              <p className="text-xs text-slate-300">
                คุณแน่ใจหรือไม่ว่าต้องการลบต้นแบบ{" "}
                <span className="font-bold text-white font-mono">
                  {itemToDelete.name}
                </span>{" "}
                และประวัติผลการตรวจสอบทั้งหมดที่เกี่ยวข้อง?
              </p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setItemToDelete(null)}
                  className="touch-btn py-1.5 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-slate-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleDeletePcb(itemToDelete.pcbId)}
                  className="touch-btn py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow"
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
