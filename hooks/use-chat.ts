"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import type { ChatSession, ChatMessage, MessageSource } from "@/lib/database.types"

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createClient()

  // セッション一覧を取得
  const fetchSessions = useCallback(async () => {
    if (!user) return

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false })

    if (!error && data) {
      setSessions(data)
    }
  }, [user, supabase])

  // 新しいセッションを作成
  const createSession = useCallback(async (apartmentId?: string, title?: string) => {
    if (!user) return null

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        apartment_id: apartmentId || null,
        title: title || "新しいチャット",
      })
      .select()
      .single()

    if (!error && data) {
      setSessions(prev => [data, ...prev])
      setCurrentSession(data)
      setMessages([])
      return data
    }
    return null
  }, [user, supabase])

  // セッションを選択してメッセージを取得
  const selectSession = useCallback(async (sessionId: string) => {
    setLoading(true)
    
    const { data: sessionData } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    if (sessionData) {
      setCurrentSession(sessionData)
    }

    const { data: messagesData } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })

    if (messagesData) {
      setMessages(messagesData)
    }

    setLoading(false)
  }, [supabase])

  // メッセージを送信
  const sendMessage = useCallback(async (
    content: string,
    role: "user" | "assistant",
    sources?: MessageSource[]
  ) => {
    if (!currentSession) return null

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        session_id: currentSession.id,
        role,
        content,
        sources: sources || [],
      })
      .select()
      .single()

    if (!error && data) {
      setMessages(prev => [...prev, data])

      // セッションの updated_at を更新
      await supabase
        .from("chat_sessions")
        .update({ title: content.slice(0, 50) })
        .eq("id", currentSession.id)

      return data
    }
    return null
  }, [currentSession, supabase])

  // セッションを削除
  const deleteSession = useCallback(async (sessionId: string) => {
    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId)

    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (currentSession?.id === sessionId) {
        setCurrentSession(null)
        setMessages([])
      }
    }
  }, [supabase, currentSession])

  // 初回ロード時にセッション一覧を取得
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  return {
    sessions,
    currentSession,
    messages,
    loading,
    fetchSessions,
    createSession,
    selectSession,
    sendMessage,
    deleteSession,
    setCurrentSession,
    setMessages,
  }
}
