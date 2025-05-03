"use client"
import { useState, useEffect, useRef } from 'react'

export default function PCBLiveDetection() {
    const [cameraFeed, setCameraFeed] = useState(null)
    const [pcbImage, setPcbImage] = useState(null)
    const [isDetecting, setIsDetecting] = useState(false)
    const [status, setStatus] = useState('Not connected')
    const wsRef = useRef(null)

    const startDetection = () => {
        if (wsRef.current) return
        
        setIsDetecting(true)
        setStatus('Connecting...')
        
        const ws = new WebSocket('ws://localhost:8000/ws/pcb-detection')
        wsRef.current = ws

        ws.onopen = () => {
            setStatus('Connected - Detecting PCB...')
        }

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            setCameraFeed(`data:image/jpeg;base64,${data.camera_feed}`)
            
            if (data.has_pcb) {
                setPcbImage(`data:image/jpeg;base64,${data.pcb_image}`)
                setStatus('PCB Detected!')
            } else {
                setPcbImage(null)
                setStatus('Scanning for PCB...')
            }
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
            setStatus('Connection error')
            setIsDetecting(false)
        }

        ws.onclose = () => {
            setStatus('Disconnected')
            setIsDetecting(false)
            wsRef.current = null
        }
    }

    const stopDetection = () => {
        if (wsRef.current) {
            wsRef.current.close()
        }
    }

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [])

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">PCB Live Detection</h1>
            
            <div className="flex gap-4 mb-4">
                <button
                    onClick={startDetection}
                    disabled={isDetecting}
                    className={`bg-blue-500 text-white py-2 px-4 rounded-md ${
                        isDetecting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                    }`}
                >
                    Start Detection
                </button>
                <button
                    onClick={stopDetection}
                    disabled={!isDetecting}
                    className={`bg-red-500 text-white py-2 px-4 rounded-md ${
                        !isDetecting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                    }`}
                >
                    Stop Detection
                </button>
            </div>
            
            <div className="mb-2">
                <p className={`font-medium ${
                    status.includes('Detected') ? 'text-green-600' : 
                    status.includes('error') ? 'text-red-600' : 'text-blue-600'
                }`}>
                    Status: {status}
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-300 rounded-md p-2">
                    <h2 className="text-lg font-semibold mb-2">Camera Feed</h2>
                    {cameraFeed ? (
                        <img 
                            src={cameraFeed} 
                            alt="Camera Feed"
                            className="w-full h-auto max-h-96 object-contain"
                        />
                    ) : (
                        <div className="bg-gray-100 h-48 flex items-center justify-center">
                            <p className="text-gray-500">No camera feed available</p>
                        </div>
                    )}
                </div>
                
                <div className="border border-gray-300 rounded-md p-2">
                    <h2 className="text-lg font-semibold mb-2">Extracted PCB</h2>
                    {pcbImage ? (
                        <img 
                            src={pcbImage} 
                            alt="Extracted PCB"
                            className="w-full h-auto max-h-96 object-contain"
                        />
                    ) : (
                        <div className="bg-gray-100 h-48 flex items-center justify-center">
                            <p className="text-gray-500">No PCB detected</p>
                        </div>
                    )}
                </div>
            </div>
            
            {pcbImage && (
                <div className="mt-4">
                    <h2 className="text-xl font-semibold mb-2">PCB Analysis</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-gray-300 rounded-md p-2">
                            <h3 className="font-medium mb-2">Copper Mask</h3>
                            {/* Placeholder for analysis results */}
                            <div className="bg-gray-100 h-48 flex items-center justify-center">
                                <p className="text-gray-500">Analysis results will appear here</p>
                            </div>
                        </div>
                        <div className="border border-gray-300 rounded-md p-2">
                            <h3 className="font-medium mb-2">Defects</h3>
                            {/* Placeholder for defects */}
                            <div className="bg-gray-100 h-48 flex items-center justify-center">
                                <p className="text-gray-500">Defect detection results</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}