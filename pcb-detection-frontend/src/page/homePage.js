import { useState, useEffect, useRef } from "react"
import { Upload, X, Hexagon, Cpu, Webcam, BadgeCheck } from "lucide-react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router";
import "./UiPage.css"
export default function HomePage() {
    const [originalImage, setOriginalImage] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    // const [showCamera, setShowCamera] = useState(false)
    // const videoRef = useRef(null)
    // const canvasRef = useRef(null)
    const fileInputRef = useRef(null)
    // const [stream, setStream] = useState(null)
    const [previewImage, setPreviewImage] = useState(null)
    const navigate = useNavigate();

    useEffect(() => {
        const savedImage = sessionStorage.getItem("OriginalImage")
        if (savedImage) {
            setOriginalImage(JSON.parse(savedImage))
        }
    }, [])

    useEffect(() => {
        if (originalImage) {
            sessionStorage.setItem("OriginalImage", JSON.stringify(originalImage))
        } else {
            sessionStorage.removeItem("OriginalImage")
        }
    }, [originalImage])

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
                    setOriginalImage(newImage)
                    setIsUploading(false)
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const removeImage = () => {
        if (originalImage && originalImage.url) {
            URL.revokeObjectURL(originalImage.url)
        }
        setOriginalImage(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const startCamera = async () => {
        try {
            // const mediaStream = await navigator.mediaDevices.getUserMedia({
            //     video: { facingMode: "environment" },
            // })

            navigate("/camDetectPCB")
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

    return (


        <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full grid-bg"></div>
                <div className="absolute top-1/4 -left-20 w-60 h-60 bg-purple-700/20 rounded-full filter blur-3xl"></div>
                <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-700/20 rounded-full filter blur-3xl"></div>
            </div>

            <div className="max-w-md mx-auto relative z-10">
                <header className="mb-10 text-center">
                    <div className="inline-flex items-center justify-center mb-4">
                        <div className="relative">
                            <Hexagon className="h-12 w-12 text-cyan-500 opacity-80" strokeWidth={1} />
                            <Cpu className="h-6 w-6 text-cyan-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text">
                        PCB Quality Control System
                    </h1>
                    <p className="text-gray-400">Intelligent Copper Line Verification for PCB Quality Control</p>
                </header>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="backdrop-blur-sm bg-gray-900/40 rounded-2xl p-6 border border-gray-800 shadow-[0_0_15px_rgba(0,200,255,0.15)]"
                >
                    {originalImage ? (
                        <div className="space-y-6">
                            <div className="mt-4">
                                <div className="flex flex-col items-center">
                                    <div
                                        className="relative group cursor-pointer"
                                        onClick={() => openPreview(originalImage)}
                                    >
                                        <img
                                            src={originalImage.url}
                                            alt={originalImage.name}
                                            className="h-40 w-full object-contain rounded-md border border-gray-200"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                            <span className="text-white opacity-0 group-hover:opacity-100">คลิกเพื่อดูรูปภาพเต็ม</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between w-full mt-2 bg-gray-50 p-2 rounded-md">
                                        <span className="text-sm text-gray-700 truncate flex-1">
                                            {originalImage.name || "Webcam Capture"}
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
                                    // onClick={() => }
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
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
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
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    type="button"
                                    className="relative w-full h-14 border border-gray-700 hover:border-cyan-500/70 hover:bg-gray-800/50 transition-all duration-300 group rounded-md overflow-hidden"
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
                                </button>
                            </motion.div>

                            <p className="text-red-400 font-bold flex items-center justify-center">อัปโหลดรูปภาพได้เพียง 1 รูปเท่านั้น</p>
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
        </div>

    )
}