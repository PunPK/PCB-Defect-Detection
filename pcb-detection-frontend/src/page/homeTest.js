"use client"
import { useState, useEffect, useRef } from 'react'

export default function PCBLiveDetection() {
    const [cameraFeed, setCameraFeed] = useState(null)
    const [pcbImage, setPcbImage] = useState(null)
    const [isConnected, setIsConnected] = useState(false)
    const [status, setStatus] = useState('Disconnected')
    const [fps, setFps] = useState(0)
    const wsRef = useRef(null)
    const frameCountRef = useRef(0)
    const timerRef = useRef(null)
    const imageQueueRef = useRef([])

    const processImageQueue = () => {
        if (imageQueueRef.current.length >= 2) {
            const [cameraData, pcbData] = imageQueueRef.current.splice(0, 2)

            // Process camera feed
            const cameraBlob = new Blob([cameraData], { type: 'image/jpeg' })
            const cameraUrl = URL.createObjectURL(cameraBlob)
            setCameraFeed(prev => {
                if (prev) URL.revokeObjectURL(prev)
                return cameraUrl
            })

            // Process PCB image
            if (pcbData && pcbData.length > 100) { // Check if not empty frame
                const pcbBlob = new Blob([pcbData], { type: 'image/jpeg' })
                const pcbUrl = URL.createObjectURL(pcbBlob)
                setPcbImage(prev => {
                    if (prev) URL.revokeObjectURL(prev)
                    return pcbUrl
                })
            } else {
                setPcbImage(null)
            }

            frameCountRef.current++
        }
    }

    const createWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close()
        }

        setStatus('Connecting...')
        setIsConnected(false)
        imageQueueRef.current = []

        const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/pcb-detection`)
        wsRef.current = ws

        ws.onopen = () => {
            setIsConnected(true)
            setStatus('Connected - Detecting PCB...')
            startFpsCounter()
        }

        ws.onmessage = (event) => {
            if (event.data instanceof Blob) {
                const reader = new FileReader()
                reader.onload = () => {
                    imageQueueRef.current.push(new Uint8Array(reader.result))
                    processImageQueue()
                }
                reader.readAsArrayBuffer(event.data)
            }
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
            setStatus(`Error: ${error.message || 'Connection failed'}`)
            stopDetection()
        }

        ws.onclose = () => {
            stopDetection()
        }
    }

    const startDetection = () => {
        createWebSocket()
    }

    const stopDetection = () => {
        stopFpsCounter()
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setIsConnected(false)
        setStatus('Disconnected')
        setFps(0)
        imageQueueRef.current = []

        if (cameraFeed) {
            URL.revokeObjectURL(cameraFeed)
            setCameraFeed(null)
        }
        if (pcbImage) {
            URL.revokeObjectURL(pcbImage)
            setPcbImage(null)
        }
    }

    const startFpsCounter = () => {
        frameCountRef.current = 0
        timerRef.current = setInterval(() => {
            setFps(frameCountRef.current)
            frameCountRef.current = 0
        }, 1000)
    }

    const stopFpsCounter = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    useEffect(() => {
        return () => {
            stopDetection()
        }
    }, [])

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">PCB Live Detection</h1>

            <div className="flex flex-wrap gap-4 mb-4 items-center">
                <button
                    onClick={startDetection}
                    disabled={isConnected}
                    className={`bg-blue-500 text-white py-2 px-4 rounded-md ${isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                        }`}
                >
                    Start Detection
                </button>
                <button
                    onClick={stopDetection}
                    disabled={!isConnected}
                    className={`bg-red-500 text-white py-2 px-4 rounded-md ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                        }`}
                >
                    Stop Detection
                </button>

                <div className="flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <span className={`font-medium ${status.includes('Detected') ? 'text-green-600' :
                        status.includes('Error') ? 'text-red-600' : 'text-blue-600'
                        }`}>
                        {status}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-medium">FPS:</span>
                    <span className="font-medium text-purple-600">{fps}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Camera Feed with PCB Outline */}
                <div className="border border-gray-300 rounded-md p-2">
                    <h2 className="text-lg font-semibold mb-2">Camera View</h2>
                    {cameraFeed ? (
                        <img
                            src={cameraFeed}
                            alt="Camera Feed with PCB Outline"
                            className="w-full h-auto max-h-[70vh] object-contain"
                        />
                    ) : (
                        <div className="bg-gray-100 h-48 flex items-center justify-center">
                            <p className="text-gray-500">
                                {isConnected ? 'Waiting for frames...' : 'Camera feed inactive'}
                            </p>
                        </div>
                    )}
                    <p className="text-sm text-gray-500 mt-2">Green outline shows detected PCB</p>
                </div>

                {/* Cropped PCB Image */}
                <div className="border border-gray-300 rounded-md p-2">
                    <h2 className="text-lg font-semibold mb-2">Cropped PCB</h2>
                    {pcbImage ? (
                        <img
                            src={pcbImage}
                            alt="Cropped PCB"
                            className="w-full h-auto max-h-[70vh] object-contain"
                        />
                    ) : (
                        <div className="bg-gray-100 h-48 flex items-center justify-center">
                            <p className="text-gray-500">
                                {isConnected ? 'No PCB detected' : 'PCB view inactive'}
                            </p>
                        </div>
                    )}
                    <p className="text-sm text-gray-500 mt-2">Perspective-corrected PCB view</p>
                </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
                <p>Running on Raspberry Pi 4 - WebSocket Stream</p>
                <p>Camera resolution: 640x480 @ ~10 FPS</p>
            </div>
        </div>
    )
}