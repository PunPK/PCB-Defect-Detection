import React, { useState, useEffect } from "react";
import { User, Image, Download, Check, ChevronRight, Lock, Menu, X } from 'lucide-react';
import { useNavigate } from "react-router-dom";

const steps = [
    {
        title: "Step 01",
        description: "Prepare PCB images for inspection",
        icon: <User className="w-4 h-4" />,
        path: "/Steps1"
    },
    {
        title: "Step 02",
        description: "Analyze and compare PCB images with AI",
        icon: <Image className="w-4 h-4" />,
        path: "/Steps2"
    },
    {
        title: "Step 03",
        description: "View and export results PCB",
        icon: <Download className="w-4 h-4" />,
        path: "/Steps3"
    },
];

const AnalysisBar = ({ activeStep }) => {
    const navigate = useNavigate();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            if (window.innerWidth > 1024) {
                setIsMobileOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleStepClick = (index) => {
        if (index > activeStep) {
            const notification = document.createElement('div');
            notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-md bg-red-600 text-white shadow-lg animate-fade-in`;
            notification.innerHTML = `
                <div class="flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Complete step ${activeStep + 1} first</span>
                </div>
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.classList.add('animate-fade-out');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
            return;
        }
        navigate(steps[index].path);
        if (windowWidth <= 1024) {
            setIsMobileOpen(false);
        }
    };

    return (
        <>
            {/* Mobile toggle button */}
            <button
                className={`lg:hidden fixed left-4 top-4 z-50 p-2 rounded-md bg-gray-800 text-white shadow-lg transition-all duration-300 ${isMobileOpen ? 'bg-blue-600' : 'bg-gray-800'}`}
                onClick={() => setIsMobileOpen(!isMobileOpen)}
            >
                {isMobileOpen ? (
                    <X className="w-5 h-5" />
                ) : (
                    <Menu className="w-5 h-5" />
                )}
            </button>

            {/* Sidebar */}
            <div className={`
                fixed top-0 left-0 h-full w-72 bg-gray-900 border-r border-gray-800 shadow-xl z-40
                transform transition-transform duration-300 ease-in-out
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            `}>
                <div className="relative h-full overflow-y-auto p-6">
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full opacity-5">
                            <div className="absolute inset-0 bg-grid-gray-800"></div>
                        </div>
                        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-purple-700/10 rounded-full filter blur-3xl"></div>
                        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-700/10 rounded-full filter blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center mb-8">
                            <div className="bg-gradient-to-r from-blue-500 to-cyan-400 w-2 h-6 rounded-full mr-3"></div>
                            <h2 className="text-xl font-semibold text-white">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                                    PCB Analysis
                                </span>
                                <span className="block h-0.5 w-full bg-gradient-to-r from-blue-500/50 to-transparent mt-1"></span>
                            </h2>
                        </div>

                        <div className="relative pl-10 space-y-8">
                            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-blue-400 to-gray-700">
                                {steps.map((_, index) => (
                                    <div
                                        key={index}
                                        className={`absolute left-0 transform -translate-x-1/2 w-3 h-3 rounded-full transition-all duration-300 ${index <= activeStep
                                            ? "bg-blue-500 ring-4 ring-blue-500/30"
                                            : "bg-gray-600"
                                            }`}
                                        style={{ top: `${(index * 76) / (steps.length - 1)}%` }}
                                    />
                                ))}
                            </div>

                            {steps.map((step, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleStepClick(index)}
                                    className={`relative group transition-all duration-200 ${index <= activeStep ? "cursor-pointer" : "cursor-not-allowed"}`}
                                >
                                    {/* Step indicator */}
                                    <div
                                        className={`absolute left-0 ml-4 transform -translate-x-1/2 flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all duration-300 ${index < activeStep
                                            ? "border-green-500 bg-green-500/10 group-hover:bg-green-500/20 shadow-sm"
                                            : index === activeStep
                                                ? "border-blue-500 bg-blue-500/10 group-hover:bg-blue-500/20 shadow-sm"
                                                : "border-gray-600 bg-gray-800"
                                            }`}
                                    >
                                        {index <= activeStep ? (
                                            index === activeStep ? (
                                                <span className="text-blue-400">
                                                    {step.icon}
                                                </span>
                                            ) : (
                                                <span className="text-green-400">
                                                    {/* {step.icon} */}
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-gray-500">
                                                <Lock className="w-4 h-4" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Step content */}
                                    <div className={`ml-12 p-3 rounded-lg transition-all duration-200 ${index < activeStep
                                        ? "bg-gray-800/50 border border-gray-700 group-hover:border-green-500/30 group-hover:translate-x-1"
                                        : index === activeStep
                                            ? "bg-gray-800 border border-blue-500/30 group-hover:translate-x-1"
                                            : "bg-gray-800/30 border border-gray-700"
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <h3 className={`text-sm font-medium ${index > activeStep
                                                ? "text-gray-500"
                                                : index === activeStep
                                                    ? "text-blue-400"
                                                    : "text-green-400"
                                                }`}>
                                                {step.title}
                                            </h3>
                                            {index <= activeStep && (
                                                <ChevronRight
                                                    className={`w-4 h-4 ${index === activeStep ? "text-blue-400" : "text-green-400"} opacity-0 group-hover:opacity-100 transition-opacity`}
                                                />
                                            )}
                                        </div>
                                        <p className={`mt-1 text-xs ${index > activeStep
                                            ? "text-gray-500"
                                            : "text-gray-400"
                                            }`}>
                                            {step.description}
                                        </p>
                                    </div>

                                    {/* Completion checkmark */}
                                    {index < activeStep && (
                                        <span className="absolute -left-4 top-0 flex h-10 w-10 ml-3 items-center justify-center">
                                            <div className="animate-ping absolute h-6 w-6 rounded-full bg-green-500/20"></div>
                                            <Check className="h-4 w-4 text-green-400 relative" />
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Progress indicator */}
                        <div className="mt-8 bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${(activeStep + 1) / steps.length * 100}%` }}
                            ></div>
                        </div>
                        <div className="text-right mt-2 text-xs text-gray-400">
                            Step {activeStep + 1} of {steps.length}
                        </div>
                    </div>
                </div>
            </div>

            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                ></div>
            )}
        </>
    );
};



export default AnalysisBar;
export { steps };