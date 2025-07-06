import React, { useState, useEffect, useRef } from "react";
import "./test.css";

const PCBCameraView = () => {
  const [originalFrame, setOriginalFrame] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [pcbFrame, setPcbFrame] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Not connected");
  const [savedImages, setSavedImages] = useState([]);
  const wsRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const pcbCanvasRef = useRef(null);

  // useEffect(() => {
  //   connectWebSocket();

  //   return () => {
  //     if (wsRef.current) {
  //       wsRef.current.close();
  //     }
  //   };
  // }, []);

  const connectWebSocket = () => {
    const ws = new WebSocket(
      `ws://${window.location.hostname}:8000/ws/factory-workflow`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setStatus("Connected to camera feed");
      // console.log("WebSocket Connected");
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        // We receive two frames - original and processed PCB
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            // Alternate between original and PCB frame
            if (!originalFrame) {
              setOriginalFrame(img);
              drawImageToCanvas(img, originalCanvasRef.current);
            } else if (!pcbFrame) {
              setPcbFrame(img);
              drawImageToCanvas(img, pcbCanvasRef.current);
            } else {
              // Subsequent frames alternate
              setOriginalFrame(img);
              drawImageToCanvas(img, originalCanvasRef.current);
              // The next message will be the PCB frame
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(event.data);
      }
    };

    ws.onerror = (error) => {
      // console.error("WebSocket Error:", error);
      setStatus("Connection error");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatus("Disconnected");
      // console.log("WebSocket Disconnected");
      // Attempt to reconnect after a delay
      setTimeout(connectWebSocket, 3000);
    };
  };

  const drawImageToCanvas = (img, canvas) => {
    if (canvas && img) {
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  };

  const saveCurrentImage = async () => {
    try {
      const response = await fetch(
        `http:/${window.location.hostname}:8000/factory/save_image`,
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
      const response = await fetch(`http://localhost:8000/factory/get_images`);
      const data = await response.json();
      console.log("Fetched saved images:", data);
      if (response.ok) {
        // console.log("Fetched saved images:", data);
        console.log(data.images);
        setSavedImages(data.images);
      }
    } catch (error) {
      console.error("Error fetching saved images:", error);
    }
  };

  const fetchOriginalImages = async (pcb_Id) => {
    try {
      const response = await fetch(
        `http://localhost:8000/factory/get_all_pcb_results`
      );
      const data = await response.json();
      console.log("Fetched saved images:", data);
      if (response.ok) {
        setOriginalImage(data);
      }
    } catch (error) {
      console.error("Error fetching saved images:", error);
    }
  };

  return (
    <div className="pcb-detection-app">
      <h1>PCB Detection System</h1>
      <div className="status">Status: {status}</div>
      {/* 
      <div className="camera-container">
        <div className="frame-view">
          <h2>Live Camera Feed</h2>
          <canvas ref={originalCanvasRef} className="camera-feed" />
        </div>

        <div className="frame-view">
          <h2>PCB Detection</h2>
          <canvas ref={pcbCanvasRef} className="camera-feed" />
          <button
            onClick={saveCurrentImage}
            disabled={!pcbFrame}
            className="save-button"
          >
            Save PCB Image
          </button>
        </div>
      </div> */}

      <div className="saved-images">
        <h2>Images</h2>
        <button onClick={() => fetchOriginalImages(1)}>
          {" "}
          #test Refresh fetchOriginal Image
        </button>
        {originalImage && (
          <div className="image-grid">
            <img
              src={`data:image/jpeg;base64,${originalImage.image_data}`}
              alt={originalImage.filename}
            />
            <div className="image-meta">
              <div>Type: {originalImage.filename}</div>
              <div>
                Date: {new Date(originalImage.uploaded_at).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* <div className="saved-images">
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
                <div>Type: {image.filename}</div>
                <div>Date: {new Date(image.uploaded_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );
};

export default PCBCameraView;
