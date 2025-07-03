import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import "./HomePage.css";

export default function CamDetectPCB() {
  const location = useLocation();
  const { PCB } = location.state || {};
  const [cameraFeed, setCameraFeed] = useState(null);
  const [pcbImage, setPcbImage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [fps, setFps] = useState(0);
  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);
  const navigate = useNavigate();

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

      // Process PCB image
      if (pcbData && pcbData.length > 100) {
        // Check if not empty frame
        const pcbBlob = new Blob([pcbData], { type: "image/jpeg" });
        const pcbUrl = URL.createObjectURL(pcbBlob);
        setPcbImage((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return pcbUrl;
        });
      } else {
        setPcbImage(null);
      }

      frameCountRef.current++;
    }
  };

  const createWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("Connecting...");
    setIsConnected(false);
    imageQueueRef.current = [];

    const ws = new WebSocket(
      `ws://${window.location.hostname}:8000/ws/pcb-detection`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
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
    setIsConnected(false);
    setStatus("Disconnected");
    setFps(0);
    imageQueueRef.current = [];

    if (cameraFeed) {
      URL.revokeObjectURL(cameraFeed);
      setCameraFeed(null);
    }
    if (pcbImage) {
      URL.revokeObjectURL(pcbImage);
      setPcbImage(null);
    }
  };

  const captureDetection = async () => {
    if (!pcbImage) {
      alert("No PCB image available to capture!");
      return;
    }

    const blob = await fetch(pcbImage).then((res) => res.blob());

    const toBase64 = (blob) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

    const base64Image = await toBase64(blob);

    const newImage = {
      id: Math.random().toString(36).substring(2, 9),
      name: `cropped_${PCB}_${Date.now()}.jpg`,
      url: base64Image,
      file: null,
    };

    try {
      if (PCB === "OriginalImage") {
        sessionStorage.setItem("OriginalImage", JSON.stringify(newImage));
        navigate(`/PCBVerification`);
      } else if (PCB === "AnalysisImage") {
        sessionStorage.setItem("AnalysisImage", JSON.stringify(newImage));
        navigate(`/PCBVerification`);
      } else if (PCB === "OriginalImageFactory") {
        sessionStorage.setItem(
          "OriginalImageFactory",
          JSON.stringify(newImage)
        );
        const pcb_id = await createPcb(newImage);
        navigate(`/factoryWorkflow/${pcb_id}`);
      }
    } catch (err) {
      console.error("Error saving to sessionStorage:", err);
    }

    setStatus("PCB captured successfully!");
  };

  const startFpsCounter = () => {
    frameCountRef.current = 0;
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
    return () => {
      stopDetection();
    };
  }, []);

  const createPcb = async (originalImageFactory) => {
    if (!originalImageFactory) {
      alert("No PCB frame available to save.");
      return;
    }

    try {
      const response = await fetch(originalImageFactory.url);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append("file", blob, originalImageFactory.name);

      const apiResponse = await fetch(
        `http://${window.location.hostname}:8000/factory/create_pcb`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await apiResponse.json();

      if (apiResponse.ok) {
        alert("Image saved successfully!");
      } else {
        alert(`Failed to save image: ${data.message}`);
      }

      return data.result.pcb_id;
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Failed to save image");
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full grid-bg"></div>
        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-purple-700/20 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-700/20 rounded-full filter blur-3xl"></div>
      </div>
      <div className="container mx-auto p-4 relative z-10">
        <h1 className="text-2xl font-bold mb-4">
          Detector {PCB || ""} PCB Live Detection{" "}
        </h1>

        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <button
            onClick={startDetection}
            disabled={isConnected}
            className={`bg-blue-700 text-white py-2 px-4 rounded-md ${
              isConnected
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-blue-600"
            }`}
          >
            เริ่มต้นการตรวจจับ
          </button>
          <button
            onClick={stopDetection}
            disabled={!isConnected}
            className={`bg-red-500 text-white py-2 px-4 rounded-md ${
              !isConnected
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-red-600"
            }`}
          >
            หยุดการตรวจจับ
          </button>
          <button
            onClick={captureDetection}
            disabled={!isConnected || !pcbImage}
            className={`bg-green-700 text-white py-2 px-4 rounded-md ${
              !isConnected || !pcbImage
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-green-600"
            }`}
          >
            ยืนยันการตรวจจับ (กดเมื่อระบบตรวจจับและแสดงได้อย่างชัดเจน)
          </button>

          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <span
              className={`font-medium ${
                status.includes("Detected")
                  ? "text-green-600"
                  : status.includes("Error")
                  ? "text-red-600"
                  : "text-blue-600"
              }`}
            >
              {status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">FPS:</span>
            <span className="font-medium text-purple-600">{fps}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Camera Feed with PCB Outline */}
          <div className="border border-gray-300 rounded-md p-2">
            <h2 className="text-lg font-semibold mb-2">Camera View</h2>
            {cameraFeed ? (
              <img
                src={cameraFeed}
                alt="Camera Feed with PCB Outline"
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            ) : (
              <div className="bg-gray-900 h-48 flex items-center justify-center">
                <p className="text-gray-500">
                  {isConnected
                    ? "Waiting for frames..."
                    : "Camera feed inactive"}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Green outline shows detected PCB
            </p>
          </div>

          {/* Cropped PCB Image */}
          <div className="border border-gray-300 rounded-md p-2">
            <h2 className="text-lg font-semibold mb-2">Cropped PCB</h2>
            {pcbImage ? (
              <img
                src={pcbImage}
                alt="Cropped PCB"
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            ) : (
              <div className="bg-gray-900 h-48 flex items-center justify-center">
                <p className="text-gray-500">
                  {isConnected ? "No PCB detected" : "PCB view inactive"}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Perspective-corrected PCB view
            </p>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>Running on Raspberry Pi 4 - WebSocket Stream</p>
          <p>Camera resolution: 640x480 @ ~10 FPS</p>
        </div>
      </div>
    </div>
  );
}
