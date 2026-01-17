"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

interface PdfViewerProps {
    url: string
    highlightText?: string
}

declare global {
    interface Window {
        AdobeDC: any
    }
}

export function PdfViewer({ url, highlightText }: PdfViewerProps) {
    /**
     * PDFを表示するための領域（HTML要素）を直接操作するための変数です。
     */
    const divRef = useRef<HTMLDivElement>(null)

    /**
     * Adobe PDF Viewerの本体（インスタンス）を保存しておくための変数です。
     * 表示した後のPDFをプログラムから操作（検索や注釈追加など）する場合に使用します。
     */
    const viewerRef = useRef<any>(null)

    // コンポーネントが表示された時や、URL・検索文字が変わった時に実行される処理です。
    useEffect(() => {
        /**PDFビューワーを初期化して表示する関数です。*/
        const initPDF = () => {
            // Adobeの準備ができていない、または表示場所が見つからない場合は何もしません。
            if (!window.AdobeDC || !divRef.current) return

            // Adobe Embed APIを使用するためのクライアントIDを環境変数から取得します。
            const clientId = process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID
            if (!clientId) {
                console.warn("Adobe Client ID is missing. Please set NEXT_PUBLIC_ADOBE_CLIENT_ID in .env.local")
                return
            }

            // Adobeビューワーの基本設定（どのIDの要素に表示するかなど）を行います。
            const adobeDCView = new window.AdobeDC.View({
                clientId: clientId,
                divId: "adobe-pdf-viewer", // 下のdivタグのIDと一致させる必要があります。
            })

            // ビューワーの見た目や機能（検索、注釈、印刷禁止など）を細かく設定します。
            const previewConfig = {
                enableSearchAPIs: true,      // 検索機能を使えるようにする
                embedMode: "FULL_WINDOW", // フルウィンドウモードで表示する
                showAnnotationTools: true,   // 注釈ツールを表示する
                enableAnnotationAPIs: true,  // プログラムから注釈を操作できるようにする
                showDownloadPDF: true,      // ダウンロードボタンを表示する
                showPrintPDF: true,         // 印刷ボタンを表示する
            }

            // 実際にPDFファイルを読み込んで表示します。
            const previewPromise = adobeDCView.previewFile(
                {
                    content: { location: { url: url } }, // 表示するPDFのURL
                    metaData: {
                        fileName: "Document.pdf", // ファイル名（表示用）
                        id: "example-pdf-id"      // ファイルを識別するID
                    },
                },
                previewConfig
            )

            // PDFの表示が完了した後の処理です。
            previewPromise.then((adobeViewer: any) => {
                // 後で操作できるようにビューワーのインスタンスを保存します。
                viewerRef.current = adobeViewer

                // --- 注釈（ハイライト）を自動で追加する処理 ---
                adobeViewer.getAnnotationManager().then((annotationManager: any) => {
                    // 追加するハイライトの情報（位置や色など）を定義します。
                    const dummyAnnotation = {
                        "@context": [
                            "https://www.w3.org/ns/anno.jsonld",
                            "https://comments.acrobat.com/ns/anno.jsonld"
                        ],
                        type: "Annotation",
                        id: "dummy-highlight-001",
                        bodyValue: "これは自動生成されたハイライトです",
                        motivation: "commenting",
                        target: {
                            source: "example-pdf-id",
                            selector: {
                                type: "AdobeAnnoSelector",
                                subtype: "highlight",
                                node: { index: 0 }, // 1ページ目
                                boundingBox: [50, 100, 250, 120], // 四角形の範囲
                                quadPoints: [50, 120, 250, 120, 50, 100, 250, 100], // 描画ポイント
                                strokeColor: "#ffff00" // ハイライトの色（黄色）
                            }
                        },
                        creator: {
                            type: "Person",
                            name: "Assistant"
                        },
                        created: new Date().toISOString(),
                        modified: new Date().toISOString()
                    }

                    // 定義したハイライトをPDF上に追加します。
                    annotationManager.addAnnotations([dummyAnnotation])
                        .then(() => console.log("Dummy annotation added successfully"))
                        .catch((err: any) => console.error("Failed to add annotation:", err))
                })

                // --- 指定されたテキストを検索してハイライトする処理 ---
                if (highlightText) {
                    adobeViewer.getAPIs().then((apis: any) => {
                        const searchApis = apis.getSearchAPIs()
                        // 指定された文字を検索します。
                        searchApis.search(highlightText)
                            .then((res: any) => {
                                console.log("Search result:", res)
                            })
                            .catch((err: any) => {
                                console.error("Search error:", err)
                            })
                    })
                }
            })
        }

        // AdobeのSDKが既に読み込まれているか確認し、初期化を開始します。
        if (window.AdobeDC) {
            initPDF()
        } else {
            // まだ読み込まれていない場合は、準備完了イベントを待ってから初期化します。
            document.addEventListener("adobe_dc_view_sdk.ready", initPDF)
        }

        // コンポーネントが消える時に、イベントリスナーを解除してメモリ漏れを防ぎます。
        return () => {
            document.removeEventListener("adobe_dc_view_sdk.ready", initPDF)
        }
    }, [url, highlightText]) // URLや検索文字が変わるたびにこの中の処理が再実行されます。

    return (
        <>
            {/* Adobe PDF Embed APIの本体プログラムを外部から読み込みます。 */}
            <Script
                src="https://documentcloud.adobe.com/view-sdk/main.js"
                strategy="lazyOnload"
            />
            {/* ここにPDFが表示されます。CSSでサイズをいっぱいに広げています。 */}
            <div id="adobe-pdf-viewer" ref={divRef} className="h-full w-full" />
        </>
    )
}
