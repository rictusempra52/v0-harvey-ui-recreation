"use client"

import { useState, useRef, useEffect } from "react"
import { UploadCloudIcon, FileTextIcon, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUpload } from "@/hooks/use-upload"
import { cn } from "@/lib/utils"

type PdfUploaderProps = {
    onUploadComplete?: (path: string, fileName: string) => void
    onUploadStart?: (fileName: string) => void
    onProgress?: (progress: number) => void
    className?: string
}

export function PdfUploader({ onUploadComplete, onUploadStart, onProgress, className }: PdfUploaderProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { uploadFile, uploading, progress, error } = useUpload()

    // 進捗の通知
    useEffect(() => {
        if (uploading && file) {
            onProgress?.(progress)
        }
    }, [progress, uploading, file, onProgress])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile && droppedFile.type === "application/pdf") {
            setFile(droppedFile)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
        }
    }

    const handleUpload = async () => {
        if (!file) return

        onUploadStart?.(file.name)
        const result = await uploadFile({ file })

        if (result) {
            onUploadComplete?.(result.path, file.name)
            setFile(null) // リセット
        }
    }

    return (
        <div className={cn("w-full max-w-md mx-auto", className)}>
            <div
                className={cn(
                    "border-2 border-dashed rounded-xl p-8 transition-colors text-center cursor-pointer",
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                    file ? "bg-accent/50 border-solid" : ""
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    disabled={uploading}
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">アップロード中... ({progress}%)</p>
                    </div>
                ) : file ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileTextIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium text-lg">{file.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <div className="flex gap-2 w-full mt-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                                className="flex-1"
                                onClick={handleUpload}
                            >
                                アップロード
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setFile(null)}
                            >
                                キャンセル
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                            <UploadCloudIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg">PDFをアップロード</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            クリックしてファイルを選択するか、ここにドラッグ＆ドロップしてください
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                    {error.message}
                </div>
            )}
        </div>
    )
}
