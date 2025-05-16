import { useState, useEffect, useRef } from "react";
import "./HomePage.css";

export default function TestCam() {
  const [cameraFeed, setCameraFeed] = useState(null);
  const [pcbImage, setPcbImage] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [fps, setFps] = useState(0);
  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const timerRef = useRef(null);
  const imageQueueRef = useRef([]);

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
      `ws://${window.location.hostname}:8000/ws/pcb-detection`
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
    return () => {
      stopDetection();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full grid-bg"></div>
        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-purple-700/20 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-700/20 rounded-full filter blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto  relative z-10">
        <h1 className="text-2xl font-bold mb-4">Camera Test</h1>

        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <button
            onClick={isStreaming ? stopDetection : startDetection}
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
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          ) : (
            <div className="bg-gray-900 h-72 flex items-center justify-center">
              <p className="text-gray-500">
                {isStreaming ? "Waiting for frames..." : "Camera feed inactive"}
              </p>
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Instructions</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li>Click "Start" to begin camera streaming</li>
            <li>The video will be sent to the server via WebSocket</li>
            <li>FPS counter shows frames sent per second</li>
            <li>Click "Stop" to end the streaming</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
