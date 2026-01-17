"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, Lock, LogIn, UserPlus, AlertCircle } from "lucide-react"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSignUp, setIsSignUp] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const { signIn, signUp } = useAuth()
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccessMessage(null)

        try {
            if (isSignUp) {
                const { error } = await signUp(email, password)
                if (error) {
                    // エラーメッセージを日本語に変換
                    if (error.message.includes("already registered")) {
                        setError("このメールアドレスは既に登録されています")
                    } else if (error.message.includes("password")) {
                        setError("パスワードは6文字以上で入力してください")
                    } else {
                        setError(`登録エラー: ${error.message}`)
                    }
                } else {
                    setSuccessMessage("確認メールを送信しました。メールを確認してください。")
                }
            } else {
                const { error } = await signIn(email, password)
                if (error) {
                    if (error.message.includes("Invalid login")) {
                        setError("メールアドレスまたはパスワードが正しくありません")
                    } else {
                        setError(`ログインエラー: ${error.message}`)
                    }
                } else {
                    router.push("/")
                    router.refresh()
                }
            }
        } catch (err) {
            setError("予期せぬエラーが発生しました。もう一度お試しください。")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-2xl lg:text-3xl font-bold">
                        マンション管理アシスタント
                    </CardTitle>
                    <CardDescription className="text-base lg:text-lg">
                        {isSignUp ? "新規アカウントを作成" : "アカウントにログイン"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* エラーメッセージ */}
                        {error && (
                            <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p className="text-sm lg:text-base">{error}</p>
                            </div>
                        )}

                        {/* 成功メッセージ */}
                        {successMessage && (
                            <div className="p-4 bg-green-500/10 text-green-600 rounded-lg">
                                <p className="text-sm lg:text-base">{successMessage}</p>
                            </div>
                        )}

                        {/* メールアドレス */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-base lg:text-lg font-medium">
                                メールアドレス
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="example@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-12 lg:h-14 text-base lg:text-lg"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* パスワード */}
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-base lg:text-lg font-medium">
                                パスワード
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-12 lg:h-14 text-base lg:text-lg"
                                    required
                                    minLength={6}
                                    disabled={isLoading}
                                />
                            </div>
                            {isSignUp && (
                                <p className="text-sm text-muted-foreground">
                                    6文字以上のパスワードを入力してください
                                </p>
                            )}
                        </div>

                        {/* 送信ボタン */}
                        <Button
                            type="submit"
                            className="w-full h-12 lg:h-14 text-base lg:text-lg font-medium"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    処理中...
                                </>
                            ) : isSignUp ? (
                                <>
                                    <UserPlus className="mr-2 h-5 w-5" />
                                    アカウント作成
                                </>
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-5 w-5" />
                                    ログイン
                                </>
                            )}
                        </Button>

                        {/* 切り替えリンク */}
                        <div className="text-center pt-4 border-t">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp)
                                    setError(null)
                                    setSuccessMessage(null)
                                }}
                                className="text-base lg:text-lg text-primary hover:underline"
                                disabled={isLoading}
                            >
                                {isSignUp
                                    ? "すでにアカウントをお持ちの方はこちら"
                                    : "新規登録はこちら"}
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
