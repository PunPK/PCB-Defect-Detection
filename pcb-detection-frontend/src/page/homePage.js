"use client"

import { useState } from "react"
// import { X, Upload } from "lucide-react"

export default function FileUpload() {
    const [files, setFiles] = useState([
        { id: "1", name: "document.folder.pdf", type: "pdf" },
        { id: "2", name: "Resume.pdf", type: "pdf" },
        { id: "3", name: "Ravi Web.docx", type: "docx" },
    ])

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files)
        }
    }

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files)
        }
    }

    const handleFiles = (fileList) => {
        const newFiles = Array.from(fileList).map((file) => ({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            type: file.name.split(".").pop()?.toLowerCase() || "",
        }))

        setFiles((prev) => [...prev, ...newFiles])
    }

    const removeFile = (id) => {
        setFiles(files.filter((file) => file.id !== id))
    }

    const getFileIcon = (type) => {
        switch (type) {
            case "pdf":
                return <div className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">PDF</div>
            case "docx":
                return <div className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">Docx</div>
            default:
                return <div className="bg-gray-500 text-white text-xs font-bold px-2 py-0.5 rounded">File</div>
        }
    }

    return (
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 p-4">
            {/* First Upload Panel */}
            <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden border border-blue-500">
                <div className="bg-blue-500 text-white font-medium py-3 px-4">Upload File</div>

                <div className="p-4">
                    <div
                        className="border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById("fileInput")?.click()}
                    >
                        {/* <Upload className="h-10 w-10 text-blue-500 mb-2" /> */}
                        <p className="text-blue-500 text-sm font-medium">Click To Upload</p>
                        <input id="fileInput" type="file" multiple className="hidden" onChange={handleFileChange} />
                    </div>

                    {files.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-sm text-gray-500 mb-2">Uploaded Documents</h3>
                            <div className="space-y-2">
                                {files.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                                        <div className="flex items-center space-x-2">
                                            {getFileIcon(file.type)}
                                            <span className="text-sm text-gray-700">{file.name}</span>
                                        </div>
                                        <button onClick={() => removeFile(file.id)} className="text-blue-500 hover:text-blue-700">
                                            {/* <X className="h-4 w-4" /> */}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Second Upload Panel */}
            <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden border border-blue-500">
                <div className="bg-blue-500 text-white font-medium py-3 px-4">Upload File</div>

                <div className="p-4">
                    <div
                        className="border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById("fileInput2")?.click()}
                    >
                        {/* <Upload className="h-10 w-10 text-blue-500 mb-2" /> */}
                        <p className="text-blue-500 text-sm font-medium">Click To Upload</p>
                        <input id="fileInput2" type="file" multiple className="hidden" onChange={handleFileChange} />
                    </div>

                    {files.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-sm text-gray-500 mb-2">Uploaded Documents</h3>
                            <div className="space-y-2">
                                {files.map((file) => (
                                    <div
                                        key={`second-${file.id}`}
                                        className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                                    >
                                        <div className="flex items-center space-x-2">
                                            {getFileIcon(file.type)}
                                            <span className="text-sm text-gray-700">{file.name}</span>
                                        </div>
                                        <button onClick={() => removeFile(file.id)} className="text-blue-500 hover:text-blue-700">
                                            {/* <X className="h-4 w-4" /> */}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}