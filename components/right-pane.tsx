import { FileTextIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export function RightPane() {
    return (
        <aside className="hidden xl:flex w-80 flex-col border-l border-border bg-background">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    引用・参照
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <XIcon className="h-4 w-4" />
                </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="text-sm text-muted-foreground text-center mt-10">
                    <p>回答の根拠となる規約等がここに表示されます</p>
                </div>
            </ScrollArea>
        </aside>
    )
}
