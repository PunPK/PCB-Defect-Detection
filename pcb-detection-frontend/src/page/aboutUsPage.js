import React from "react";

export default function AboutUs() {
    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
            <div className="max-w-3xl w-full bg-gray-800 rounded-2xl shadow-xl p-10 space-y-6">
                <h1 className="text-4xl font-bold text-cyan-400">About Me</h1>
                <p className="text-lg leading-relaxed text-gray-300">
                    Welcome to our project! This website is part of an innovative solution designed for the National Software Contest (NSC Thailand). Our mission is to enhance industrial efficiency through the application of cutting-edge technologies.
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
        </div>
    );
}
