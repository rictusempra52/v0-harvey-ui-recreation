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
    FileIcon,
    PencilIcon,
    AlertTriangleIcon
} from "lucide-react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
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
    const [uploadingFile, setUploadingFile] = useState<{ name: string, progress: number } | null>(null)
    const [editingDoc, setEditingDoc] = useState<Document | null>(null)
    const [newFileName, setNewFileName] = useState("")
    const [updating, setUpdating] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<{ id: string, path: string } | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

    const handleEditClick = (doc: Document) => {
        setEditingDoc(doc)
        setNewFileName(doc.file_name)
    }

    const handleUpdateName = async () => {
        if (!editingDoc || !newFileName.trim()) return

        setUpdating(true)
        const { error } = await supabase
            .from('documents')
            .update({ file_name: newFileName.trim() })
            .eq('id', editingDoc.id)

        if (error) {
            toast.error("名前の変更に失敗しました")
        } else {
            toast.success("名前を変更しました")
            setEditingDoc(null)
        }
        setUpdating(false)
    }

    const handleDelete = async (id: string, path: string) => {
        setDeleting(id)
        setConfirmDelete(null)

        try {
            // 1. Storageから削除 (GCS と Supabase Storage 両方を試みる)
            // GCSからの削除
            const { error: gcsError } = await supabase.functions.invoke('delete-gcs-object', {
                body: { filePaths: [path] }
            })
            if (gcsError) console.warn('GCS removal failed or skipped:', gcsError)

            // Supabase Storageからの削除 (互換性のため)
            await supabase.storage.from('pdfs').remove([path])

            // 2. DBから削除
            const { data, error: dbError } = await supabase
                .from('documents')
                .delete()
                .eq('id', id)
                .select()

            if (dbError) {
                console.error('DB deletion failed:', dbError)
                toast.error(`データベースからの削除に失敗しました: ${dbError.message}`)
            } else if (!data || data.length === 0) {
                toast.error("削除対象のデータが見つかりませんでした。権限がない可能性があります。")
            } else {
                toast.success("文書を完全に削除しました")
                setDocuments(prev => prev.filter(d => d.id !== id))
                setSelectedIds(prev => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
            }
        } catch (err: any) {
            console.error('Unexpected error during deletion:', err)
            toast.error("削除中に予期せぬエラーが発生しました")
        } finally {
            setDeleting(null)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return

        const idsToDelete = Array.from(selectedIds)
        const docsToDelete = documents.filter(doc => selectedIds.has(doc.id))

        setDeleting("bulk")
        setConfirmDelete(null)

        try {
            // 一括削除（GCS）
            const { error: gcsError } = await supabase.functions.invoke('delete-gcs-object', {
                body: { filePaths: docsToDelete.map(doc => doc.file_path) }
            })
            if (gcsError) console.warn('Bulk GCS removal failed:', gcsError)

            // 一括削除（Supabase Storage - 互換性のため）
            await supabase.storage.from('pdfs').remove(docsToDelete.map(doc => doc.file_path))

            // 一括削除（DB）
            const { data, error: dbError } = await supabase
                .from('documents')
                .delete()
                .in('id', idsToDelete)
                .select()

            if (dbError) {
                toast.error("データベースからの削除に失敗しました")
            } else if (data) {
                toast.success(`${data.length}件の文書を削除しました`)
                setDocuments(prev => prev.filter(d => !selectedIds.has(d.id)))
                setSelectedIds(new Set())
            }
        } catch (err) {
            toast.error("一括削除中にエラーが発生しました")
        } finally {
            setDeleting(null)
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === documents.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(documents.map(doc => doc.id)))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
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
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold">新規アップロード</h3>
                                            </div>
                                            <PdfUploader
                                                onUploadComplete={handleUploadComplete}
                                                onUploadStart={handleUploadStart}
                                                onProgress={handleProgress}
                                                apartmentId={selectedMansion.id}
                                            />
                                        </Card>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold">登録済みドキュメント ({documents.length})</h3>
                                                {selectedIds.size > 0 && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => setConfirmDelete({ id: "bulk", path: "bulk" })}
                                                        disabled={deleting !== null}
                                                        className="h-10 px-4"
                                                    >
                                                        <Trash2Icon className="h-4 w-4 mr-2" />
                                                        選択した{selectedIds.size}件を削除
                                                    </Button>
                                                )}
                                            </div>

                                            {loading ? (
                                                <div className="flex justify-center py-10">
                                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : documents.length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg">
                                                    ドキュメントはまだありません
                                                </div>
                                            ) : (
                                                <div className="border rounded-xl bg-card overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="hover:bg-transparent bg-muted/30">
                                                                <TableHead className="w-[50px]">
                                                                    <Checkbox
                                                                        checked={selectedIds.size === documents.length && documents.length > 0}
                                                                        onCheckedChange={toggleSelectAll}
                                                                        aria-label="すべて選択"
                                                                    />
                                                                </TableHead>
                                                                <TableHead className="min-w-[250px]">ファイル名</TableHead>
                                                                <TableHead>アップロード日</TableHead>
                                                                <TableHead>ステータス</TableHead>
                                                                <TableHead className="text-right">操作</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {/* アップロード中のプレースホルダー */}
                                                            {uploadingFile && (
                                                                <TableRow className="border-blue-100 bg-blue-50/20">
                                                                    <TableCell>
                                                                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-2">
                                                                            <FileTextIcon className="h-4 w-4 text-blue-500 animate-pulse" />
                                                                            <span className="font-medium text-blue-900 truncate max-w-[200px]">{uploadingFile.name}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <span className="text-sm text-blue-600">アップロード中...</span>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex gap-2">
                                                                            {getFileStatusBadge(false, uploadingFile.progress)}
                                                                            {getOcrStatusBadge('pending', false)}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Loader2 className="h-4 w-4 animate-spin inline-block" />
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}

                                                            {documents.map((doc) => (
                                                                <TableRow key={doc.id} className="group hover:bg-muted/50 transition-colors">
                                                                    <TableCell>
                                                                        <Checkbox
                                                                            checked={selectedIds.has(doc.id)}
                                                                            onCheckedChange={() => toggleSelect(doc.id)}
                                                                            aria-label={`${doc.file_name}を選択`}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                                                                                <FileTextIcon className="h-5 w-5 text-red-500" />
                                                                            </div>
                                                                            <span className="font-bold text-base text-card-foreground truncate max-w-[300px]">{doc.file_name}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <span className="text-sm font-medium text-muted-foreground">
                                                                            {new Date(doc.created_at).toLocaleDateString('ja-JP')}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-2">
                                                                            {getFileStatusBadge(true)}
                                                                            {getOcrStatusBadge(doc.ocr_status, true)}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                                                onClick={() => handleEditClick(doc)}
                                                                            >
                                                                                <PencilIcon className="h-5 w-5" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent"
                                                                                onClick={() => window.open(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pdfs/${doc.file_path}`, '_blank')}
                                                                            >
                                                                                <DownloadIcon className="h-5 w-5" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                onClick={() => setConfirmDelete({ id: doc.id, path: doc.file_path })}
                                                                                disabled={deleting === doc.id}
                                                                            >
                                                                                {deleting === doc.id ? (
                                                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                                                ) : (
                                                                                    <Trash2Icon className="h-5 w-5" />
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* 名前変更ダイアログ */}
                <Dialog open={!!editingDoc} onOpenChange={(open: boolean) => !open && setEditingDoc(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>文書名の変更</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">新しい名前</Label>
                                <Input
                                    id="name"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    className="h-12 text-lg"
                                    placeholder="文書名を入力してください"
                                />
                            </div>
                        </div>
                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditingDoc(null)} className="h-12 flex-1">
                                キャンセル
                            </Button>
                            <Button onClick={handleUpdateName} disabled={updating} className="h-12 flex-1">
                                {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                保存する
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 削除確認ダイアログ */}
                <AlertDialog open={!!confirmDelete} onOpenChange={(open: boolean) => !open && setConfirmDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                <AlertTriangleIcon className="h-6 w-6" />
                                {confirmDelete?.id === "bulk" ? "選択した文書の一括削除" : "文書の削除"}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-lg">
                                {confirmDelete?.id === "bulk"
                                    ? `選択された ${selectedIds.size} 件の文書をすべて削除してもよろしいですか？`
                                    : "この文書を削除してもよろしいですか？"
                                }
                                <br />
                                この操作は取り消せません。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="h-14 text-lg flex-1">
                                やめる（残す）
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    if (!confirmDelete) return
                                    if (confirmDelete.id === "bulk") {
                                        handleBulkDelete()
                                    } else {
                                        handleDelete(confirmDelete.id, confirmDelete.path)
                                    }
                                }}
                                className="h-14 text-lg bg-destructive hover:bg-destructive/90 flex-1"
                            >
                                はい、削除します
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
