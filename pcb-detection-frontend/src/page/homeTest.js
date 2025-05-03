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

    const createWebSocket = () => {
        // Close existing connection if any
        if (wsRef.current) {
            wsRef.current.close()
        }

        setStatus('Connecting...')
        setIsConnected(false)

        const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/pcb-detection`)
        wsRef.current = ws

        ws.onopen = () => {
            setIsConnected(true)
            setStatus('Connected - Detecting PCB...')
            startFpsCounter()
        }

        ws.onmessage = (event) => {
            frameCountRef.current++

            try {
                const blob = new Blob([event.data], { type: 'image/jpeg' })
                const imageUrl = URL.createObjectURL(blob)
                setCameraFeed(imageUrl)

                // Clean up previous URL if exists
                if (cameraFeed) {
                    URL.revokeObjectURL(cameraFeed)
                }
            } catch (error) {
                console.error('Error processing frame:', error)
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

        // Clean up image URLs
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

            <div className="grid grid-cols-1 gap-4">
                <div className="border border-gray-300 rounded-md p-2">
                    <h2 className="text-lg font-semibold mb-2">Camera Feed</h2>
                    {cameraFeed ? (
                        <img
                            src={cameraFeed}
                            alt="Camera Feed"
                            className="w-full h-auto max-h-[70vh] object-contain"
                        />
                    ) : (
                        <div className="bg-gray-100 h-48 flex items-center justify-center">
                            <p className="text-gray-500">
                                {isConnected ? 'Waiting for frames...' : 'Camera feed inactive'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
                <p>Running on Raspberry Pi 4 - WebSocket Stream</p>
                <p>Camera resolution: 640x480 @ ~10 FPS</p>
            </div>
        </div>
    )
}