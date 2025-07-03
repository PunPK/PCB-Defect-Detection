import { useState, useEffect } from "react";
import "./HomePage.css";
import { useLocation, useNavigate } from "react-router";

export default function FileDetectPCB() {
  const location = useLocation();
  const { PCB } = location.state || {};
  const [originalImage, setOriginalImage] = useState(null);
  const [originalImageFactory, setOriginalImageFactory] = useState(null);
  const [analysisImage, setAnalysisImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [croppedPCB, setCroppedPCB] = useState(null);
  const [status, setStatus] = useState("Waiting for image...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (PCB === "AnalysisImage") {
      const savedAnalysisImage = sessionStorage.getItem("PreAnalysisImage");
      const imgData = JSON.parse(savedAnalysisImage);
      setAnalysisImage(imgData);
      processImage(imgData.url);
    } else if (PCB === "OriginalImage") {
      const savedOriginalImage = sessionStorage.getItem("PreOriginalImage");
      if (savedOriginalImage) {
        const imgData = JSON.parse(savedOriginalImage);
        setOriginalImage(imgData);
        processImage(imgData.url);
      }
    } else if (PCB === "OriginalImageFactory") {
      const savedOriginalImageFactory = sessionStorage.getItem(
        "PreOriginalImageFactory"
      );
      if (savedOriginalImageFactory) {
        const imgData = JSON.parse(savedOriginalImageFactory);
        setOriginalImageFactory(imgData);
        processImage(imgData.url);
      }
    }
  }, []);

  const processImage = async (imageUrl) => {
    if (!imageUrl) return;

    setIsProcessing(true);
    setStatus("Processing image...");
    setError(null);

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append("file", blob, "original_image.jpg");

      const apiResponse = await fetch(
        "http://localhost:8000/api/pcb-detection/image",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!apiResponse.ok) {
        throw new Error(`Server error: ${apiResponse.status}`);
      }

      const result = await apiResponse.json();

      setProcessedImage(`data:image/jpeg;base64,${result.display_image}`);
      setCroppedPCB(
        result.pcb_image ? `data:image/jpeg;base64,${result.pcb_image}` : null
      );

      setStatus(result.detected ? "PCB detected!" : "No PCB detected");
    } catch (err) {
      setError(err.message);
      setStatus("Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const captureDetection = async () => {
    if (!croppedPCB) {
      alert("No PCB image available to capture!");
      return;
    }

    const newImage = {
      id: Math.random().toString(36).substring(2, 9),
      name: `cropped_${PCB}_${Date.now()}.jpg`,
      url: croppedPCB,
      file: null, // ถ้าไม่มีไฟล์ต้นฉบับ สามารถใส่ null หรือไม่ใส่ก็ได้
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
        const pcb_id = await createPcb();
        navigate(`/factoryWorkflow/${pcb_id}`);
      }
    } catch (err) {
      console.error("Error saving to sessionStorage:", err);
    }
  };

  const waiting = (seconds) =>
    new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  const createPcb = async () => {
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
          PCB Detection System : {PCB}
        </h1>

        <div className="mb-6">
          <div className="flex items-center gap-4">
            <span className="font-medium">Status:</span>
            <span
              className={`font-medium ${
                status.includes("detected")
                  ? "text-green-500"
                  : status.includes("failed")
                  ? "text-red-500"
                  : "text-blue-400"
              }`}
            >
              {status}
            </span>
            {isProcessing && (
              <span className="text-blue-400">Processing...</span>
            )}
          </div>

          {error && <div className="mt-2 text-red-400">Error: {error}</div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-300 rounded-md p-2">
            {PCB === "OriginalImage" && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Original Image</h2>
                {originalImage ? (
                  <img
                    src={originalImage.url}
                    alt="Original PCB"
                    className="w-full h-auto max-h-[70vh] object-contain"
                  />
                ) : (
                  <div className="bg-gray-900 h-48 flex items-center justify-center">
                    <p className="text-gray-500">
                      No Original Image found in session
                    </p>
                  </div>
                )}
              </div>
            )}

            {PCB === "AnalysisImage" && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Analysis Image</h2>
                {analysisImage ? (
                  <img
                    src={analysisImage.url}
                    alt="Aanalysis PCB"
                    className="w-full h-auto max-h-[70vh] object-contain"
                  />
                ) : (
                  <div className="bg-gray-900 h-48 flex items-center justify-center">
                    <p className="text-gray-500">
                      No Analysis Image found in session
                    </p>
                  </div>
                )}
              </div>
            )}

            {PCB === "OriginalImageFactory" && (
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  Original Factory Image
                </h2>
                {originalImageFactory ? (
                  <img
                    src={originalImageFactory.url}
                    alt="Original PCB"
                    className="w-full h-auto max-h-[70vh] object-contain"
                  />
                ) : (
                  <div className="bg-gray-900 h-48 flex items-center justify-center">
                    <p className="text-gray-500">
                      No Original Factory Image found in session
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border border-gray-300 rounded-md p-2">
            <h2 className="text-lg font-semibold mb-2">Processed View</h2>
            {processedImage ? (
              <img
                src={processedImage}
                alt="Processed PCB"
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            ) : (
              <div className="bg-gray-900 h-48 flex items-center justify-center">
                <p className="text-gray-500">
                  {originalImage ? "Processing..." : "No image to process"}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Green outline shows detected PCB
            </p>
          </div>

          <div className="border border-gray-300 rounded-md p-2">
            <h2 className="text-lg font-semibold mb-2">Cropped PCB</h2>
            {croppedPCB ? (
              <img
                src={croppedPCB}
                alt="Cropped PCB"
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            ) : (
              <div className="bg-gray-900 h-48 flex items-center justify-center">
                <p className="text-gray-500">
                  {originalImage
                    ? "No PCB detected or cropped"
                    : "PCB view inactive"}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Perspective-corrected PCB view
            </p>
          </div>
        </div>

        {originalImage && (
          <div className="mt-6 flex mb:gap-4 gap-1">
            <button
              className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700"
              onClick={() => {
                captureDetection();
              }}
              disabled={!processedImage || isProcessing}
            >
              Confirm Detection
            </button>
            <button
              className="bg-gray-600 text-white py-2 px-6 rounded-md hover:bg-gray-700"
              onClick={() => {
                sessionStorage.removeItem("OriginalImage");
                setOriginalImage(null);
                setProcessedImage(null);
                setCroppedPCB(null);
                setStatus("Waiting for image...");
                waiting(2);
                navigate("/");
              }}
            >
              Reset
            </button>
            <button
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700"
              onClick={() => processImage(originalImage.url)}
              disabled={isProcessing}
            >
              Reprocess Image
            </button>
          </div>
        )}

        {originalImageFactory && (
          <div className="mt-6 flex mb:gap-4 gap-1">
            <button
              className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700"
              onClick={() => {
                captureDetection();
              }}
              disabled={!processedImage || isProcessing}
            >
              Confirm Detection
            </button>
            <button
              className="bg-gray-600 text-white py-2 px-6 rounded-md hover:bg-gray-700"
              onClick={() => {
                sessionStorage.removeItem("OriginalImageFactory");
                setOriginalImageFactory(null);
                setProcessedImage(null);
                setCroppedPCB(null);
                setStatus("Waiting for image...");
                waiting(2);
                navigate("/home-factory");
              }}
            >
              Reset
            </button>
            <button
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700"
              onClick={() => processImage(originalImageFactory.url)}
              disabled={isProcessing}
            >
              Reprocess Image
            </button>
          </div>
        )}

        {analysisImage && (
          <div className="mt-6 flex mb:gap-4 gap-1">
            <button
              className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700"
              onClick={() => {
                captureDetection();
              }}
              disabled={!processedImage || isProcessing}
            >
              Confirm Detection
            </button>
            <button
              className="bg-gray-600 text-white py-2 px-6 rounded-md hover:bg-gray-700"
              onClick={() => {
                sessionStorage.removeItem("AnalysisImage");
                setAnalysisImage(null);
                setProcessedImage(null);
                setCroppedPCB(null);
                setStatus("Waiting for image...");
                waiting(2);
                navigate("/PCBVerification");
              }}
            >
              Reset
            </button>
            <button
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700"
              onClick={() => processImage(analysisImage.url)}
              disabled={isProcessing}
            >
              Reprocess Image
            </button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-400">
          <p>PCB Detection System - Using sessionStorage image</p>
        </div>
      </div>
    </div>
  );
}
