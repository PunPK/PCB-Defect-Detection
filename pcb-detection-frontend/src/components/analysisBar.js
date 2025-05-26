import React, { useState } from "react";
import { User, Image, Download, Check, ChevronRight, Lock } from 'lucide-react';
import { useNavigate } from "react-router-dom";

const steps = [
    {
        title: "Steps 1",
        description: "แปลงรูปภาพสีไปเป็นเป็นสีขาวดำ",
        icon: <User className="w-5 h-5" />,
        path: "/Steps1"
    },
    {
        title: "Create your image",
        description: "Choose AI assistants to create your image variations",
        icon: <Image className="w-5 h-5" />,
        path: "/Steps2"
    },
    {
        title: "Download",
        description: "Download zip of all variations",
        icon: <Download className="w-5 h-5" />,
        path: "/Steps3"
    },
    {
        title: "Review",
        description: "Review your created images",
        icon: <Image className="w-5 h-5" />,
        path: "/Steps4"
    },
    {
        title: "Share",
        description: "Share your creations with others",
        icon: <Download className="w-5 h-5" />,
        path: "/Steps5"
    },
];

const AnalysisBar = ({ activeStep }) => {
    const navigate = useNavigate();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(null);

    const handleStepClick = (index) => {
        if (index > activeStep) {
            alert(`Please complete step ${activeStep + 1} first before proceeding to step ${index + 1}`);
            return;
        }
        navigate(steps[index].path);
    };



    return (
        <>
            <button
                className="lg:hidden fixed left-0 top-4 z-50 p-2 rounded-r-md bg-green-500 text-white shadow-md"
                onClick={() => setIsMobileOpen(!isMobileOpen)}
            >
                <ChevronRight className={`w-5 h-5 transition-transform ${isMobileOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className="fixed left-0 top-0 h-full w-64 lg:w-72 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 lg:p-6 border-r border-gray-200 dark:border-gray-700 shadow-sm z-50 overflow-y-auto">
                {/* Mobile toggle button (hidden on desktop) */}
                <button className="lg:hidden absolute -right-10 top-4 p-2 rounded-r-md bg-green-500 text-white">
                    <ChevronRight className="w-5 h-5" />
                </button>

                <div className="flex items-center mb-6 lg:mb-8">
                    <div className="bg-green-500 dark:bg-green-600 w-2 h-6 rounded-full mr-3"></div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white relative">
                        Analysis Progress
                        <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-green-500 to-transparent"></span>
                    </h2>
                </div>

                <div className="relative">
                    {/* Vertical progress line */}
                    <div className="absolute left-9 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-gray-200 dark:from-green-400 dark:to-gray-700">
                        {steps.map((_, index) => (
                            <div
                                key={index}
                                className={`absolute left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full transition-all duration-300 ${index <= activeStep
                                    ? "bg-green-500 dark:bg-green-400 ring-4 ring-green-200 dark:ring-green-900/50"
                                    : "bg-gray-300 dark:bg-gray-600"
                                    }`}
                                style={{ top: `${(index * 100) / (steps.length - 1)}%` }}
                            />
                        ))}
                    </div>

                    <div className="space-y-8 lg:space-y-10 pl-10 lg:pl-12 max-h-[calc(100vh-150px)] overflow-y-auto">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                onClick={() => handleStepClick(index)}
                                className={`relative group transition-all duration-200 ${index <= activeStep ? "cursor-pointer" : "cursor-not-allowed"}`}
                            >
                                <div
                                    className={`flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-lg border-2 transition-all duration-300 ${index < activeStep
                                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400 shadow-sm group-hover:shadow-md"
                                        : index === activeStep
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 shadow-sm group-hover:shadow-md"
                                            : "border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600"
                                        }`}
                                >
                                    {index <= activeStep ? (
                                        index === activeStep ? (
                                            <span className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500 dark:text-blue-400">
                                                {step.icon}
                                            </span>
                                        ) : (
                                            <span className="w-4 h-4 lg:w-5 lg:h-5 text-green-500 dark:text-green-400">
                                                {step.icon}
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-gray-500 dark:text-gray-400 w-4 h-4 lg:w-5 lg:h-5">
                                            <Lock className="w-4 h-4" />
                                        </span>
                                    )}
                                </div>

                                <div className={`mt-2 lg:mt-3 p-2 lg:p-3 rounded-lg transition-all duration-200 ${index < activeStep
                                    ? "bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/50 group-hover:translate-x-1"
                                    : index === activeStep
                                        ? "bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 group-hover:translate-x-1"
                                        : "bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <h3 className={`text-base lg:text-lg font-medium ${index > activeStep
                                            ? "text-gray-400 dark:text-gray-500"
                                            : index === activeStep
                                                ? "text-blue-600 dark:text-blue-400"
                                                : "text-green-600 dark:text-green-400"
                                            }`}>
                                            {step.title}
                                        </h3>
                                        {index <= activeStep && (
                                            <ChevronRight
                                                className={`w-4 h-4 ${index === activeStep ? "text-blue-500 dark:text-blue-400" : "text-green-500 dark:text-green-400"} opacity-0 group-hover:opacity-100 transition-opacity`}
                                            />
                                        )}
                                    </div>
                                    <p className={`mt-1 text-xs lg:text-sm ${index > activeStep
                                        ? "text-gray-400 dark:text-gray-500"
                                        : index === activeStep
                                            ? "opacity-90"
                                            : "opacity-80"
                                        }`}>
                                        {step.description}
                                    </p>
                                    {index > activeStep && (
                                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                                            Complete previous steps first
                                        </p>
                                    )}
                                </div>

                                {index < activeStep && (
                                    <span className="absolute -left-10 lg:-left-12 top-0 flex h-9 w-9 lg:h-10 lg:w-10 items-center justify-center">
                                        <div className="animate-ping absolute h-5 w-5 lg:h-6 lg:w-6 rounded-full bg-green-400/30 dark:bg-green-500/30"></div>
                                        <Check className="h-4 w-4 lg:h-5 lg:w-5 text-green-500 dark:text-green-400 relative" />
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default AnalysisBar;
export { steps };