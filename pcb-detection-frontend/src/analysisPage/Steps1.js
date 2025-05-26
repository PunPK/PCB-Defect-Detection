import AnalysisBar, { steps } from "../components/analysisBar.js"

import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from "react-router";

export default function Step1() {
  const [activeStep, setActiveStep] = useState(0);
  const navigate = useNavigate()

  return (
    <div className="flex">
      <AnalysisBar activeStep={activeStep} />

      <div className="ml-80 p-6 flex-1">
        <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
          Steps 1 แปลงรูปภาพสีไปเป็นเป็นสีขาวดำ
        </h2>
        <p className="font-light text-gray-500 lg:mb-16 sm:text-xl dark:text-gray-400">
          การแปลงรูปภาพจากรูปแบบสีปกติให้กลายเป็นขาวดำเพื่อใช้ในการดำเนินการตรวจสอบข้อผิดพลาด
        </p>
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