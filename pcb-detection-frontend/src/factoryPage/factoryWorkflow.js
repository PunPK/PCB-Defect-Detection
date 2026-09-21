import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Camera,
  BadgeCheck,
  Cpu,
  Trash2,
  RefreshCw,
  Info,
  ClipboardList,
  FileImage,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router";
import {
  Button,
  Panel,
  PageHeader,
  ImageFrame,
  ImagePreviewModal,
  cx,
} from "./ui.js";

const STEPS = [
  { no: 1, title: "ลงทะเบียนต้นแบบ", en: "Register Template" },
  { no: 2, title: "เดินสายพาน & ตรวจจับ", en: "Run Inspection" },
  { no: 3, title: "ตรวจสอบผล & รายงาน", en: "Review & Report" },
];

export function StepIndicator({ current = 1 }) {
  return (
    <ol className="grid grid-cols-3 gap-2 sm:gap-3">
      {STEPS.map((s) => {
        const done = s.no < current;
        const active = s.no === current;
        return (
          <li
            key={s.no}
            className={cx(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 sm:px-3",
              active
                ? "border-brand-500 bg-brand-50 dark:border-brand-500/60 dark:bg-brand-500/10"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            )}
          >
            <span
              className={cx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                active
                  ? "bg-brand-600 text-white"
                  : done
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              )}
            >
              {s.no}
            </span>
            <span className="min-w-0 leading-tight">
              <span
                className={cx(
                  "block truncate text-xs font-semibold sm:text-sm",
                  active ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-300"
                )}
              >
                {s.title}
              </span>
              <span className="hidden truncate text-[10px] uppercase tracking-wider text-slate-400 sm:block">
                {s.en}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function HomeFactoryWorkflow() {
  const [originalImageFactory, setOriginalImageFactory] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (originalImageFactory) {
      sessionStorage.setItem(
        "PreOriginalImageFactory",
        JSON.stringify(originalImageFactory)
      );
    } else {
      sessionStorage.removeItem("PreOriginalImageFactory");
    }
  }, [originalImageFactory]);

  const handleFileChange = (e) => {
    const fileList = e.target.files;
    if (fileList && fileList[0]) {
      const file = fileList[0];

      if (!file.type.startsWith("image/")) {
        alert("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (JPG, PNG)");
        return;
      }

      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newImage = {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            url: event.target.result,
            file,
          };
          setOriginalImageFactory(newImage);
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    if (originalImageFactory && originalImageFactory.url) {
      URL.revokeObjectURL(originalImageFactory.url);
    }
    setOriginalImageFactory(null);
    sessionStorage.removeItem("PreOriginalImageFactory");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startCamera = () => {
    navigate("/camDetectPCB", {
      state: { PCB: "OriginalImageFactory" },
    });
  };

  const proceed = () => {
    navigate("/fileDetectPCB", {
      state: { PCB: "OriginalImageFactory" },
    });
  };

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        code="Station · Template Setup"
        title="ลงทะเบียนแผ่น PCB ต้นแบบ"
        description="ระบบตรวจสอบลายทองแดง PCB อัตโนมัติร่วมกับสายพานลำเลียง — เริ่มต้นด้วยการกำหนดภาพต้นแบบ (Golden Sample) สำหรับใช้เปรียบเทียบ"
        actions={
          <Button variant="secondary" icon={ClipboardList} onClick={() => navigate("/results")}>
            ดูบันทึกผลการตรวจ
          </Button>
        }
      />

      <div className="mb-6">
        <StepIndicator current={1} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main action panel */}
        <Panel
          className="lg:col-span-2"
          title="ภาพต้นแบบ (Golden Sample)"
          subtitle="เลือกวิธีนำเข้าภาพต้นแบบของแผ่น PCB"
          icon={FileImage}
          bodyClassName="p-4 sm:p-6"
        >
          {originalImageFactory ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
              <div className="md:col-span-3">
                <ImageFrame
                  src={originalImageFactory.url}
                  alt={originalImageFactory.name}
                  className="h-64 sm:h-80"
                  onClick={() => setPreviewImage(originalImageFactory)}
                />
              </div>
              <div className="flex flex-col gap-4 md:col-span-2">
                <dl className="divide-y divide-slate-200 rounded-md border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
                  <div className="flex justify-between gap-3 px-3 py-2.5">
                    <dt className="text-slate-500 dark:text-slate-400">ชื่อไฟล์</dt>
                    <dd className="truncate font-mono text-slate-800 dark:text-slate-200" title={originalImageFactory.name}>
                      {originalImageFactory.name || "Webcam Capture"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 px-3 py-2.5">
                    <dt className="text-slate-500 dark:text-slate-400">ขนาดไฟล์</dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-200">
                      {originalImageFactory.file?.size
                        ? `${(originalImageFactory.file.size / 1024).toFixed(1)} KB`
                        : "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 px-3 py-2.5">
                    <dt className="text-slate-500 dark:text-slate-400">สถานะ</dt>
                    <dd className="font-semibold text-emerald-600 dark:text-emerald-400">พร้อมใช้งาน</dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-col gap-2">
                  <Button size="lg" icon={BadgeCheck} onClick={proceed} className="w-full">
                    ดำเนินการตรวจจับ
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      icon={RefreshCw}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      เปลี่ยนรูป
                    </Button>
                    <Button variant="danger-outline" icon={Trash2} onClick={removeImage}>
                      ลบรูป
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Camera option */}
              <button
                type="button"
                onClick={startCamera}
                className="group flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-slate-200 bg-white p-6 text-center transition-colors hover:border-brand-500 hover:bg-brand-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:p-8 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-brand-500/5"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Camera className="h-7 w-7" />
                </span>
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  ถ่ายภาพด้วยกล้อง
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  เปิดกล้องเพื่อบันทึกภาพต้นแบบของแผ่น PCB
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
                  เปิดกล้อง <ChevronRight className="h-4 w-4" />
                </span>
              </button>

              {/* Upload option */}
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = e.dataTransfer.files;
                  if (files.length) handleFileChange({ target: { files } });
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={cx(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:p-8",
                  isDragging
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-slate-300 hover:border-brand-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                )}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Upload className="h-7 w-7" />
                </span>
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  อัปโหลดไฟล์รูปภาพ
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  JPG · PNG
                </span>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {isUploading && (
            <div className="mt-4 flex items-center gap-3 rounded-md border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              กำลังอัปโหลดรูปภาพ...
            </div>
          )}
        </Panel>

        {/* Side info */}
        <div className="flex flex-col gap-6">
          <Panel title="ข้อกำหนดการถ่ายภาพ" subtitle="Operating Instructions" icon={Info}>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {[
                "วางแผ่น PCB บนพื้นที่สีขาวเท่านั้น",
                "ถ่ายภาพให้เห็นบอร์ดครบทั้งแผ่น ไม่เอียง",
                "แสงสว่างสม่ำเสมอ ไม่มีเงาหรือแสงสะท้อน",
                "รองรับไฟล์ JPG และ PNG",
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="ข้อมูลระบบ" subtitle="System Information" icon={Cpu}>
            <dl className="space-y-2.5 text-sm">
              {[
                ["อุปกรณ์", "Raspberry Pi 4"],
                ["โมเดลสกัดลายทองแดง", "Tiny U-Net"],
                ["เกณฑ์ผ่าน (PASS)", "≥ 80%"],
                ["เกณฑ์เตือน (WARN)", "70 – 79%"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <ImagePreviewModal
        image={previewImage?.url}
        title={previewImage?.name}
        onClose={() => setPreviewImage(null)}
      />
    </main>
  );
}
