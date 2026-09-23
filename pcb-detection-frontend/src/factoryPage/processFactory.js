import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Layers,
  Trash2,
  Printer,
  CheckSquare,
  Square,
  Activity,
  Play,
  StopCircle,
  Video,
  ScanLine,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ListChecks,
  Eye,
  ClipboardList,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import ExportPdfModal from "./ExportPdfModal.js";
import { StepIndicator } from "./factoryWorkflow.js";
import {
  API_BASE,
  Button,
  Panel,
  PageHeader,
  StatTile,
  VerdictBadge,
  StatusIndicator,
  LoadingScreen,
  EmptyState,
  ImageFrame,
  ImagePreviewModal,
  ConfirmDialog,
  getVerdict,
  b64,
  cx,
} from "./ui.js";

function FeedPanel({ title, tag, icon: Icon, src, active, placeholder, accent }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Icon className={cx("h-4 w-4 shrink-0", accent)} />
          <span className="truncate">{title}</span>
        </span>
        <span
          className={cx(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
            active
              ? "bg-rose-600 text-white"
              : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          {active ? `● ${tag}` : "OFFLINE"}
        </span>
      </div>
      <div className="relative flex aspect-video items-center justify-center bg-slate-950">
        {src ? (
          <img src={src} alt={title} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-slate-500">
            {active ? (
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            ) : (
              <Icon className="h-6 w-6 text-slate-600" />
            )}
            <p>{placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [isRechecking, setIsRechecking] = useState(false);

  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

  const [resultData, setResultData] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
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

  const handleRequestDelete = (itemName, confirmText, functions) => {
    setItemToDelete({ itemName, confirmText, functions });
    setIsDeleteOpen(true);
  };

  useEffect(() => {
    sessionStorage.removeItem("PreOriginalImageFactory");
  }, []);

  const processImageQueue = () => {
    // ป้องกัน Frame คั่งค้างใน Memory จนหน้าจอค้าง: ทิ้งเฟรมเก่าและเก็บเฉพาะ 2 เฟรมล่าสุด
    if (imageQueueRef.current.length > 4) {
      imageQueueRef.current = imageQueueRef.current.slice(-2);
    }
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
          } else if (message.type === "rechecking") {
            setIsRechecking(true);
            setAnalyzingStatus(message.message || "กำลังย้อนสายพานเพื่อตรวจจับซ้ำ...");
          } else if (message.type === "recheck_centering") {
            setIsRechecking(false);
            setAnalyzingStatus(message.message || "สายพานกำลังเดินหน้าเข้าสู่กึ่งกลางกล้อง...");
          } else if (message.type === "centering") {
            setAnalyzingStatus(message.message || "กำลังขยับสายพานปรับตำแหน่งกึ่งกลาง...");
          } else if (message.type === "focusing") {
            setAnalyzingStatus(message.message || "กำลังปรับ Focus เลนส์กล้องให้คมชัดสูงสุด...");
          } else if (message.type === "stabilizing") {
            setAnalyzingStatus(message.message || "รอนิ่งสนิทและบันทึกภาพคุณภาพสูงสุด...");
          } else if (message.type === "cooldown") {
            setAnalyzingStatus(message.message || `กำลังส่งชิ้นงานออก (${message.remaining}s)...`);
          } else if (message.type === "searching") {
            setAnalyzingStatus(null);
          } else if (message.type === "new_result") {
            setIsRechecking(false);
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

  const handleRecheck = async () => {
    if (!isStreaming) return;
    setIsRechecking(true);
    setAnalyzingStatus("กำลังส่งคำสั่งย้อนสายพาน (Recheck)...");

    // 1. ส่งคำสั่งผ่าน WebSocket ทันที
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action: "recheck" }));
      } catch (err) {
        console.warn("WebSocket recheck error:", err);
      }
    }

    // 2. เรียก REST API เป็น fallback เพิ่มเติม
    try {
      await fetch(`${API_BASE}/factory/recheck`, { method: "POST" });
    } catch (err) {
      console.warn("API recheck error:", err);
    }

    // Safety timeout หากไม่มีการตอบกลับภายใน 5 วินาที
    setTimeout(() => {
      setIsRechecking(false);
    }, 5000);
  };

  const stopDetection = () => {
    stopFpsCounter();
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ action: "stop" }));
        } catch (e) {}
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    try {
      fetch(`${API_BASE}/factory/stop`, { method: "POST" });
    } catch (e) {}
    setIsStreaming(false);
    setIsRechecking(false);
    setStatus("Disconnected");
    setFps(0);
    imageQueueRef.current = [];
    setAnalyzingStatus(null);

    setCameraFeed((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setTraceFeed((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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
      const response = await fetch(`${API_BASE}/factory/get_images/${pcb_Id}`);
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
      const response = await fetch(`${API_BASE}/factory/get_result_pcb_working/${pcb_Id}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcb_id]);

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
      await fetch(`${API_BASE}/factory/delete_pcb/${pcb_Id}`, { method: "DELETE" });
    } catch (error) {
      console.error("Error deleting PCB:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteResult = async (result_Id) => {
    try {
      await fetch(`${API_BASE}/factory/delete_result/${result_Id}`, { method: "DELETE" });
      setSelectedResultIds((prev) => prev.filter((id) => id !== result_Id));
      fetchResultData(pcb_id);
    } catch (error) {
      console.error("Error deleting result:", error);
    }
  };

  if (isProcessing) {
    return <LoadingScreen label="กำลังโหลดข้อมูลชุดตรวจสอบ..." />;
  }

  const results = resultData?.result_List || [];
  const verdicts = results.map((r) => getVerdict(r.accuracy, r.description));
  const passCount = verdicts.filter((v) => v === "PASS").length;
  const warnCount = verdicts.filter((v) => v === "WARN").length;
  const failCount = verdicts.filter((v) => v === "FAIL").length;
  const avgAccuracy = results.length
    ? (results.reduce((sum, item) => sum + (item.accuracy || 0), 0) / results.length).toFixed(1)
    : "0.0";

  const connState = status.includes("Error")
    ? "error"
    : isStreaming
    ? "online"
    : status.startsWith("Connecting")
    ? "connecting"
    : "idle";
  const connLabel = {
    error: "ข้อผิดพลาดการเชื่อมต่อ",
    online: "กำลังทำงาน",
    connecting: "กำลังเชื่อมต่อ...",
    idle: "หยุดทำงาน",
  }[connState];

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        code={`Conveyor Line · Batch #${pcb_id}`}
        title="สายพานตรวจสอบอัตโนมัติ"
        description="ตรวจสอบและสกัดลายทองแดง PCB แบบ Real-time ด้วย AI ร่วมกับสายพานลำเลียง"
        actions={
          <>
            <StatusIndicator state={connState} label={connLabel} />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Gauge className="h-3.5 w-3.5 text-slate-400" />
              {fps} FPS
            </span>
          </>
        }
      />

      <div className="mb-6">
        <StepIndicator current={results.length ? 3 : 2} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Template panel */}
        <Panel
          className="lg:col-span-4 xl:col-span-3"
          title="ภาพต้นแบบ"
          subtitle="Golden Sample Template"
          icon={Layers}
        >
          {originalImageFactory ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <ImageFrame
                src={b64(originalImageFactory.image_data)}
                alt={originalImageFactory.filename}
                className="h-48"
                onClick={() =>
                  setPreviewImage({
                    src: b64(originalImageFactory.image_data),
                    title: originalImageFactory.filename,
                  })
                }
              />
              <div className="flex flex-col gap-3">
                <dl className="divide-y divide-slate-200 rounded-md border border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
                  <div className="flex justify-between gap-2 px-3 py-2">
                    <dt className="text-slate-500 dark:text-slate-400">Batch ID</dt>
                    <dd className="font-mono font-semibold">#{pcb_id}</dd>
                  </div>
                  <div className="flex justify-between gap-2 px-3 py-2">
                    <dt className="text-slate-500 dark:text-slate-400">ไฟล์</dt>
                    <dd className="truncate font-mono" title={originalImageFactory.filename}>
                      {originalImageFactory.filename}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 px-3 py-2">
                    <dt className="text-slate-500 dark:text-slate-400">สถานะ</dt>
                    <dd className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> พร้อมใช้งาน
                    </dd>
                  </div>
                </dl>
                <Button
                  variant="danger-outline"
                  size="sm"
                  className="mt-auto w-full"
                  icon={Trash2}
                  onClick={() =>
                    handleRequestDelete(
                      "ลบชุดตรวจสอบและภาพต้นแบบ",
                      "ภาพต้นแบบและผลการตรวจทั้งหมดในชุดนี้จะถูกลบถาวร ต้องการดำเนินการต่อหรือไม่?",
                      () => removeOriginalImage()
                    )
                  }
                >
                  ลบภาพต้นแบบ
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="ยังไม่มีภาพต้นแบบ"
              description="กรุณาลงทะเบียนภาพต้นแบบก่อนเริ่มตรวจสอบ"
              action={
                <Button icon={Upload} onClick={() => navigate("/home-factory")}>
                  อัปโหลดต้นแบบ
                </Button>
              }
            />
          )}
        </Panel>

        {/* Live monitor */}
        <Panel
          className="lg:col-span-8 xl:col-span-9"
          title="จอมอนิเตอร์สายพาน"
          subtitle="Live Conveyor Monitor"
          icon={Activity}
          actions={
            isStreaming ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="warning"
                  icon={RotateCcw}
                  loading={isRechecking}
                  onClick={handleRecheck}
                  title="ย้อนสายพานเพื่อตรวจจับชิ้นงานนี้ซ้ำ"
                >
                  {isRechecking ? "กำลังย้อนสายพาน..." : "ตรวจซ้ำ (Recheck)"}
                </Button>
                <Button variant="danger" icon={StopCircle} onClick={stopDetection}>
                  หยุดสายพาน
                </Button>
              </div>
            ) : (
              <Button
                variant="success"
                icon={Play}
                loading={connState === "connecting"}
                onClick={() => startDetection(pcb_id)}
              >
                เริ่มเดินสายพาน
              </Button>
            )
          }
        >
          {analyzingStatus && (
            <div className="mb-4 flex items-center gap-3 rounded-md border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              {analyzingStatus}
            </div>
          )}
          {connState === "error" && (
            <div className="mb-4 flex items-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {status}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FeedPanel
              title="กล้องสายพานลำเลียง"
              tag="LIVE"
              icon={Video}
              accent="text-slate-500"
              src={cameraFeed}
              active={isStreaming}
              placeholder={isStreaming ? "รอสัญญาณภาพจากกล้อง..." : "กด 'เริ่มเดินสายพาน' เพื่อเปิดกล้อง"}
            />
            <FeedPanel
              title="สกัดลายทองแดง (AI Copper Trace)"
              tag="U-NET"
              icon={ScanLine}
              accent="text-brand-600 dark:text-brand-400"
              src={traceFeed}
              active={isStreaming}
              placeholder={isStreaming ? "กำลังสแกนหาตำแหน่งลายเส้นทองแดง..." : "ระบบ AI สแตนด์บาย"}
            />
          </div>
        </Panel>
      </div>

      {/* Results */}
      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 sm:gap-4">
          <StatTile label="ตรวจแล้ว" value={results.length} unit="ชิ้น" icon={ListChecks} />
          <StatTile label="ผ่าน (PASS)" value={passCount} icon={CheckCircle2} tone="pass" />
          <StatTile label="เตือน (WARN)" value={warnCount} icon={AlertTriangle} tone="warn" />
          <StatTile label="ไม่ผ่าน (FAIL)" value={failCount} icon={XCircle} tone="fail" />
          <div className="col-span-2 md:col-span-1">
            <StatTile label="ความถูกต้องเฉลี่ย" value={avgAccuracy} unit="%" icon={Gauge} tone="brand" />
          </div>
        </div>

        <Panel
          title="ผลการตรวจในชุดนี้"
          subtitle={`Inspection Results · ${results.length} รายการ`}
          icon={ClipboardList}
          actions={
            results.length > 0 && (
              <>
                <Button variant="secondary" size="sm" icon={CheckSquare} onClick={handleSelectAllResults}>
                  เลือกทั้งหมด
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Square}
                  onClick={handleClearSelectedResults}
                  disabled={!selectedResultIds.length}
                >
                  ยกเลิกเลือก
                </Button>
                <Button size="sm" icon={Printer} onClick={() => setIsExportPdfOpen(true)}>
                  ส่งออก PDF{selectedResultIds.length > 0 ? ` (${selectedResultIds.length})` : ""}
                </Button>
              </>
            )
          }
        >
          {results.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="ยังไม่มีผลการตรวจ"
              description="เมื่อสายพานทำงานและ AI ตรวจพบชิ้นงาน ผลการตรวจจะแสดงที่นี่โดยอัตโนมัติ"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {results.map((result, index) => {
                const verdict = verdicts[index];
                const selected = selectedResultIds.includes(result.results_id);
                return (
                  <article
                    key={result.results_id}
                    className={cx(
                      "flex flex-col rounded-lg border bg-white transition-colors dark:bg-slate-900",
                      selected
                        ? "border-brand-500 ring-1 ring-brand-500"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleToggleSelectResult(result.results_id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 accent-brand-600"
                        />
                        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                          #{String(index + 1).padStart(3, "0")}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">ID {result.results_id}</span>
                      </label>
                      <VerdictBadge verdict={verdict} />
                    </div>

                    <div className="p-3">
                      <ImageFrame
                        src={b64(result.imageList?.image_data)}
                        alt={result.imageList?.filename || "Result"}
                        className="aspect-[4/3]"
                        emptyLabel="ไม่มีรูปภาพ"
                        onClick={() =>
                          setPreviewImage({
                            src: b64(result.imageList?.image_data),
                            title: `Result #${result.results_id}`,
                          })
                        }
                      />
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">ความถูกต้อง</span>
                        <span className="font-mono text-sm font-bold">{result.accuracy}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={cx(
                            "h-full rounded-full",
                            verdict === "PASS" ? "bg-emerald-500" : verdict === "WARN" ? "bg-warn-500" : "bg-rose-500"
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, result.accuracy || 0))}%` }}
                        />
                      </div>
                      <p
                        className="mt-2 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400"
                        title={result.description}
                      >
                        {result.description || "-"}
                      </p>
                    </div>

                    <div className="mt-auto flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        className="flex-1"
                        onClick={() => navigate(`/details/${result.results_id}`)}
                      >
                        ดูรายละเอียด
                      </Button>
                      <Button
                        variant="danger-outline"
                        size="sm"
                        icon={Trash2}
                        aria-label="ลบผลการตรวจ"
                        onClick={() =>
                          handleRequestDelete(
                            `ลบผลการตรวจ #${result.results_id}`,
                            `ต้องการลบผลการตรวจ #${result.results_id} หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
                            () => deleteResult(result.results_id)
                          )
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={isDeleteOpen}
        title={itemToDelete?.itemName}
        message={itemToDelete?.confirmText}
        onConfirm={itemToDelete?.functions}
        onClose={() => setIsDeleteOpen(false)}
      />

      <ImagePreviewModal
        image={previewImage?.src}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />

      <ExportPdfModal
        isOpen={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
        pcbId={pcb_id}
        initialResultsList={resultData?.result_List}
        preSelectedResultIds={selectedResultIds}
      />
    </main>
  );
}
