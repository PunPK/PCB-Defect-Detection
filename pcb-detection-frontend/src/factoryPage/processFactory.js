import { useState, useEffect, useRef } from "react";
import {
  Upload,
  X,
  Hexagon,
  BadgeCheck,
  Factory,
  CheckCircle,
  Layers,
  ArchiveX,
  Trash2,
  Printer,
  CheckSquare,
  Square,
  CheckCircle2,
  Activity,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router";
import "../page/uploadPage.css";
import Delete from "../components/Delete.js";
import ExportPdfModal from "./ExportPdfModal.js";

import { Button } from "../page/uploadPCBChecked.js";

export default function ProcessFactoryWorkflow() {
  const [originalImageFactory, setOriginalImageFactory] = useState(null);
  const [cameraFeed, setCameraFeed] = useState(null);
  const [traceFeed, setTraceFeed] = useState(null);
  const [analyzingStatus, setAnalyzingStatus] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [fps, setFps] = useState(0);
  const { pcb_id } = useParams();
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

  const [resultData, setResultData] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState([]);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState([]);

  const handleToggleSelectResult = (resultId, e) => {
    if (e) e.stopPropagation();
    setSelectedResultIds((prev) =>
      prev.includes(resultId) ? prev.filter((id) => id !== resultId) : [...prev, resultId]
    );
  };

  const handleSelectAllResults = () => {
    if (!resultData?.result_List) return;
    setSelectedResultIds(resultData.result_List.map((r) => r.results_id));
  };

  const handleClearSelectedResults = () => {
    setSelectedResultIds([]);
  };

  const handleOpenExportPdf = () => {
    setIsExportPdfOpen(true);
  };

  const handleRequestDelete = (
    itemName = "Item",
    confirmText = "Are you sure you want to delete this Item?",
    functions
  ) => {
    setItemToDelete({ itemName, confirmText, functions });
    setIsDeleteOpen(true);
  };

  sessionStorage.removeItem("PreOriginalImageFactory");

  const processImageQueue = () => {
    if (imageQueueRef.current.length >= 2) {
      const [cameraData, pcbData] = imageQueueRef.current.splice(0, 2);

      const cameraBlob = new Blob([cameraData], { type: "image/jpeg" });
      const cameraUrl = URL.createObjectURL(cameraBlob);
      setCameraFeed((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return cameraUrl;
      });

      const pcbBlob = new Blob([pcbData], { type: "image/jpeg" });
      const pcbUrl = URL.createObjectURL(pcbBlob);
      setTraceFeed((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return pcbUrl;
      });

      frameCountRef.current++;
    }
  };

  const createWebSocket = async (result_Id) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("Connecting...");
    setIsStreaming(false);
    imageQueueRef.current = [];

    const ws = new WebSocket(
      `ws://${window.location.hostname}:8000/factory/ws/factory-workflow?pcb_id=${result_Id}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsStreaming(true);
      setStatus("Connected - Conveyor & AI Active");
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
          if (message.type === "analyzing") {
            setAnalyzingStatus(message.message || "AI กำลังวิเคราะห์ลายเส้นทองแดง...");
          } else if (message.type === "new_result") {
            setAnalyzingStatus(null);
            fetchResultData(pcb_id);
          }
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus(`Error: ${error.message || "Connection failed"}`);
      stopDetection();
    };

    ws.onclose = () => {
      stopDetection();
    };
  };

  const startDetection = async (result_Id) => {
    if (!result_Id) {
      alert("Please create a PCB before starting detection.");
      return;
    }
    createWebSocket(result_Id);
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
    setAnalyzingStatus(null);

    if (cameraFeed) {
      URL.revokeObjectURL(cameraFeed);
      setCameraFeed(null);
    }
    if (traceFeed) {
      URL.revokeObjectURL(traceFeed);
      setTraceFeed(null);
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

  const fetchOriginalImages = async (pcb_Id) => {
    setIsProcessing(true);
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_images/${pcb_Id}`
      );
      const data = await response.json();
      if (data.status === "success") {
        setOriginalImageFactory(data);
      }
    } catch (error) {
      console.error("Error fetching saved images:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchResultData = async (pcb_Id) => {
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result_pcb_working/${pcb_Id}`
      );
      const data = await response.json();
      if (response.ok) {
        setResultData(data);
      }
    } catch (error) {
      console.error("Error fetching saved results:", error);
    }
  };

  useEffect(() => {
    fetchOriginalImages(pcb_id);
    fetchResultData(pcb_id);
    return () => {
      stopDetection();
    };
  }, [pcb_id]);

  const openPreview = (image) => {
    setPreviewImage(image);
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  const removeOriginalImage = () => {
    if (pcb_id) {
      sessionStorage.removeItem("OriginalImageFactory");
      deletePcb(pcb_id);
      navigate("/home-factory");
    }
    setOriginalImageFactory(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const deletePcb = async (pcb_Id) => {
    setIsProcessing(true);
    try {
      await fetch(
        `http://${window.location.hostname}:8000/factory/delete_pcb/${pcb_Id}`,
        { method: "DELETE" }
      );
    } catch (error) {
      console.error("Error deleting PCB:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteResult = async (result_Id) => {
    try {
      await fetch(
        `http://${window.location.hostname}:8000/factory/delete_result/${result_Id}`,
        { method: "DELETE" }
      );
      fetchResultData(pcb_id);
    } catch (error) {
      console.error("Error deleting result:", error);
    }
  };

  const getVerdictInfo = (result) => {
    const desc = result.description || "";
    if (desc.includes("PASS") || result.accuracy >= 80) {
      return { label: "PASS", color: "text-emerald-400", bg: "bg-emerald-950/80 border-emerald-500/60" };
    }
    if (desc.includes("WARN") || result.accuracy >= 70) {
      return { label: "WARN", color: "text-amber-400", bg: "bg-amber-950/80 border-amber-500/60" };
    }
    return { label: "FAIL", color: "text-rose-400", bg: "bg-rose-950/80 border-rose-500/60" };
  };

  if (isProcessing) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#050816]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full grid-bg opacity-30"></div>
        <div className="absolute top-0 left-0 w-full h-full circuit-pattern"></div>
        <div className="absolute top-0 left-0 w-2/5 h-full bg-gradient-to-r from-cyan-900/15 via-blue-900/10 to-transparent"></div>
      </div>

      <div className="max-w-md mx-auto relative z-10">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center justify-center mb-3">
            <div className="relative">
              <Hexagon
                className="h-12 w-12 text-cyan-500 opacity-80"
                strokeWidth={1}
              />
              <Factory className="h-6 w-6 text-cyan-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 text-transparent bg-clip-text">
            Smart Conveyor Workflow
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm">
            ระบบตรวจสอบและสกัดลายทองแดง PCB อัตโนมัติด้วย AI ร่วมกับสายพานลำเลียง
          </p>
        </header>
      </div>

      {/* Main Top Section: Template Card & Dual Live Video Monitor */}
      <div className="flex flex-col lg:flex-row gap-6 mb-10">
        {/* Left: Original PCB Template Card */}
        <div className="w-full lg:w-[28%] h-auto">
          <div className="backdrop-blur-sm bg-black/50 rounded-2xl p-5 border border-cyan-500/20 shadow-lg shadow-cyan-950/20 h-full flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold mb-4 text-center relative">
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
                  ORIGINAL TEMPLATE
                </span>
                <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 h-0.5 w-16 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
              </h2>

              <div className="bg-gray-950/80 rounded-xl p-3 min-h-[220px] flex flex-col items-center justify-center border border-gray-800">
                {originalImageFactory ? (
                  <div className="w-full flex flex-col">
                    <div className="relative mb-3 rounded-lg overflow-hidden bg-black/70 p-1 border border-gray-800">
                      <img
                        src={`data:image/jpeg;base64,${originalImageFactory.image_data}`}
                        alt={originalImageFactory.filename}
                        className="h-44 w-full object-contain rounded-md"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-1.5 mb-3 border border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                        <span className="text-xs text-gray-300 truncate max-w-[150px]">
                          {originalImageFactory.filename}
                        </span>
                      </div>
                      <button
                        onClick={removeOriginalImage}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-semibold mb-3">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>ต้นแบบโหลดพร้อมใช้งาน</span>
                    </div>

                    <Button
                      variant="danger"
                      className="w-full text-xs py-2"
                      onClick={() =>
                        handleRequestDelete(
                          "ORIGINAL PCB IMAGE",
                          "ต้องการลบรูปภาพต้นแบบนี้หรือไม่?",
                          () => removeOriginalImage()
                        )
                      }
                      icon={<ArchiveX className="h-3.5 w-3.5" />}
                    >
                      ลบรูปภาพต้นแบบ
                    </Button>
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer py-6"
                    onClick={() => navigate("/home-factory")}
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-cyan-500/30 mb-3">
                      <Layers className="h-7 w-7 text-cyan-400" />
                    </div>
                    <p className="text-gray-400 mb-3 text-center text-xs">
                      ยังไม่มีรูปภาพต้นแบบในระบบ
                    </p>
                    <Button
                      onClick={() => navigate("/home-factory")}
                      variant="primary"
                      className="text-xs"
                      icon={<Upload className="h-3.5 w-3.5" />}
                    >
                      อัปโหลดต้นแบบ
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/80 text-center text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
              <Zap className="w-3 h-3 text-cyan-500" />
              <span>Nano Controller & Belt Active</span>
            </div>
          </div>
        </div>

        {/* Right: Dual Live Monitor (Conveyor Camera + Real-time Copper Trace) */}
        <div className="w-full lg:w-[72%] h-auto">
          <div className="backdrop-blur-sm bg-black/50 rounded-2xl p-5 border border-cyan-500/30 shadow-lg shadow-cyan-950/30 h-full flex flex-col">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={isStreaming ? stopDetection : () => startDetection(pcb_id)}
                  className={`px-5 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 ${
                    isStreaming
                      ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-900/30"
                      : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-gray-950 shadow-emerald-900/30 font-extrabold"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>{isStreaming ? "หยุดการทำงาน (Stop)" : "เริ่มเดินสายพาน (Start)"}</span>
                </button>

                <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
                  <span className="text-xs text-gray-400">สถานะ:</span>
                  <span
                    className={`text-xs font-semibold ${
                      status.includes("Error")
                        ? "text-rose-400"
                        : isStreaming
                        ? "text-emerald-400"
                        : "text-gray-400"
                    }`}
                  >
                    {status}
                  </span>
                </div>
              </div>

              {isStreaming && (
                <div className="flex items-center gap-2 bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 rounded-full text-xs font-mono text-cyan-300">
                  <span>FPS:</span>
                  <span className="font-bold">{fps}</span>
                </div>
              )}
            </div>

            {/* Notification when AI is analyzing */}
            {analyzingStatus && (
              <div className="mb-4 px-4 py-2 bg-gradient-to-r from-cyan-950/80 via-blue-950/80 to-purple-950/80 border border-cyan-400/60 rounded-xl flex items-center gap-3 animate-pulse shadow-[0_0_15px_rgba(0,200,255,0.2)]">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></div>
                <span className="text-cyan-300 text-xs sm:text-sm font-semibold">
                  {analyzingStatus}
                </span>
              </div>
            )}

            {/* DUAL DISPLAY PANELS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* Panel 1: Live Conveyor Camera Feed */}
              <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-800 flex flex-col">
                <div className="px-3 py-2 bg-gray-900/90 border-b border-gray-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    กล้องสายพานลำเลียง (Conveyor Feed)
                  </span>
                  {isStreaming && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      LIVE CAM
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-[240px] flex items-center justify-center bg-black">
                  {cameraFeed ? (
                    <img
                      src={cameraFeed}
                      alt="Camera Feed"
                      className="w-full h-full max-h-[36vh] object-contain"
                    />
                  ) : (
                    <div className="text-gray-500 text-xs flex flex-col items-center gap-2 p-6 text-center">
                      <p>{isStreaming ? "รอสัญญาณภาพจากกล้อง..." : "กดปุ่ม 'เริ่มเดินสายพาน' เพื่อเปิดกล้อง"}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel 2: Real-time Copper Trace Extraction Feed */}
              <div className="bg-gray-950 rounded-xl overflow-hidden border border-cyan-500/30 shadow-[0_0_15px_rgba(0,200,255,0.08)] flex flex-col">
                <div className="px-3 py-2 bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border-b border-cyan-500/30 flex justify-between items-center">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    การดึงลายทองแดง Real-Time (AI Copper Trace)
                  </span>
                  {isStreaming && (
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-700">
                      TINY U-NET
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-[240px] flex items-center justify-center bg-black">
                  {traceFeed ? (
                    <img
                      src={traceFeed}
                      alt="Extracted Copper Trace"
                      className="w-full h-full max-h-[36vh] object-contain"
                    />
                  ) : (
                    <div className="text-gray-500 text-xs flex flex-col items-center gap-2 p-6 text-center">
                      <p>{isStreaming ? "ระบบกำลังสแกนหาตำแหน่งลายเส้นทองแดง..." : "ระบบ AI สแตนด์บาย"}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS LIST SECTION */}
      {resultData?.result_List?.length >= 1 && (
        <div className="mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="backdrop-blur-sm bg-black/40 rounded-2xl p-6 border border-cyan-500/20 shadow-[0_0_20px_rgba(0,200,255,0.1)]"
          >
            {/* Statistics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-gray-400">ชิ้นงานที่ตรวจแล้วทั้งหมด</div>
                  <div className="text-3xl font-bold text-cyan-400 font-mono mt-1">
                    {resultData.result_List.length} <span className="text-sm font-normal text-gray-400">ชิ้น</span>
                  </div>
                </div>
                <Factory className="w-8 h-8 text-cyan-500/40" />
              </div>

              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-gray-400">ค่าความถูกต้องเฉลี่ย</div>
                  <div className="text-3xl font-bold text-purple-400 font-mono mt-1">
                    {(
                      resultData.result_List.reduce((sum, item) => sum + item.accuracy, 0) /
                      resultData.result_List.length
                    ).toFixed(1)}%
                  </div>
                </div>
                <BadgeCheck className="w-8 h-8 text-purple-500/40" />
              </div>

              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-gray-400">ชิ้นงานผ่านเกณฑ์ (Pass Rate)</div>
                  <div className="text-3xl font-bold text-emerald-400 font-mono mt-1">
                    {resultData.result_List.filter((r) => r.accuracy >= 80 || (r.description && r.description.includes("PASS"))).length}
                    <span className="text-sm font-normal text-gray-400"> / {resultData.result_List.length}</span>
                  </div>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
              </div>
            </div>

            {/* Action Bar for Export and Selection */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/60 p-3 rounded-xl border border-gray-800 mb-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllResults}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium text-gray-300 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  เลือกทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={handleClearSelectedResults}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium text-gray-400 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  ยกเลิกการเลือก
                </button>
                {selectedResultIds.length > 0 && (
                  <span className="text-xs text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-800/60 ml-2">
                    เลือกแล้ว {selectedResultIds.length} รายการ
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenExportPdf}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-gray-950 font-bold rounded-lg text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 text-gray-950" />
                <span>ส่งออกรายงาน PDF {selectedResultIds.length > 0 ? `(${selectedResultIds.length})` : ""}</span>
              </button>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {resultData.result_List.map((result, index) => {
                const verdictInfo = getVerdictInfo(result);
                return (
                  <motion.div
                    key={result.results_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-gray-900/60 rounded-xl p-4 border transition-all duration-300 group relative flex flex-col justify-between ${
                      selectedResultIds.includes(result.results_id)
                        ? "border-cyan-400 shadow-[0_0_15px_rgba(0,200,255,0.2)] bg-cyan-950/20"
                        : "border-gray-800 hover:border-cyan-500/40"
                    }`}
                  >
                    <div>
                      {/* Top Bar on Card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-cyan-500 text-gray-950 text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-mono text-gray-400">
                            #{result.results_id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggleSelectResult(result.results_id, e)}
                            className={`p-1 rounded text-xs transition-all ${
                              selectedResultIds.includes(result.results_id)
                                ? "text-cyan-400"
                                : "text-gray-500 hover:text-white"
                            }`}
                          >
                            {selectedResultIds.includes(result.results_id) ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                            onClick={() => {
                              handleRequestDelete(
                                `Result #${result.results_id}`,
                                `ต้องการลบผลการทดสอบ #${result.results_id} หรือไม่?`,
                                () => deleteResult(result.results_id)
                              );
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Image Thumbnail */}
                      <div
                        className="relative group cursor-pointer mb-3 rounded-lg overflow-hidden bg-black/80 aspect-square flex items-center justify-center border border-gray-800"
                        onClick={() => openPreview(result.imageList)}
                      >
                        {result.imageList?.image_data ? (
                          <img
                            src={`data:image/jpeg;base64,${result.imageList.image_data}`}
                            alt={result.imageList.filename || "Result"}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="text-gray-500 text-xs">ไม่มีรูปภาพ</div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1 bg-black/70 rounded-full">
                            ดูรูปภาพเต็ม
                          </span>
                        </div>
                      </div>

                      {/* Verdict Badge & Accuracy */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${verdictInfo.bg} ${verdictInfo.color}`}>
                          {verdictInfo.label}
                        </span>
                        <span className="text-xs font-bold text-cyan-300 font-mono">
                          {result.accuracy}%
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-400 truncate mb-3" title={result.description}>
                        {result.description}
                      </p>
                    </div>

                    {/* View Details Button */}
                    <button
                      onClick={() => navigate(`/details/${result.results_id}`)}
                      type="button"
                      className="w-full py-2 px-3 bg-gray-800 hover:bg-cyan-950/60 border border-gray-700 hover:border-cyan-500/60 text-gray-300 hover:text-cyan-300 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                    >
                      <BadgeCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>คลิกเพื่อดูรายละเอียด</span>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Delete
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={itemToDelete?.functions || (() => {})}
        itemName={itemToDelete?.itemName || "Error"}
        confirmText={itemToDelete?.confirmText || "Error"}
      />

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center w-full pb-3 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-gray-200">
                {previewImage.filename}
              </h4>
              <button
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-gray-800"
                onClick={closePreview}
              >
                ✕
              </button>
            </div>
            <div className="py-4 flex items-center justify-center w-full">
              <img
                src={`data:image/jpeg;base64,${previewImage.image_data}`}
                alt={previewImage.filename}
                className="max-w-full max-h-[70vh] object-contain rounded-lg border border-gray-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* Export to PDF Modal */}
      <ExportPdfModal
        isOpen={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
        pcbId={pcb_id}
        initialResultsList={resultData?.result_List}
        preSelectedResultIds={selectedResultIds}
      />
    </div>
  );
}