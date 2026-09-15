import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Archive,
  TrendingUp,
  Cpu,
  X,
  RefreshCw,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDisplay } from "./DisplayContext.js";

export default function DisplayPerformance() {
  const { theme, activePcbId, passThreshold } = useDisplay();
  const isDark = theme === "dark";

  const [resultData, setResultData] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'ok' | 'ng'
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!activePcbId) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result_pcb_working/${activePcbId}`
      );
      if (response.ok) {
        const data = await response.json();
        setResultData(data);
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activePcbId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Fetch single result detail
  const fetchSingleDetail = async (resultId) => {
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result/${resultId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedDetail(data);
      }
    } catch (err) {
      console.error("Error fetching detail:", err);
    }
  };

  const hasResults = Boolean(
    resultData?.result_List && resultData.result_List.length > 0
  );
  const totalCount = hasResults ? resultData.result_List.length : 0;
  const passedItems = hasResults
    ? resultData.result_List.filter(
        (item) => (item.accuracy ?? 0) >= passThreshold
      )
    : [];
  const failedItems = hasResults
    ? resultData.result_List.filter(
        (item) => (item.accuracy ?? 0) < passThreshold
      )
    : [];
  const okCount = passedItems.length;
  const ngCount = failedItems.length;
  const okPercent =
    totalCount > 0 ? ((okCount / totalCount) * 100).toFixed(1) : "0.0";
  const ngPercent =
    totalCount > 0 ? ((ngCount / totalCount) * 100).toFixed(1) : "0.0";
  const avgAccuracy =
    totalCount > 0
      ? (
          resultData.result_List.reduce(
            (sum, item) => sum + (item.accuracy || 0),
            0
          ) / totalCount
        ).toFixed(1)
      : "0.0";

  // Filtered List
  const items = hasResults ? [...resultData.result_List].reverse() : [];
  const filteredItems = items.filter((item) => {
    const isOk = (item.accuracy ?? 0) >= passThreshold;
    if (filterMode === "ok") return isOk;
    if (filterMode === "ng") return !isOk;
    return true;
  });

  return (
    <div className="h-full min-h-0 flex flex-col gap-1.5 p-1.5 sm:p-2 overflow-hidden">
      {/* Top Header Card */}
      <div
        className={`rounded-xl border p-2 shadow-sm flex items-center justify-between shrink-0 ${
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
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold">
              ประสิทธิภาพการตรวจจับ (Inspection Analytics)
            </h2>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
              วิเคราะห์ความแม่นยำ อัตราการผ่าน และประวัติผลการตรวจสอบ PCB #{activePcbId}
            </p>
          </div>
        </div>

        <button
          onClick={fetchResults}
          disabled={isLoading}
          className={`touch-btn px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all ${
            isDark
              ? "bg-[#0b1e38] border-cyan-500/40 text-cyan-300 hover:bg-[#122e54]"
              : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>รีเฟรช</span>
        </button>
      </div>

      {/* Overview Stat Cards (4 columns) */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        {/* Total Inspected */}
        <div
          className={`rounded-xl border p-1.5 sm:p-2 shadow-sm ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1 text-slate-400 text-[10px]">
            <Archive className="w-3 h-3 text-cyan-400" />
            <span>ชิ้นงานทั้งหมด</span>
          </div>
          <div className="mt-1 text-lg sm:text-xl font-black font-mono leading-none">{totalCount}</div>
          <div className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5">ชิ้นที่ตรวจแล้ว</div>
        </div>

        {/* Pass Count */}
        <div
          className={`rounded-xl border p-1.5 sm:p-2 shadow-sm ${
            isDark
              ? "bg-[#041a14]/90 border-emerald-500/40 text-white"
              : "bg-emerald-50 border-emerald-300 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            <span>ผ่าน (OK)</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between leading-none">
            <span className="text-lg sm:text-xl font-black font-mono text-emerald-500">
              {okCount}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-500">
              {okPercent}%
            </span>
          </div>
          <div className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5">
            เกณฑ์ &ge; {passThreshold}%
          </div>
        </div>

        {/* Fail Count */}
        <div
          className={`rounded-xl border p-1.5 sm:p-2 shadow-sm ${
            isDark
              ? "bg-[#1e070c]/90 border-rose-500/40 text-white"
              : "bg-rose-50 border-rose-300 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1 text-rose-500 text-[10px] font-semibold">
            <XCircle className="w-3 h-3" />
            <span>มีข้อบกพร่อง (NG)</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between leading-none">
            <span className="text-lg sm:text-xl font-black font-mono text-rose-500">
              {ngCount}
            </span>
            <span className="text-[10px] font-mono font-bold text-rose-500">
              {ngPercent}%
            </span>
          </div>
          <div className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5">
            เกณฑ์ &lt; {passThreshold}%
          </div>
        </div>

        {/* Average Accuracy */}
        <div
          className={`rounded-xl border p-1.5 sm:p-2 shadow-sm ${
            isDark
              ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1 text-slate-400 text-[10px]">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span>ความแม่นยำเฉลี่ย</span>
          </div>
          <div className="mt-1 text-lg sm:text-xl font-black font-mono text-cyan-400 leading-none">
            {avgAccuracy}%
          </div>
          <div className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5">
            ค่าเฉลี่ยทั้งหมด
          </div>
        </div>
      </div>

      {/* Filter and Results Grid */}
      <div
        className={`rounded-xl border p-2 sm:p-2.5 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden ${
          isDark
            ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Filter Controls */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/40 mb-1.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>รายการผลการตรวจ ({filteredItems.length})</span>
          </div>

          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg border text-[11px] ${
              isDark
                ? "bg-black/40 border-slate-700/60"
                : "bg-slate-100 border-slate-300"
            }`}
          >
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterMode === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ทั้งหมด ({totalCount})
            </button>
            <button
              onClick={() => setFilterMode("ok")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterMode === "ok"
                  ? isDark
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "bg-blue-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              OK ({okCount})
            </button>
            <button
              onClick={() => setFilterMode("ng")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterMode === "ng"
                  ? "bg-rose-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              NG ({ngCount})
            </button>
          </div>
        </div>

        {/* Inspected PCB Items Grid */}
        <div className="flex-1 overflow-y-auto touch-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-mono">
              ไม่พบรายการที่ตรงกับเงื่อนไข
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredItems.map((item, idx) => {
                const isOk = (item.accuracy ?? 0) >= passThreshold;
                return (
                  <div
                    key={item.results_id || idx}
                    onClick={() => fetchSingleDetail(item.results_id)}
                    className={`touch-btn p-2.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      isDark
                        ? "bg-[#050c18] hover:bg-[#0c1c34] border-slate-800"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="w-16 h-16 rounded-lg bg-black/80 flex items-center justify-center overflow-hidden shrink-0 border border-slate-700/60">
                      {item.imageList?.image_data ? (
                        <img
                          src={`data:image/jpeg;base64,${item.imageList.image_data}`}
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Cpu className="w-6 h-6 text-slate-600" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            isOk
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          }`}
                        >
                          {isOk ? "OK" : "NG"}
                        </span>
                        <span className="font-mono font-bold text-xs text-cyan-400">
                          {item.accuracy !== null && item.accuracy !== undefined
                            ? `${Number(item.accuracy).toFixed(1)}%`
                            : "-"}
                        </span>
                      </div>
                      <div className="text-xs font-semibold truncate mt-1">
                        {item.name || `PCB #${item.results_id || idx + 1}`}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {item.imageList?.uploaded_at
                          ? new Date(item.imageList.uploaded_at).toLocaleTimeString("th-TH")
                          : "-"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedDetail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-xl w-full rounded-2xl border p-5 shadow-2xl ${
                isDark
                  ? "bg-[#081220] border-cyan-500/40 text-white"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b mb-3 border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      (selectedDetail.result_List?.accuracy ?? 0) >= passThreshold
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    }`}
                  >
                    {(selectedDetail.result_List?.accuracy ?? 0) >= passThreshold
                      ? "OK"
                      : "NG"}
                  </span>
                  <h3 className="text-sm font-bold">
                    ผลการตรวจสอบ PCB #{selectedDetail.result_List?.results_id}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="w-7 h-7 rounded-full bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview Comparison */}
              <div className="space-y-3">
                <div className="bg-black/90 rounded-xl p-2 flex items-center justify-center max-h-[45vh] overflow-hidden">
                  {selectedDetail.result_List?.imageList?.image_data ? (
                    <img
                      src={`data:image/jpeg;base64,${selectedDetail.result_List.imageList.image_data}`}
                      alt="Inspected PCB"
                      className="max-h-[40vh] max-w-full object-contain rounded"
                    />
                  ) : (
                    <div className="text-slate-500 font-mono text-xs py-8">
                      ไม่มีภาพแสดงผล
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {selectedDetail.result_List?.description || "ตรวจสอบคุณภาพสำเร็จ"}
                  </span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">
                    {selectedDetail.result_List?.accuracy}%
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
