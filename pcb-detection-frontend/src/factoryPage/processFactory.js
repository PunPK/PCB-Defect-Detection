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
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import "../page/uploadPage.css";

import { Button } from "../page/uploadPCBChecked.js";
export default function ProcessFactoryWorkflow() {
  const [originalImageFactory, setOriginalImageFactory] = useState(null);
  const [analysisImage, setAnalysisImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraFeed, setCameraFeed] = useState(null);
  const [pcbImage, setPcbImage] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [fileName, setFileName] = useState("");
  const [fps, setFps] = useState(0);
  // const [showCamera, setShowCamera] = useState(false)
  // const videoRef = useRef(null)
  // const canvasRef = useRef(null)
  const fileInputRef = useRef(null);
  // const [stream, setStream] = useState(null)
  const [previewImage, setPreviewImage] = useState(null);
  const navigate = useNavigate();

  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

  const [pcbFrame, setPcbFrame] = useState(null);
  // const [isConnected, setIsConnected] = useState(false);
  // const [status, setStatus] = useState("Not connected");
  const [savedImages, setSavedImages] = useState([]);

  const detectionResults = [
    {
      id: 1,
      name: "ผิดพลาดเล็กน้อย",
      accuracy: 85,
      type: "UD",
      imageUrl: originalImageFactory
        ? originalImageFactory.url
        : "https://example.com/pcb1.jpg",
      description: "Detailed description about this PCB defect...",
    },
    {
      id: 2,
      name: "ผิดพลากมาก",
      accuracy: 85,
      type: "UD",
      imageUrl: originalImageFactory
        ? originalImageFactory.url
        : "https://example.com/pcb1.jpg",
      description: "Detailed description about this PCB defect...",
    },
    {
      id: 3,
      name: "คนละแบบกันเลย",
      accuracy: 85,
      type: "UD",
      imageUrl: originalImageFactory
        ? originalImageFactory.url
        : "https://example.com/pcb1.jpg",
      description: "Detailed description about this PCB defect...",
    },
    {
      id: 4,
      name: "ผิดพลาดเล็กน้อย",
      accuracy: 80,
      type: "UD",
      imageUrl: originalImageFactory
        ? originalImageFactory.url
        : "https://example.com/pcb1.jpg",
      description: "Detailed description about this PCB defect...",
    },
    // Add more items as needed
  ];

  const [totalAccuracy, setTotalAccuracy] = useState(0);

  useEffect(() => {
    if (detectionResults.length === 0) {
      setTotalAccuracy(0);
      return;
    }

    let sum = 0;
    for (const result of detectionResults) {
      sum += result.accuracy;
    }

    const average = sum / detectionResults.length;
    setTotalAccuracy(average);
  }, [detectionResults]);

  const processImageQueue = () => {
    if (imageQueueRef.current.length >= 2) {
      const [cameraData, pcbData] = imageQueueRef.current.splice(0, 2);

      // Process camera feed
      const cameraBlob = new Blob([cameraData], { type: "image/jpeg" });
      const cameraUrl = URL.createObjectURL(cameraBlob);
      setCameraFeed((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return cameraUrl;
      });

      frameCountRef.current++;
    }
  };

  const createWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("Connecting...");
    setIsStreaming(false);
    imageQueueRef.current = [];

    const ws = new WebSocket(
      `ws://${window.location.hostname}:8000/ws/factory-workflow`
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

  const startDetection = async () => {
    createWebSocket();
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

  useEffect(() => {
    const savedImage = sessionStorage.getItem("OriginalImageFactory");
    if (savedImage) {
      setOriginalImageFactory(JSON.parse(savedImage));
    }
  }, []);

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

  const createPcb = async () => {
    if (!originalImageFactory) {
      alert("No PCB frame available to save.");
      return;
    }

    try {
      const response = await fetch(originalImageFactory.url);
      const blob = await response.blob();

      const formData = new FormData();
      // formData.append("file", blob, "factory_original_image.jpg");
      formData.append(
        "file",
        blob,
        originalImageFactory.name || "factory_original_image.jpg"
      );
      formData.append("pcb_id", 1);

      const apiResponse = await fetch(
        `http://${window.location.hostname}:8000/factory/create_pcb`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await apiResponse.json();
      console.log(data);

      if (apiResponse.ok) {
        alert("Image saved successfully!");
      } else {
        alert(`Failed to save image: ${data.message}`);
      }
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Failed to save image");
    }
  };

  const createPcssb = async () => {
    try {
      const response = await fetch(
        "http://your-raspberry-pi-ip:8000/save_image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_base64: pcbFrame?.src.split(",")[1] || "",
            detection_type: "pcb",
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        alert("Image saved successfully!");
        fetchSavedImages(); // Refresh the saved images list
      } else {
        alert(`Failed to save image: ${data.message}`);
      }
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Failed to save image");
    }
  };

  const fetchSavedImages = async () => {
    try {
      const response = await fetch(
        "http://your-raspberry-pi-ip:8000/get_images"
      );
      const data = await response.json();
      if (response.ok) {
        setSavedImages(data.images);
      }
    } catch (error) {
      console.error("Error fetching saved images:", error);
    }
  };

  // useEffect(() => {
  //     return () => {
  //         if (stream) {
  //             stream.getTracks().forEach((track) => track.stop())
  //         }
  //     }
  // }, [stream])

  const handleFileChange = (e) => {
    const fileList = e.target.files;
    if (fileList && fileList[0]) {
      const file = fileList[0];

      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file only");
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

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startCamera = async () => {
    try {
      // const mediaStream = await navigator.mediaDevices.getUserMedia({
      //     video: { facingMode: "environment" },
      // })

      navigate("/camDetectPCB", {
        state: { PCB: "OriginalImageFactory" },
      });
      // setShowCamera(true)
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const openPreview = (image) => {
    setPreviewImage(image);
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  const removeOriginalImage = () => {
    // console.log(originalPCB)
    if (originalImageFactory && originalImageFactory.url) {
      URL.revokeObjectURL(originalImageFactory.url);
      sessionStorage.removeItem("OriginalImage");
    }
    setOriginalImageFactory(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
                      src={originalImageFactory.url}
                      alt={originalImageFactory.name}
                      className="h-full max-h-60 w-full object-contain rounded-md border border-gray-200"
                    />
                    {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div> */}
                  </div>

                  <div className="flex items-center justify-between bg-gray-900 rounded-md px-3 py-2 mb-4 border border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-red"></div>
                      <span className="text-sm text-gray-300 truncate max-w-[160px]">
                        {originalImageFactory.name}
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
                      onClick={removeOriginalImage}
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
                  {/* 
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            /> */}

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

              {isUploading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 border-red-500 border-t-transparent animate-spin mb-3"></div>
                    <p className="text-red-400 text-sm font-mono">
                      UPLOADING...
                    </p>
                    <p className="text-gray-500 text-xs mt-1">{fileName}</p>
                  </div>
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
                onClick={() => {
                  const handler = isStreaming ? stopDetection : startDetection;
                  createPcb();
                  handler();
                }}
                // onClick={isStreaming ? stopDetection : startDetection}
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
                    {detectionResults.length}
                  </span>
                  <span className="text-gray-400 text-sm ml-2">ชิ้น</span>
                </h1>
              </div>

              <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4 text-center shadow-[0_0_10px_rgba(180,70,255,0.1)] hover:shadow-[0_0_15px_rgba(180,70,255,0.2)] transition-all duration-300 group">
                <div className="text-lg uppercase tracking-widest text-purple-400/80 mb-1">
                  เปอร์เซ็นของถูกต้องของการตรวจสอบโดยรวม
                </div>
                <div className="relative inline-block">
                  <h3 className="text-2xl font-bold text-gray-100">
                    {totalAccuracy}
                    <span className="text-lg text-purple-400">%</span>
                  </h3>
                </div>
                <div className="mt-3 h-1.5 bg-gradient-to-r from-purple-500/10 to-purple-500/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-600"
                    style={{ width: `${totalAccuracy}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {detectionResults.map((result, index) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 group"
                >
                  <div className="relative mb-3">
                    <div className="absolute -top-6 -left-6 z-10 bg-cyan-500 text-gray-900 text-xl font-bold rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                      {index + 1}
                    </div>
                    <div
                      className="relative group cursor-pointer mb-3"
                      onClick={() => openPreview(result)}
                    >
                      <div className="aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                        <img
                          src={result.imageUrl}
                          alt={result.name}
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
                          onClick={() => navigate(`/details/${result.id}`)}
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

      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-900/30 px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-800/50">
          <Cpu className="h-3 w-3 text-cyan-600" />
          <span>Running on Raspberry Pi 4</span>
        </div>
      </div>
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
              src={previewImage.imageUrl}
              alt={previewImage.name}
              className="max-w-full max-h-[80vh] object-contain mx-auto"
            />
            <div className="mt-2 text-center text-white">
              {previewImage.name}
            </div>
          </div>
        </div>
      )}
      <div className="saved-images">
        <h2>Saved Images</h2>
        <button onClick={fetchSavedImages}>Refresh Saved Images</button>
        <div className="image-grid">
          {savedImages.map((image, index) => (
            <div key={index} className="saved-image-item">
              <img
                src={`data:image/jpeg;base64,${image.image_data}`}
                alt={`Saved PCB ${index}`}
              />
              <div className="image-meta">
                <div>Type: {image.detection_type}</div>
                <div>Date: {new Date(image.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
