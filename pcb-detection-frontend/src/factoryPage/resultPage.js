import {
  CheckCircle,
  XCircle,
  BarChart2,
  Hexagon,
  DatabaseZap,
  Trash2,
  ArchiveRestore,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const ResultPage = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    handleGetResults();
  }, []);

  const handleGetResults = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_all_pcb_results`
      );
      const data = await response.json();

      if (response.ok) {
        const processedResults = data.results.map((result) => {
          const status = result.sum_accuracy > 50 ? "pass" : "fail";
          return { ...result, status };
        });
        setResults(processedResults);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error fetching saved images:", error);
    }
  };

  const removeOriginalImage = (pcb_Id) => {
    if (pcb_Id) {
      sessionStorage.removeItem("OriginalImageFactory");
      deletePcb(pcb_Id);
    }
    // if (fileInputRef.current) {
    //   fileInputRef.current.value = "";
    // }
  };

  const deletePcb = async (pcb_Id) => {
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/delete_pcb/${pcb_Id}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();
      console.log("Delete Pcb:");
      handleGetResults();
    } catch (error) {
      console.error("Error fetching saved images:", error);
    }
  };

  const totalTests = results?.length;
  const passedTests = results?.filter((r) => r.status === "pass").length || 0;
  const avgAccuracy =
    results?.reduce((sum, r) => sum + r.sum_accuracy, 0) / totalTests;

  if (isProcessing) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#050816]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full grid-bg"></div>
        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-purple-700/20 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-700/20 rounded-full filter blur-3xl"></div>
      </div>
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="max-w-md mx-auto relative z-10 ">
          <header className="mb-10 text-center">
            <div className="inline-flex items-center justify-center mb-4">
              <div className="relative">
                <Hexagon
                  className="h-12 w-12 text-cyan-500 opacity-80"
                  strokeWidth={1}
                />
                <DatabaseZap className="h-6 w-6 text-cyan-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text">
              Record of Results
            </h1>
            <p className="text-gray-400">
              {" "}
              Automated Conveyor Belt Simulation for Smart Factories in
              Intelligent Copper Line Verification for PCB Quality Control
            </p>
          </header>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center">
              <BarChart2 className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-gray-400">Total Tests</h3>
            </div>
            <p className="text-2xl font-bold mt-2">{totalTests}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
              <h3 className="text-gray-400">Passed</h3>
            </div>
            <p className="text-2xl font-bold text-green-400 mt-2">
              {passedTests}
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-400 mr-2" />
              <h3 className="text-gray-400">Failed</h3>
            </div>
            <p className="text-2xl font-bold text-red-400 mt-2">
              {totalTests - passedTests}
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-cyan-400 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="text-gray-400">Avg. Accuracy</h3>
            </div>
            <p className="text-2xl font-bold text-cyan-400 mt-2">
              {avgAccuracy.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results?.map((result) => (
            <div
              key={result.pcb_id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-cyan-400 transition-colors"
            >
              <div className="bg-gray-900 h-64 flex items-center justify-center p-4 border-b border-gray-700">
                <img
                  src={`data:image/jpeg;base64,${result?.originalPcb?.image_data}`}
                  alt={`PCB Test ${result.pcb_id}`}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium text-gray-100">
                    Inspection No. {result.pcb_id}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${result.status === "pass"
                      ? "bg-green-900/50 text-green-400 border border-green-800"
                      : "bg-red-900/50 text-red-400 border border-red-800"
                      }`}
                  >
                    {result.status === "pass" ? "PASS" : "FAIL"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Accuracy:</span>
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${result.status === "pass"
                            ? "bg-green-500"
                            : "bg-red-500"
                            }`}
                          style={{ width: `${result.accuracy}%` }}
                        ></div>
                      </div>
                      <span
                        className={`font-mono ${result.status === "pass"
                          ? "text-green-400"
                          : "text-red-400"
                          }`}
                      >
                        {result?.sum_accuracy || "NULL"}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      Count of Results:
                    </span>
                    <span className="font-medium text-gray-300">
                      {result?.result_ids?.length || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 justify-center">
                  <div className="flex justify-center">
                    <button
                      onClick={() =>
                        navigate(`/factoryWorkflow/${result.pcb_id}`)
                      }
                      type="button"
                      className="relative  max-w-md w-full h-14 border border-gray-700 hover:border-green-500/70 hover:bg-gray-800/50 transition-all duration-300 group rounded-md overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 to-purple-500/0 group-hover:from-green-500/5 group-hover:to-purple-500/5 transition-all duration-700" />
                      <div className="relative z-10 flex items-center justify-center h-full px-4 text-center">
                        <ArchiveRestore className="h-9 w-9 mr-3 text-green-500 group-hover:text-green-400" />
                        <span className="text-sm text-gray-300 group-hover:text-green-300 transition-colors">
                          เพิ่ม/แก้ไข ข้อมูล
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        removeOriginalImage(result.pcb_id);
                      }}
                      type="button"
                      className="relative  max-w-md w-full h-14 border border-gray-700 hover:border-red-500/70 hover:bg-gray-800/50 transition-all duration-300 group rounded-md overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-purple-500/0 group-hover:from-red-500/5 group-hover:to-purple-500/5 transition-all duration-700" />
                      <div className="relative z-10 flex items-center justify-center h-full px-4 text-center">
                        <Trash2 className="h-9 w-9 mr-3 text-red-500 group-hover:text-red-400" />
                        <span className="text-sm text-gray-300 group-hover:text-red-300 transition-colors">
                          ลบข้อมูลผลการทดสอบ{" "}
                          <span className="text-red-500">
                            ครั้งที่ {result.pcb_id}
                          </span>
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  {result.status === "pass" ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-gray-800 p-5 rounded-lg border border-gray-700">
          <h2 className="text-lg font-medium text-gray-100 mb-3 flex items-center">
            <svg
              className="h-5 w-5 text-cyan-400 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Analysis Summary
          </h2>
          <p className="text-gray-400">
            The PCB quality control test results show {passedTests} out of{" "}
            {totalTests} tests passed (
            {((passedTests / totalTests) * 100).toFixed(0)}% pass rate) with an
            average accuracy of {avgAccuracy.toFixed(1)}%.
            {passedTests < totalTests &&
              ` Inspection No. ${results.find((r) => r.status === "fail")?.pcb_id
              } failed with ${results.find((r) => r.status === "fail")?.sum_accuracy
              }% accuracy.`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
