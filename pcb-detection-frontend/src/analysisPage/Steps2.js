import AnalysisBar, { steps } from "../components/analysisBar.js"
import { ArrowDown, ArrowRight, IterationCcw } from "lucide-react"
import { useState, useEffect } from 'react'
import { useNavigate } from "react-router";
import "../page/HomePage.css"

function ImageCard({ title, src, alt, className = "" }) {
    return (
        <div className={`bg-gray-800 rounded-xl overflow-hidden border-b-4 ${className} transition-transform hover:scale-105`}>
            <div className="p-4 bg-gray-900">
                <h3 className="text-lg font-medium text-gray-200">{title}</h3>
            </div>
            <div className="p-2 bg-gray-800">
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-48 object-contain rounded-md bg-black"
                />
            </div>
        </div>
    );
}

export default function Step2() {
    const [activeStep, setActiveStep] = useState(1);
    const navigate = useNavigate()
    const [originalImage, setOriginalImage] = useState(null)
    const [analysisImage, setAnalysisImage] = useState(null)
    const [processedImages, setProcessedImages] = useState(null)
    const [status, setStatus] = useState('Waiting for image...')
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        getImg()
    }, [])

    const getImg = async () => {
        try {
            const savedAnalysisImage = sessionStorage.getItem("AnalysisImage")
            const analysisImgData = JSON.parse(savedAnalysisImage)
            setAnalysisImage(analysisImgData)

            const savedOriginalImage = sessionStorage.getItem("OriginalImage")
            const originalImgData = JSON.parse(savedOriginalImage)
            setOriginalImage(originalImgData)
            processImage(originalImgData.url, originalImgData.name, analysisImgData.url, analysisImgData.name)

        } catch (err) {
            console.log(err)
        }
    }

    const processImage = async (originalImageUrl, originalName = "original_pcb.jpg", analysisImageUrl, analysisName = "analysis_pcb.jpg") => {
        if (!originalImageUrl || !analysisImageUrl) return;

        setIsProcessing(true);
        setStatus('Processing image...');
        setError(null);

        try {
            const formData = new FormData();

            const originalResponse = await fetch(originalImageUrl);
            const originalblob = await originalResponse.blob();
            formData.append('files', originalblob, originalName);

            const analysisResponse = await fetch(analysisImageUrl);
            const analysisblob = await analysisResponse.blob();
            formData.append('files', analysisblob, analysisName);

            const apiResponse = await fetch('http://localhost:8000/api/analysis/prepare', {
                method: 'POST',
                body: formData
            });

            if (!apiResponse.ok) {
                throw new Error(`Server error: ${apiResponse.status}`);
            }

            const result = await apiResponse.json();

            console.log(apiResponse)
            setProcessedImages({
                template: `data:image/jpeg;base64,${result.images.template}`,
                defective: `data:image/jpeg;base64,${result.images.defective}`,
                aligned: `data:image/jpeg;base64,${result.images.aligned}`,
                diff: `data:image/jpeg;base64,${result.images.diff}`,
                cleaned: `data:image/jpeg;base64,${result.images.cleaned}`,
                result: `data:image/jpeg;base64,${result.images.result}`
            });

            setStatus(result.detected ? 'PCB detected!' : 'No PCB detected');
        } catch (err) {
            setError(err.message);
            setStatus('Processing failed');
        } finally {
            setIsProcessing(false);
        }
    }

    return (
        // <div className="flex bg-gray-900 min-h-screen">
        <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden">
            <AnalysisBar activeStep={activeStep} />
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full grid-bg"></div>
                <div className="absolute top-1/4 -left-20 w-60 h-60 bg-purple-700/20 rounded-full filter blur-3xl"></div>
                <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-700/20 rounded-full filter blur-3xl"></div>
            </div>

            <div className="lg:ml-64 p-8 flex-1 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-start mb-12">
                        <div className="max-w-2xl">
                            <span className="text-blue-400 font-mono text-xl tracking-widest">STEP 02</span>
                            <h2 className="mb-3 text-4xl font-bold text-white">
                                Analyze and compare PCB images with AI
                            </h2>
                            <p className="text-gray-400 font-light text-lg max-w-3xl leading-relaxed">
                                กลไกเพื่ออธิบายจุดที่ผิดพลาดของความต่างกันของ PCB ทั้ง 2 แผ่น ด้วยเทคโนโลยี AI เพื่อใช้ในการตรวจสอบข้อผิดพลาด
                            </p>
                        </div>
                        <div className="flex space-x-4 mt-3">
                            <button
                                onClick={() => {
                                    getImg()
                                }}
                                className="flex items-center justify-center px-8 py-4 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-all duration-300"
                            >
                                <p className="font-light text-xl leading-relaxed">
                                    Reset Process
                                </p>
                                <svg className="w-5 h-5 ml-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <IterationCcw />
                                </svg>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
                                    navigate("/Steps3");
                                }}
                                className="flex items-center justify-center px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all duration-300"
                            >
                                <p className="font-light text-xl leading-relaxed">
                                    Next Step
                                </p>
                                <svg className="w-5 h-5 ml-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16 relative">

                        <div>
                            <h2 className="text-2xl font-bold mb-8 text-center">Original PCB</h2>


                            <div className="mb-8">
                                <ImageCard
                                    title="รูปภาพต้นฉบับ PCB (สี)"
                                    src={originalImage?.url}
                                    alt="Final Result"
                                    className="border-teal-400"
                                />
                            </div>

                            <div className="flex justify-center mb-8">
                                <ArrowDown className="w-8 h-8 text-white" />
                            </div>


                            <div className="mb-8">
                                <ImageCard
                                    title="รูปภาพต้นฉบับ PCB (สีเทา)"
                                    src={processedImages?.template}
                                    alt="Template PCB"
                                    className="border-blue-400"
                                />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold mb-8 text-center">Analysis PCB</h2>

                            <div className="mb-8">
                                <ImageCard
                                    title="รูปภาพตรวจจับ PCB (สี)"
                                    src={analysisImage?.url}
                                    alt="Defective PCB"
                                    className="border-red-400"
                                />
                            </div>

                            {/* Arrow Down */}
                            <div className="flex justify-center mb-8">
                                <ArrowDown className="w-8 h-8 text-white" />
                            </div>

                            <div className="mb-8 relative">
                                <ImageCard
                                    title="รูปภาพตรวจจับ PCB (สีเทา)"
                                    src={processedImages?.defective}
                                    alt="Defective PCB"
                                    className="border-red-400"
                                />

                                <div className="absolute left-0 top-1/2 transform -translate-x-16 -translate-y-1/2 hidden lg:block">
                                    <ArrowRight className="w-12 h-12 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-2xl mx-auto">
                        <div className="flex justify-center mb-8">
                            <ArrowDown className="w-8 h-8 text-white" />
                        </div>
                        <div className="mb-8">
                            <ImageCard
                                title="รูปภาพที่ได้จากการจัดรูปภาพทั้ง 2 รูป ให้อยู่ในตำแหน่งเดียวกัน"
                                src={processedImages?.aligned}
                                alt="Defective PCB"
                                className="border-red-400"
                            />
                        </div>

                        <div className="flex justify-center mb-8">
                            <ArrowDown className="w-8 h-8 text-white" />
                        </div>
                        <div className="mb-8">
                            <ImageCard
                                title="ตรวจจับจุดที่แตกต่างกันของทั้ง 2 รูปภาพ"
                                src={processedImages?.diff}
                                alt="Defective PCB"
                                className="border-red-400"
                            />
                        </div>
                        <div className="flex justify-center mb-8">
                            <ArrowDown className="w-8 h-8 text-white" />
                        </div>
                        <div className="mb-8">
                            <ImageCard
                                title="แยกจุดที่ตรวจจับจุดที่แตกต่างกันของทั้ง 2 รูปภาพเจอ"
                                src={processedImages?.cleaned}
                                alt="Defective PCB"
                                className="border-red-400"
                            />
                        </div>
                        <div className="flex justify-center mb-8">
                            <ArrowDown className="w-8 h-8 text-white" />
                        </div>
                        <div className="mb-8">
                            <ImageCard
                                title="ผลลัพธ์ของการตรวจจับจุดแตกต่าง"
                                src={processedImages?.result}
                                alt="Defective PCB"
                                className="border-red-400"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-800 pt-6 mt-5">
                        <button
                            onClick={() => {
                                setActiveStep(prev => Math.max(prev - 1, 0));
                                navigate("/Steps1");
                            }}
                            className="flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-all duration-300"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                        </button>
                        <div className="text-sm text-gray-500 font-mono">
                            {activeStep + 1} / {steps.length}
                        </div>
                        <button
                            onClick={() => {
                                setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
                                navigate("/Steps3");
                            }}
                            className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all duration-300"
                        >
                            Next Step
                            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}