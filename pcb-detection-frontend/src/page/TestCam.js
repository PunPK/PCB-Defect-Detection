import { useState, useEffect, useRef } from 'react';

export default function TestCam() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [status, setStatus] = useState('Press Start to begin');
    const [fps, setFps] = useState(0);
    const videoRef = useRef(null);
    const wsRef = useRef(null);
    const frameCountRef = useRef(0);
    const timerRef = useRef(null);

    const startStreaming = async () => {
        try {
            setStatus('Accessing camera...');

            wsRef.current = new WebSocket(`ws://${window.location.hostname}:8000/ws/test-cam`);

            wsRef.current.onopen = () => {
                setIsStreaming(true);
                setStatus('Streaming to server...');
                startFpsCounter();
            };

            wsRef.current.onclose = () => {
                stopStreaming();
                setStatus('Disconnected from server');
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setStatus('Connection error');
            };

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const sendFrame = () => {
                if (!isStreaming || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

                if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(blob => {
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                            wsRef.current.send(blob);
                            frameCountRef.current++;
                        }
                    }, 'image/jpeg', 0.8);
                }

                requestAnimationFrame(sendFrame);
            };

            sendFrame();

        } catch (error) {
            console.error('Error accessing camera:', error);
            setStatus(`Error: ${error.message}`);
        }
    };

    const stopStreaming = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }

        stopFpsCounter();
        setIsStreaming(false);
        frameCountRef.current = 0;
    };

    const startFpsCounter = () => {
        stopFpsCounter();
        timerRef.current = setInterval(() => {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
        }, 1000);
    };

    const stopFpsCounter = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            stopStreaming();
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">Camera Test</h1>

                <div className="flex flex-wrap gap-4 mb-4 items-center">
                    <button
                        onClick={isStreaming ? stopStreaming : startStreaming}
                        className={`px-4 py-2 rounded-md font-medium ${isStreaming
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        {isStreaming ? 'Stop' : 'Start'}
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Status:</span>
                            <span className={`font-medium ${status.includes('Error') ? 'text-red-400' :
                                isStreaming ? 'text-green-400' : 'text-blue-400'
                                }`}>
                                {status}
                            </span>
                        </div>

                        {isStreaming && (
                            <div className="flex items-center gap-2">
                                <span className="font-medium">FPS:</span>
                                <span className="font-mono">{fps}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-black rounded-lg overflow-hidden mb-4">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-auto max-h-[70vh] mx-auto"
                    />
                </div>

                <div className="bg-gray-800 p-4 rounded-lg">
                    <h2 className="text-lg font-semibold mb-2">Instructions</h2>
                    <ul className="list-disc pl-5 space-y-1 text-gray-300">
                        <li>Click "Start" to begin camera streaming</li>
                        <li>The video will be sent to the server via WebSocket</li>
                        <li>FPS counter shows frames sent per second</li>
                        <li>Click "Stop" to end the streaming</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}