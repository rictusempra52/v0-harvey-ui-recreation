"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    HomeIcon,
    SettingsIcon,
    FileTextIcon,
    Trash2Icon,
    DownloadIcon,
    Loader2,
    FileIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { MansionSelector } from "@/components/mansion-selector"
import { PdfUploader } from "@/components/pdf-uploader"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

type Document = {
    id: string
    file_name: string
    file_path: string
    file_size: number
    ocr_status: 'pending' | 'processing' | 'completed' | 'failed'
    created_at: string
}

export default function DocumentsPage() {
    const router = useRouter()
    const { user } = useAuth()
    const [selectedMansion, setSelectedMansion] = useState<{ name: string, id: string } | null>(null)
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [uploadingFile, setUploadingFile] = useState<{ name: string, progress: number } | null>(null)

    const supabase = createClient()

    // ドキュメント一覧取得
    useEffect(() => {
        if (!selectedMansion?.id) {
            setDocuments([])
            return
        }

        const fetchDocuments = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('apartment_id', selectedMansion.id)
                .order('created_at', { ascending: false })

            if (!error && data) {
                setDocuments(data)
            }
            setLoading(false)
        }

        fetchDocuments()
    }, [selectedMansion, supabase])

    // Realtime購読を追加
    useEffect(() => {
        if (!selectedMansion?.id) return

        const channel = supabase
            .channel(`documents-realtime-${selectedMansion.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'documents',
                    filter: `apartment_id=eq.${selectedMansion.id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setDocuments(prev => {
                            if (prev.find(d => d.id === payload.new.id)) return prev
                            return [payload.new as Document, ...prev]
                        })
                    } else if (payload.eventType === 'UPDATE') {
                        setDocuments(prev => prev.map(d =>
                            d.id === payload.new.id ? { ...d, ...payload.new } as Document : d
                        ))
                    } else if (payload.eventType === 'DELETE') {
                        setDocuments(prev => prev.filter(d => d.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedMansion, supabase])

    const handleMansionSelect = (name: string, id?: string) => {
        if (id) {
            setSelectedMansion({ name, id })
        }
    }

    const handleUploadComplete = async (path: string, fileName: string) => {
        if (!selectedMansion?.id) return

        // DBにメタデータを保存
        const { data, error } = await supabase
            .from('documents')
            .insert({
                apartment_id: selectedMansion.id,
                file_name: fileName,
                file_path: path,
                file_size: 0, // サイズは本来useUploadから取得すべきだが仮で0
                ocr_status: 'pending'
            })
            .select()
            .single()

        if (!error && data) {
            setDocuments(prev => [data, ...prev])
        }
        setUploadingFile(null)
    }

    const handleUploadStart = useCallback((name: string) => {
        setUploadingFile({ name, progress: 0 })
    }, [])

    const handleProgress = useCallback((progress: number) => {
        setUploadingFile(prev => prev ? { ...prev, progress } : null)
    }, [])

    const handleDelete = async (id: string, path: string) => {
        setDeleting(id)

        // 1. Storageから削除（本来はDB削除トリガーでやるべきだが今回は手動）
        // バケット名は固定で 'pdfs'
        const { error: storageError } = await supabase.storage
            .from('pdfs')
            .remove([path])

        if (storageError) {
            console.error('Storage update failed:', storageError)
        }

        // 2. DBから削除
        const { error: dbError } = await supabase
            .from('documents')
            .delete()
            .eq('id', id)

        if (!dbError) {
            setDocuments(prev => prev.filter(d => d.id !== id))
        }
        setDeleting(null)
    }

    const getFileStatusBadge = (isUploaded: boolean, progress: number = 0) => {
        const badgeClass = "text-sm px-3 py-1 font-medium"
        if (!isUploaded) {
            return (
                <Badge variant="secondary" className={cn("bg-blue-100 text-blue-700 border-blue-200 animate-pulse", badgeClass)}>
                    アップロード中 ({progress}%)
                </Badge>
            )
        }
        return (
            <Badge variant="outline" className={cn("text-emerald-600 border-emerald-200 bg-emerald-50", badgeClass)}>
                ✅ アップロード完了
            </Badge>
        )
    }

    const getOcrStatusBadge = (status: string, isUploaded: boolean) => {
        const badgeClass = "text-sm px-3 py-1 font-medium"
        if (!isUploaded) {
            return <Badge variant="outline" className={cn("text-muted-foreground bg-muted/50", badgeClass)}>待機中</Badge>
        }

        switch (status) {
            case 'completed':
                return <Badge className={cn("bg-green-600 hover:bg-green-700 text-white", badgeClass)}>OCR完了</Badge>
            case 'processing':
                return <Badge className={cn("bg-amber-500 hover:bg-amber-600 text-white", badgeClass)}>OCR処理中...</Badge>
            case 'failed':
                return <Badge variant="destructive" className={badgeClass}>OCR失敗</Badge>
            case 'pending':
                return <Badge variant="secondary" className={cn("bg-slate-200 text-slate-700", badgeClass)}>OCR待ち</Badge>
            default:
                return <Badge variant="secondary" className={badgeClass}>不明</Badge>
        }
    }

    return (
        <ResizablePanelGroup direction="horizontal" className="h-dvh bg-background text-foreground">
            {/* サイドバー（デスクトップ） */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="hidden lg:flex flex-col border-r border-border bg-sidebar">
                <Sidebar />
            </ResizablePanel>

            <ResizableHandle withHandle className="hidden lg:flex" />

            {/* メインコンテンツ */}
            <ResizablePanel defaultSize={80}>
                <div className="flex flex-col h-full overflow-hidden min-h-0 relative">
                    <header className="shrink-0 p-4 lg:p-8 border-b border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
                                <FileTextIcon className="h-8 w-8" />
                                文書管理
                            </h2>
                        </div>

                        <div className="max-w-2xl">
                            <MansionSelector onSelect={handleMansionSelect} />
                        </div>
                    </header>

                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full p-4 lg:p-8">
                            <div className="max-w-5xl mx-auto space-y-8">
                                {!selectedMansion ? (
                                    <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed border-muted">
                                        <h3 className="text-xl font-semibold mb-2">マンションを選択してください</h3>
                                        <p className="text-muted-foreground">文書を管理するには、対象のマンションを選択する必要があります。</p>
                                    </div>
                                ) : (
                                    <>
                                        <Card className="p-6">
                                            <h3 className="text-lg font-semibold mb-4">新規アップロード</h3>
                                            <PdfUploader
                                                onUploadComplete={handleUploadComplete}
                                                onUploadStart={handleUploadStart}
                                                onProgress={handleProgress}
                                            />
                                        </Card>

                                        <div className="space-y-4">
                                            <h3 className="text-lg font-semibold">登録済みドキュメント ({documents.length})</h3>

                                            {loading ? (
                                                <div className="flex justify-center py-10">
                                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : documents.length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg">
                                                    ドキュメントはまだありません
                                                </div>
                                            ) : (
                                                <div className="grid gap-4">
                                                    {/* アップロード中のプレースホルダー */}
                                                    {uploadingFile && (
                                                        <Card className="p-4 flex items-center justify-between border-blue-200 bg-blue-50/30">
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                                    <FileTextIcon className="h-5 w-5 text-blue-600 animate-bounce" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold truncate text-blue-900">{uploadingFile.name}</p>
                                                                    <div className="flex items-center gap-3 mt-1">
                                                                        {getFileStatusBadge(false, uploadingFile.progress)}
                                                                        {getOcrStatusBadge('pending', false)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                                                        </Card>
                                                    )}

                                                    {documents.map((doc) => (
                                                        <Card key={doc.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors border-border/60">
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                                                                    <FileTextIcon className="h-6 w-6 text-red-500" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-lg truncate mb-1">{doc.file_name}</p>
                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                        <span className="text-sm text-muted-foreground font-medium">
                                                                            {new Date(doc.created_at).toLocaleDateString('ja-JP')}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            {getFileStatusBadge(true)}
                                                                            {getOcrStatusBadge(doc.ocr_status, true)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pdfs/${doc.file_path}`, '_blank')}
                                                                >
                                                                    <DownloadIcon className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                                    onClick={() => handleDelete(doc.id, doc.file_path)}
                                                                    disabled={deleting === doc.id}
                                                                >
                                                                    {deleting === doc.id ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Trash2Icon className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
