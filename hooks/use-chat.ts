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
    sources?: MessageSource[],
    sessionId?: string
  ) => {
    const targetSessionId = sessionId || currentSession?.id
    if (!targetSessionId) return null

    // 1. ユーザーメッセージをDBに保存
    const { data: userMsg, error: userError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: targetSessionId,
        role,
        content,
        sources: sources || [],
      })
      .select()
      .single()

    if (userError || !userMsg) return null
    
    // 最新のメッセージリストを生成（ステートの更新待機を回避）
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)

    if (messages.length === 0) {
      await supabase
        .from("chat_sessions")
        .update({ title: content.slice(0, 50) })
        .eq("id", targetSessionId)
    }

    // 2. AIの応答を取得（roleがuserの場合のみ）
    if (role === "user") {
      setLoading(true)
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: updatedMessages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            sessionId: targetSessionId,
          }),
        })

        console.log("Chat API Response Status:", response.status);
        console.log("Chat API Status Header:", response.headers.get("X-Chat-API-Status"));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Chat API Error Text:", errorText);
          throw new Error(`AI response failed: ${response.status}`);
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No reader available")

        let aiContent = ""
        const aiMsgPlaceholder: ChatMessage = {
          id: "temp-ai-id",
          session_id: targetSessionId,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
          sources: [],
        }
        setMessages(prev => [...prev, aiMsgPlaceholder])

        const decoder = new TextDecoder()
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // チャンクをデコードし、バッファに追加
          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          
          // 改行で分割し、完全な行だけを処理
          const lines = buffer.split("\n")
          // 最後の不完全な行をバッファに戻す
          buffer = lines.pop() || ""
          
          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue

            // Vercel AI SDK プロトコル (0:"text", 1:"...", etc)
            const colonIndex = trimmedLine.indexOf(":")
            if (colonIndex !== -1) {
              const type = trimmedLine.substring(0, colonIndex)
              const content = trimmedLine.substring(colonIndex + 1)
              
              if (type === "0") {
                try {
                  const text = JSON.parse(content)
                  aiContent += text
                } catch (e) {
                  // JSONパース失敗時はフォールバック
                  aiContent += content.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
                }
              }
            } else {
              // プロトコル形式でない場合はそのまま追加（念のため）
              aiContent += trimmedLine
            }
          }

          setMessages(prev => 
            prev.map(m => m.id === "temp-ai-id" ? { ...m, content: aiContent } : m)
          )
        }

        // ストリーム終了後の残りのバッファを処理
        if (buffer) {
          const lines = buffer.split("\n")
          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue
            const colonIndex = trimmedLine.indexOf(":")
            if (colonIndex !== -1) {
              const type = trimmedLine.substring(0, colonIndex)
              const content = trimmedLine.substring(colonIndex + 1)
              if (type === "0") {
                try {
                  const text = JSON.parse(content)
                  aiContent += text
                } catch (e) {
                  aiContent += content.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
                }
              }
            } else {
              aiContent += trimmedLine
            }
          }
        }

        // 状態を最終確定
        setMessages(prev => 
          prev.map(m => m.id === "temp-ai-id" ? { ...m, content: aiContent } : m)
        )

        // AIの応答からソース情報を抽出するパース処理（全文検索に強化）
        const extractedSources: MessageSource[] = []
        
        // 以下のパターンを全文から検索する
        // 1. [SourceID: uuid, Page: 5, Block: 10]
        // 2. (SourceID: uuid, Page: 5, Block: 10)
        // 3. ID: uuid
        const sourcePatterns = /\[?SourceID:\s*([a-f\d-]+)(?:,\s*Page:\s*(\d+))?(?:,\s*Block:\s*(\d+))?\]?/gi
        const matches = Array.from(aiContent.matchAll(sourcePatterns))
        
        matches.forEach(match => {
          const fileId = match[1]
          const page = match[2]
          const blockId = match[3]
          
          // 重複チェック
          if (!extractedSources.some(s => s.fileId === fileId && s.page === page && s.blockId === blockId)) {
            extractedSources.push({
              title: "参照資料", // タイトルは後で補完されるか、汎用名を使用
              fileId,
              page,
              blockId
            })
          }
        })

        // 従来の「参考資料:」セクションがある場合の補完処理 (タイトル取得のため)
        const sourceMatch = aiContent.match(/(?:^|\n)(?:#+\s*)?参考資料[:：]?\s*([\s\S]*)$/)
        if (sourceMatch && sourceMatch[1]) {
          const lines = sourceMatch[1].split("\n")
          lines.forEach(line => {
            const trimmedLine = line.trim()
            if (!trimmedLine) return
            const docMatch = trimmedLine.match(/^[*・-]\s*(?:\[(.*?)\]|(.*?))(?:\s*\((.*?)\))/)
            if (docMatch) {
              const title = (docMatch[1] || docMatch[2] || "").trim()
              const extra = docMatch[3] || ""
              const idMatch = extra.match(/(?:Source)?ID:\s*([a-f\d-]+)/i)
              if (idMatch) {
                // すでに抽出済みのソースがあればタイトルを更新
                const existing = extractedSources.find(s => s.fileId === idMatch[1])
                if (existing) {
                  existing.title = title
                } else {
                  extractedSources.push({
                    title,
                    fileId: idMatch[1],
                    page: (extra.match(/Page:\s*(\d+)/i) || [])[1],
                    blockId: (extra.match(/Block:\s*(\d+)/i) || [])[1],
                  })
                }
              }
            }
          })
        }
        console.log("Extracted sources strategy final:", extractedSources)

        // AIの応答をDBに保存
        const { data: savedAiMsg, error: saveError } = await supabase
          .from("chat_messages")
          .insert({
            session_id: targetSessionId,
            role: "assistant",
            content: aiContent,
            sources: extractedSources,
          })
          .select()
          .single()

        if (saveError) {
          console.error("Failed to save AI message:", saveError)
        }

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
