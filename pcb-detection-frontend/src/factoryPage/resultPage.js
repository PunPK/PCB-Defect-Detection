import {
  CheckCircle2,
  XCircle,
  BarChart2,
  Trash2,
  Printer,
  Gauge,
  Search,
  ClipboardList,
  PlusCircle,
  RefreshCw,
  LayoutGrid,
  List,
  ArrowRight,
  Info,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import ExportPdfModal from "./ExportPdfModal.js";
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
  ConfirmDialog,
  b64,
  cx,
} from "./ui.js";

const ResultPage = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [selectedPcbForExport, setSelectedPcbForExport] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid");

  const handleOpenExportModal = (pcbId) => {
    setSelectedPcbForExport(pcbId);
    setIsExportModalOpen(true);
  };

  const handleRequestDelete = (itemName, confirmText, functions) => {
    setItemToDelete({ itemName, confirmText, functions });
    setIsDeleteOpen(true);
  };

  useEffect(() => {
    handleGetResults();
  }, []);

  const handleGetResults = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/factory/get_all_pcb_results`);
      const data = await response.json();

      if (response.ok) {
        const processedResults = data.results.map((result) => {
          const status = result.sum_accuracy > 80 ? "pass" : "fail";
          return { ...result, status };
        });
        setResults(processedResults);
      }
    } catch (error) {
      console.error("Error fetching results:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const removePcbResult = (pcb_Id) => {
    if (pcb_Id) {
      sessionStorage.removeItem("OriginalImageFactory");
      deletePcb(pcb_Id);
    }
  };

  const deletePcb = async (pcb_Id) => {
    try {
      await fetch(`${API_BASE}/factory/delete_pcb/${pcb_Id}`, { method: "DELETE" });
      handleGetResults();
    } catch (error) {
      console.error("Error deleting PCB:", error);
    }
  };

  if (isProcessing && !results) {
    return <LoadingScreen label="กำลังโหลดบันทึกผลการตรวจ..." />;
  }

  const all = results || [];
  const totalTests = all.length;
  const passedTests = all.filter((r) => r.status === "pass").length;
  const failedTests = totalTests - passedTests;
  const avgAccuracy = totalTests
    ? all.reduce((sum, r) => sum + (r.sum_accuracy || 0), 0) / totalTests
    : 0;
  const passRate = totalTests ? (passedTests / totalTests) * 100 : 0;

  const visible = all.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (query && !String(r.pcb_id).includes(query.trim().replace("#", ""))) return false;
    return true;
  });

  const accuracyText = (r) =>
    r?.sum_accuracy !== undefined && r?.sum_accuracy !== null ? `${r.sum_accuracy}%` : "N/A";

  const RowActions = ({ result, compact }) => (
    <div className={cx("flex gap-2", compact ? "" : "flex-col")}>
      <Button
        size="sm"
        icon={ArrowRight}
        className={compact ? "" : "w-full"}
        onClick={() => navigate(`/factoryWorkflow/${result.pcb_id}`)}
      >
        เปิดชุดตรวจ
      </Button>
      <div className={cx("flex gap-2", compact ? "" : "w-full")}>
        <Button
          variant="secondary"
          size="sm"
          icon={Printer}
          className={compact ? "" : "flex-1"}
          onClick={() => handleOpenExportModal(result.pcb_id)}
        >
          PDF
        </Button>
        <Button
          variant="danger-outline"
          size="sm"
          icon={Trash2}
          aria-label="ลบข้อมูล"
          onClick={() =>
            handleRequestDelete(
              `ลบชุดตรวจสอบ #${result.pcb_id}`,
              `ข้อมูลภาพต้นแบบและผลการตรวจทั้งหมดของชุด #${result.pcb_id} จะถูกลบถาวร ต้องการดำเนินการต่อหรือไม่?`,
              () => removePcbResult(result.pcb_id)
            )
          }
        />
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        code="Quality Records"
        title="บันทึกผลการตรวจสอบ"
        description="ประวัติชุดการตรวจสอบ PCB ทั้งหมด พร้อมสรุปผลคุณภาพและการส่งออกรายงาน"
        actions={
          <>
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={isProcessing}
              onClick={handleGetResults}
            >
              รีเฟรช
            </Button>
            <Button icon={PlusCircle} onClick={() => navigate("/home-factory")}>
              เริ่มชุดตรวจใหม่
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="ชุดตรวจทั้งหมด" value={totalTests} unit="ชุด" icon={BarChart2} />
        <StatTile
          label="ผ่านเกณฑ์"
          value={passedTests}
          icon={CheckCircle2}
          tone="pass"
          hint={`Pass rate ${passRate.toFixed(0)}%`}
        />
        <StatTile label="ไม่ผ่านเกณฑ์" value={failedTests} icon={XCircle} tone="fail" />
        <StatTile label="ความถูกต้องเฉลี่ย" value={avgAccuracy.toFixed(1)} unit="%" icon={Gauge} tone="brand" />
      </div>

      <Panel
        title="รายการชุดตรวจสอบ"
        subtitle={`แสดง ${visible.length} จาก ${totalTests} ชุด`}
        icon={ClipboardList}
        bodyClassName="p-0"
      >
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800">
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขชุดตรวจ (Batch ID)"
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700">
              {[
                ["all", "ทั้งหมด"],
                ["pass", "PASS"],
                ["fail", "FAIL"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cx(
                    "h-9 rounded px-3 text-xs font-semibold transition-colors",
                    filter === key
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700">
              {[
                ["grid", LayoutGrid, "มุมมองการ์ด"],
                ["list", List, "มุมมองตาราง"],
              ].map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={() => setView(key)}
                  className={cx(
                    "flex h-9 w-9 items-center justify-center rounded transition-colors",
                    view === key
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4">
          {totalTests === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="ยังไม่มีบันทึกผลการตรวจ"
              description="เริ่มชุดตรวจใหม่โดยลงทะเบียนภาพต้นแบบ PCB"
              action={
                <Button icon={PlusCircle} onClick={() => navigate("/home-factory")}>
                  เริ่มชุดตรวจใหม่
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState icon={Search} title="ไม่พบรายการที่ตรงกับเงื่อนไข" />
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((result) => {
                const pass = result.status === "pass";
                return (
                  <article
                    key={result.pcb_id}
                    className="flex flex-col rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                      <span className="font-mono text-sm font-semibold">Batch #{result.pcb_id}</span>
                      <VerdictBadge verdict={pass ? "PASS" : "FAIL"} />
                    </div>
                    <div className="p-3">
                      <ImageFrame
                        src={b64(result?.originalPcb?.image_data)}
                        alt={`PCB Batch ${result.pcb_id}`}
                        className="aspect-[4/3]"
                        onClick={() => navigate(`/factoryWorkflow/${result.pcb_id}`)}
                      />
                      <dl className="mt-3 space-y-2 text-sm">
                        <div>
                          <div className="flex justify-between">
                            <dt className="text-slate-500 dark:text-slate-400">ความถูกต้องรวม</dt>
                            <dd className="font-mono font-bold">{accuracyText(result)}</dd>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className={cx("h-full rounded-full", pass ? "bg-emerald-500" : "bg-rose-500")}
                              style={{ width: `${Math.min(100, Math.max(0, result.sum_accuracy || 0))}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">จำนวนชิ้นงานที่ตรวจ</dt>
                          <dd className="font-mono font-semibold">{result?.result_ids?.length ?? 0}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="mt-auto border-t border-slate-200 p-3 dark:border-slate-800">
                      <RowActions result={result} />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">ภาพ</th>
                    <th className="px-4 py-2.5 font-semibold">Batch ID</th>
                    <th className="px-4 py-2.5 font-semibold">ผลตรวจ</th>
                    <th className="px-4 py-2.5 text-right font-semibold">ความถูกต้อง</th>
                    <th className="px-4 py-2.5 text-right font-semibold">ชิ้นงาน</th>
                    <th className="px-4 py-2.5 text-right font-semibold">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visible.map((result) => (
                    <tr key={result.pcb_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2">
                        <div className="h-12 w-16 overflow-hidden rounded border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
                          {result?.originalPcb?.image_data && (
                            <img
                              src={b64(result.originalPcb.image_data)}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono font-semibold">#{result.pcb_id}</td>
                      <td className="px-4 py-2">
                        <VerdictBadge verdict={result.status === "pass" ? "PASS" : "FAIL"} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{accuracyText(result)}</td>
                      <td className="px-4 py-2 text-right font-mono">{result?.result_ids?.length ?? 0}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end">
                          <RowActions result={result} compact />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      {totalTests > 0 && (
        <div className="mt-6 flex gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <p>
            <span className="font-semibold text-slate-900 dark:text-white">สรุปผลการวิเคราะห์: </span>
            ผ่านเกณฑ์ {passedTests} จาก {totalTests} ชุด (Pass rate {passRate.toFixed(0)}%) ความถูกต้องเฉลี่ย{" "}
            {avgAccuracy.toFixed(1)}%
            {failedTests > 0 &&
              ` — ชุด #${all.find((r) => r.status === "fail")?.pcb_id} ไม่ผ่านเกณฑ์ด้วยความถูกต้อง ${
                all.find((r) => r.status === "fail")?.sum_accuracy
              }%`}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={isDeleteOpen}
        title={itemToDelete?.itemName}
        message={itemToDelete?.confirmText}
        onConfirm={itemToDelete?.functions}
        onClose={() => setIsDeleteOpen(false)}
      />

      {selectedPcbForExport && (
        <ExportPdfModal
          isOpen={isExportModalOpen}
          onClose={() => {
            setIsExportModalOpen(false);
            setSelectedPcbForExport(null);
          }}
          pcbId={selectedPcbForExport}
        />
      )}
    </main>
  );
};

export default ResultPage;
