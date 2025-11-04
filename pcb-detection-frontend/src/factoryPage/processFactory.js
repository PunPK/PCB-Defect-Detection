import { useState, useEffect, useRef } from "react";
import {
  Upload,
  X,
  Hexagon,
  Cpu,
  BadgeCheck,
  Factory,
  CheckCircle,
  Layers,
  ArchiveX,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router";
import "../page/uploadPage.css";
import Delete from "../components/Delete.js";

import { Button } from "../page/uploadPCBChecked.js";
export default function ProcessFactoryWorkflow() {
  const [originalImageFactory, setOriginalImageFactory] = useState(null);
  const [cameraFeed, setCameraFeed] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [fps, setFps] = useState(0);
  const { pcb_id } = useParams();
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

  const [resultData, setResultData] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState([]);

  const handleRequestDelete = (
    itemName = "Item",
    confirmText = "Are you sure you want to delete this Item?",
    functions
  ) => {
    setItemToDelete({ itemName, confirmText, functions });
    setIsDeleteOpen(true);
  };

  sessionStorage.removeItem("PreOriginalImageFactory");

  const processImageQueue = () => {
    if (imageQueueRef.current.length >= 2) {
      const [cameraData, pcbData] = imageQueueRef.current.splice(0, 2);

      const cameraBlob = new Blob([cameraData], { type: "image/jpeg" });
      const cameraUrl = URL.createObjectURL(cameraBlob);
      setCameraFeed((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return cameraUrl;
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
      setStatus("Connected - Detecting PCB...");
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
          if (message.type === "new_result") {
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

  const stopDetection = () => {
    stopFpsCounter();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
    setStatus("Disconnected");
    setFps(0);
    imageQueueRef.current = [];

    if (cameraFeed) {
      URL.revokeObjectURL(cameraFeed);
      setCameraFeed(null);
    }
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
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_images/${pcb_Id}`
      );
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
    setIsProcessing(true);
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/get_result_pcb_working/${pcb_Id}`
      );
      const data = await response.json();
      if (response.ok) {
        setResultData(data);
      }
    } catch (error) {
      console.error("Error fetching saved images:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchOriginalImages(pcb_id);
    fetchResultData(pcb_id);
  }, [pcb_id]);
  const openPreview = (image) => {
    setPreviewImage(image);
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

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
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/delete_pcb/${pcb_Id}`,
        {
          method: "DELETE",
        }
      );
      console.log("Delete Pcb:");
    } catch (error) {
      console.error("Error fetching saved images:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteResult = async (result_Id) => {
    setIsProcessing(true);
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8000/factory/delete_result/${result_Id}`,
        {
          method: "DELETE",
        }
      );
      console.log("Delete result:");
      fetchResultData(pcb_id);
    } catch (error) {
      console.error("Error fetching saved images:", error);
    } finally {
      setIsProcessing(false);
    }
  };

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
        <div className="absolute top-0 left-0 w-full h-full grid-bg opacity-30"></div>
        <div className="absolute top-0 left-0 w-full h-full circuit-pattern"></div>
        <div className="absolute top-0 left-0 w-2/5 h-full bg-gradient-to-r from-red-900/40 via-pink-600/20 to-transparent"></div>
      </div>

      <div className="max-w-md mx-auto relative z-10 ">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              <Hexagon
                className="h-12 w-12 text-cyan-500 opacity-80"
                strokeWidth={1}
              />
              <Factory className="h-6 w-6 text-cyan-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text">
            Factory Workflow Simulation
          </h1>
          <p className="text-gray-400">
            {" "}
            Automated Conveyor Belt Simulation for Smart Factories in
            Intelligent Copper Line Verification for PCB Quality Control
          </p>
        </header>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-[30%] h-full ">
          <div className="backdrop-blur-sm bg-black/40 rounded-xl p-6 border border-red-500/30 glow-red tech-border h-full">
            <h2 className="text-xl font-bold mb-6 text-center relative">
              <span className="bg-gradient-to-r from-orange-400 to-red-500 text-transparent bg-clip-text">
                ORIGINAL PCB
              </span>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-0.5 w-16 bg-gradient-to-r from-orange-400 to-red-500"></div>
            </h2>

            <div className="bg-black rounded-lg p-4 min-h-[300px] flex flex-col items-center justify-center relative h-full">
              {originalImageFactory ? (
                <div className="w-full h-full flex flex-col">
                  <div className="relative mb-4 gradient-border-red rounded-lg overflow-hidden">
                    <img
                      src={`data:image/jpeg;base64,${originalImageFactory.image_data}`}
                      alt={originalImageFactory.filename}
                      className="h-full max-h-60 w-full object-contain rounded-md border border-gray-200"
                    />
                    {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div> */}
                  </div>

                  <div className="flex items-center justify-between bg-gray-900 rounded-md px-3 py-2 mb-4 border border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-red"></div>
                      <span className="text-sm text-gray-300 truncate max-w-[160px]">
                        {originalImageFactory.filename}
                      </span>
                    </div>
                    <button
                      onClick={removeOriginalImage}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-auto">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="flex items-center text-green-400 text-sm">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span>PCB LOADED</span>
                      </div>
                    </div>

                    <Button
                      variant="danger"
                      className="w-full text-sm"
                      onClick={() =>
                        handleRequestDelete(
                          "ORIGINAL PCB IMAGE",
                          "Are you sure you want to delete this ORIGINAL PCB IMAGE?",
                          () => removeOriginalImage()
                        )
                      }
                      icon={<ArchiveX className="h-4 w-4" />}
                    >
                      Delete PCB IMAGE
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover-scale"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-red-500/30 mb-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-red-500/10 rounded-full animate-pulse-red"></div>
                    <Layers className="h-8 w-8 text-red-400" />
                  </div>
                  <p className="text-gray-400 mb-4 text-center text-sm">
                    UPLOAD ORIGINAL PCB IMAGE
                  </p>

                  <Button
                    onClick={() => navigate("/home-factory")}
                    variant="danger"
                    className="text-sm"
                    icon={<Upload className="h-4 w-4" />}
                  >
                    UPLOAD IMAGE
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[70%] h-auto">
          <div className="backdrop-blur-sm bg-black/40 rounded-xl p-6 border border-cyan-500/30 glow-blue tech-border h-full">
            <h2 className="text-xl font-bold mb-6 text-center relative">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
                PCB Factory Workflow Detection
              </span>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-0.5 w-24 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
            </h2>
            <div className="flex flex-wrap gap-4 mb-4 items-center">
              <button
                // onClick={() => stopDetection()}
                // onClick={isStreaming ? stopDetection : startDetection(pcb_id)}
                onClick={
                  isStreaming ? stopDetection : () => startDetection(pcb_id)
                }
                className={`px-4 py-2 rounded-md font-medium ${
                  isStreaming
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isStreaming ? "Stop" : "Start"}
              </button>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <span
                    className={`font-medium ${
                      status.includes("Error")
                        ? "text-red-400"
                        : isStreaming
                        ? "text-green-400"
                        : "text-blue-400"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                {isStreaming && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">FPS:</span>
                    <span className="font-mono">{fps}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black rounded-lg overflow-hidden mb-4">
              {cameraFeed ? (
                <img
                  src={cameraFeed}
                  alt="Camera Feed with PCB Outline"
                  className="w-full h-auto max-h-[35vh] object-contain"
                />
              ) : (
                <div className="bg-gray-900 h-72 flex items-center justify-center">
                  <p className="text-gray-500">
                    {isStreaming
                      ? "Waiting for frames..."
                      : "Camera feed inactive"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {resultData?.result_List?.length >= 1 && (
        <div className="min-h-screen p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="backdrop-blur-sm bg-black/40 rounded-xl p-6 border border-cyan-500/30 border-gray-800 shadow-[0_0_15px_rgba(0,200,255,0.15)]"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center mb-10 px-4">
                <h2 className="text-xl font-bold mb-6 text-center relative">
                  <span className="bg-gradient-to-r from-pink-400 to-purple-500 text-transparent bg-clip-text">
                    Result of PCB Factory Workflow Detection
                  </span>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-0.5 w-32 bg-gradient-to-r from-pink-400 to-purple-500"></div>
                </h2>

                <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-4 h-full text-center  shadow-[0_0_10px_rgba(0,200,255,0.1)] hover:shadow-[0_0_15px_rgba(0,200,255,0.2)] transition-all duration-300 group">
                  <div className="text-lg uppercase tracking-widest text-cyan-400/80 mb-1">
                    จำนวนที่ตรวจสอบได้โดยรวม
                  </div>
                  <h1 className="text-4xl  font-bold text-gray-100">
                    <span className="text-cyan-400">
                      {resultData?.result_List?.length || 0}
                    </span>
                    <span className="text-gray-400 text-sm ml-2">ชิ้น</span>
                  </h1>
                </div>

                <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4 text-center shadow-[0_0_10px_rgba(180,70,255,0.1)] hover:shadow-[0_0_15px_rgba(180,70,255,0.2)] transition-all duration-300 group">
                  <div className="text-lg uppercase tracking-widest text-purple-400/80 mb-1">
                    เปอร์เซ็นของถูกต้องของการตรวจสอบ
                  </div>
                  <div className="relative inline-block">
                    <h3 className="text-2xl font-bold text-gray-100">
                      {(
                        resultData?.result_List?.reduce(
                          (sum, item) => sum + item.accuracy,
                          0
                        ) / resultData?.result_List?.length || 0
                      ).toFixed(2)}

                      <span className="text-lg text-purple-400">%</span>
                    </h3>
                  </div>
                  <div className="mt-3 h-1.5 bg-gradient-to-r from-purple-500/10 to-purple-500/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-purple-600"
                      style={{
                        width: `${
                          resultData?.result_List?.reduce(
                            (sum, item) => sum + item.accuracy,
                            0
                          ) / resultData?.result_List?.length || 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {resultData?.result_List.map((result, index) => (
                  <motion.div
                    key={result.results_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 group"
                  >
                    <div className="relative mb-3">
                      <div className="absolute -top-6 -left-6 z-10 bg-cyan-500 text-gray-900 text-xl font-bold rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                        {index + 1}
                      </div>
                      <button
                        className="absolute top-2 right-2 z-10 bg-red-700/90 hover:bg-red-800 focus:ring-4 focus:ring-red-500/50 text-white font-semibold px-3 py-1.5 rounded-md shadow-md flex items-center gap-1.5 text-sm transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          handleRequestDelete(
                            `Result of PCB ID: ${result.results_id} `,
                            `Are you sure you want to delete result of PCB ID: ${result.results_id}?`,
                            () => deleteResult(result.results_id)
                          );
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>ลบผลการทดสอบ</span>
                      </button>

                      <div
                        className="relative group cursor-pointer mb-3"
                        onClick={() => openPreview(result.imageList)}
                      >
                        <div className="aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                          <img
                            src={`data:image/jpeg;base64,${result.imageList.image_data}`}
                            alt={result.imageList.filename}
                            className="h-full w-full object-contain"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 text-sm">
                              คลิกเพื่อดูรูปภาพเต็ม
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 ">
                        <h3 className="font-medium text-gray-300">
                          {result.name}
                        </h3>
                        <div className="flex justify-between items-center">
                          <span className="text-cyan-400 font-semibold">
                            ความถูกต้อง : {result.accuracy} %
                          </span>
                          {/* <button
                        onClick={() => navigate(`/details/${result.id}`)}
                        className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
                      >
                        คลิกเพื่อดูรายละเอียด
                      </button> */}
                          <button
                            onClick={() =>
                              navigate(`/details/${result.results_id}`)
                            }
                            type="button"
                            className="relative  max-w-md h-14 border border-gray-700 hover:border-cyan-500/70 hover:bg-gray-800/50 transition-all duration-300 group rounded-md overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 transition-all duration-700" />
                            <div className="relative z-10 flex items-center justify-center h-full px-4 text-center">
                              <BadgeCheck className="h-5 w-5 mr-3 text-cyan-500 group-hover:text-cyan-400" />
                              <span className="text-sm text-gray-300 group-hover:text-cyan-300 transition-colors">
                                คลิกเพื่อดูรายละเอียด
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="text-center mt-10">
        <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-900/30 px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-800/50">
          <Cpu className="h-3 w-3 text-cyan-600" />
          <span>Running on Raspberry Pi 4</span>
        </div>
      </div>
      <Delete
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={
          itemToDelete?.functions || (() => console.log("No function to call"))
        }
        itemName={itemToDelete?.itemName || "Error"}
        confirmText={itemToDelete?.confirmText || "Error"}
      />

      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
              onClick={closePreview}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={`data:image/jpeg;base64,${previewImage.image_data}`}
              alt={previewImage.filename}
              className="w-full max-h-[70vh] object-contain mx-auto"
            />
            <div className="mt-2 text-center text-white">
              {previewImage.filename}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
