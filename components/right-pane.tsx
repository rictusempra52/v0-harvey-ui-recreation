import { FileTextIcon, XIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PdfViewer } from "@/components/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface RightPaneProps {
    selectedSource: {
        title: string;
        content?: string;
        annotations?: any[];
        fileId?: string;
        page?: string;
        blockId?: string;
    } | null
    onClose: () => void
}

export function RightPane({ selectedSource, onClose }: RightPaneProps) {
    const [filePath, setFilePath] = useState<string | null>(null)
    const [annotations, setAnnotations] = useState<any[] | undefined>(undefined)
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (selectedSource?.fileId) {
            const fetchDoc = async () => {
                setLoading(true)
                const { data, error } = await supabase
                    .from('documents')
                    .select('file_path, ocr_pages')
                    .eq('id', selectedSource.fileId)
                    .single()

                if (!error && data) {
                    setFilePath(data.file_path)

                    // 特定のブロックが指定されている場合、座標を抽出してハイライト用のアノテーションを作成
                    if (selectedSource.blockId && data.ocr_pages) {
                        const ocrData = data.ocr_pages as any
                        const pageNum = parseInt(selectedSource.page || "1")
                        const targetPage = ocrData.pages?.find((p: any) => p.page_number === pageNum)

                        if (targetPage && targetPage.blocks) {
                            // blockId (インデックス) に対応するブロックを探す
                            // 本来はID固定が望ましいが、今回は単純化のため検索インデックスと同じ順序を想定
                            // (index.ts で FLAT した順番)
                            const flatBlocks = ocrData.pages.flatMap((p: any) => p.blocks || [])
                            const targetBlock = flatBlocks[parseInt(selectedSource.blockId)]

                            if (targetBlock && targetBlock.quadPoints) {
                                const q = targetBlock.quadPoints
                                const w = targetPage.dimensions?.width || 1000
                                const h = targetPage.dimensions?.height || 1414

                                // Adobe format: [BL_x, BL_y, BR_x, BR_y, TL_x, TL_y, TR_x, TR_y]
                                // DAI sequence in index.ts: [TL_x, TL_y, TR_x, TR_y, BR_x, BR_y, BL_x, BL_y]
                                const adobeQuad = [
                                    q[6] * w, (1 - q[7]) * h, // BL
                                    q[4] * w, (1 - q[5]) * h, // BR
                                    q[0] * w, (1 - q[1]) * h, // TL
                                    q[2] * w, (1 - q[3]) * h  // TR
                                ]

                                const annotation = {
                                    "@context": ["https://www.w3.org/ns/anno.jsonld", "https://comments.acrobat.com/ns/anno.jsonld"],
                                    type: "Annotation",
                                    id: `anno-${Date.now()}`,
                                    bodyValue: selectedSource.content || "",
                                    motivation: "commenting",
                                    target: {
                                        source: selectedSource.fileId,
                                        selector: {
                                            type: "AdobeAnnoSelector",
                                            subtype: "highlight",
                                            boundingBox: [q[6] * w, (1 - q[7]) * h, q[2] * w, (1 - q[1]) * h],
                                            quadPoints: adobeQuad,
                                            strokeColor: "#ffcc00",
                                            opacity: 0.3
                                        }
                                    }
                                }
                                setAnnotations([annotation])
                            }
                        }
                    } else {
                        setAnnotations(undefined)
                    }
                }
                setLoading(false)
            }
            fetchDoc()
        } else {
            setFilePath(null)
            setAnnotations(undefined)
        }
    }, [selectedSource, supabase])

    const pdfUrl = filePath
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pdfs/${filePath}`
        : "/sample.pdf"

    return (
        <aside className="flex flex-col h-full w-full overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    引用・参照
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <XIcon className="h-4 w-4" />
                </Button>
            </div>
            {selectedSource ? (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="p-4 border-b flex items-center justify-between">
                        <h3 className="font-bold text-lg">{selectedSource.title}</h3>
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-h-0 relative">
                        <PdfViewer
                            key={`${selectedSource.fileId || selectedSource.title}-${filePath}-${selectedSource.blockId}`}
                            url={pdfUrl}
                            highlightText={selectedSource.content}
                            annotations={annotations || selectedSource.annotations}
                            fileId={selectedSource.fileId}
                        />
                    </div>
                </div>
            ) : (
                <ScrollArea className="flex-1 p-4">
                    <div className="text-sm text-muted-foreground text-center mt-10">
                        <p>回答の根拠となる規約等がここに表示されます</p>
                    </div>
                </ScrollArea>
            )}
        </aside>
    )
}
