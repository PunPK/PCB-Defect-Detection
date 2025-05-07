import React from "react";
import { Radar, Cpu } from "lucide-react"

export default function AboutUs() {
    return (
        <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden opacity-20">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxkZWZzPjxwYXR0ZXJuIGlkPSJwYXR0ZXJuIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHBhdHRlcm5UcmFuc2Zvcm09InJvdGF0ZSg0NSkiPjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPjwvc3ZnPg==')]"></div>
            </div>

            {/* Main content */}
            <div className="relative z-10 container mx-auto px-6 py-16 flex items-center justify-center">
                <div className="max-w-4xl w-full">
                    <div className="mb-12 text-center">
                        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-4">
                            About Our <span className="text-white">Innovation</span>
                        </h1>
                        <div className="w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-600 mx-auto rounded-full"></div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-2xl shadow-xl p-10 space-y-6">
                        <h2 className="text-2xl font-bold text-white mb-4">Welcome to Project : <span className="text-cyan-300 font-semibold">This PCB is suspicious</span></h2>
                        <p className="text-lg leading-relaxed text-gray-300">
                            Welcome to our project! This website is part of an innovative solution designed for the National Software Contest 2025 (NSC Thailand 2025). Our mission is to enhance industrial efficiency through the application of cutting-edge technologies.
                        </p>
                        <p className="text-lg leading-relaxed text-gray-300">
                            The core of our system is powered by <span className="text-cyan-300 font-semibold">Artificial Intelligence</span> that accurately inspects copper trace patterns on PCB (Printed Circuit Boards). This ensures production quality and reduces manufacturing defects.
                        </p>
                        <p className="text-lg leading-relaxed text-gray-300">
                            We utilize a <span className="text-cyan-300 font-semibold">Raspberry Pi</span> as an edge computing device to perform real-time image processing and send inspection results to the central dashboard.
                        </p>
                        <p className="text-lg leading-relaxed text-gray-300">
                            The website interface, built with <span className="text-cyan-300 font-semibold">React</span> and styled using <span className="text-cyan-300 font-semibold">Tailwind CSS</span>, offers a seamless user experience for viewing error reports, analytics, and system status in real time.
                        </p>
                        <p className="text-lg leading-relaxed text-gray-300">
                            This project reflects our passion for technology and commitment to solving real-world problems through software innovation.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mb-12 mt-10">
                        {/* AI Card */}
                        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-cyan-400 transition-all duration-300 group">
                            <div className="flex items-center mb-4">
                                <div className="bg-cyan-900/30 p-3 rounded-lg mr-4 group-hover:bg-cyan-500 transition-colors">
                                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <Radar />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-cyan-400">AI Vision System</h3>
                            </div>
                            <p className="text-gray-300">
                                Our advanced AI inspects copper trace patterns on PCBs with 99.2% accuracy, reducing manufacturing defects by 40%. (suppose)
                            </p>
                        </div>

                        {/* IoT Card */}
                        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-blue-400 transition-all duration-300 group">
                            <div className="flex items-center mb-4">
                                <div className="bg-blue-900/30 p-3 rounded-lg mr-4 group-hover:bg-blue-500 transition-colors">
                                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <Cpu />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-blue-400">Edge Computing</h3>
                            </div>
                            <p className="text-gray-300">
                                Raspberry Pi clusters perform real-time processing at the edge, minimizing latency and bandwidth usage.
                            </p>
                        </div>
                    </div>

                    {/* Mission statement */}
                    <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/70 border border-gray-700 rounded-xl p-8 mb-8 backdrop-blur-sm">
                        <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
                        <p className="text-lg text-gray-300 leading-relaxed">
                            We're revolutionizing industrial quality control through cutting-edge AI and IoT technologies. Our solution for the National Software Contest (NSC Thailand) enhances PCB manufacturing efficiency by automating visual inspection with unprecedented accuracy.
                        </p>
                    </div>

                    {/* Tech stack */}
                    <div className="flex flex-wrap justify-center gap-4 mt-10">
                        <div className="tech-badge bg-cyan-900/20 border border-cyan-400/20">React.js</div>
                        <div className="tech-badge bg-blue-900/20 border border-blue-400/20">Tailwind CSS</div>
                        <div className="tech-badge bg-purple-900/20 border border-purple-400/20">FASTAPI</div>
                        <div className="tech-badge bg-green-900/20 border border-green-400/20">Python</div>
                        <div className="tech-badge bg-red-900/20 border border-red-400/20">Raspberry Pi</div>
                        <div className="tech-badge bg-yellow-900/20 border border-yellow-400/20">Node.js</div>
                    </div>
                </div>
            </div>

            <div className="absolute top-20 left-10 w-4 h-4 rounded-full bg-cyan-400 opacity-70 animate-pulse"></div>
            <div className="absolute bottom-1/4 right-20 w-3 h-3 rounded-full bg-blue-400 opacity-50 animate-pulse delay-300"></div>
            <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-purple-400 opacity-60 animate-pulse delay-700"></div>

            <style jsx>{`
                .tech-badge {
                    @apply px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm;
                    @apply transition-all duration-300 hover:scale-105 hover:opacity-100;
                }
            `}</style>
        </div>
    );
}