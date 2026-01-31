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

    // 1. ユーザーメッセージをDBに保存
    const { data: userMsg, error: userError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: currentSession.id,
        role,
        content,
        sources: sources || [],
      })
      .select()
      .single()

    if (userError || !userMsg) return null
    setMessages(prev => [...prev, userMsg])

    // セッションの updated_at とタイトルを更新
    if (messages.length === 0) {
      await supabase
        .from("chat_sessions")
        .update({ title: content.slice(0, 50) })
        .eq("id", currentSession.id)
      fetchSessions()
    }

    // 2. AIの応答を取得（roleがuserの場合のみ）
    if (role === "user") {
      setLoading(true)
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: [...messages, { role: "user", content }].map(m => ({
              role: m.role,
              content: m.content,
            })),
          }),
        })

        if (!response.ok) throw new Error("AI response failed")

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No reader available")

        let aiContent = ""
        const aiMsgPlaceholder: ChatMessage = {
          id: "temp-ai-id",
          session_id: currentSession.id,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
          sources: [],
        }
        setMessages(prev => [...prev, aiMsgPlaceholder])

        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          // Vercel AI SDK のデータ形式（0:"..."）からテキストを抽出
          const lines = chunk.split("\n")
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.slice(2))
                aiContent += text
                setMessages(prev => 
                  prev.map(m => m.id === "temp-ai-id" ? { ...m, content: aiContent } : m)
                )
              } catch (e) {
                console.error("Error parsing chunk", e)
              }
            }
          }
        }

        // AIの応答をDBに保存
        const { data: savedAiMsg } = await supabase
          .from("chat_messages")
          .insert({
            session_id: currentSession.id,
            role: "assistant",
            content: aiContent,
            sources: [],
          })
          .select()
          .single()

        if (savedAiMsg) {
          setMessages(prev => 
            prev.map(m => m.id === "temp-ai-id" ? savedAiMsg : m)
          )
        }
      } catch (error) {
        console.error("AI Error:", error)
      } finally {
        setLoading(false)
      }
    }

    return userMsg
  }, [currentSession, supabase, messages, fetchSessions])

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
