import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Hexagon,
  Brain,
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

  return (
    <>
      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 no-print">
        <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-500/10 overflow-hidden text-white">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Hexagon className="h-9 w-9 text-cyan-500" strokeWidth={1.5} />
                <Brain className="h-4 w-4 text-cyan-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Export to PDF: PCB Inspection Report
                </h2>
                <p className="text-xs text-gray-400">
                  ชุดต้นแบบ PCB #{pcbId} | เลือกเอกสารผลลัพธ์ที่ต้องการส่งออก
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tabs */}
              <div className="flex bg-gray-800/80 p-1 rounded-lg border border-gray-700 text-xs">
                <button
                  onClick={() => setActiveTab("select")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    activeTab === "select"
                      ? "bg-cyan-500 text-gray-950 shadow font-bold"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  เลือกรายการ ({totalSelected})
                </button>
                <button
                  onClick={handleGoToPreview}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    activeTab === "preview"
                      ? "bg-cyan-500 text-gray-950 shadow font-bold"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  ดูตัวอย่าง
                </button>
              </div>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoadingList ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
                <p className="text-gray-400 text-sm">กำลังโหลดรายการผลลัพธ์ของ PCB #{pcbId}...</p>
              </div>
            ) : activeTab === "select" ? (
              <div className="space-y-5">
                {/* Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-800/40 p-3.5 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-xs text-gray-300 transition-colors cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-xs text-gray-400 transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      ยกเลิกทั้งหมด
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Filter className="w-3 h-3" /> กรอง:
                    </span>
                    {["all", "pass", "fail"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFilterType(type)}
                        className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                          filterType === type
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {type === "all" ? "ทั้งหมด" : type === "pass" ? "Pass (≥80%)" : "Fail (<80%)"}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-gray-400">
                    เลือกแล้ว: <span className="font-bold text-cyan-400">{totalSelected}</span> /{" "}
                    {availableResults.length} รายการ
                  </div>
                </div>

                {/* Grid of Results */}
                {availableResults.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    ไม่พบผลลัพธ์การตรวจสอบในชุดต้นแบบนี้
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    ไม่พบรายการที่ตรงกับตัวกรอง
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredResults.map((result) => {
                      const isSelected = selectedIds.some((id) => Number(id) === Number(result.results_id));
                      const isPass = (result.accuracy || 0) >= 80;
                      const thumbData =
                        result?.imageList?.image_data || result?.imageList?.result_image?.image_data;

                      return (
                        <div
                          key={result.results_id}
                          onClick={(e) => handleToggleSelect(result.results_id, e)}
                          className={`group relative rounded-xl border p-3 cursor-pointer transition-all duration-200 select-none ${
                            isSelected
                              ? "bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500/40"
                              : "bg-gray-800/40 border-gray-700/60 hover:border-gray-600 opacity-60 hover:opacity-100"
                          }`}
                        >
                          {/* Checkbox Button */}
                          <div className="absolute top-2.5 right-2.5 z-10">
                            <div
                              className={`w-6 h-6 rounded flex items-center justify-center transition-colors shadow ${
                                isSelected
                                  ? "bg-cyan-500 text-gray-950"
                                  : "border border-gray-500 bg-gray-900/80 hover:border-cyan-400"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Thumbnail image */}
                          <div className="aspect-video bg-black/60 rounded-lg overflow-hidden flex items-center justify-center mb-2.5 border border-gray-800/80">
                            {thumbData ? (
                              <img
                                src={`data:image/jpeg;base64,${thumbData}`}
                                alt={`Result #${result.results_id}`}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="text-xs text-gray-600">ไม่มีรูปตัวอย่าง</div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between pr-8">
                              <span className="text-xs font-semibold text-gray-200">
                                Result #{result.results_id}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                  isPass
                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                                }`}
                              >
                                {result.accuracy}%
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">
                              {result.description || "PCB Inspection Analysis"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Tab 2: Document Preview */
              <div className="space-y-4">
                <div className="bg-gray-800/40 p-3 rounded-lg border border-gray-700/50 flex items-center justify-between text-xs text-gray-300">
                  <span>
                    ตัวอย่างเอกสาร A4 ({totalSelected} รายการ | ความถูกต้องเฉลี่ย:{" "}
                    <span className="text-cyan-400 font-bold">{avgAccuracy}%</span>)
                  </span>
                  <span className="text-gray-400">ขนาดหน้า A4 มาตรฐาน (พร้อมพิมพ์)</span>
                </div>

                <div className="max-h-[65vh] overflow-y-auto p-4 bg-gray-950/70 rounded-xl border border-gray-800">
                  <div className="pdf-preview-page p-6 sm:p-10 font-sans">
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
          <div className="p-4 border-t border-gray-800 flex items-center justify-between bg-gray-950/80">
            <div className="text-xs text-gray-400">
              {isPreparingData ? (
                <span className="flex items-center gap-2 text-cyan-400 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังเตรียมข้อมูลรูปภาพความละเอียดสูง ({loadProgress.current}/{loadProgress.total})...
                </span>
              ) : (
                <span>พร้อมส่งออกเอกสาร {totalSelected} รายการ</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={totalSelected === 0 || isPreparingData}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-gray-950 font-bold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isPreparingData ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                <span>พิมพ์ / บันทึกเป็น PDF</span>
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
