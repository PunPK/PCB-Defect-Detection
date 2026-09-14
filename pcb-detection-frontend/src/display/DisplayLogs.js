import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Filter,
  FileText,
  Clock,
} from "lucide-react";
import { useDisplay } from "./DisplayContext.js";

export default function DisplayLogs() {
  const { theme, activePcbId, passThreshold } = useDisplay();
  const isDark = theme === "dark";

  const [logs, setLogs] = useState([]);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'ok' | 'ng'
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      // First try fetching for current active PCB
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result_pcb_working/${activePcbId}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data?.result_List) {
          const formatted = data.result_List.map((item, idx) => {
            const isOk = (item.accuracy ?? 0) >= passThreshold;
            return {
              id: item.results_id || idx + 1,
              pcbId: activePcbId,
              name: item.name || `PCB #${item.results_id || idx + 1}`,
              status: isOk ? "OK" : "NG",
              accuracy:
                item.accuracy !== null && item.accuracy !== undefined
                  ? Number(item.accuracy).toFixed(1)
                  : "-",
              timestamp: item.imageList?.uploaded_at
                ? new Date(item.imageList.uploaded_at).toLocaleString("th-TH")
                : "-",
              description:
                item.description ||
                (isOk ? "ผ่านเกณฑ์คุณภาพ" : "พบข้อบกพร่องในชิ้นงาน"),
            };
          });
          setLogs(formatted.reverse());
        }
      }
    } catch (err) {
      console.error("Error fetching display logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activePcbId, passThreshold]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (filterMode === "ok") return log.status === "OK";
    if (filterMode === "ng") return log.status === "NG";
    return true;
  });

  const okCount = logs.filter((l) => l.status === "OK").length;
  const ngCount = logs.filter((l) => l.status === "NG").length;

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
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold">
              บันทึกข้อมูล (System Logs & Inspection History)
            </h2>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
              ประวัติและบันทึกการตรวจสอบคุณภาพชิ้นงานอัตโนมัติบนสายพาน
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
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

      {/* Main Table Card */}
      <div
        className={`rounded-xl border p-2 sm:p-2.5 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden ${
          isDark
            ? "bg-[#07111e]/95 border-cyan-500/30 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Table Header / Filters */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/40 mb-1.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>ประวัติทั้งหมด ({filteredLogs.length} รายการ)</span>
          </div>

          <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg border border-slate-700/40 text-[11px]">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterMode === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ทั้งหมด ({logs.length})
            </button>
            <button
              onClick={() => setFilterMode("ok")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterMode === "ok"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              OK ({okCount})
            </button>
            <button
              onClick={() => setFilterMode("ng")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterMode === "ng"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              NG ({ngCount})
            </button>
          </div>
        </div>

        {/* Logs List for Touchscreen */}
        <div className="flex-1 overflow-y-auto touch-scrollbar space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-mono">
              ยังไม่มีบันทึกข้อมูลการตรวจสอบ
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isDark
                    ? "bg-[#050c18] border-slate-800 hover:border-cyan-500/40"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Left: Status & Name */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border ${
                      log.status === "OK"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    }`}
                  >
                    {log.status}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{log.name}</span>
                      <span className="text-[10px] font-mono text-cyan-400">
                        #{log.id}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {log.description}
                    </div>
                  </div>
                </div>

                {/* Right: Accuracy & Timestamp */}
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs font-mono font-bold text-cyan-400">
                      {log.accuracy}%
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{log.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
