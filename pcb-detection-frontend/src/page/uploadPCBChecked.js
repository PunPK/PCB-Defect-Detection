import { useState, useEffect, useRef } from "react"
import { Upload, Edit2, Download, CheckCircle, AlertCircle, Cpu, Layers, X, ChevronRight, Hexagon, ArchiveX, Webcam, BadgeCheck, Check } from "lucide-react"
import { useNavigate } from "react-router"
import { motion } from "framer-motion"
import "./uploadPage.css"

export default function PCBVerificationPage() {
    const [originalPCB, setOriginalPCB] = useState(null)
    const [analysisPCB, setAnalysisPCB] = useState(null)
    const [preAnalysisPCB, setPreAnalysisPCB] = useState(null)
    const [fileName, setFileName] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef(null)
    const [previewImage, setPreviewImage] = useState(null)
    const navigate = useNavigate()

    // Load image from session storage on component mount
    useEffect(() => {
        const savedOriginalImage = sessionStorage.getItem("OriginalImage")
        const savedAnalysisImage = sessionStorage.getItem("AnalysisImage")
        if (savedOriginalImage) {
            setOriginalPCB(JSON.parse(savedOriginalImage))
        }
        if (savedAnalysisImage) {
            setAnalysisPCB(JSON.parse(savedAnalysisImage))
        }
    }, [])

    // Save image to session storage whenever it changes
    // useEffect(() => {
    //     if (originalPCB) {
    //         sessionStorage.setItem("OriginalImage", originalPCB)
    //     }

    //     if (fileName) {
    //         sessionStorage.setItem("originalPCBFileName", fileName)
    //     } else {
    //         sessionStorage.removeItem("originalPCBFileName")
    //     }
    // }, [originalPCB, fileName])


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
                    setPreAnalysisPCB(newImage)
                    setIsUploading(false)
                }
            }
            reader.readAsDataURL(file)
        }
    }

    useEffect(() => {
        if (preAnalysisPCB) {
            sessionStorage.setItem("PreAnalysisImage", JSON.stringify(preAnalysisPCB))
        } else {
            sessionStorage.removeItem("PreAnalysisImage")
        }
    }, [preAnalysisPCB])

    const removeAnalysisImage = () => {
        // console.log(AnalysisPCB)
        if (analysisPCB && analysisPCB.url) {
            URL.revokeObjectURL(analysisPCB.url)
            sessionStorage.removeItem("AnalysisImage")
        }
        setAnalysisPCB(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const removeOriginalImage = () => {
        // console.log(originalPCB)
        if (originalPCB && originalPCB.url) {
            URL.revokeObjectURL(originalPCB.url)
            sessionStorage.removeItem("OriginalImage")
        }
        setOriginalPCB(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const removePreAnalysisPCBImage = () => {
        // console.log(originalPCB)
        if (preAnalysisPCB && preAnalysisPCB.url) {
            URL.revokeObjectURL(preAnalysisPCB.url)
            sessionStorage.removeItem("PreAnalysisImage")
        }
        setPreAnalysisPCB(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }


    const openPreview = (image) => {
        setPreviewImage(image)
    }

    const closePreview = () => {
        setPreviewImage(null)
    }

    const Button = ({ children, onClick, className, variant = "primary", icon, disabled }) => {
        const baseStyles = "px-4 py-2 rounded-md font-medium transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"

        const variants = {
            primary:
                "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-700/50 relative overflow-hidden group",
            secondary:
                "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border border-purple-700/50 relative overflow-hidden group",
            outline: "border border-gray-700 hover:border-cyan-500/70 bg-transparent hover:bg-gray-800/50 text-gray-300",
            danger:
                "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border border-red-700/50 relative overflow-hidden group",
        }

        return (
            <button
                onClick={onClick}
                className={`${baseStyles} ${variants[variant]} ${className || ""}`}
                disabled={disabled}
            >
                {(variant === "primary" || variant === "secondary" || variant === "danger") && (
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                )}
                <span className="relative z-10 flex items-center gap-2">
                    {icon}
                    {children}
                </span>
            </button>
        )
    }

    return (
        <>
            <div className="min-h-screen bg-[#050816] text-white p-2 relative overflow-hidden">
                {/* Background elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full grid-bg opacity-30"></div>
                    <div className="absolute top-0 left-0 w-full h-full circuit-pattern"></div>
                    <div className="absolute top-0 left-0 w-2/5 h-full bg-gradient-to-r from-red-900/40 via-pink-600/20 to-transparent"></div>
                </div>

                <div className="relative z-10 container mx-auto px-4 py-8">
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

                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="w-full lg:w-[30%] h-full">
                            <div className="backdrop-blur-sm bg-black/40 rounded-xl p-6 border border-red-500/30 glow-red tech-border h-full">
                                <h2 className="text-xl font-bold mb-6 text-center relative">
                                    <span className="bg-gradient-to-r from-orange-400 to-red-500 text-transparent bg-clip-text">
                                        ORIGINAL PCB
                                    </span>
                                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-0.5 w-16 bg-gradient-to-r from-orange-400 to-red-500"></div>
                                </h2>

                                <div className="bg-black rounded-lg p-4 min-h-[300px] flex flex-col items-center justify-center relative h-full">
                                    {originalPCB ? (
                                        <div className="w-full h-full flex flex-col">
                                            <div className="relative mb-4 gradient-border-red rounded-lg overflow-hidden">
                                                <img
                                                    src={originalPCB.url}
                                                    alt={originalPCB.name}
                                                    className="h-full max-h-60 w-full object-contain rounded-md border border-gray-200"
                                                />
                                                {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div> */}
                                            </div>

                                            <div className="flex items-center justify-between bg-gray-900 rounded-md px-3 py-2 mb-4 border border-gray-800">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-red"></div>
                                                    <span className="text-sm text-gray-300 truncate max-w-[160px]">{originalPCB.name}</span>
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

                        <div className="w-full lg:w-[70%] h-full">
                            <div className="backdrop-blur-sm bg-black/40 rounded-xl p-6 border border-cyan-500/30 glow-blue tech-border h-full">
                                <h2 className="text-xl font-bold mb-6 text-center relative">
                                    <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
                                        PCB ANALYSIS
                                    </span>
                                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-0.5 w-24 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
                                </h2>

                                <div className="bg-black rounded-lg p-4 min-h-[300px] flex flex-col items-center justify-center relative h-full">
                                    {originalPCB ? (
                                        !preAnalysisPCB ? (
                                            analysisPCB ? (
                                                <div className="w-full h-full flex flex-col">
                                                    <div className="flex flex-row gap-6 max-w-4xl mx-auto p-6 bg-gray-900 rounded-lg border border-gray-800 shadow-lg">
                                                        {/* Left Column - Image */}
                                                        <div className="w-1/2 flex flex-col">
                                                            <div className="bg-black rounded-lg flex items-center justify-center h-64 border border-gray-700 mb-4">
                                                                <img
                                                                    src={analysisPCB.url}
                                                                    alt={analysisPCB.name}
                                                                    className="max-h-full max-w-full object-contain"
                                                                />
                                                            </div>

                                                            <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                                                <div className="flex items-center">
                                                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-2"></span>
                                                                    <span className="text-sm text-gray-300 truncate max-w-[160px]">
                                                                        {analysisPCB.name}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={removeAnalysisImage}
                                                                    className="text-gray-400 hover:text-red-400 transition-colors"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>

                                                            <div className="mt-2">
                                                                <div className="flex items-center justify-center gap-2 mb-3">
                                                                    <div className="flex items-center text-green-400 text-sm">
                                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                                        <span>PCB LOADED</span>
                                                                    </div>
                                                                </div>

                                                                <Button
                                                                    variant="secondary"
                                                                    className="w-full text-sm"
                                                                    onClick={removeAnalysisImage}
                                                                    icon={<ArchiveX className="h-4 w-4" />}
                                                                >
                                                                    Delete PCB IMAGE
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Right Column - Content */}
                                                        <div className="w-1/2 flex flex-col visibility: hidden;">
                                                            {/* Header Section */}
                                                            <div className="text-left mb-6 ">
                                                                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                                                                    <Cpu className="h-6 w-6 text-cyan-400" />
                                                                </div>
                                                                <h1 className="text-cyan-400 text-xl font-semibold mb-1">
                                                                    PCB Quality Control System
                                                                </h1>
                                                                <p className="text-gray-400 text-sm">
                                                                    Click the button "START ANALYSIS" to start verification
                                                                </p>
                                                            </div>

                                                            {/* Divider */}
                                                            <div className="h-px bg-gray-700 my-4"></div>

                                                            {/* Process Details Section */}
                                                            <div className="mb-6">
                                                                <h2 className="text-cyan-400 text-lg font-medium mb-3">
                                                                    PROCESS DETAILS
                                                                </h2>

                                                                <div className="space-y-2 text-sm text-gray-300">
                                                                    <div className="flex items-center">
                                                                        <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span>
                                                                        Edge Detection
                                                                    </div>
                                                                    <div className="flex items-center">
                                                                        <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span>
                                                                        Copper Tracing
                                                                    </div>
                                                                    <div className="flex items-center">
                                                                        <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span>
                                                                        Quality Scoring
                                                                    </div>
                                                                    <div className="flex items-center">
                                                                        <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span>
                                                                        Defect Mapping
                                                                    </div>
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>

                                                    <div className="mt-5 flex justify-center pr-6 pl-6">
                                                        <Button
                                                            variant="primary"
                                                            className="w-full"
                                                            icon={<Cpu className="h-4 w-4" />}
                                                        >
                                                            START ANALYSIS
                                                        </Button>
                                                    </div>

                                                    <div className="mt-4 flex items-center justify-center gap-2 text-red-400 text-sm">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <span>ANALYSIS NOT PERFORMED YET</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-8 mt-3">
                                                    <motion.div
                                                        whileHover={{ scale: 1.02 }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                        className="group border-2 border-dashed border-gray-700 hover:border-cyan-500/70 rounded-xl p-8 text-center hover:bg-gray-800/30 transition-all cursor-pointer relative overflow-hidden"
                                                        onClick={() => navigate("/camDetectPCB", {
                                                            state: { PCB: "AnalysisImage" },
                                                        })}
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:to-purple-500/10 transition-all duration-700"></div>

                                                        <div className="flex flex-col items-center justify-center gap-4 relative z-10">
                                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(0,200,255,0.3)] transition-all duration-500 border border-gray-700 group-hover:border-cyan-500/50">
                                                                <Webcam className="h-8 w-8 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-xl font-medium mb-2 text-white group-hover:text-cyan-300 transition-colors">
                                                                    ระบบตรวจจับแผ่น PCB ที่ต้องการตรวจสอบ
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
                                                                    อัปโหลด/วาง รูปภาพของแผ่น PCB ที่ต้องการตรวจสอบ
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
                                            )
                                        ) : <div className="space-y-6 ">
                                            <div className="mt-1">
                                                <div className="flex flex-col items-center">
                                                    <div
                                                        className="relative group cursor-pointer"
                                                        onClick={() => openPreview(preAnalysisPCB)}
                                                    >
                                                        <img
                                                            src={preAnalysisPCB.url}
                                                            alt={preAnalysisPCB.name}
                                                            className="h-40 w-full object-contain rounded-md border border-gray-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                                            <span className="text-white opacity-0 group-hover:opacity-100">คลิกเพื่อดูรูปภาพเต็ม</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between w-full mt-2 bg-gray-50 p-2 rounded-md">
                                                        <span className="text-sm text-gray-700 truncate flex-1">
                                                            {preAnalysisPCB.name || "Webcam Capture"}
                                                        </span>
                                                        <button
                                                            onClick={removePreAnalysisPCBImage}
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
                                                            state: { PCB: "AnalysisImage" },
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
                                        </div>) : (
                                        <div className="flex flex-col items-center justify-center text-center p-8">
                                            <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-6 relative">
                                                <div className="absolute inset-0 rounded-full border-2 border-dashed border-red-900 animate-spin-slow"></div>
                                                <AlertCircle className="h-10 w-10 text-red-600" />
                                            </div>
                                            <h3 className="text-xl text-gray-400 mb-2">NO ORIGINAL PCB IMAGE UPLOADED</h3>
                                            <p className="text-gray-500 max-w-md">
                                                Please upload an Original PCB image on the left panel to begin quality analysis and verification process.
                                            </p>
                                            {/* <div className="flex items-center mt-6 text-red-400 text-sm">
                                                <span>UPLOAD IMAGE FIRST</span>

                                            </div> */}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="mt-12 text-center">
                        <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-900/30 px-4 py-2 rounded-full backdrop-blur-sm border border-gray-800/50">
                            <div className="flex items-center gap-1.5">
                                <Cpu className="h-3 w-3 text-cyan-600" />
                                <span>Running on Raspberry Pi 4</span>
                            </div>
                            <div className="h-4 w-px bg-gray-700"></div>
                            <span className="font-mono">ANALYSIS</span>
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
        </>
    )
}