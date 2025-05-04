import { useState, useEffect, useRef } from "react"
import { Upload, X, RefreshCw, Check, Hexagon, Cpu, Scan } from "lucide-react"
// import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

const customStyles = `
  @keyframes shine {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }
  
  .animate-shine {
    animation: shine 1.5s ease-in-out;
  }
  
  .grid-bg {
    background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9IiMxYTFhM2EiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==');
  }
`

export default function UploadFilePage() {
    const [image, setImage] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [showCamera, setShowCamera] = useState(false)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const fileInputRef = useRef(null)
    const [stream, setStream] = useState(null)

    useEffect(() => {
        const savedImage = sessionStorage.getItem("uploadedImage")
        if (savedImage) {
            setImage(savedImage)
        }
    }, [])

    useEffect(() => {
        if (image) {
            sessionStorage.setItem("uploadedImage", image)
        } else {
            sessionStorage.removeItem("uploadedImage")
        }
    }, [image])

    // Clean up camera stream when component unmounts or camera is closed
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop())
            }
        }
    }, [stream])

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]

            // Check if file is an image
            if (!file.type.startsWith("image/")) {
                alert("Please upload an image file only")
                return
            }

            setIsUploading(true)

            const reader = new FileReader()
            reader.onload = (event) => {
                if (event.target?.result) {
                    setImage(event.target.result)
                    setIsUploading(false)
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const removeImage = () => {
        setImage(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            })

            setStream(mediaStream)

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
            }

            setShowCamera(true)
        } catch (err) {
            console.error("Error accessing camera:", err)
            alert("Could not access camera. Please check permissions.")
        }
    }

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            setStream(null)
        }
        setShowCamera(false)
    }

    const captureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current
            const canvas = canvasRef.current

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            // Draw current video frame to canvas
            const ctx = canvas.getContext("2d")
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

                // Convert canvas to data URL and set as image
                const imageData = canvas.toDataURL("image/jpeg")
                setImage(imageData)

                // Stop camera after capturing
                stopCamera()
            }
        }
    }

    return (
        <>

            <style jsx>{customStyles}</style>

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
                        {showCamera ? (
                            <div className="space-y-6">
                                <div className="relative rounded-lg overflow-hidden bg-black border-2 border-cyan-500/30">
                                    <div className="absolute inset-0 z-10 pointer-events-none border border-cyan-400/20"></div>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-500 opacity-70"></div>
                                    <div className="absolute top-4 left-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                        <span className="text-xs text-cyan-300 font-mono">REC</span>
                                    </div>
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>

                                <div className="flex justify-center gap-4">
                                    {/* <Button
                                        onClick={captureImage}
                                        className="relative overflow-hidden group bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 border border-cyan-700"
                                    >
                                        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 group-hover:animate-shine"></span>
                                        <Check className="h-4 w-4 mr-2" />
                                        ถ่ายภาพ
                                    </Button>

                                    <Button
                                        onClick={stopCamera}
                                        variant="outline"
                                        className="border-gray-700 hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-300"
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        ยกเลิก
                                    </Button> */}
                                </div>
                            </div>
                        ) : image ? (
                            <div className="space-y-6">
                                <div className="relative">
                                    <div className="absolute inset-0 rounded-lg border-2 border-cyan-500/30 pointer-events-none"></div>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-500 opacity-70 rounded-t-lg"></div>
                                    <img
                                        src={image || "/placeholder.svg"}
                                        alt="Uploaded image"
                                        className="w-full h-auto rounded-lg object-contain max-h-[300px] bg-black/50"
                                    />
                                    <button
                                        onClick={removeImage}
                                        className="absolute top-3 right-3 bg-gray-900/80 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors duration-300 border border-gray-700 hover:border-red-400 shadow-lg"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>

                                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-mono text-cyan-300 border border-cyan-900/50">
                                        IMAGE_CAPTURED.JPG
                                    </div>
                                </div>

                                {/* <div className="flex justify-center">
                                    <Button
                                        onClick={removeImage}
                                        className="relative overflow-hidden group bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 border border-cyan-700/50"
                                    >
                                        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 group-hover:animate-shine"></span>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        อัปโหลดใหม่
                                    </Button>
                                </div> */}
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                    className="group border-2 border-dashed border-gray-700 hover:border-cyan-500/70 rounded-xl p-8 text-center hover:bg-gray-800/30 transition-all cursor-pointer relative overflow-hidden"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:to-purple-500/10 transition-all duration-700"></div>

                                    <div className="flex flex-col items-center justify-center gap-4 relative z-10">
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(0,200,255,0.3)] transition-all duration-500 border border-gray-700 group-hover:border-cyan-500/50">
                                            <Upload className="h-8 w-8 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-medium mb-2 text-white group-hover:text-cyan-300 transition-colors">
                                                อัปโหลดรูปภาพต้นแบบของแผ่น PCB
                                            </h3>
                                            <p className="text-gray-400 mb-5 group-hover:text-gray-300 transition-colors">
                                                คลิกเพื่อเลือกไฟล์รูปภาพ
                                            </p>

                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />

                                            {/* <Button className="relative overflow-hidden group bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 border border-cyan-700/50">
                                                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 group-hover:animate-shine"></span>
                                                เลือกรูปภาพ
                                            </Button> */}
                                        </div>
                                    </div>
                                </motion.div>

                                <div className="text-center relative">
                                    <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
                                    <span className="relative bg-[#050816] px-4 text-gray-400">หรือ</span>
                                </div>

                                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                                    {/* <Button
                                        onClick={startCamera}
                                        variant="outline"
                                        className="w-full h-14 border-gray-700 hover:border-cyan-500/70 hover:bg-gray-800/50 transition-all duration-300 group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 transition-all duration-700 rounded-md"></div>
                                        <Scan className="h-5 w-5 mr-3 text-cyan-500 group-hover:text-cyan-400" />
                                        <span className="text-gray-300 group-hover:text-cyan-300 transition-colors">เปิดกล้อง</span>
                                    </Button> */}
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
                </div>
            </div>
        </>
    )
}
