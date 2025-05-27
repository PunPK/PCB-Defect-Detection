import AnalysisBar, { steps } from "../components/analysisBar.js"

import { useState, useEffect } from 'react'
import { useNavigate } from "react-router";

export default function Step1() {
  const [activeStep, setActiveStep] = useState(0);
  const navigate = useNavigate()
  const [originalImage, setOriginalImage] = useState(null)
  const [analysisImage, setAnalysisImage] = useState(null)
  const [processedImages, setProcessedImages] = useState(null)
  const [croppedPCB, setCroppedPCB] = useState(null)
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
    <div className="flex">
      <AnalysisBar activeStep={activeStep} />

      <div className="ml-80 p-6 flex-1">
        <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
          Steps 1 เตรียมความพร้อมของรูปภาพ PCB ที่จะใช้ในการตรวจสอบ
        </h2>
        <p className="font-light text-gray-500 max-w-screen-xl lg:mb-16 sm:text-xl dark:text-gray-400">
          แบ่งไปด้วยหลายๆขั้นตอน ตั้งแต่การแปลงรูปภาพจากรูปแบบสีปกติให้กลายเป็นขาวดำ และทำให้รูปภาพอยู่ในพิกัดเดียวกัน และความจับความต่างกันของ PCB ตั้ง 2 แผ่น เพื่อใช้ในการดำเนินการตรวจสอบข้อผิดพลาด
        </p>
        <div className="image-grid">
          <div className="image-card">
            <h3>Template</h3>
            <img src={processedImages?.template} alt="Template" />
          </div>
          <div className="image-card">
            <h3>Defective</h3>
            <img src={processedImages?.defective} alt="Defective" />
          </div>
          <div className="image-card">
            <h3>Aligned</h3>
            <img src={processedImages?.aligned} alt="Aligned" />
          </div>
          <div className="image-card">
            <h3>Difference</h3>
            <img src={processedImages?.diff} alt="Difference" />
          </div>
          <div className="image-card">
            <h3>Cleaned</h3>
            <img src={processedImages?.cleaned} alt="Cleaned" />
          </div>
          <div className="image-card">
            <h3>Result</h3>
            <img src={processedImages?.result} alt="Result" />
          </div>
        </div>
        <button
          onClick={() => {
            setActiveStep(prev => Math.max(prev - 1, 0));
            navigate(-1);
          }}
          className="mr-2 px-4 py-2 bg-gray-200 rounded"
        >
          Previous
        </button>
        <button
          onClick={() => {
            setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
            navigate("/Steps2");
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Next
        </button>
      </div>
    </div>
  );
}