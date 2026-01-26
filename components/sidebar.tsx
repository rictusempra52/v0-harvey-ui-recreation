"use client"

import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    HomeIcon,
    HistoryIcon,
    FileIcon,
    SettingsIcon,
} from "lucide-react"

interface SidebarProps {
    currentView?: "home" | "history"
    onViewChange?: (view: "home" | "history") => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
    const router = useRouter()
    const pathname = usePathname()

    const handleHomeClick = () => {
        if (pathname === "/") {
            onViewChange?.("home")
        } else {
            router.push("/")
        }
    }

    const handleHistoryClick = () => {
        if (pathname === "/") {
            onViewChange?.("history")
        } else {
            router.push("/?view=history")
        }
    }

    const handleDocumentsClick = () => {
        router.push("/documents")
    }

    return (
        <div className="flex flex-col h-full bg-sidebar">
            <div className="p-6 border-b border-border">
                <h1
                    className="text-2xl font-bold text-sidebar-foreground flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                        if (pathname === "/") {
                            // ホーム画面にいる場合はメッセージをクリア（元の実装を尊重）
                            window.location.href = "/"
                        } else {
                            router.push("/")
                        }
                    }}
                >
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                        <HomeIcon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    シメスくん
                </h1>
                <p className="text-sm text-muted-foreground mt-1">マンション管理AIアシスタント</p>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                <Button
                    variant={pathname === "/" && currentView === "home" ? "secondary" : "ghost"}
                    className="w-full justify-start text-base h-12"
                    onClick={handleHomeClick}
                >
                    <HomeIcon className="h-5 w-5 mr-3" />
                    ホーム
                </Button>
                <Button
                    variant={pathname === "/" && currentView === "history" ? "secondary" : "ghost"}
                    className="w-full justify-start text-base h-12"
                    onClick={handleHistoryClick}
                >
                    <HistoryIcon className="h-5 w-5 mr-3" />
                    過去の履歴
                </Button>
                <Button
                    variant={pathname === "/documents" ? "secondary" : "ghost"}
                    className="w-full justify-start text-base h-12"
                    onClick={handleDocumentsClick}
                >
                    <FileIcon className="h-5 w-5 mr-3" />
                    文書管理
                </Button>
                <Button variant="ghost" className="w-full justify-start text-base h-12">
                    <SettingsIcon className="h-5 w-5 mr-3" />
                    設定
                </Button>
            </nav>
            <div className="p-4 border-t border-border">
                <Card className="p-4 bg-primary/5 border-primary/20">
                    <p className="text-sm text-foreground font-medium mb-1">使い方ガイド</p>
                    <p className="text-xs text-muted-foreground">大きなボタンをタップするか、マイクボタンで音声入力できます</p>
                </Card>
            </div>
        </div>
    )
}
