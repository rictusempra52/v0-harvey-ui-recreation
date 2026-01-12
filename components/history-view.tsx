"use client"

import type React from "react"
import { SearchIcon, CalendarIcon, BuildingIcon, ChevronRightIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type HistoryItem = {
    id: string
    title: string
    date: string
    mansion: string
    preview: string
}

const dummyHistory: HistoryItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: `${i + 1}`,
    title: [
        "理事会の議事録作成",
        "定期清掃のお知らせ作成",
        "ゴミ出しルールの確認",
        "ペット飼育に関する規約確認",
        "駐車場の空き状況確認",
    ][i % 5],
    date: `2026/01/${12 - Math.floor(i / 3)}`,
    mansion: [
        "グランドハイツ代々木",
        "パークサイド恵比寿",
        "リバーサイド中目黒",
    ][i % 3],
    preview: "過去のやり取りのサンプルテキストです。スクロールして内容を確認できるかテストしています。高齢者の方でも読みやすいよう、リストの各項目はゆったりとした余白を持たせています。",
}))

export function HistoryView() {
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <div className="shrink-0 p-4 lg:p-8 border-b border-border space-y-4">
                <h2 className="text-2xl lg:text-3xl font-bold">過去の履歴</h2>
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="履歴を検索..."
                        className="pl-10 h-12 lg:h-14 text-base lg:text-lg"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 h-full">
                <div className="p-4 lg:p-8 space-y-4 max-w-5xl mx-auto">
                    {dummyHistory.map((item) => (
                        <Card
                            key={item.id}
                            className="p-4 lg:p-6 cursor-pointer hover:bg-accent/50 transition-colors border-border/50 group"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs font-normal flex items-center gap-1">
                                            <CalendarIcon className="h-3 w-3" />
                                            {item.date}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs font-normal flex items-center gap-1">
                                            <BuildingIcon className="h-3 w-3" />
                                            {item.mansion}
                                        </Badge>
                                    </div>
                                    <h3 className="text-lg lg:text-xl font-bold truncate group-hover:text-primary transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm lg:text-base text-muted-foreground line-clamp-1">
                                        {item.preview}
                                    </p>
                                </div>
                                <ChevronRightIcon className="h-6 w-6 text-muted-foreground shrink-0 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Card>
                    ))}
                    {/* 下部の余白 */}
                    <div className="h-8" />
                </div>
            </ScrollArea>
        </div>
    )
}
