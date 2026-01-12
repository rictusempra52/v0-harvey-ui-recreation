"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { HomeIcon, CheckIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

const DUMMY_MANSIONS = [
    "グランドメゾン恵比寿",
    "パークハビオ新宿ビル",
    "プラウドタワー千代田",
    "ザ・パークハウス晴海",
    "ブリリアタワー有明",
    "シティタワー武蔵小杉",
    "ヴィンテージ芝浦",
    "リビオレゾン板橋",
]

interface MansionSelectorProps {
    onSelect: (mansion: string) => void
}

export function MansionSelector({ onSelect }: MansionSelectorProps) {
    const [query, setQuery] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)

    const filteredMansions = DUMMY_MANSIONS.filter((mansion) =>
        mansion.toLowerCase().includes(query.toLowerCase())
    )

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // クエリが変わったら選択インデックスをリセット
    useEffect(() => {
        setSelectedIndex(-1)
    }, [query])

    const handleSelect = (mansion: string) => {
        setQuery(mansion)
        onSelect(mansion)
        setIsOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === "ArrowDown") {
                setIsOpen(true)
            }
            return
        }

        if (e.key === "ArrowDown") {
            e.preventDefault()
            setSelectedIndex((prev) => (prev + 1) % filteredMansions.length)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setSelectedIndex((prev) => (prev - 1 + filteredMansions.length) % filteredMansions.length)
        } else if (e.key === "Enter") {
            if (selectedIndex >= 0 && selectedIndex < filteredMansions.length) {
                handleSelect(filteredMansions[selectedIndex])
            }
        } else if (e.key === "Escape") {
            setIsOpen(false)
        }
    }

    return (
        <div className="max-w-xl mx-auto w-full py-4 mb-4 relative" ref={containerRef}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <HomeIcon className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                    type="text"
                    placeholder="マンション名を入力して選択してください..."
                    className="pl-12 h-14 text-lg rounded-2xl border-2 border-muted focus-visible:ring-primary focus-visible:border-primary transition-all shadow-sm"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setIsOpen(true)
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {isOpen && filteredMansions.length > 0 && (
                <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-xl border-2 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <ScrollArea className="max-h-[300px]">
                        <div className="p-2">
                            {filteredMansions.map((mansion, index) => (
                                <button
                                    key={mansion}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors flex items-center justify-between group ${index === selectedIndex ? "bg-primary/20" : "hover:bg-primary/10"
                                        }`}
                                    onClick={() => handleSelect(mansion)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <span className="text-lg font-medium">{mansion}</span>
                                    {(query === mansion || index === selectedIndex) && (
                                        <CheckIcon className={`h-5 w-5 ${query === mansion ? "text-primary" : "text-primary/40"}`} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            )}
        </div>
    )
}
