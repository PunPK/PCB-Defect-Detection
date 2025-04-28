"use client"

import { useState, useEffect } from "react"

export default function HomeTest() {
    const [originlImage, setoriginlImage] = useState(null)
    const [checkedImage, setCheckedImage] = useState(null)
    const [previewImage, setPreviewImage] = useState(null)

    // Load images from sessionStorage on component mount
    useEffect(() => {
        const storedLeft = sessionStorage.getItem('originlImage')
        const storedRight = sessionStorage.getItem('checkedImage')

        if (storedLeft) setoriginlImage(JSON.parse(storedLeft))
        if (storedRight) setCheckedImage(JSON.parse(storedRight))
    }, [])

    // Save images to sessionStorage whenever they change
    useEffect(() => {
        if (originlImage) {
            sessionStorage.setItem('originlImage', JSON.stringify(originlImage))
        } else {
            sessionStorage.removeItem('originlImage')
        }

        if (checkedImage) {
            sessionStorage.setItem('checkedImage', JSON.stringify(checkedImage))
        } else {
            sessionStorage.removeItem('checkedImage')
        }
    }, [originlImage, checkedImage])

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e, side) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files, side)
        }
    }

    const handleFileChange = (e, side) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files, side)
        }
    }

    const handleFiles = (fileList, side) => {
        const file = fileList[0] // Only take the first file

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

        if (side === 'left') {
            if (originlImage) URL.revokeObjectURL(originlImage.url) // Clean up previous image
            setoriginlImage(newImage)
        } else {
            if (checkedImage) URL.revokeObjectURL(checkedImage.url) // Clean up previous image
            setCheckedImage(newImage)
        }
    }

    const removeImage = (side) => {
        if (side === 'left') {
            if (originlImage) URL.revokeObjectURL(originlImage.url)
            setoriginlImage(null)
        } else {
            if (checkedImage) URL.revokeObjectURL(checkedImage.url)
            setCheckedImage(null)
        }
    }

    const openPreview = (image) => {
        setPreviewImage(image)
    }

    const closePreview = () => {
        setPreviewImage(null)
    }

    return (
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 p-4">
            {/* Original PCB Upload Panel */}
            <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden border border-blue-500">
                <div className="bg-blue-500 text-white font-medium py-3 px-4">Original PCB</div>

                <div className="p-4">
                    {!originlImage ? (
                        <div
                            className="border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'left')}
                            onClick={() => document.getElementById("originlImageInput")?.click()}
                        >
                            <p className="text-blue-500 text-sm font-medium">Click or Drop to Upload</p>
                            <p className="text-gray-500 text-xs mt-1">Supports JPG, PNG, GIF</p>
                            <button className="mt-2 bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm">
                                Click Open Cam
                            </button>
                            <input
                                id="originlImageInput"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleFileChange(e, 'left')}
                            />
                        </div>
                    ) : (
                        <div className="mt-4">
                            <div className="flex flex-col items-center">
                                <div
                                    className="relative group cursor-pointer"
                                    onClick={() => openPreview(originlImage)}
                                >
                                    <img
                                        src={originlImage.url}
                                        alt={originlImage.name}
                                        className="h-40 w-full object-contain rounded-md border border-gray-200"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                        <span className="text-white opacity-0 group-hover:opacity-100">Click to Preview</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between w-full mt-2 bg-gray-50 p-2 rounded-md">
                                    <span className="text-sm text-gray-700 truncate flex-1">{originlImage.name}</span>
                                    <button
                                        onClick={() => removeImage('left')}
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

            {/* PCB Checked Upload Panel */}
            <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden border border-blue-500">
                <div className="bg-blue-500 text-white font-medium py-3 px-4">PCB Checked</div>

                <div className="p-4">
                    {!checkedImage ? (
                        <div
                            className="border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'right')}
                            onClick={() => document.getElementById("checkedImageInput")?.click()}
                        >
                            <p className="text-blue-500 text-sm font-medium">Click or Drop to Upload</p>
                            <p className="text-gray-500 text-xs mt-1">Supports JPG, PNG, GIF</p>
                            <button className="mt-2 bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm">
                                Click Open Cam
                            </button>
                            <input
                                id="checkedImageInput"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleFileChange(e, 'right')}
                            />
                        </div>
                    ) : (
                        <div className="mt-4">
                            <div className="flex flex-col items-center">
                                <div
                                    className="relative group cursor-pointer"
                                    onClick={() => openPreview(checkedImage)}
                                >
                                    <img
                                        src={checkedImage.url}
                                        alt={checkedImage.name}
                                        className="h-40 w-full object-contain rounded-md border border-gray-200"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                        <span className="text-white opacity-0 group-hover:opacity-100">Click to Preview</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between w-full mt-2 bg-gray-50 p-2 rounded-md">
                                    <span className="text-sm text-gray-700 truncate flex-1">{checkedImage.name}</span>
                                    <button
                                        onClick={() => removeImage('right')}
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