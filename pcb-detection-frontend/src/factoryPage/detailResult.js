import {
  ArrowLeft,
  Printer,
  ScanLine,
  GitCompare,
  CircleSlash,
  Zap,
  AlertTriangle,
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import "./exportPdf.css";
import {
  API_BASE,
  Button,
  Panel,
  PageHeader,
  StatTile,
  VerdictBadge,
  LoadingScreen,
  EmptyState,
  ImageFrame,
  ImagePreviewModal,
  b64,
  cx,
} from "./ui.js";

function ImageCard({ step, title, subtitle, tag, src, alt, onOpen }) {
  return (
    <div className="print-avoid-break flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {step && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-600 font-mono text-[11px] font-bold text-white">
                {step}
              </span>
            )}
            <span className="truncate">{title}</span>
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {tag && (
          <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {tag}
          </span>
        )}
      </div>
      <div className="p-3">
        <ImageFrame src={b64(src)} alt={alt} className="h-56 sm:h-64 lg:h-72" onClick={() => onOpen(src, title)} />
      </div>
    </div>
  );
}

export default function DetailResult() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [result, setResult] = useState(null);
  const { result_id } = useParams();

  useEffect(() => {
    handleGetResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result_id]);

  const handleGetResult = async () => {
    if (!result_id) {
      console.error("No result_id provided");
      return;
    }
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/factory/get_result/${result_id}`);
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
    setPreviewImage({ src: b64(image_data), title: filename });
  };

  // Parse defect stats from description string
  const getParsedStats = () => {
    const desc = result?.result_List?.description || "";
    const openMatch = desc.match(/Open:\s*(\d+)/i);
    const shortMatch = desc.match(/Short:\s*(\d+)/i);
    const minorMatch = desc.match(/Minor:\s*(\d+)/i);
    const verdictMatch = desc.match(/Verdict:\s*([A-Z_]+)/i);

    const verdict = verdictMatch
      ? verdictMatch[1].toUpperCase()
      : result?.result_List?.accuracy >= 80
      ? "PASS"
      : "FAIL";
    const open = openMatch ? parseInt(openMatch[1], 10) : 0;
    const short = shortMatch ? parseInt(shortMatch[1], 10) : 0;
    const minor = minorMatch ? parseInt(minorMatch[1], 10) : 0;

    return { verdict, open, short, minor, rawDesc: desc };
  };

  if (isProcessing) {
    return <LoadingScreen label="กำลังโหลดผลการวิเคราะห์..." />;
  }

  const stats = getParsedStats();
  const data = result?.result_List;
  const images = data?.imageList || {};
  const badgeVerdict = ["PASS", "WARN", "FAIL"].includes(stats.verdict) ? stats.verdict : "FAIL";
  const verdictLabel = {
    PASS: "ผ่านเกณฑ์ (PASS)",
    WARN: "มีข้อผิดพลาดเล็กน้อย (WARN)",
    FAIL: "ไม่ผ่านเกณฑ์ (FAIL)",
  }[badgeVerdict];
  const disposition = {
    PASS: { text: "ปกติ พร้อมส่งต่อ", cls: "text-emerald-600 dark:text-emerald-400" },
    WARN: { text: "ส่งตรวจซ้ำโดยพนักงาน", cls: "text-warn-600 dark:text-warn-400" },
    FAIL: { text: "คัดแยก / ต้องนำไปตรวจสอบ", cls: "text-rose-600 dark:text-rose-400" },
  }[badgeVerdict];

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        code={`Inspection Report · Batch #${data?.pcb_result_id ?? "-"}`}
        title={`ผลการวิเคราะห์ชิ้นงาน #${data?.results_id ?? result_id}`}
        description="ระบบ AI สกัดลายทองแดงและวิเคราะห์จุดบกพร่องเทียบกับภาพต้นแบบ"
        actions={
          <>
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
              ย้อนกลับ
            </Button>
            <Button icon={Printer} onClick={() => window.print()} disabled={!data}>
              พิมพ์ / บันทึก PDF
            </Button>
          </>
        }
      />

      {!data ? (
        <EmptyState
          title="ไม่พบข้อมูลผลการตรวจ"
          description={`ไม่พบผลการตรวจหมายเลข #${result_id} หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้`}
          action={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate("/results")}>
              กลับไปหน้าบันทึกผล
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Verdict summary */}
          <Panel title="สรุปผลการตรวจ" subtitle="Inspection Summary" icon={ClipboardCheck} className="print-avoid-break">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <VerdictBadge verdict={badgeVerdict} label={verdictLabel} size="lg" />
                <code className="break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {stats.rawDesc || "-"}
                </code>
              </div>
              <div className="flex items-baseline gap-2 md:text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  คะแนนความสมบูรณ์
                </span>
                <span className="font-mono text-3xl font-bold text-brand-600 dark:text-brand-400">
                  {data.accuracy}%
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="วงจรขาด (Open)" value={stats.open} unit="จุด" icon={CircleSlash} tone={stats.open ? "fail" : "neutral"} />
              <StatTile label="วงจรลัด (Short)" value={stats.short} unit="จุด" icon={Zap} tone={stats.short ? "fail" : "neutral"} />
              <StatTile label="ตำหนิย่อย (Minor)" value={stats.minor} unit="จุด" icon={AlertTriangle} tone={stats.minor ? "warn" : "neutral"} />
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  การจัดการชิ้นงาน
                </span>
                <div className={cx("mt-2 text-base font-bold sm:text-lg", disposition.cls)}>{disposition.text}</div>
              </div>
            </div>
          </Panel>

          {/* Template vs detected */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              <GitCompare className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              ภาพเปรียบเทียบต้นแบบและชิ้นงานจริง
            </h2>
            <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <ImageCard
                title="ภาพต้นแบบ (Template)"
                subtitle="ไฟล์ต้นแบบอ้างอิงที่ใช้ในการตรวจสอบ"
                tag="Reference"
                src={images.template_image?.image_data}
                alt="Template PCB"
                onOpen={openPreview}
              />
              <ImageCard
                title="ภาพชิ้นงานที่ตรวจพบ (Detected)"
                subtitle="ภาพจากกล้องบนสายพานที่ตัดเฉพาะตัวบอร์ด"
                tag="Camera"
                src={images.defective_image?.image_data}
                alt="Detected PCB"
                onOpen={openPreview}
              />
              <span className="absolute left-1/2 top-1/2 z-10 hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm md:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </section>

          {/* AI processing pipeline */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              <ScanLine className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              ลำดับการประมวลผลด้วย AI
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
              <ImageCard
                step={1}
                title="สกัดลายทองแดง (Copper Trace Extraction)"
                subtitle="โมเดล Tiny U-Net สกัดเฉพาะเส้นทางเดินลายทองแดงออกจากเนื้อบอร์ด FR4"
                tag="U-Net"
                src={images.aligned_image?.image_data}
                alt="Extracted Copper Trace"
                onOpen={openPreview}
              />
              <div className="flex justify-center lg:hidden">
                <ChevronDown className="h-5 w-5 text-slate-400" />
              </div>
              <ImageCard
                step={2}
                title="ผลการวิเคราะห์ลาย (Defect Analysis)"
                subtitle="เปรียบเทียบลายทองแดงกับต้นแบบ พร้อมระบุตำแหน่งและประเภทจุดบกพร่อง"
                tag="Analysis"
                src={images.result_image?.image_data}
                alt="Analyzed Defect Result"
                onOpen={openPreview}
              />
            </div>
          </section>
        </div>
      )}

      <ImagePreviewModal
        image={previewImage?.src}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </main>
  );
}
