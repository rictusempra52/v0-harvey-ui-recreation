"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

interface PdfViewerProps {
    url: string
    highlightText?: string
    annotations?: any[]
    fileId?: string
}

declare global {
    interface Window {
        AdobeDC: any
    }
}

export function PdfViewer({ url, highlightText, annotations, fileId = "example-pdf-id" }: PdfViewerProps) {
    /**
     * PDFを表示するための領域（HTML要素）を直接操作するための変数です。
     */
    const divRef = useRef<HTMLDivElement>(null)

    /**
     * Adobe PDF Viewerの本体（インスタンス）を保存しておくための変数です。
     * 表示した後のPDFをプログラムから操作（検索や注釈追加など）する場合に使用します。
     */
    const viewerRef = useRef<any>(null)

    // 複数のビューワーが同時に存在しても衝突しないように、一意のIDを生成します。
    const viewerId = useRef(`adobe-pdf-viewer-${Math.random().toString(36).substr(2, 9)}`)

    // コンポーネントが表示された時や、URL・検索文字が変わった時に実行される処理です。
    useEffect(() => {
        const container = divRef.current;

        /**PDFビューワーを初期化して表示する関数です。*/
        const initPDF = () => {
            // Adobeの準備ができていない、または表示場所が見つからない場合は何もしません。
            if (!window.AdobeDC || !container) return

            // 前の表示内容が残っている場合はクリアします。
            container.innerHTML = "";

            // Adobe Embed APIを使用するためのクライアントIDを環境変数から取得します。
            const clientId = process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID
            if (!clientId) {
                console.warn("Adobe Client ID is missing. Please set NEXT_PUBLIC_ADOBE_CLIENT_ID in .env.local")
                return
            }

            // Adobeビューワーの基本設定（どのIDの要素に表示するかなど）を行います。
            const adobeDCView = new window.AdobeDC.View({
                clientId: clientId,
                divId: viewerId.current,
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
                        id: fileId      // ファイルを識別するID
                    },
                },
                previewConfig
            )

            // PDFの表示が完了した後の処理です。
            previewPromise.then((adobeViewer: any) => {
                // 後で操作できるようにビューワーのインスタンスを保存します。
                viewerRef.current = adobeViewer

                // --- 注釈（ハイライト）を自動で追加する処理 ---
                if (annotations && annotations.length > 0) {
                    adobeViewer.getAnnotationManager().then((annotationManager: any) => {
                        // アノテーションに現在のfileIdをセットする
                        const updatedAnnotations = annotations.map(anno => ({
                            ...anno,
                            target: {
                                ...anno.target,
                                source: fileId
                            }
                        }))

                        // 定義したハイライトをPDF上に追加します。
                        annotationManager.addAnnotations(updatedAnnotations)
                            .then(() => console.log("Annotations added successfully"))
                            .catch((err: any) => console.error("Failed to add annotations:", err))
                    })
                }

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
            // Cleanup container
            if (container) {
                container.innerHTML = "";
            }
        }
    }, [url, highlightText, annotations, fileId]) // 全ての関連プロップを依存関係に含めます。

    return (
        <>
            {/* Adobe PDF Embed APIの本体プログラムを外部から読み込みます。 */}
            <Script
                src="https://documentcloud.adobe.com/view-sdk/main.js"
                strategy="lazyOnload"
            />
            {/* ここにPDFが表示されます。CSSでサイズをいっぱいに広げています。 */}
            <div id={viewerId.current} ref={divRef} className="h-full w-full" />
        </>
    )
}
