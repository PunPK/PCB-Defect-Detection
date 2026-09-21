import { ArrowDown, ArrowRight, IterationCcw, Printer, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import "../page/HomePage.css";
import "./exportPdf.css";

export default function DetailResult() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [result, setResult] = useState(null);
  const { result_id } = useParams();

  function ImageCard({ title, subtitle, src, alt, className = "", badge = null }) {
    return (
      <div
        className={`bg-gray-900/80 rounded-xl overflow-hidden border border-gray-700/80 border-b-4 ${className} transition-all hover:scale-[1.01] hover:shadow-xl print-avoid-break backdrop-blur-sm`}
      >
        <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-800/80 border-b border-gray-700/50 flex justify-between items-center">
          <div>
            <h3 className="text-base lg:text-lg font-bold text-gray-100 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {badge && <div>{badge}</div>}
        </div>
        <div
          className="p-3 bg-black/50 relative group cursor-pointer"
          onClick={() => openPreview(src, title)}
        >
          {src ? (
            <img
              src={`data:image/jpeg;base64,${src}`}
              alt={alt}
              className="w-full h-56 lg:h-64 object-contain rounded-lg bg-black/60 p-1"
            />
          ) : (
            <div className="w-full h-56 lg:h-64 flex items-center justify-center text-gray-500 text-sm">
              ไม่มีข้อมูลรูปภาพ
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
            <span className="text-white opacity-0 group-hover:opacity-100 transform group-hover:translate-y-0 translate-y-2 transition-all duration-300 px-3 py-1.5 bg-black/70 rounded-full text-sm font-medium">
              คลิกเพื่อดูรูปภาพเต็ม
            </span>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    handleGetResult();
  }, [result_id]);

  const handleGetResult = async () => {
    setIsProcessing(true);
    if (!result_id) {
      console.error("No result_id provided");
      return;
    }

    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result/${result_id}`
      );
      const data = await response.json();

      if (response.ok) {
        setResult(data);
      }
    } catch (error) {
      console.error("Error fetching result details:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const openPreview = (image_data, filename) => {
    if (!image_data) return;
    setPreviewImage({
      image_data: image_data,
      filename: filename,
    });
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  // Helper parsing defect stats from description string
  const getParsedStats = () => {
    const desc = result?.result_List?.description || "";
    const openMatch = desc.match(/Open:\s*(\d+)/i);
    const shortMatch = desc.match(/Short:\s*(\d+)/i);
    const minorMatch = desc.match(/Minor:\s*(\d+)/i);
    const verdictMatch = desc.match(/Verdict:\s*([A-Z_]+)/i);

    const verdict = verdictMatch ? verdictMatch[1] : (result?.result_List?.accuracy >= 80 ? "PASS" : "FAIL");
    const open = openMatch ? parseInt(openMatch[1], 10) : 0;
    const short = shortMatch ? parseInt(shortMatch[1], 10) : 0;
    const minor = minorMatch ? parseInt(minorMatch[1], 10) : 0;

    return { verdict, open, short, minor, rawDesc: desc };
  };

  const stats = getParsedStats();

  if (isProcessing) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#050816]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full grid-bg opacity-30"></div>
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-700/15 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-20 w-96 h-96 bg-cyan-700/15 rounded-full filter blur-3xl"></div>
      </div>

      <div className="p-2 sm:p-6 max-w-6xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start mb-8 gap-6 border-b border-gray-800/80 pb-6">
          <div className="max-w-2xl">
            <div className="flex items-center mb-3">
              <span className="text-cyan-400 font-mono text-sm sm:text-base tracking-widest flex items-center font-semibold">
                <span className="inline-block w-2.5 h-2.5 bg-cyan-400 rounded-full mr-2 animate-pulse"></span>
                DEFECT INSPECTION REPORT
              </span>
              <div className="ml-4 h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent"></div>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              ผลการวิเคราะห์ชิ้นงานที่ #{result?.result_List?.results_id}
            </h1>
            <p className="text-gray-400 text-sm">
              ชุดการตรวจสอบ PCB Batch ID: #{result?.result_List?.pcb_result_id} | ระบบ AI สกัดลายทองแดงและวิเคราะห์จุดบกพร่อง
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full sm:w-auto print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-gray-950 font-bold rounded-lg text-sm shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Printer className="w-4 h-4 mr-2" />
              <span>พิมพ์ / บันทึก PDF</span>
            </button>

            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 hover:text-white text-sm font-medium transition-all"
            >
              <IterationCcw className="w-4 h-4 mr-2" />
              <span>ย้อนกลับ</span>
            </button>
          </div>
        </div>

        {/* Status & Analysis Summary Card */}
        {result && (
          <div className="mb-10 p-5 rounded-2xl bg-gray-900/60 border border-cyan-500/30 shadow-[0_0_20px_rgba(0,200,255,0.08)] backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-800/80 pb-4 mb-4">
              <div className="flex items-center gap-3">
                {stats.verdict === "PASS" ? (
                  <div className="px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>ผ่านเกณฑ์ (PASS)</span>
                  </div>
                ) : stats.verdict === "WARN" ? (
                  <div className="px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-400 font-bold text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>มีข้อผิดพลาดเล็กน้อย (WARN)</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-full bg-rose-950/80 border border-rose-500/60 text-rose-400 font-bold text-sm flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>ไม่ผ่านเกณฑ์ (FAIL)</span>
                  </div>
                )}
                <div className="text-gray-300 font-mono text-xs sm:text-sm">
                  {stats.rawDesc}
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase text-gray-400 font-semibold tracking-wider">
                  คะแนนความสมบูรณ์
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-cyan-400 font-mono">
                  {result?.result_List?.accuracy}%
                </span>
              </div>
            </div>

            {/* Defect Count Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-black/40 border border-gray-800 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Open Circuits (ขาด)</div>
                <div className="text-xl font-bold font-mono text-rose-400">
                  {stats.open} <span className="text-xs font-normal text-gray-500">จุด</span>
                </div>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Short Circuits (ลัด)</div>
                <div className="text-xl font-bold font-mono text-fuchsia-400">
                  {stats.short} <span className="text-xs font-normal text-gray-500">จุด</span>
                </div>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Minor Defects (ตำหนิย่อย)</div>
                <div className="text-xl font-bold font-mono text-amber-400">
                  {stats.minor} <span className="text-xs font-normal text-gray-500">จุด</span>
                </div>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">สถานะชิ้นงาน</div>
                <div className={`text-base font-bold ${stats.verdict === "PASS" ? "text-emerald-400" : "text-rose-400"}`}>
                  {stats.verdict === "PASS" ? "ปกติ พร้อมส่งต่อ" : "ต้องนำไปตรวจสอบ"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: Template vs Detected Comparison */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <h2 className="text-lg font-bold text-gray-200 uppercase tracking-wide">
              ภาพเปรียบเทียบต้นแบบและชิ้นงานจริง
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <div>
              <ImageCard
                title="รูปภาพต้นฉบับ PCB (Template)"
                subtitle="ไฟล์ต้นแบบอ้างอิงที่ใช้ในการตรวจสอบ"
                src={result?.result_List?.imageList?.template_image?.image_data}
                alt="Template PCB"
                className="border-b-blue-500 shadow-blue-500/10"
                badge={<span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded">ต้นแบบ</span>}
              />
            </div>

            <div className="relative">
              <ImageCard
                title="รูปภาพตรวจจับ PCB ที่พบ (Detected PCB)"
                subtitle="ภาพถ่ายจากกล้องบนสายพานลำเลียงที่ตัดเฉพาะตัวบอร์ด"
                src={result?.result_List?.imageList?.defective_image?.image_data}
                alt="Detected PCB"
                className="border-b-purple-500 shadow-purple-500/10"
                badge={<span className="text-xs px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded">กล้องตรวจจับ</span>}
              />
              <div className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-gray-800 border border-gray-600 items-center justify-center text-gray-300">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Sequential Workflow Steps (ดึงลาย -> วิเคราะห์ลาย) */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center mb-6">
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent w-full"></div>
            <span className="px-4 text-xs uppercase tracking-widest text-cyan-400 font-semibold whitespace-nowrap">
              ลำดับการประมวลผลด้วย AI
            </span>
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent w-full"></div>
          </div>

          {/* ขั้นตอนที่ 1: ขั้นตอนการดึงลายทองแดง */}
          <div className="mb-6">
            <ImageCard
              title="ขั้นตอนที่ 1 : ขั้นตอนการดึงลายทองแดง (Copper Trace Extraction)"
              subtitle="โมเดล TinyUNet สกัดเฉพาะเส้นทางเดินลายทองแดงออกจากเนื้อบอร์ด FR4"
              src={result?.result_List?.imageList?.aligned_image?.image_data}
              alt="Extracted Copper Trace"
              className="border-b-cyan-500 shadow-cyan-500/10"
              badge={<span className="text-xs px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">AI U-Net</span>}
            />
          </div>

          <div className="flex justify-center my-4">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center animate-bounce">
              <ArrowDown className="w-4 h-4 text-cyan-400" />
            </div>
          </div>

          {/* ขั้นตอนที่ 2: ผลลัพธ์การวิเคราะห์ลาย */}
          <div className="mb-10">
            <ImageCard
              title="ขั้นตอนที่ 2 : ผลลัพธ์การวิเคราะห์ลาย (Defect Analysis Result)"
              subtitle="โมเดลเปรียบเทียบลายทองแดงกับต้นแบบ พร้อมไฮไลท์ระบุตำแหน่งและประเภทของจุดบกพร่อง"
              src={result?.result_List?.imageList?.result_image?.image_data}
              alt="Analyzed Defect Result"
              className="border-b-rose-500 shadow-rose-500/15"
              badge={<span className="text-xs px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded">AI Analysis</span>}
            />
          </div>
        </div>
      </div>

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center"
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
                className="max-w-full max-h-[75vh] object-contain rounded-lg border border-gray-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
