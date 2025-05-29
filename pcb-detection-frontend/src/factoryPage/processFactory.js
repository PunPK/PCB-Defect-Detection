import { useState, useEffect, useRef } from "react"
import { Upload, X, Hexagon, Cpu, Webcam, BadgeCheck, Factory, Edit2, Download, CheckCircle, AlertCircle, Layers, ChevronRight, ArchiveX, Check } from "lucide-react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router";
import "../page/uploadPage.css"

import { Button } from "../page/uploadPCBChecked.js";
export default function ProcessFactoryWorkflow() {
    const [originalImageFactory, setOriginalImageFactory] = useState(null)
    const [analysisImage, setAnalysisImage] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [cameraFeed, setCameraFeed] = useState(null);
    const [pcbImage, setPcbImage] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [status, setStatus] = useState("Disconnected");
    const [fileName, setFileName] = useState("")
    const [fps, setFps] = useState(0);
    // const [showCamera, setShowCamera] = useState(false)
    // const videoRef = useRef(null)
    // const canvasRef = useRef(null)
    const fileInputRef = useRef(null)
    // const [stream, setStream] = useState(null)
    const [previewImage, setPreviewImage] = useState(null)
    const navigate = useNavigate();

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
        const savedImage = sessionStorage.getItem("OriginalImageFactory")
        if (savedImage) {
            setOriginalImageFactory(JSON.parse(savedImage))
        }
    }, [])

    useEffect(() => {
        if (originalImageFactory) {
            sessionStorage.setItem("PreOriginalImageFactory", JSON.stringify(originalImageFactory))
        } else {
            sessionStorage.removeItem("PreOriginalImageFactory")
        }
    }, [originalImageFactory])

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
            const file = fileList[0]

            if (!file.type.startsWith("image/")) {
                alert("Please upload an image file only")
                return
            }

            setIsUploading(true)

            const reader = new FileReader()
            reader.onload = (event) => {
                if (event.target?.result) {
                    const newImage = {
                        id: Math.random().toString(36).substring(2, 9),
                        name: file.name,
                        url: event.target.result,
                        file
                    }
                    setOriginalImageFactory(newImage)
                    setIsUploading(false)
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const removeImage = () => {
        if (originalImageFactory && originalImageFactory.url) {
            URL.revokeObjectURL(originalImageFactory.url)
        }
        setOriginalImageFactory(null)

        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const startCamera = async () => {
        try {
            // const mediaStream = await navigator.mediaDevices.getUserMedia({
            //     video: { facingMode: "environment" },
            // })

            navigate("/camDetectPCB", {
                state: { PCB: "OriginalImageFactory" },
            })
            // setShowCamera(true)
        } catch (err) {
            console.error("Error accessing camera:", err)
            alert("Could not access camera. Please check permissions.")
        }
    }

    const openPreview = (image) => {
        setPreviewImage(image)
    }

    const closePreview = () => {
        setPreviewImage(null)
    }

    const removeOriginalImage = () => {
        // console.log(originalPCB)
        if (originalImageFactory && originalImageFactory.url) {
            URL.revokeObjectURL(originalImageFactory.url)
            sessionStorage.removeItem("OriginalImage")
        }
        setOriginalImageFactory(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
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
                            <Hexagon className="h-12 w-12 text-cyan-500 opacity-80" strokeWidth={1} />
                            <Factory className="h-6 w-6 text-cyan-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text">
                        Factory Workflow Simulation
                    </h1>
                    <p className="text-gray-400">  Automated Conveyor Belt Simulation for Smart Factories in Intelligent Copper Line Verification for PCB Quality Control</p>
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
                                            <span className="text-sm text-gray-300 truncate max-w-[160px]">{originalImageFactory.name}</span>
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
                                    <p className="text-gray-400 mb-4 text-center text-sm">UPLOAD ORIGINAL PCB IMAGE</p>
                                    {/* 
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            /> */}

                                    <Button onClick={() => navigate("/")} variant="danger" className="text-sm" icon={<Upload className="h-4 w-4" />}>
                                        UPLOAD IMAGE
                                    </Button>
                                </div>
                            )}

                            {isUploading && (
                                <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full border-2 border-red-500 border-t-transparent animate-spin mb-3"></div>
                                        <p className="text-red-400 text-sm font-mono">UPLOADING...</p>
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
                                onClick={isStreaming ? stopDetection : startDetection}
                                className={`px-4 py-2 rounded-md font-medium ${isStreaming
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
                                        className={`font-medium ${status.includes("Error")
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

                    </div>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="backdrop-blur-sm bg-gray-900/40 rounded-2xl mt-7 p-6 border border-gray-800 shadow-[0_0_15px_rgba(0,200,255,0.15)]"
            >
                {originalImageFactory ? (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold mb-6 text-center relative">
                            <span className="bg-gradient-to-r from-pink-400 to-purple-500 text-transparent bg-clip-text">
                                Result of PCB Factory Workflow Detection
                            </span>
                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-0.5 w-32 bg-gradient-to-r from-pink-400 to-purple-500"></div>
                        </h2>
                        <div className="mt-4">
                            <div className="flex flex-col items-center">
                                <div
                                    className="relative group cursor-pointer"
                                    onClick={() => openPreview(originalImageFactory)}
                                >
                                    <img
                                        src={originalImageFactory.url}
                                        alt={originalImageFactory.name}
                                        className="h-40 w-full object-contain rounded-md border border-gray-200"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                        <span className="text-white opacity-0 group-hover:opacity-100">คลิกเพื่อดูรูปภาพเต็ม</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between w-full mt-2 bg-gray-50 p-2 rounded-md">
                                    <span className="text-sm text-gray-700 truncate flex-1">
                                        {originalImageFactory.name || "Webcam Capture"}
                                    </span>
                                    <button
                                        onClick={removeImage}
                                    // className="text-red-500 hover:text-red-700 ml-2"
                                    >

                                        {/* <X className="h-5 w-5 text-red-500 group-hover:text-red-700" /> */}
                                        <span className="text-sm text-red-700 group-hover:text-red-300 transition-colors">
                                            Remove
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    navigate("/fileDetectPCB", {
                                        state: { PCB: "OriginalImageFactory" },
                                    })
                                }}
                                type="button"
                                className="relative w-full h-14 mt-3 border border-gray-700 hover:border-cyan-500/70 hover:bg-gray-800/50 transition-all duration-300 group rounded-md overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 transition-all duration-700" />
                                <div className="relative z-10 flex items-center justify-center h-full px-4 text-center">
                                    <BadgeCheck className="h-5 w-5 mr-3 text-cyan-500 group-hover:text-cyan-400" />
                                    <span className="text-sm text-gray-300 group-hover:text-cyan-300 transition-colors">
                                        ดำเนินการตรวจจับ
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            className="group border-2 border-dashed border-gray-700 hover:border-cyan-500/70 rounded-xl p-8 text-center hover:bg-gray-800/30 transition-all cursor-pointer relative overflow-hidden"
                            onClick={() => startCamera()}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:to-purple-500/10 transition-all duration-700"></div>

                            <div className="flex flex-col items-center justify-center gap-4 relative z-10">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(0,200,255,0.3)] transition-all duration-500 border border-gray-700 group-hover:border-cyan-500/50">
                                    <Webcam className="h-8 w-8 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-medium mb-2 text-white group-hover:text-cyan-300 transition-colors">
                                        ระบบตรวจจับต้นแบบของแผ่น PCB
                                    </h3>
                                    <p className="text-gray-400 mb-5 group-hover:text-gray-300 transition-colors">
                                        คลิกเพื่อเปิดกล้อง
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        <div className="text-center relative">
                            <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
                            <span className="relative bg-[#050816] px-4 text-gray-400">หรือ</span>
                        </div>

                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                            <div
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const files = e.dataTransfer.files;
                                    if (files.length) {
                                        handleFileChange({ target: { files } });
                                    }
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className="relative w-full h-14 border border-gray-700 hover:border-cyan-500/70 hover:bg-gray-800/50 transition-all duration-300 group rounded-md overflow-hidden cursor-pointer"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 transition-all duration-700" />
                                <div className="relative z-10 flex items-center justify-center h-full px-4 text-center">
                                    <Upload className="h-5 w-5 mr-3 text-cyan-500 group-hover:text-cyan-400" />
                                    <span className="text-sm text-gray-300 group-hover:text-cyan-300 transition-colors">
                                        อัปโหลด/วาง รูปภาพต้นแบบของแผ่น PCB
                                    </span>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </motion.div>
                        <p className="text-gray-700 font-bold flex items-center justify-center text-center">
                            กรุณาวางแผ่น PCB บนพื้นที่สีขาวเท่านั้น<br />
                            รองรับไฟล์ JPG, PNG
                        </p>

                    </div>
                )}

                {isUploading && (
                    <div className="mt-6 flex justify-center">
                        <div className="flex items-center gap-3 bg-cyan-900/20 px-4 py-2 rounded-full border border-cyan-800/30">
                            <div className="w-4 h-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
                            <p className="text-cyan-400 text-sm">กำลังอัปโหลด...</p>
                        </div>
                    </div>
                )}
            </motion.div>

            <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-900/30 px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-800/50">
                    <Cpu className="h-3 w-3 text-cyan-600" />
                    <span>Running on Raspberry Pi 4</span>
                </div>
            </div>
            {previewImage && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={closePreview}>
                    <div className="relative max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button
                            className="absolute -top-10 right-0 text-white hover:text-gray-300"
                            onClick={closePreview}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={previewImage.url}
                            alt={previewImage.name}
                            className="max-w-full max-h-[80vh] object-contain mx-auto"
                        />
                        <div className="mt-2 text-center text-white">
                            {previewImage.name}
                        </div>
                    </div>
                </div>
            )}
        </div>


    )
}