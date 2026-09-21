import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Hexagon,
  FileText,
  ListChecks,
  ArrowDown,
  Eye,
  Loader2,
  CheckSquare,
  Square,
  Filter,
} from "lucide-react";
import "./exportPdf.css";

// Reusable Report Content used by both Preview and Print Portal
function PrintableReportContent({ items, pcbId, totalCount, avgAccuracy }) {
  return (
    <div>
      {/* Document Cover / Header */}
      <div className="border-b-2 border-gray-300 pb-6 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Hexagon className="h-10 w-10 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              This PCB is suspicious
            </h1>
            <p className="text-xs text-gray-500">
              Automated PCB Defect Detection & Quality Control Report
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-gray-600 space-y-0.5">
          <div>
            <span className="font-semibold">Inspection Batch:</span> #{pcbId}
          </div>
          <div>
            <span className="font-semibold">Total Selected:</span> {totalCount} Items
          </div>
          <div>
            <span className="font-semibold">Average Accuracy:</span> {avgAccuracy}%
          </div>
          <div>
            <span className="font-semibold">Export Date:</span>{" "}
            {new Date().toLocaleDateString("th-TH")}
          </div>
        </div>
      </div>

      {/* Render each selected result */}
      {items.map((item, index) => {
        const templateData = item?.imageList?.template_image?.image_data;
        const defectiveData = item?.imageList?.defective_image?.image_data;
        const alignedData = item?.imageList?.aligned_image?.image_data;
        const resultData =
          item?.imageList?.result_image?.image_data || item?.imageList?.image_data;

        return (
          <div
            key={item.results_id || index}
            className={`mb-12 ${index > 0 ? "print-page-break pt-6 border-t-2 border-dashed border-gray-300" : ""}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  Detail Result
                </span>
              </div>
              <span className="text-xs text-gray-400">
                รายการที่ {index + 1} จาก {totalCount}
              </span>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Result ที่ {item.results_id} ในการตรวจสอบครั้งที่ {item.pcb_result_id || pcbId}
            </h2>

            {/* Result Status Box */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg mb-3 print-avoid-break">
              <h3 className="text-base font-bold text-gray-800">
                <span className="text-blue-600">Result:</span> [
                <span className="text-cyan-700 font-bold">{item.accuracy}%</span>]{" "}
                <span className="text-gray-700">{item.description}</span>
              </h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-6">
              แบ่งไปด้วยหลายๆขั้นตอน ตั้งแต่การแปลงรูปภาพจากรูปแบบสีปกติให้กลายเป็นขาวดำ
              และทำให้รูปภาพอยู่ในพิกัดเดียวกัน และตรวจหาความแตกต่างระหว่าง PCB ทั้ง 2 แผ่น
              เพื่อใช้ในการตรวจสอบข้อผิดพลาดด้วยความแม่นยำสูง
            </p>

            {/* 1. Original PCB & 2. Analysis PCB side by side */}
            <div className="grid grid-cols-2 gap-4 mb-4 print-avoid-break">
              {/* Template */}
              <div className="border border-blue-300 rounded-lg overflow-hidden bg-gray-50 border-b-4 border-b-blue-600">
                <div className="p-2 text-center bg-gray-100 text-xs font-semibold text-gray-700">
                  รูปภาพต้นฉบับ PCB (สีเทา)
                </div>
                <div className="p-2 h-44 flex items-center justify-center bg-white">
                  {templateData ? (
                    <img
                      src={`data:image/jpeg;base64,${templateData}`}
                      alt="Template PCB"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-gray-400">กำลังเตรียมรูปภาพ...</div>
                  )}
                </div>
              </div>

              {/* Defective */}
              <div className="border border-red-300 rounded-lg overflow-hidden bg-gray-50 border-b-4 border-b-red-600">
                <div className="p-2 text-center bg-gray-100 text-xs font-semibold text-gray-700">
                  รูปภาพตรวจจับ PCB (สีเทา)
                </div>
                <div className="p-2 h-44 flex items-center justify-center bg-white">
                  {defectiveData ? (
                    <img
                      src={`data:image/jpeg;base64,${defectiveData}`}
                      alt="Defective PCB"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-gray-400">กำลังเตรียมรูปภาพ...</div>
                  )}
                </div>
              </div>
            </div>

            {/* Pipeline Steps 3, 4, 5, 6 */}
            <div className="space-y-4 max-w-md mx-auto">
              {/* 1. Extracted Copper Trace */}
              <div className="print-avoid-break">
                <div className="flex justify-center mb-1">
                  <ArrowDown className="w-5 h-5 text-gray-400" />
                </div>
                <div className="border border-cyan-300 rounded-lg overflow-hidden bg-gray-50 border-b-4 border-b-cyan-600">
                  <div className="p-2 text-center bg-gray-100 text-xs font-semibold text-gray-700">
                    ขั้นตอนที่ 1 : ขั้นตอนการดึงลายทองแดง (Copper Trace Extraction)
                  </div>
                  <div className="p-2 h-44 flex items-center justify-center bg-white">
                    {alignedData ? (
                      <img
                        src={`data:image/jpeg;base64,${alignedData}`}
                        alt="Extracted Copper Trace"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-gray-400">กำลังเตรียมรูปภาพ...</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Defect Analysis Result */}
              <div className="print-avoid-break">
                <div className="flex justify-center mb-1">
                  <ArrowDown className="w-5 h-5 text-gray-400" />
                </div>
                <div className="border border-rose-300 rounded-lg overflow-hidden bg-gray-50 border-b-4 border-b-rose-600">
                  <div className="p-2 text-center bg-gray-100 text-xs font-semibold text-gray-700">
                    ขั้นตอนที่ 2 : ผลลัพธ์การวิเคราะห์ลาย (Defect Analysis Result)
                  </div>
                  <div className="p-2 h-44 flex items-center justify-center bg-white">
                    {resultData ? (
                      <img
                        src={`data:image/jpeg;base64,${resultData}`}
                        alt="Defect Analysis Result"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-gray-400">กำลังเตรียมรูปภาพ...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExportPdfModal({
  isOpen,
  onClose,
  pcbId,
  initialResultsList = null,
  preSelectedResultIds = null,
}) {
  const [activeTab, setActiveTab] = useState("select"); // "select" | "preview"
  const [availableResults, setAvailableResults] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterType, setFilterType] = useState("all"); // "all" | "pass" | "fail"
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isPreparingData, setIsPreparingData] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });
  const [fullResultMap, setFullResultMap] = useState({});

  const initializedPcbRef = useRef(null);

  // Clean up print class on afterprint
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("is-printing-pdf");
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("is-printing-pdf");
    };
  }, []);

  // Fetch results list when opened if not passed
  const fetchResultsList = useCallback(async () => {
    if (!pcbId) return;
    setIsLoadingList(true);
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result_pcb_working/${pcbId}`
      );
      if (response.ok) {
        const data = await response.json();
        const list = data?.result_List || [];
        setAvailableResults(list);
      }
    } catch (err) {
      console.error("Failed to fetch results for PCB:", err);
    } finally {
      setIsLoadingList(false);
    }
  }, [pcbId]);

  useEffect(() => {
    if (!isOpen) {
      initializedPcbRef.current = null;
      return;
    }

    if (initialResultsList && initialResultsList.length > 0) {
      setAvailableResults(initialResultsList);
    } else {
      fetchResultsList();
    }
  }, [isOpen, initialResultsList, fetchResultsList]);

  // Initialize selected IDs ONCE when availableResults loads for this pcbId
  useEffect(() => {
    if (!isOpen) return;

    if (availableResults.length > 0 && initializedPcbRef.current !== pcbId) {
      if (preSelectedResultIds && preSelectedResultIds.length > 0) {
        setSelectedIds(preSelectedResultIds.map(Number));
      } else {
        setSelectedIds(availableResults.map((r) => Number(r.results_id)));
      }
      initializedPcbRef.current = pcbId;
    }
  }, [isOpen, pcbId, availableResults, preSelectedResultIds]);

  // Toggle selection for a single item
  const handleToggleSelect = (id, e) => {
    if (e) {
      e.stopPropagation();
    }
    const numId = Number(id);
    setSelectedIds((prev) => {
      const isSelected = prev.some((item) => Number(item) === numId);
      if (isSelected) {
        return prev.filter((item) => Number(item) !== numId);
      } else {
        return [...prev, numId];
      }
    });
  };

  // Filter results
  const filteredResults = availableResults.filter((item) => {
    if (filterType === "pass") return (item.accuracy || 0) >= 80;
    if (filterType === "fail") return (item.accuracy || 0) < 80;
    return true;
  });

  const handleSelectAll = () => {
    const visibleIds = filteredResults.map((r) => Number(r.results_id));
    setSelectedIds((prev) => Array.from(new Set([...prev.map(Number), ...visibleIds])));
  };

  const handleDeselectAll = () => {
    const visibleIds = new Set(filteredResults.map((r) => Number(r.results_id)));
    setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(Number(id))));
  };

  // Fetch full details (all 6 images) for selected items
  const fetchFullDetailsForSelected = async (targetIds) => {
    const idsToFetch = targetIds
      .map(Number)
      .filter((id) => !fullResultMap[id] || !fullResultMap[id]?.imageList?.template_image);

    if (idsToFetch.length === 0) return fullResultMap;

    setIsPreparingData(true);
    setLoadProgress({ current: 0, total: idsToFetch.length });

    const newMap = { ...fullResultMap };

    // Try batch endpoint
    try {
      const batchRes = await fetch(
        `http://${window.location.hostname}:8000/factory/get_results_detail_batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result_ids: idsToFetch }),
        }
      );

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        if (batchData.status === "success" && Array.isArray(batchData.results)) {
          batchData.results.forEach((item) => {
            if (item && item.results_id) {
              newMap[Number(item.results_id)] = item;
            }
          });
          setFullResultMap(newMap);
          setIsPreparingData(false);
          return newMap;
        }
      }
    } catch (e) {
      console.warn("Batch detail fetch failed, falling back to parallel fetch:", e);
    }

    // Fallback: fetch individually
    let loadedCount = 0;
    for (const id of idsToFetch) {
      try {
        const res = await fetch(
          `http://${window.location.hostname}:8000/factory/get_result/${id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.result_List) {
            newMap[Number(id)] = data.result_List;
          }
        }
      } catch (err) {
        console.error(`Error loading result #${id}:`, err);
      }
      loadedCount++;
      setLoadProgress({ current: loadedCount, total: idsToFetch.length });
    }

    setFullResultMap(newMap);
    setIsPreparingData(false);
    return newMap;
  };

  // Switch to Preview
  const handleGoToPreview = async () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกผลลัพธ์อย่างน้อย 1 รายการเพื่อดูตัวอย่าง");
      return;
    }
    await fetchFullDetailsForSelected(selectedIds);
    setActiveTab("preview");
  };

  // Print Action
  const handlePrint = async () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกผลลัพธ์อย่างน้อย 1 รายการเพื่อส่งออก");
      return;
    }

    await fetchFullDetailsForSelected(selectedIds);

    // Apply class to body for print stylesheet
    document.body.classList.add("is-printing-pdf");

    // Wait for React to mount images into the portal DOM
    setTimeout(() => {
      window.print();
      // Failsafe cleanup
      setTimeout(() => {
        document.body.classList.remove("is-printing-pdf");
      }, 3000);
    }, 400);
  };

  if (!isOpen) return null;

  const totalSelected = selectedIds.length;
  const selectedResultsData = selectedIds
    .map((id) => {
      const numId = Number(id);
      return (
        fullResultMap[numId] ||
        availableResults.find((r) => Number(r.results_id) === numId)
      );
    })
    .filter(Boolean);

  const avgAccuracy =
    selectedResultsData.length > 0
      ? (
          selectedResultsData.reduce((sum, r) => sum + (r.accuracy || 0), 0) /
          selectedResultsData.length
        ).toFixed(2)
      : "0.00";

  const tabCls = (active) =>
    `flex-1 sm:flex-none h-9 px-3 rounded font-semibold transition-colors flex items-center justify-center gap-1.5 ${
      active
        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    }`;

  return (
    <>
      {/* Modal Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-6 no-print"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex h-full w-full max-w-5xl flex-col overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold sm:text-lg">ส่งออกรายงานผลการตรวจ (PDF)</h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    ชุดตรวจสอบ Batch #{pcbId} · เลือกรายการที่ต้องการส่งออก
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="ปิด"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 sm:hidden dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Tabs */}
              <div className="flex w-full rounded-md bg-slate-200/70 p-1 text-xs sm:w-auto dark:bg-slate-800">
                <button onClick={() => setActiveTab("select")} className={tabCls(activeTab === "select")}>
                  <ListChecks className="h-3.5 w-3.5" />
                  เลือกรายการ ({totalSelected})
                </button>
                <button onClick={handleGoToPreview} className={tabCls(activeTab === "preview")}>
                  <Eye className="h-3.5 w-3.5" />
                  ดูตัวอย่าง
                </button>
              </div>

              <button
                onClick={onClose}
                aria-label="ปิด"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 sm:flex dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoadingList ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="mb-3 h-10 w-10 animate-spin text-brand-600 dark:text-brand-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  กำลังโหลดรายการผลลัพธ์ของ Batch #{pcbId}...
                </p>
              </div>
            ) : activeTab === "select" ? (
              <div className="space-y-4">
                {/* Controls Bar */}
                <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 md:flex-row md:items-center md:justify-between dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Square className="h-3.5 w-3.5" />
                      ยกเลิกทั้งหมด
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      เลือกแล้ว{" "}
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{totalSelected}</span> /{" "}
                      {availableResults.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-slate-400" />
                    <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700">
                      {["all", "pass", "fail"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFilterType(type)}
                          className={`h-8 rounded px-2.5 text-xs font-semibold transition-colors ${
                            filterType === type
                              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          {type === "all" ? "ทั้งหมด" : type === "pass" ? "Pass ≥80%" : "Fail <80%"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Grid of Results */}
                {availableResults.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    ไม่พบผลลัพธ์การตรวจสอบในชุดต้นแบบนี้
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">ไม่พบรายการที่ตรงกับตัวกรอง</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {filteredResults.map((result) => {
                      const isSelected = selectedIds.some((id) => Number(id) === Number(result.results_id));
                      const isPass = (result.accuracy || 0) >= 80;
                      const thumbData =
                        result?.imageList?.image_data || result?.imageList?.result_image?.image_data;

                      return (
                        <div
                          key={result.results_id}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && handleToggleSelect(result.results_id, e)}
                          onClick={(e) => handleToggleSelect(result.results_id, e)}
                          className={`relative cursor-pointer select-none rounded-md border p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                            isSelected
                              ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10"
                              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="absolute right-2 top-2 z-10">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                                isSelected
                                  ? "border-brand-600 bg-brand-600 text-white"
                                  : "border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900"
                              }`}
                            >
                              {isSelected && (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Thumbnail image */}
                          <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded bg-slate-100 dark:bg-slate-950">
                            {thumbData ? (
                              <img
                                src={`data:image/jpeg;base64,${thumbData}`}
                                alt={`Result #${result.results_id}`}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <div className="text-xs text-slate-400">ไม่มีรูปตัวอย่าง</div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-mono text-xs font-semibold">#{result.results_id}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ring-1 ring-inset ${
                                isPass
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                                  : "bg-rose-50 text-rose-700 ring-rose-600/30 dark:bg-rose-500/10 dark:text-rose-400"
                              }`}
                            >
                              {result.accuracy}%
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {result.description || "PCB Inspection Analysis"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Tab 2: Document Preview */
              <div className="space-y-3">
                <div className="flex flex-col gap-1 rounded-md border border-slate-200 p-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-300">
                  <span>
                    ตัวอย่างเอกสาร {totalSelected} รายการ · ความถูกต้องเฉลี่ย{" "}
                    <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{avgAccuracy}%</span>
                  </span>
                  <span className="text-slate-400">ขนาดหน้า A4 มาตรฐาน (พร้อมพิมพ์)</span>
                </div>

                <div className="max-h-[65vh] overflow-y-auto rounded-md border border-slate-200 bg-slate-200 p-2 sm:p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="pdf-preview-page p-4 font-sans sm:p-10">
                    <PrintableReportContent
                      items={selectedResultsData}
                      pcbId={pcbId}
                      totalCount={totalSelected}
                      avgAccuracy={avgAccuracy}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isPreparingData ? (
                <span className="flex items-center gap-2 font-medium text-brand-600 dark:text-brand-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังเตรียมรูปภาพความละเอียดสูง ({loadProgress.current}/{loadProgress.total})...
                </span>
              ) : (
                <span>พร้อมส่งออกเอกสาร {totalSelected} รายการ</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={totalSelected === 0 || isPreparingData}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPreparingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                <span>พิมพ์ / บันทึก PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Render Printable Document into document.body via Portal */}
      {createPortal(
        <div id="printable-pdf-document">
          <PrintableReportContent
            items={selectedResultsData}
            pcbId={pcbId}
            totalCount={totalSelected}
            avgAccuracy={avgAccuracy}
          />
        </div>,
        document.body
      )}
    </>
  );
}
