"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileTextIcon,
  MessageSquareIcon,
  MicIcon,
  SendIcon,
  ClipboardListIcon,
  MailIcon,
  UserIcon,
  FileIcon,
  HomeIcon,
  HistoryIcon,
  SettingsIcon,
} from "lucide-react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { RightPane } from "@/components/right-pane"
import { MansionSelector } from "@/components/mansion-selector"
import { HistoryView } from "@/components/history-view"


type Scenario = {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  color: string
}

type Message = {
  role: "user" | "assistant"
  content: string
  sources?: Array<{ title: string; page?: string; content?: string }>
}

export default function Dashboard() {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [selectedSource, setSelectedSource] = useState<{ title: string; content?: string } | null>(null)
  const [selectedMansion, setSelectedMansion] = useState("")
  const [currentView, setCurrentView] = useState<"home" | "history">("home")


  const scenarios: Scenario[] = [
    {
      id: "qa",
      title: "入居者対応",
      icon: <UserIcon className="h-10 w-10 sm:h-12 sm:w-12" />,
      description: "よくある質問への回答を検索",
      color: "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 border-orange-200",
    },
    {
      id: "minutes",
      title: "議事録を作成",
      icon: <ClipboardListIcon className="h-10 w-10 sm:h-12 sm:w-12" />,
      description: "理事会・総会の議事録を自動作成",
      color: "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-200",
    },
    {
      id: "notice",
      title: "回覧文を作成",
      icon: <MailIcon className="h-10 w-10 sm:h-12 sm:w-12" />,
      description: "入居者向けのお知らせを作成",
      color: "bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200",
    },
    {
      id: "document",
      title: "規約・文書を確認",
      icon: <FileIcon className="h-10 w-10 sm:h-12 sm:w-12" />,
      description: "管理規約や過去の文書を検索",
      color: "bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 border-purple-200",
    },
  ]

  const handleScenarioClick = (scenario: Scenario) => {
    const scenarioMessages: Record<string, { user: string; assistant: Message }> = {
      minutes: {
        user: "理事会の議事録を作成してください",
        assistant: {
          role: "assistant",
          content:
            "理事会の議事録を作成いたします。以下のテンプレートをご利用ください。\n\n【議事録】\n日時：令和○年○月○日\n場所：管理組合事務所\n出席者：理事長、副理事長、理事○名\n\n議題：\n1. 前回議事録の承認\n2. 収支報告\n3. その他",
          sources: [
            { title: "議事録作成マニュアル", page: "3-5ページ" },
            { title: "管理組合運営規則", page: "第12条" },
          ],
        },
      },
      notice: {
        user: "入居者向けに定期清掃のお知らせを作成してください",
        assistant: {
          role: "assistant",
          content:
            "入居者の皆様へ\n\n【定期清掃のお知らせ】\n\n日頃より管理組合の活動にご協力いただき、ありがとうございます。\n\n下記の日程で共用部分の定期清掃を実施いたします。\n\n日時：令和○年○月○日（○）午前9時～12時\n場所：エントランス、廊下、階段等\n\nご理解とご協力をお願い申し上げます。",
          sources: [{ title: "回覧文テンプレート集", page: "清掃関連" }, { title: "年間清掃計画書" }],
        },
      },
      qa: {
        user: "ゴミ出しのルールについて教えてください",
        assistant: {
          role: "assistant",
          content:
            "ゴミ出しのルールについてご案内いたします。\n\n【ゴミ出しルール】\n・可燃ゴミ：月・木曜日 朝8時まで\n・不燃ゴミ：第2・4水曜日 朝8時まで\n・資源ゴミ：毎週土曜日 朝8時まで\n\n※必ず指定のゴミ袋をご使用ください\n※分別の徹底をお願いいたします",
          sources: [{ title: "ゴミ出しルール（令和5年版）" }, { title: "管理規約", page: "第25条" }],
        },
      },
      document: {
        user: "ペット飼育に関する規約を確認したい",
        assistant: {
          role: "assistant",
          content:
            "ペット飼育に関する規約をご案内いたします。\n\n【ペット飼育規約】\n当マンションでは、以下の条件でペット飼育が可能です：\n\n1. 小型犬（体重10kg以下）または猫1匹まで\n2. 事前に管理組合への届出が必要\n3. 共用部分では必ずリードまたはケージを使用\n4. 鳴き声等で近隣に迷惑をかけないこと",
          sources: [
            { title: "ペット飼育規約", page: "全文" },
            { title: "管理規約", page: "第28条" },
            { title: "ペット飼育届出書" },
          ],
        },
      },
    }

    const messageData = scenarioMessages[scenario.id]
    if (messageData) {
      setMessages([{ role: "user", content: messageData.user }, messageData.assistant])
    }
  }

  const handleSendMessage = () => {
    if (message.trim()) {
      const newUserMessage: Message = { role: "user", content: message }
      setMessages([...messages, newUserMessage])
      setMessage("")

      // フロントエンドのみのデモレスポンス
      setTimeout(() => {
        const assistantMessage: Message = {
          role: "assistant",
          content:
            "ご質問ありがとうございます。該当する情報を確認いたしました。管理規約および過去の事例に基づき、以下の通りご案内いたします。詳細は引用元の文書をご確認ください。",
          sources: [
            {
              title: "管理規約",
              page: "関連条文",
              content:
                "【管理規約 第○条】\n専有部分の修繕等\n区分所有者は、その専有部分について、修繕、模様替え又は建物に定着する物件の取り付け若しくは取り替え（以下「修繕等」という。）を行おうとするときは、あらかじめ、理事長にその旨を申請し、書面による承認を受けなければならない。\n\n2 前項の申請には、設計図、仕様書及び工程表を添付しなければならない。",
            },
            {
              title: "過去の議事録",
              page: "令和4年度",
              content:
                "【令和4年度 第3回理事会議事録】\n議題2：専有部分のリフォーム申請について\n\n××号室より提出されたフローリング張替え工事申請について審議し、遮音等級L-45以上の製品を使用することを条件に承認することとした。",
            },
          ],
        }
        setMessages((prev) => [...prev, assistantMessage])
      }, 1000)
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      // 音声入力のデモ（フロントエンドのみ）
      setTimeout(() => {
        setMessage("駐車場の空き状況を確認したい")
        setIsRecording(false)
      }, 2000)
    }
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-dvh bg-background text-foreground">
      {/* サイドバー（デスクトップ） */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="hidden lg:flex flex-col border-r border-border bg-sidebar">
        <div className="p-6 border-b border-border">
          <h1
            className="text-2xl font-bold text-sidebar-foreground flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setMessages([])}
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
            variant={currentView === "home" ? "secondary" : "ghost"}
            className="w-full justify-start text-base h-12"
            onClick={() => setCurrentView("home")}
          >
            <HomeIcon className="h-5 w-5 mr-3" />
            ホーム
          </Button>
          <Button
            variant={currentView === "history" ? "secondary" : "ghost"}
            className="w-full justify-start text-base h-12"
            onClick={() => setCurrentView("history")}
          >
            <HistoryIcon className="h-5 w-5 mr-3" />
            過去の履歴
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
      </ResizablePanel>

      <ResizableHandle withHandle className="hidden lg:flex" />

      {/* メインコンテンツ */}
      <ResizablePanel defaultSize={55} minSize={30}>
        <main className="flex h-full flex-col overflow-hidden">
          {/* ヘッダー（モバイル） */}
          <header className="lg:hidden h-16 border-b border-border px-4 flex items-center justify-between bg-card">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <HomeIcon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold text-foreground">シメスくん</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentView(currentView === "home" ? "history" : "home")}
                title={currentView === "home" ? "履歴を表示" : "ホームに戻る"}
              >
                {currentView === "home" ? (
                  <HistoryIcon className="h-6 w-6" />
                ) : (
                  <HomeIcon className="h-6 w-6" />
                )}
              </Button>
            </div>
          </header>

          {/* チャットエリア または 履歴エリア */}
          <div className="flex-1 min-h-0 flex flex-col">
            {currentView === "home" ? (
              <>
                <ScrollArea className="flex-1 h-full p-4 pb-0 lg:p-8 lg:pb-0">
                  <div className="max-w-4xl mx-auto">
                    {messages.length === 0 ? (
                      <div className="space-y-8">
                        {/* ウェルカムメッセージ */}
                        <div className="text-center space-y-2 py-0">
                          <div className="inline-flex h-20 w-20 lg:h-24 lg:w-24 items-center justify-center rounded-2xl bg-primary/10">
                            <MessageSquareIcon className="h-10 w-10 lg:h-12 lg:w-12 text-primary" />
                          </div>
                          <h2 className="text-2xl lg:text-4xl font-bold text-foreground text-balance">
                            フロント業務をお助けします
                          </h2>
                          <p className="text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            マンション名とやりたいことを選んでみてください
                          </p>
                        </div>
                        {/* マンション選択・検索ボックス */}
                        <MansionSelector onSelect={setSelectedMansion} />


                        {/* 業務シナリオボタン */}
                        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
                          {scenarios.map((scenario) => (
                            <Card
                              key={scenario.id}
                              className={`p-6 lg:p-8 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${scenario.color} border-2`}
                              onClick={() => handleScenarioClick(scenario)}
                            >
                              <div className="flex flex-col items-start gap-4">
                                <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl bg-background/50 flex items-center justify-center">
                                  {scenario.icon}
                                </div>
                                <div>
                                  <h3 className="text-xl lg:text-2xl font-bold mb-2">{scenario.title}</h3>
                                  <p className="text-sm lg:text-base opacity-90 leading-relaxed">{scenario.description}</p>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 lg:space-y-8">
                        {messages.map((msg, idx) => (
                          <div key={idx} className={`flex gap-3 lg:gap-4 ${msg.role === "user" ? "justify-end" : ""}`}>
                            {msg.role === "assistant" && (
                              <div className="h-10 w-10 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                                <MessageSquareIcon className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                              </div>
                            )}
                            <div className={`flex-1 max-w-2xl space-y-3`}>
                              <Card
                                className={`p-4 lg:p-6 ${msg.role === "user"
                                  ? "bg-primary text-primary-foreground ml-auto"
                                  : "bg-card text-card-foreground"
                                  }`}
                              >
                                <p className="text-base lg:text-lg leading-relaxed whitespace-pre-line">{msg.content}</p>
                              </Card>
                              {/* 根拠の見える化：引用元の表示 */}
                              {msg.sources && msg.sources.length > 0 && (
                                <Card className="p-4 lg:p-5 bg-muted/50 border-l-4 border-l-primary">
                                  <p className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                                    <FileTextIcon className="h-4 w-4" />
                                    参照した文書
                                  </p>
                                  <div className="space-y-2">
                                    {msg.sources.map((source, i) => (
                                      <div
                                        key={i}
                                        className="flex items-start gap-2 text-sm lg:text-base cursor-pointer hover:bg-black/5 p-1 rounded transition-colors"
                                        onClick={() => setSelectedSource(source)}
                                      >
                                        <div className="h-5 w-5 shrink-0 rounded bg-primary/10 flex items-center justify-center mt-0.5">
                                          <span className="text-xs font-bold text-primary">{i + 1}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-foreground underline decoration-primary/30 underline-offset-4">
                                            {source.title}
                                          </span>
                                          {source.page && <span className="text-muted-foreground ml-2">（{source.page}）</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </Card>
                              )}
                            </div>
                            {msg.role === "user" && (
                              <div className="h-10 w-10 lg:h-12 lg:w-12 shrink-0 rounded-xl bg-secondary flex items-center justify-center">
                                <UserIcon className="h-5 w-5 lg:h-6 lg:w-6 text-secondary-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
                {/* 入力エリア */}
                <div className="border-t border-border p-4 lg:p-6 bg-card">
                  <div className="max-w-4xl mx-auto">
                    <div className="flex gap-2 lg:gap-3">
                      <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                        placeholder="質問を入力してください..."
                        className="flex-1 h-14 lg:h-16 text-base lg:text-lg px-4 lg:px-6"
                      />
                      <Button
                        onClick={toggleRecording}
                        size="icon"
                        variant={isRecording ? "destructive" : "secondary"}
                        className="h-14 w-14 lg:h-16 lg:w-16 shrink-0"
                        title="音声入力"
                      >
                        <MicIcon className={`h-6 w-6 lg:h-7 lg:w-7 ${isRecording ? "animate-pulse" : ""}`} />
                      </Button>
                      <Button
                        onClick={handleSendMessage}
                        size="icon"
                        className="h-14 w-14 lg:h-16 lg:w-16 shrink-0"
                        disabled={!message.trim()}
                        title="送信"
                      >
                        <SendIcon className="h-6 w-6 lg:h-7 lg:w-7" />
                      </Button>
                    </div>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-3 text-center leading-relaxed">
                      お客様へは、必ず規約や区分所有法に基づいてご回答ください。
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <HistoryView />
            )}
          </div>
        </main>
      </ResizablePanel>

      <ResizableHandle withHandle className="hidden xl:flex" />

      {/* 右サイドバー（引用表示） */}
      <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="hidden xl:flex bg-sidebar border-l border-border">
        <RightPane selectedSource={selectedSource} onClose={() => setSelectedSource(null)} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
