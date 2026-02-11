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

            // デバックログ: 受信チャンク
            console.log("▼ Received Stream Line:", trimmedLine.substring(0, 100))

            if (trimmedLine.startsWith('0:')) { // オブジェクトの断片（AI SDK形式）
              const content = trimmedLine.substring(2)
              console.log("▼ DEBUG Content (0:):", content)
              // AI SDK の JSON 文字列断片は、エスケープされた引用符を含む場合がある
              try {
                const text = JSON.parse(content)
                aiContent += text
                console.log("▼ DEBUG aiContent after parse:", aiContent.substring(aiContent.length - 50))
              } catch (e) {
                aiContent += content
                console.log("▼ DEBUG aiContent after fallback:", aiContent.substring(aiContent.length - 50))
              }
            } else if (trimmedLine.startsWith('e:')) {
              console.log("Stream Finish Event:", trimmedLine)
            } else if (trimmedLine.startsWith('d:')) {
              console.log("Usage Data received:", trimmedLine)
            } else {
              // プレフィックスがない直接的なJSON断片の場合（稀）
              aiContent += trimmedLine
            }
          }

          setMessages(prev => 
            prev.map(m => {
              if (m.id !== "temp-ai-id") return m;
              
              let displayContent = aiContent;
              // JSON文字列の中から answer プロパティの値を抽出する
              // 例: {"answer": "こんにちは...
              const answerMatch = aiContent.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)/);
              if (answerMatch) {
                displayContent = answerMatch[1]
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                  .replace(/\\r/g, '\r')
                  .replace(/\\t/g, '\t');
              }
              
              return { ...m, content: displayContent };
            })
          )
        }

        // 状態を最終確定（この時点で aiContent は完全な JSON のはず）
        let finalAnswer = aiContent;
        let extractedSources: MessageSource[] = [];

        try {
          // JSON としてパース。失敗に備えて何重にもチェック。
          let cleanJson = aiContent.trim();
          // AI SDK の断片が残っている場合（稀）に備えてクリーンアップ
          if (!cleanJson.startsWith('{')) {
            const firstBrace = cleanJson.indexOf('{');
            if (firstBrace !== -1) cleanJson = cleanJson.substring(firstBrace);
          }
          if (!cleanJson.endsWith('}')) {
            const lastBrace = cleanJson.lastIndexOf('}');
            if (lastBrace !== -1) cleanJson = cleanJson.substring(0, lastBrace + 1);
          }

          const parsed = JSON.parse(cleanJson);
          if (parsed && typeof parsed === 'object') {
            finalAnswer = parsed.answer || aiContent;
            if (Array.isArray(parsed.sources)) {
              extractedSources = parsed.sources.map((s: any) => ({
                title: s.title || "参照資料",
                fileId: s.fileId,
                page: s.page?.toString(),
                blockId: s.blockId?.toString(),
                citation: s.citation
              }));
            }
          }
        } catch (e) {
          console.log("Final JSON parse failed, falling back to manual extraction:", e);
          // フォールバック: JSONの崩れを考慮して answer 部分を正規表現で救出
          const answerMatch = aiContent.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)/);
          if (answerMatch) {
            finalAnswer = answerMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }

          // ソース情報も正規表現で抽出を試みる
          const sourcePatterns = /\[?SourceID:\s*([a-f\d-]+)(?:,\s*Page:\s*(\d+))?(?:,\s*Block:\s*(\d+))?\]?/gi
          const matches = Array.from(aiContent.matchAll(sourcePatterns))
          
          matches.forEach(match => {
            const fileId = match[1]
            const page = match[2]
            const blockId = match[3]
            if (!extractedSources.some(s => s.fileId === fileId && s.page === page && s.blockId === blockId)) {
              extractedSources.push({
                title: "参照資料",
                fileId,
                page,
                blockId
              })
            }
          })
        }

        console.log("Extracted sources strategy final:", extractedSources)

        // UI表示用のテキストを更新（JSONの生データではなく answer のみを表示）
        setMessages(prev => 
          prev.map(m => m.id === "temp-ai-id" ? { ...m, content: finalAnswer, sources: extractedSources } : m)
        )

        // AIの応答をDBに保存
        const { data: savedAiMsg, error: saveError } = await supabase
          .from("chat_messages")
          .insert({
            session_id: targetSessionId,
            role: "assistant",
            content: finalAnswer,
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
