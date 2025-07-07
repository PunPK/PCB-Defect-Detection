import { ArrowDown, ArrowRight, IterationCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import "../page/HomePage.css";

export default function DetailResult() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [result, setResult] = useState(null);
  const { result_id } = useParams();

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
            src={`data:image/jpeg;base64,${src}`}
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
    );
  }

  useEffect(() => {
    handleGetResult();
  }, [result_id]);

  const handleGetResult = async () => {
    setIsProcessing(true);
    if (!result_id) {
      console.error("No result_id provided");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/factory/get_result/${result_id}`
      );
      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error fetching saved images:", error);
    }
  };

  const openPreview = (image_data, filename) => {
    const image_list = {
      image_data: image_data,
      filename: filename,
    };
    setPreviewImage(image_list);
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  if (isProcessing) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#050816]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    // <div className="flex bg-gray-900 min-h-screen">
    <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full grid-bg"></div>
        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-purple-700/20 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-700/20 rounded-full filter blur-3xl"></div>
      </div>

      <div className="p-8 flex-1 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start mb-8 lg:mb-12 gap-6">
            <div className="max-w-2xl ml-2">
              <div className="flex items-center mb-6">
                <span className="text-blue-400 font-mono text-lg lg:text-xl tracking-widest flex items-center">
                  <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                  Detail Result
                </span>
                <div className="ml-4 h-px flex-1 bg-gradient-to-r from-blue-400/20 to-transparent"></div>
              </div>

              <h2 className="mb-4 text-2xl lg:text-4xl font-bold text-white bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                {`Result ที่ ${result?.result_List?.results_id} ในการตรวจสอบครั้งที่ ${result?.result_List?.pcb_result_id}`}
              </h2>

              {result && (
                <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900/50 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 opacity-30"></div>
                  <h3 className="relative text-lg lg:text-2xl font-bold text-gray-100">
                    <span className="text-blue-400">Result:</span> [
                    <span className="text-cyan-300">
                      {result?.result_List?.accuracy}%
                    </span>
                    ]{" "}
                    <span className="text-gray-300">
                      {result?.result_List?.description}
                    </span>
                  </h3>
                </div>
              )}

              <p className="text-gray-300 font-light text-base lg:text-lg leading-relaxed space-y-4">
                <span className="block">
                  แบ่งไปด้วยหลายๆขั้นตอน
                  ตั้งแต่การแปลงรูปภาพจากรูปแบบสีปกติให้กลายเป็นขาวดำ
                  และทำให้รูปภาพอยู่ในพิกัดเดียวกัน และตรวจหาความแตกต่างระหว่าง
                  PCB ทั้ง 2 แผ่น
                  เพื่อใช้ในการตรวจสอบข้อผิดพลาดด้วยความแม่นยำสูง
                </span>
              </p>
            </div>
            <div className="flex flex-col w-full sm:w-auto">
              <button
                onClick={() => {
                  navigate(-1);
                }}
                className="flex items-center justify-center px-6 py-3 lg:px-14 lg:py-8 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-all duration-300"
              >
                <p className="font-light text-lg sm:text-2xl leading-relaxed">
                  ย้อนกลับ
                </p>
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <IterationCcw />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16 relative">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-center">
                Original PCB
              </h2>
              <div className="flex justify-between items-center border-t border-gray-800 pt-6 mt-4 mb-6"></div>

              <div className="mb-8">
                <ImageCard
                  title="รูปภาพต้นฉบับ PCB (สีเทา)"
                  src={
                    result?.result_List?.imageList?.template_image?.image_data
                  }
                  alt={
                    result?.result_List?.imageList?.template_image?.filename ||
                    "Template PCB"
                  }
                  className="border-blue-400"
                />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2 text-center">
                Analysis PCB
              </h2>
              <div className="flex justify-between items-center border-t border-gray-800 pt-6 mt-4 mb-6"></div>

              <div className="mb-8 relative">
                <ImageCard
                  title="รูปภาพตรวจจับ PCB (สีเทา)"
                  src={
                    result?.result_List?.imageList?.defective_image?.image_data
                  }
                  alt={
                    result?.result_List?.imageList?.defective_image?.filename ||
                    "Defective PCB"
                  }
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
                src={result?.result_List?.imageList?.aligned_image?.image_data}
                alt={
                  result?.result_List?.imageList?.aligned_image?.filename ||
                  "Aligend PCB"
                }
                className="border-red-400"
              />
            </div>

            <div className="flex justify-center mb-8">
              <ArrowDown className="w-8 h-8 text-white" />
            </div>
            <div className="mb-8">
              <ImageCard
                title="ตรวจจับจุดที่แตกต่างกันของทั้ง 2 รูปภาพ"
                src={result?.result_List?.imageList?.diff_image?.image_data}
                alt={
                  result?.result_List?.imageList?.diff_image?.filename ||
                  "Diff PCB"
                }
                className="border-red-400"
              />
            </div>
            <div className="flex justify-center mb-8">
              <ArrowDown className="w-8 h-8 text-white" />
            </div>
            <div className="mb-8">
              <ImageCard
                title="แยกจุดที่ตรวจจับจุดที่แตกต่างกันของทั้ง 2 รูปภาพเจอ"
                src={result?.result_List?.imageList?.cleaned_image?.image_data}
                alt={
                  result?.result_List?.imageList?.cleaned_image?.filename ||
                  "Cleaned PCB"
                }
                className="border-red-400"
              />
            </div>
            <div className="flex justify-center mb-8">
              <ArrowDown className="w-8 h-8 text-white" />
            </div>
            <div className="mb-8">
              <ImageCard
                title="ผลลัพธ์ของการตรวจจับจุดแตกต่าง"
                src={result?.result_List?.imageList?.result_image?.image_data}
                alt={
                  result?.result_List?.imageList?.result_image?.filename ||
                  "Result PCB"
                }
                className="border-red-400"
              />
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-gray-800 pt-6 mt-5"></div>
        </div>
        {previewImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={closePreview}
          >
            <div
              className="relative max-w-4xl w-full max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute -top-10 right-0 text-white hover:text-gray-300"
                onClick={closePreview}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <img
                src={`data:image/jpeg;base64,${previewImage.image_data}`}
                alt={previewImage.filename}
                className="w-full max-h-[60vh] object-contain mx-auto"
              />
              <div className="mt-2 text-center text-white">
                {previewImage.filename}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
