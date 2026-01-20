"use client"

import { useState, useEffect } from "react"
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
    }

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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500 hover:bg-green-600">OCR完了</Badge>
            case 'processing':
                return <Badge className="bg-blue-500 hover:bg-blue-600">処理中</Badge>
            case 'failed':
                return <Badge variant="destructive">失敗</Badge>
            default:
                return <Badge variant="secondary">待機中</Badge>
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
                                            <PdfUploader onUploadComplete={handleUploadComplete} />
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
                                                    {documents.map((doc) => (
                                                        <Card key={doc.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors">
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                                                    <FileTextIcon className="h-5 w-5 text-red-600" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-medium truncate">{doc.file_name}</p>
                                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                        <span>{new Date(doc.created_at).toLocaleDateString('ja-JP')}</span>
                                                                        <span>•</span>
                                                                        {getStatusBadge(doc.ocr_status)}
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
