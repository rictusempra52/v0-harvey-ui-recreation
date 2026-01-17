"use client"

import { useState, useEffect, useCallback } from "react"
import { SearchIcon, CalendarIcon, BuildingIcon, ChevronRightIcon, Loader2, Trash2Icon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import type { ChatSession, ChatMessage, MessageSource } from "@/lib/database.types"

type Message = {
    role: "user" | "assistant"
    content: string
    sources?: MessageSource[]
}

type HistoryViewProps = {
    onSelect: (messages: Message[], sessionId: string) => void
}

type SessionWithApartment = ChatSession & {
    apartments?: { name: string } | null
}

export function HistoryView({ onSelect }: HistoryViewProps) {
    const [sessions, setSessions] = useState<SessionWithApartment[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [deleting, setDeleting] = useState<string | null>(null)
    const { user } = useAuth()
    const supabase = createClient()

    const fetchSessions = useCallback(async () => {
        if (!user) return

        setLoading(true)
        const { data, error } = await supabase
            .from("chat_sessions")
            .select(`
                *,
                apartments (name)
            `)
            .order("updated_at", { ascending: false })

        if (!error && data) {
            setSessions(data)
        }
        setLoading(false)
    }, [user, supabase])

    useEffect(() => {
        fetchSessions()
    }, [fetchSessions])

    const handleSelect = async (session: SessionWithApartment) => {
        // セッションのメッセージを取得
        const { data: messagesData } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("session_id", session.id)
            .order("created_at", { ascending: true })

        if (messagesData) {
            const messages: Message[] = messagesData.map((msg: ChatMessage) => ({
                role: msg.role,
                content: msg.content,
                sources: msg.sources || undefined,
            }))
            onSelect(messages, session.id)
        }
    }

    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation()
        setDeleting(sessionId)

        const { error } = await supabase
            .from("chat_sessions")
            .delete()
            .eq("id", sessionId)

        if (!error) {
            setSessions(prev => prev.filter(s => s.id !== sessionId))
        }
        setDeleting(null)
    }

    const filteredSessions = sessions.filter(session =>
        session.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.apartments?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <div className="shrink-0 p-4 lg:p-8 border-b border-border space-y-4">
                <h2 className="text-2xl lg:text-3xl font-bold">過去の履歴</h2>
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="履歴を検索..."
                        className="pl-10 h-12 lg:h-14 text-base lg:text-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 h-full">
                <div className="p-4 lg:p-8 space-y-4 max-w-5xl mx-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {searchQuery ? "検索結果がありません" : "履歴がありません"}
                        </div>
                    ) : (
                        filteredSessions.map((session) => (
                            <Card
                                key={session.id}
                                className="p-4 lg:p-6 cursor-pointer hover:bg-accent/50 transition-colors border-border/50 group"
                                onClick={() => handleSelect(session)}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="text-xs font-normal flex items-center gap-1">
                                                <CalendarIcon className="h-3 w-3" />
                                                {formatDate(session.updated_at)}
                                            </Badge>
                                            {session.apartments?.name && (
                                                <Badge variant="secondary" className="text-xs font-normal flex items-center gap-1">
                                                    <BuildingIcon className="h-3 w-3" />
                                                    {session.apartments.name}
                                                </Badge>
                                            )}
                                        </div>
                                        <h3 className="text-lg lg:text-xl font-bold truncate group-hover:text-primary transition-colors">
                                            {session.title || "無題のチャット"}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => handleDelete(e, session.id)}
                                            disabled={deleting === session.id}
                                        >
                                            {deleting === session.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2Icon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            )}
                                        </Button>
                                        <ChevronRightIcon className="h-6 w-6 text-muted-foreground shrink-0 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                    {/* 下部の余白 */}
                    <div className="h-8" />
                </div>
            </ScrollArea>
        </div>
    )
}

