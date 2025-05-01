"use client"
import { useState, useEffect } from "react"

export default function TestOpenCam() {
    const [image, setImage] = useState(null)
    const [originalImage, setOriginalImage] = useState(null)
    const [isWebcamOpen, setIsWebcamOpen] = useState(false)
    const [isCapturing, setIsCapturing] = useState(false)
    const [isProcess, setIsProcess] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)

    // Load image from sessionStorage on component mount
    useEffect(() => {
        const storedImage = sessionStorage.getItem('originalImage')
        if (storedImage) setOriginalImage(JSON.parse(storedImage))
    }, [])

    // Save image to sessionStorage when it changes
    useEffect(() => {
        if (originalImage) {
            sessionStorage.setItem('originalImage', JSON.stringify(originalImage))
        } else {
            sessionStorage.removeItem('originalImage')
        }
    }, [originalImage])

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files)
        }
    }

    const handleFileChange = (fileList) => {
        const file = fileList[0]
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file')
            return
        }

        const newImage = {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            url: URL.createObjectURL(file),
            file
        }
        setOriginalImage(newImage)
    }

    const openWebcam = () => {
        setIsWebcamOpen(true)
    }

    const captureImage = async () => {
        setIsCapturing(true)
        try {
            const response = await fetch('http://localhost:8000/capture', {
                method: 'POST'
            })

            if (!response.ok) throw new Error('Capture failed')

            const blob = await response.blob()
            const imageUrl = URL.createObjectURL(blob)

            setOriginalImage({
                id: `webcam-${Date.now()}`,
                url: imageUrl,
                name: 'Webcam Capture',
                blob
            })

            console.log(response)

            setIsWebcamOpen(false)
        } catch (error) {
            console.error('Error capturing image:', error)
            alert('Failed to capture image')
        } finally {
            setIsCapturing(false)
        }
    }

    const processImage = async () => {
        if (!image) return

        try {
            const formData = new FormData()
            formData.append('file', image.blob, 'pcb.jpg')

            const response = await fetch('http://localhost:8000/process', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) throw new Error('Processing failed')

            const processedBlob = await response.blob()
            const processedUrl = URL.createObjectURL(processedBlob)

            setImage(prev => ({
                ...prev,
                processedUrl
            }))

        } catch (error) {
            console.error('Error processing image:', error)
        } finally {
            setIsCapturing(false)
        }
    }

    const removeImage = () => {
        if (originalImage) {
            URL.revokeObjectURL(originalImage.url)
            setOriginalImage(null)
        }
    }

    const openPreview = (image) => {
        setPreviewImage(image)
    }

    const closePreview = () => {
        setPreviewImage(null)
    }

    return (
        <div className="w-full lg:w-[1200px] mt-11 lg:ml-96 max-w-7xl p-4">
            <div className="mx-auto max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg xl:max-w-screen-xl text-center mb-8 lg:mb-16">
                <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
                    PCB Webcam Capture
                </h2>
                <p className="font-light text-gray-500 lg:mb-16 sm:text-xl dark:text-gray-400">
                    Capture PCB images using your webcam
                </p>
            </div>

            <div className="flex justify-center">
                <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden border border-blue-500">
                    <div className="bg-blue-500 text-white font-medium py-3 px-4">Original PCB</div>
                    <div className="p-4">
                        {!originalImage ? (
                            <div className="space-y-4">
                                <div
                                    className="border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onClick={() => document.getElementById("fileInput")?.click()}
                                >
                                    <p className="text-blue-500 text-sm font-medium">Click or Drop to Upload</p>
                                    <p className="text-gray-500 text-xs mt-1">Supports JPG, PNG, GIF</p>
                                    <input
                                        id="fileInput"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleFileChange(e.target.files)}
                                    />
                                </div>

                                <div className="flex flex-col items-center space-y-2">
                                    <div className="w-full border-t border-gray-200 my-2"></div>
                                    <p className="text-gray-500 text-sm">OR</p>
                                    <button
                                        onClick={openWebcam}
                                        className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                                    >
                                        Open Webcam
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4">
                                <div className="flex flex-col items-center">
                                    <div
                                        className="relative group cursor-pointer"
                                        onClick={() => openPreview(originalImage)}
                                    >
                                        <img
                                            src={originalImage.url}
                                            alt={originalImage.name}
                                            className="h-40 w-full object-contain rounded-md border border-gray-200"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                            <span className="text-white opacity-0 group-hover:opacity-100">Click to Preview</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between w-full mt-2 bg-gray-50 p-2 rounded-md">
                                        <span className="text-sm text-gray-700 truncate flex-1">
                                            {originalImage.name}
                                        </span>
                                        <button
                                            onClick={removeImage}
                                            className="text-red-500 hover:text-red-700 ml-2"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Webcam Modal */}
            {isWebcamOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium">Webcam Capture</h3>
                            <button
                                onClick={() => setIsWebcamOpen(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="bg-gray-200 h-64 flex items-center justify-center mb-4">
                            <p className="text-gray-500">
                                Webcam will be opened on the server when you click Capture
                            </p>
                        </div>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={captureImage}
                                disabled={isCapturing}
                                className={`bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md ${isCapturing ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                            >
                                {isCapturing ? 'Capturing...' : 'Capture'}
                            </button>
                            <button
                                onClick={processImage}
                                disabled={isProcess}
                                className={`bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md ${isCapturing ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                            >
                                {isProcess ? 'Processing...' : 'Process'}
                            </button>
                            <button
                                onClick={() => setIsWebcamOpen(false)}
                                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={closePreview}>
                    <div className="relative max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button
                            className="absolute -top-10 right-0 text-white hover:text-gray-300"
                            onClick={closePreview}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={previewImage.url}
                            alt={previewImage.name}
                            className="max-w-full max-h-[80vh] object-contain mx-auto"
                        />
                        <div className="mt-2 text-center text-white">
                            {previewImage.name}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}