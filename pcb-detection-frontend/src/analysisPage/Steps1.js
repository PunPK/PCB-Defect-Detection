import AnalysisBar, { steps } from "../components/analysisBar.js"
import { ArrowDown, ArrowRight, IterationCcw } from "lucide-react"
import { useState, useEffect } from 'react'
import { useNavigate } from "react-router";
import "../page/HomePage.css"

export default function Step1() {
  const [activeStep, setActiveStep] = useState(0);
  const navigate = useNavigate()
  const [originalImage, setOriginalImage] = useState(null)
  const [analysisImage, setAnalysisImage] = useState(null)
  const [processedImages, setProcessedImages] = useState(null)
  const [status, setStatus] = useState('Waiting for image...')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [namePreviewImage, setNamePreviewImage] = useState(null)
  const [openPreviewImage, setOpenPreviewImage] = useState(false)

  function ImageCard({ title, src, alt, className = "" }) {
    return (
      <div
        className={`bg-gray-800 rounded-xl overflow-hidden border-b-4 ${className} transition-all hover:scale-[1.02] hover:shadow-lg`}
      >
        <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-700">
          <h3 className="text-lg font-medium text-gray-200 text-center truncate">
            {title}
          </h3>
        </div>
        <div
          className="p-2 bg-gray-800 relative group cursor-pointer"
          onClick={() => openPreview(src, title)}
        >
          <img
            src={src}
            alt={alt}
            className="w-full h-48 object-contain rounded-md bg-gray-900 p-1"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
            <span className="text-white opacity-0 group-hover:opacity-100 transform group-hover:translate-y-0 translate-y-2 transition-all duration-300 px-3 py-1.5 bg-black/60 rounded-full text-sm">
              คลิกเพื่อดูรูปภาพเต็ม
            </span>
          </div>
        </div>
      </div>
    )
  }

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

  const openPreview = (image, name = "pcb_image.jpg") => {
    setPreviewImage(image)
    setNamePreviewImage(name)
    setOpenPreviewImage(true)
  }

  const closePreview = () => {
    setPreviewImage(null)
    setNamePreviewImage(null)
    setOpenPreviewImage(false)
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
              <span className="text-blue-400 font-mono text-xl tracking-widest">STEP 01</span>
              <h2 className="mb-3 text-4xl font-bold text-white">
                Prepare PCB Images for Inspection
              </h2>
              <p className="text-gray-400 font-light text-lg max-w-3xl leading-relaxed">
                แบ่งไปด้วยหลายๆขั้นตอน ตั้งแต่การแปลงรูปภาพจากรูปแบบสีปกติให้กลายเป็นขาวดำ และทำให้รูปภาพอยู่ในพิกัดเดียวกัน และความจับความต่างกันของ PCB ทั้ง 2 แผ่น เพื่อใช้ในการตรวจสอบข้อผิดพลาด
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
                  navigate("/Steps2");
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
              <h2 className="text-2xl font-bold mb-2 text-center">Original PCB</h2>
              <div className="flex justify-between items-center border-t border-gray-800 pt-6 mt-4 mb-6"></div>

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
              <h2 className="text-2xl font-bold mb-2 text-center">Analysis PCB</h2>
              <div className="flex justify-between items-center border-t border-gray-800 pt-6 mt-4 mb-6"></div>

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
            {/* <button
              onClick={() => {
                setActiveStep(prev => Math.max(prev - 1, 0));
                navigate(-1);
              }}
              className="flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-all duration-300"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button> */}
            <div className="text-sm text-gray-500 font-mono">
              {activeStep + 1} / {steps.length}
            </div>
            <button
              onClick={() => {
                setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
                navigate("/Steps2");
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
        {openPreviewImage && (
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
                src={previewImage}
                alt={namePreviewImage}
                className="max-w-full max-h-[80vh] object-contain mx-auto"
              />
              <div className="mt-2 text-center text-white">
                {namePreviewImage}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}