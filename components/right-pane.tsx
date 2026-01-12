import { FileTextIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RightPaneProps {
    selectedSource: { title: string; content?: string } | null
    onClose: () => void
}

export function RightPane({ selectedSource, onClose }: RightPaneProps) {
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
            <ScrollArea className="flex-1 p-4">
                {selectedSource ? (
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg border-b pb-2">{selectedSource.title}</h3>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                            {selectedSource.content || "このドキュメントのプレビューは利用できません。"}
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground text-center mt-10">
                        <p>回答の根拠となる規約等がここに表示されます</p>
                    </div>
                )}
            </ScrollArea>
        </aside>
    )
}
